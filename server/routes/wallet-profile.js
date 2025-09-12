import { Router } from 'express'
import { query } from '../db/index.js'

const r = Router()

// ——— Auth-Helpers (JWT Payload ohne Secret lesen) ———
function parseUser(req){
  if (req.user) return req.user
  const hdr = req.headers?.authorization || ''
  if (!hdr.startsWith('Bearer ')) return null
  try {
    const p = JSON.parse(Buffer.from(hdr.slice(7).split('.')[1], 'base64url').toString('utf8'))
    return { id: p.sub ?? p.id, username: p.username, role: p.role || 'user' }
  } catch { return null }
}
const withAuth = (req,res,next)=>{ const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next() }

// ——— GET /api/profile ———
r.get('/profile', withAuth, async (req,res)=>{
  const me = await query(`SELECT id, username, role, wallet_balance_cents FROM users WHERE id=? LIMIT 1`, [req.user.id])
  const orders = await query(`SELECT COUNT(1) AS n FROM orders WHERE user_username=?`, [req.user.username])
  const inv = await query(`SELECT COUNT(1) AS n FROM inventory_items WHERE username=?`, [req.user.username]).catch(()=>({rows:[{n:0}]}))
  res.json({
    user: me.rows?.[0] || { id:req.user.id, username:req.user.username, role:req.user.role, wallet_balance_cents:0 },
    stats: { orders: orders.rows?.[0]?.n || 0, inventory: inv.rows?.[0]?.n || 0 }
  })
})

// ——— POST /api/wallet/topup {amount_cents} ———
r.post('/wallet/topup', withAuth, async (req,res)=>{
  const amount = Number(req.body?.amount_cents||0)
  if (!(amount>0)) return res.status(400).json({error:'amount_invalid'})
  await query(`UPDATE users SET wallet_balance_cents = COALESCE(wallet_balance_cents,0) + ? WHERE id=?`, [amount, req.user.id])
  const me = await query(`SELECT wallet_balance_cents FROM users WHERE id=?`, [req.user.id])
  res.json({ ok:true, wallet_balance_cents: me.rows?.[0]?.wallet_balance_cents || 0 })
})

// ——— POST /api/wallet/spend {amount_cents} ———
r.post('/wallet/spend', withAuth, async (req,res)=>{
  const amount = Number(req.body?.amount_cents||0)
  if (!(amount>0)) return res.status(400).json({error:'amount_invalid'})
  const me = await query(`SELECT wallet_balance_cents FROM users WHERE id=?`, [req.user.id])
  const bal = Number(me.rows?.[0]?.wallet_balance_cents||0)
  if (bal < amount) return res.status(400).json({error:'insufficient_funds', wallet_balance_cents: bal})
  await query(`UPDATE users SET wallet_balance_cents = wallet_balance_cents - ? WHERE id=?`, [amount, req.user.id])
  const me2 = await query(`SELECT wallet_balance_cents FROM users WHERE id=?`, [req.user.id])
  res.json({ ok:true, wallet_balance_cents: me2.rows?.[0]?.wallet_balance_cents || 0 })
})

// ——— GET /api/inventory ———
r.get('/inventory', withAuth, async (req,res)=>{
  let q;
  try {
    q = await query(`SELECT id, item_name, qty, created_at FROM inventory_items WHERE username=? ORDER BY id DESC`, [req.user.username])
  } catch (e) {
    q = { rows: [] }
  }
  res.json({ items: q.rows||[] })
})

export default r
