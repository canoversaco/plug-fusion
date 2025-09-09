import { Router } from 'express'
import { query } from '../db/index.js'
const r = Router()

function parseUser(req){
  if (req.user) return req.user
  const a = req.headers?.authorization || ''
  if (!a.startsWith('Bearer ')) return null
  try{
    const p = JSON.parse(Buffer.from(a.slice(7).split('.')[1], 'base64url').toString('utf8'))
    return { id: p.sub ?? p.id, username: p.username, role: p.role || 'user' }
  }catch{ return null }
}
const withAuth = (req,res,next)=>{ const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next() }

// --- Profile (optional Online-Status wie gehabt) ---
r.get('/profile', withAuth, async (req,res)=>{
  const row = (await query(`SELECT courier_online FROM users WHERE username=? LIMIT 1`, [req.user.username])).rows?.[0]
  res.json({ username:req.user.username, courier_online: Number(row?.courier_online||0) })
})
r.put('/profile', withAuth, async (req,res)=>{
  const on = req.body?.courier_online ? 1 : 0
  await query(`UPDATE users SET courier_online=? WHERE username=?`, [on, req.user.username])
  res.json({ ok:true, courier_online:on })
})

// --- Bestellungen: ALLE / MEINE ---
r.get('/orders/all', withAuth, async (_req,res)=>{
  const rows = (await query(`SELECT * FROM orders ORDER BY id DESC`,[])).rows||[]
  res.json({ orders: rows })
})
r.get('/orders/mine', withAuth, async (req,res)=>{
  const rows = (await query(`SELECT * FROM orders WHERE courier_username=? ORDER BY id DESC`,[req.user.username])).rows||[]
  res.json({ orders: rows })
})

// --- Aktionen (Claim, Status, ETA, Location) ---
r.post('/orders/:id/claim', withAuth, async (req,res)=>{
  const oid = Number(req.params.id)
  const o = (await query(`SELECT * FROM orders WHERE id=?`, [oid])).rows?.[0]
  if (!o || (o.courier_username && o.courier_username!==req.user.username)) return res.status(400).json({error:'cannot_claim'})
  await query(`UPDATE orders SET courier_username=?, status=COALESCE(NULLIF(status,''),'angenommen'), updated_at=datetime('now') WHERE id=?`, [req.user.username, oid])
  res.json({ ok:true })
})
r.post('/orders/:id/status', withAuth, async (req,res)=>{
  const oid = Number(req.params.id)
  const status = String(req.body?.status||'')
  const allowed = new Set(['angenommen','unterwegs','angekommen','abgeschlossen','storniert'])
  if (!allowed.has(status)) return res.status(400).json({error:'bad_status'})
  await query(`UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?`, [status, oid])
  res.json({ ok:true })
})
r.put('/orders/:id/eta', withAuth, async (req,res)=>{
  const oid = Number(req.params.id)
  const m = Math.max(0, Number(req.body?.eta_minutes||0))
  await query(`UPDATE orders SET eta_minutes=?, updated_at=datetime('now') WHERE id=?`, [m, oid])
  res.json({ ok:true })
})
r.put('/orders/:id/location', withAuth, async (req,res)=>{
  const oid = Number(req.params.id)
  const la = Number(req.body?.lat), ln = Number(req.body?.lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return res.status(400).json({error:'bad_coords'})
  await query(`UPDATE orders SET courier_lat=?, courier_lng=?, updated_at=datetime('now') WHERE id=?`, [la, ln, oid])
  res.json({ ok:true })
})

export default r
