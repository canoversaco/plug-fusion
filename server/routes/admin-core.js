import { Router } from 'express'
import { query } from '../db/index.js'
import * as B from 'bcryptjs'

const r = Router()

// --- JWT-Payload minimal lesen (ohne Secret), damit wir req.user haben:
function parseUser(req){
  if (req.user) return req.user
  const hdr = req.headers?.authorization || ''
  if (!hdr.startsWith('Bearer ')) return null
  const t = hdr.slice(7)
  try {
    const p = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'))
    return { id: p.sub ?? p.id, username: p.username, role: p.role || 'user' }
  } catch { return null }
}
const withAuth = (req,res,next)=>{ const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next() }
const requireRole = (...roles)=>(req,res,next)=> roles.includes((req.user||{}).role) ? next() : res.status(403).json({error:'forbidden'})

// ========================== USERS ===============================
r.get('/admin/users', withAuth, requireRole('admin'), async (_req,res)=>{
  const q = await query(`SELECT id, username, role, wallet_balance_cents FROM users ORDER BY username ASC`,[])
  res.json({ users: q.rows||[] })
})

r.post('/admin/users', withAuth, requireRole('admin'), async (req,res)=>{
  const { id, username, password, role='user', wallet_balance_cents } = req.body||{}
  const roleSafe = (['user','admin','courier'].includes(role) ? role : 'user')
  const wallet = wallet_balance_cents==null ? 0 : Number(wallet_balance_cents||0)
  if (id) {
    // update
    if (password && password.length>0){
      const hash = await B.hash(password, 10)
      await query(`UPDATE users SET username=?, role=?, wallet_balance_cents=?, password_hash=? WHERE id=?`,
        [username, roleSafe, wallet, hash, Number(id)])
    } else {
      await query(`UPDATE users SET username=?, role=?, wallet_balance_cents=? WHERE id=?`,
        [username, roleSafe, wallet, Number(id)])
    }
    return res.json({ ok:true, user:{ id:Number(id) } })
  } else {
    if (!username || !password) return res.status(400).json({ error:'username_and_password_required' })
    const hash = await B.hash(password, 10)
    const ins = await query(
      `INSERT INTO users(username, role, wallet_balance_cents, password_hash) VALUES(?,?,?,?) RETURNING id`,
      [username, roleSafe, wallet, hash]
    )
    return res.json({ ok:true, user:{ id: ins.rows?.[0]?.id } })
  }
})

r.delete('/admin/users/:id', withAuth, requireRole('admin'), async (req,res)=>{
  const id = Number(req.params.id)||0
  // Schutz: Admin mit id=1 nicht löschen
  if (id===1) return res.status(400).json({ error:'cannot_delete_primary_admin' })
  await query(`DELETE FROM users WHERE id=?`, [id])
  res.json({ ok:true })
})

// ========================== ORDERS ==============================
r.get('/admin/orders', withAuth, requireRole('admin'), async (_req,res)=>{
  const q = await query(`SELECT * FROM orders ORDER BY id DESC LIMIT 300`,[])
  res.json({ orders: q.rows||[] })
})

r.post('/admin/orders/:id', withAuth, requireRole('admin'), async (req,res)=>{
  const id = Number(req.params.id)||0
  const { status, courier_username, eta_minutes } = req.body||{}
  if (status) await query(`UPDATE orders SET status=? WHERE id=?`, [String(status), id])
  if (courier_username!=null) await query(`UPDATE orders SET courier_username=? WHERE id=?`, [courier_username||null, id])
  if (eta_minutes!=null) await query(`UPDATE orders SET eta_at = datetime('now', ?) WHERE id=?`, [`+${Number(eta_minutes||15)} minutes`, id])
  res.json({ ok:true })
})

export default r
