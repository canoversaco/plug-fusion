import { Router } from 'express'
import { query } from '../db/index.js'
import crypto from 'crypto'

const r = Router()

/** ====== Auth Helpers (JWT ohne verify – wir lesen Claims) ====== */
function parseUserFromAuth(header){
  if (!header || !header.startsWith('Bearer ')) return null
  try{
    const payload = JSON.parse(Buffer.from(header.slice(7).split('.')[1], 'base64url').toString('utf8'))
    return { id: payload.sub ?? payload.id, username: payload.username, role: payload.role || 'user' }
  }catch{ return null }
}
function parseUser(req){
  if (req.user) return req.user
  const h = req.headers?.authorization
  return parseUserFromAuth(h)
}
const withAuth = (req,res,next)=>{ const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next() }
const isCourier = (u)=> u && (u.role==='courier' || u.role==='admin')

/** ====== Chat Verschlüsselung am Server (At-Rest) ====== */
const CHAT_SECRET = process.env.CHAT_SECRET || 'dev-chat-secret'
function enc(text){
  const iv = crypto.randomBytes(12)
  const key = crypto.createHash('sha256').update(CHAT_SECRET).digest()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(text,'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${ct.toString('base64url')}.${tag.toString('base64url')}`
}
function dec(cipherText){
  try{
    const [ivB64, ctB64, tagB64] = String(cipherText).split('.')
    const iv = Buffer.from(ivB64, 'base64url')
    const ct = Buffer.from(ctB64, 'base64url')
    const tag = Buffer.from(tagB64, 'base64url')
    const key = crypto.createHash('sha256').update(CHAT_SECRET).digest()
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv)
    d.setAuthTag(tag)
    const pt = Buffer.concat([d.update(ct), d.final()])
    return pt.toString('utf8')
  }catch{ return '' }
}

/** ====== SSE Streams für Live-Tracking ====== */
const streams = new Map() // orderId -> Set(res)

function pushUpdate(orderId, payload){
  const set = streams.get(Number(orderId))
  if (!set) return
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const res of set) {
    try{ res.write(data) }catch{}
  }
}
function authOrderAccess(u, orderRow, allowCourier=true){
  if (!orderRow) return false
  if (u.role==='admin') return true
  if (allowCourier && isCourier(u) && orderRow.courier_username && orderRow.courier_username===u.username) return true
  if (orderRow.user_username && orderRow.user_username===u.username) return true
  return false
}

/** ====== Kunde: Liste + Details ====== */
r.get('/my/orders', withAuth, async (req,res)=>{
  const rows = (await query(
    `SELECT id, status, total_cents, mode, eta_minutes, courier_username, created_at, updated_at
     FROM orders WHERE user_username=? ORDER BY id DESC LIMIT 100`, [req.user.username]
  )).rows || []
  res.json({ orders: rows })
})

r.get('/my/orders/:id', withAuth, async (req,res)=>{
  const oid = Number(req.params.id)
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!authOrderAccess(req.user, o, true)) return res.status(403).json({error:'forbidden'})
  const items = (await query(`SELECT product_id, name, qty, price_cents, grams FROM order_items WHERE order_id=?`, [oid])).rows || []
  const history = (await query(`SELECT status, eta_minutes, lat, lng, note, created_at FROM order_tracking WHERE order_id=? ORDER BY id DESC LIMIT 50`, [oid])).rows || []
  res.json({ order: o, items, history })
})

r.post('/my/orders/:id/cancel', withAuth, async (req,res)=>{
  const oid = Number(req.params.id)
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!authOrderAccess(req.user, o, false)) return res.status(403).json({error:'forbidden'})
  if (!o || !['wartet_bestätigung','angenommen'].includes(o.status)) return res.status(400).json({error:'cannot_cancel'})
  await query(`UPDATE orders SET status='storniert', updated_at=datetime('now') WHERE id=?`, [oid])
  await query(`INSERT INTO order_tracking(order_id,status,note) VALUES(?, 'storniert','vom Kunden storniert')`, [oid])
  pushUpdate(oid, { kind:'status', status:'storniert' })
  res.json({ ok:true })
})

/** ====== SSE-Stream: Kunde & zugewiesener Kurier (oder Admin) ====== */
r.get('/orders/:id/stream', async (req,res)=>{
  // Token per Header ODER ?t=...
  const token = req.headers?.authorization?.startsWith('Bearer ')
    ? req.headers.authorization
    : (req.query?.t ? `Bearer ${req.query.t}` : null)
  const user = parseUserFromAuth(token)
  if (!user) return res.status(401).end()

  const oid = Number(req.params.id)
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!authOrderAccess(user, o, true)) return res.status(403).end()

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control':'no-cache',
    'Connection':'keep-alive',
    'Access-Control-Allow-Origin':'*'
  })
  res.write(`retry: 5000\n\n`)

  if (!streams.has(oid)) streams.set(oid, new Set())
  streams.get(oid).add(res)

  // Initialsnapshot
  const hist = (await query(`SELECT status, eta_minutes, lat, lng, note, created_at FROM order_tracking WHERE order_id=? ORDER BY id DESC LIMIT 1`, [oid])).rows?.[0]
  res.write(`data: ${JSON.stringify({ kind:'hello', order_id: oid, status: o.status, eta_minutes: o.eta_minutes, courier: o.courier_username, last: hist||null })}\n\n`)

  const ping = setInterval(()=>{ try{ res.write(':\n\n') }catch{} }, 25000)

  req.on('close', ()=>{
    clearInterval(ping)
    const set = streams.get(oid)
    if (set){ set.delete(res); if (set.size===0) streams.delete(oid) }
  })
})

