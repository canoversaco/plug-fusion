import { Router } from 'express'
import { query } from '../db/index.js'
const r = Router()

function parseUser(req){
  if (req.user) return req.user
  const a=req.headers?.authorization||''
  if(!a.startsWith('Bearer ')) return null
  try{
    const p=JSON.parse(Buffer.from(a.slice(7).split('.')[1],'base64url').toString('utf8'))
    return { id:p.sub??p.id, username:p.username, role:p.role||'user' }
  }catch{ return null }
}
const withAuth=(req,res,next)=>{ const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next() }

function dk(a,b){ const x=[String(a||'').toLowerCase(), String(b||'').toLowerCase()].sort(); return x[0]+'|'+x[1] }

async function createOrderConversation(orderId, customer, courier, creator){
  await query(`INSERT OR IGNORE INTO conversations(type,title,order_id,created_by) VALUES('order', ?, ?, ?)`, [`Order #${orderId}`, orderId, creator])
  const cid = (await query(`SELECT id FROM conversations WHERE order_id=?`, [orderId])).rows?.[0]?.id
  if(!cid) return null
  await query(`INSERT OR IGNORE INTO conversation_participants(conversation_id,username) VALUES(?,?)`,[cid, customer])
  await query(`INSERT OR IGNORE INTO conversation_participants(conversation_id,username) VALUES(?,?)`,[cid, courier])
  return cid
}

r.get('/chat/my', withAuth, async (req,res)=>{
  const rows = (await query(
    `SELECT DISTINCT c.id, c.type, c.title, c.order_id,
            (SELECT text FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
            (SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_ts
       FROM conversations c
       JOIN conversation_participants p ON p.conversation_id=c.id
      WHERE p.username=?
      ORDER BY IFNULL(last_ts, c.created_at) DESC, c.id DESC`, [req.user.username]
  )).rows || []
  res.json({ conversations: rows })
})

r.post('/chat/start/admin', withAuth, async (req,res)=>{
  const admin = (await query(`SELECT username FROM users WHERE role='admin' ORDER BY id ASC LIMIT 1`,[])).rows?.[0]?.username
  if(!admin) return res.status(400).json({error:'no_admin'})
  const key = dk(req.user.username, admin)
  await query(`INSERT OR IGNORE INTO conversations(type,title,direct_key,created_by) VALUES('direct', ?, ?, ?)`,
              [`${req.user.username} ↔ ${admin}`, key, req.user.username])
  const cid = (await query(`SELECT id FROM conversations WHERE direct_key=?`,[key])).rows?.[0]?.id
  await query(`INSERT OR IGNORE INTO conversation_participants(conversation_id,username) VALUES(?,?)`,[cid, req.user.username])
  await query(`INSERT OR IGNORE INTO conversation_participants(conversation_id,username) VALUES(?,?)`,[cid, admin])
  res.json({ ok:true, conversation_id: cid })
})

r.post('/chat/start/with', withAuth, async (req,res)=>{
  const target = String(req.body?.username||'').trim()
  if(!target) return res.status(400).json({error:'missing_username'})
  const key = dk(req.user.username, target)
  await query(`INSERT OR IGNORE INTO conversations(type,title,direct_key,created_by) VALUES('direct', ?, ?, ?)`,
              [`${req.user.username} ↔ ${target}`, key, req.user.username])
  const cid = (await query(`SELECT id FROM conversations WHERE direct_key=?`,[key])).rows?.[0]?.id
  await query(`INSERT OR IGNORE INTO conversation_participants(conversation_id,username) VALUES(?,?)`,[cid, req.user.username])
  await query(`INSERT OR IGNORE INTO conversation_participants(conversation_id,username) VALUES(?,?)`,[cid, target])
  res.json({ ok:true, conversation_id: cid })
})

r.get('/chat/:cid/messages', withAuth, async (req,res)=>{
  const cid = Number(req.params.cid)
  const isPart = (await query(`SELECT 1 FROM conversation_participants WHERE conversation_id=? AND username=?`,[cid, req.user.username])).rows?.length>0
  if(!isPart) return res.status(403).json({error:'forbidden'})
  const rows = (await query(`SELECT id, sender_username AS sender, text, created_at FROM messages WHERE conversation_id=? ORDER BY id ASC LIMIT 300`,[cid])).rows||[]
  res.json({ messages: rows })
})
r.post('/chat/:cid/message', withAuth, async (req,res)=>{
  const cid = Number(req.params.cid)
  const txt = String(req.body?.text||'').trim()
  if(!txt) return res.status(400).json({error:'empty'})
  const isPart = (await query(`SELECT 1 FROM conversation_participants WHERE conversation_id=? AND username=?`,[cid, req.user.username])).rows?.length>0
  if(!isPart) return res.status(403).json({error:'forbidden'})
  await query(`INSERT INTO messages(conversation_id, sender_username, text) VALUES(?,?,?)`,[cid, req.user.username, txt])
  res.json({ ok:true })
})

r.get('/chat/order/:oid', withAuth, async (req,res)=>{
  const oid = Number(req.params.oid)
  const o = (await query(`SELECT * FROM orders WHERE id=?`,[oid])).rows?.[0]
  if(!o) return res.status(404).json({error:'not_found'})
  const u = req.user
  if(!(u.role==='admin' || o.user_username===u.username || o.courier_username===u.username)){
    return res.status(403).json({error:'forbidden'})
  }
  const items = (await query(`SELECT product_id,name,price_cents,qty,grams FROM order_items WHERE order_id=?`,[oid])).rows||[]
  res.json({ order:o, items })
})

export default r