/** ====== Chat: Kunde & Kurier & Admin ====== */
r.get('/orders/:id/messages', withAuth, async (req,res)=>{
  const oid = Number(req.params.id)
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!authOrderAccess(req.user, o, true)) return res.status(403).json({error:'forbidden'})
  const rows = (await query(`SELECT id, sender_username, cipher, created_at FROM order_messages WHERE order_id=? ORDER BY id DESC LIMIT 100`, [oid])).rows || []
  const messages = rows.map(m=>({ id:m.id, sender_username:m.sender_username, text: dec(m.cipher), created_at:m.created_at }))
  res.json({ messages })
})
r.post('/orders/:id/messages', withAuth, async (req,res)=>{
  const oid = Number(req.params.id)
  const { text } = req.body||{}
  if (!text || !String(text).trim()) return res.status(400).json({error:'empty'})
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!authOrderAccess(req.user, o, true)) return res.status(403).json({error:'forbidden'})
  const c = enc(String(text))
  await query(`INSERT INTO order_messages(order_id,sender_username,cipher) VALUES(?,?,?)`, [oid, req.user.username, c])
  pushUpdate(oid, { kind:'message', from:req.user.username })
  res.json({ ok:true })
})

/** ====== Kurier: verfügbare Aufträge, claimen, Status/ETA/Location ====== */
r.get('/courier/orders', withAuth, async (req,res)=>{
  if (!isCourier(req.user)) return res.status(403).json({error:'forbidden'})
  const onlyMine = req.query.mine==='1'
  let rows
  if (onlyMine){
    rows = (await query(`SELECT * FROM orders WHERE courier_username=? AND status IN ('angenommen','unterwegs','angekommen') ORDER BY id DESC`, [req.user.username])).rows || []
  }else{
    rows = (await query(`SELECT * FROM orders WHERE status IN ('wartet_bestätigung','angenommen','unterwegs','angekommen') AND (courier_username IS NULL OR courier_username='' OR courier_username=?) ORDER BY id ASC`, [req.user.username])).rows || []
  }
  res.json({ orders: rows })
})

r.post('/courier/orders/:id/claim', withAuth, async (req,res)=>{
  if (!isCourier(req.user)) return res.status(403).json({error:'forbidden'})
  const oid = Number(req.params.id)
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!o || !['wartet_bestätigung','angenommen'].includes(o.status) || (o.courier_username && o.courier_username!==req.user.username))
    return res.status(400).json({error:'cannot_claim'})
  // auf 'angenommen' setzen und Kurier hinterlegen
  await query(`UPDATE orders SET courier_username=?, status='angenommen', updated_at=datetime('now') WHERE id=?`, [req.user.username, oid])
  await query(`INSERT INTO order_tracking(order_id,status,note) VALUES(?, 'angenommen','Kurier hat übernommen')`, [oid])
  pushUpdate(oid, { kind:'status', status:'angenommen', courier:req.user.username })
  res.json({ ok:true })
})

r.post('/courier/orders/:id/status', withAuth, async (req,res)=>{
  if (!isCourier(req.user)) return res.status(403).json({error:'forbidden'})
  const oid = Number(req.params.id)
  const { status, note } = req.body||{}
  const allowed = new Set(['angenommen','unterwegs','angekommen','abgeschlossen','storniert'])
  if (!allowed.has(String(status))) return res.status(400).json({error:'bad_status'})
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!authOrderAccess(req.user, o, true)) return res.status(403).json({error:'forbidden'})
  await query(`UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?`, [status, oid])
  await query(`INSERT INTO order_tracking(order_id,status,note) VALUES(?,?,?)`, [oid, status, note||null])
  pushUpdate(oid, { kind:'status', status })
  res.json({ ok:true })
})

r.put('/courier/orders/:id/eta', withAuth, async (req,res)=>{
  if (!isCourier(req.user)) return res.status(403).json({error:'forbidden'})
  const oid = Number(req.params.id)
  const { eta_minutes } = req.body||{}
  const n = Math.max(0, Number(eta_minutes||0))
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!authOrderAccess(req.user, o, true)) return res.status(403).json({error:'forbidden'})
  await query(`UPDATE orders SET eta_minutes=?, updated_at=datetime('now') WHERE id=?`, [n, oid])
  await query(`INSERT INTO order_tracking(order_id,eta_minutes,note) VALUES(?,?,?)`, [oid, n, 'ETA Update'])
  pushUpdate(oid, { kind:'eta', eta_minutes: n })
  res.json({ ok:true })
})

r.put('/courier/orders/:id/location', withAuth, async (req,res)=>{
  if (!isCourier(req.user)) return res.status(403).json({error:'forbidden'})
  const oid = Number(req.params.id)
  const { lat, lng } = req.body||{}
  const la = Number(lat), ln = Number(lng)
  if (!isFinite(la) || !isFinite(ln)) return res.status(400).json({error:'bad_coords'})
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!authOrderAccess(req.user, o, true)) return res.status(403).json({error:'forbidden'})
  await query(`UPDATE orders SET courier_lat=?, courier_lng=?, updated_at=datetime('now') WHERE id=?`, [la, ln, oid])
  await query(`INSERT INTO order_tracking(order_id,lat,lng,note) VALUES(?,?,?,?)`, [oid, la, ln, 'Position Update'])
  pushUpdate(oid, { kind:'position', lat: la, lng: ln })
  res.json({ ok:true })
})

export default r
