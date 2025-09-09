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

r.get('/categories', async (_req,res)=>{
  const q = await query(`SELECT id, name, position, active,
                                COALESCE(highlight,0) AS highlight,
                                highlight_color
                         FROM categories WHERE active=1
                         ORDER BY position ASC, id ASC`,[])
  res.json({ categories: q.rows||[] })
})

r.get('/product-tiers', async (_req,res)=>{
  const q = await query(`SELECT product_id, grams, price_cents
                         FROM product_price_tiers
                         ORDER BY product_id ASC, grams ASC`,[])
  res.json({ tiers: q.rows||[] })
})

r.post('/orders', withAuth, async (req,res)=>{
  try{
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) return res.status(400).json({ error:'empty_cart' })
    const mode = String(req.body?.mode || 'pickup')
    const payWallet = !!req.body?.pay_with_wallet

    const ids = [...new Set(items.map(x=>Number(x.product_id)).filter(Boolean))]
    if (!ids.length) return res.status(400).json({ error:'empty_cart' })
    const ph = ids.map(_=>'?').join(',')
    const prows = (await query(`SELECT id, name, price_cents FROM products WHERE active=1 AND id IN (${ph})`, ids)).rows||[]

    let subtotal = 0
    const lines = []
    for (const it of items){
      const pid = Number(it.product_id)
      const grams = Number(it.grams||1)
      const qty = Math.max(1, Number(it.qty||1))
      const p = prows.find(r=>Number(r.id)===pid)
      if (!p) return res.status(400).json({ error:'product_not_found_or_inactive', product_id: pid })

      const t = (await query(`SELECT price_cents FROM product_price_tiers WHERE product_id=? AND grams=? LIMIT 1`,[pid,grams])).rows?.[0]
      let unit = t ? Number(t.price_cents) : Math.round(Number(p.price_cents||0) * grams)
      if (!unit || unit<0) unit = 0

      subtotal += unit * qty
      lines.push({ product_id: pid, name: p.name, grams, price_cents: unit, qty })
    }

    let total = subtotal
    if (payWallet){
      const balQ = await query(`SELECT wallet_balance_cents FROM users WHERE id=?`, [req.user.id])
      const bal = Number(balQ.rows?.[0]?.wallet_balance_cents||0)
      const use = Math.min(bal, subtotal)
      if (use>0){
        await query(`UPDATE users SET wallet_balance_cents = wallet_balance_cents - ? WHERE id=?`, [use, req.user.id])
        total = subtotal - use
      }
    }

    const ins = await query(
      `INSERT INTO orders(user_username, status, subtotal_cents, total_cents, mode, created_at)
       VALUES(?, 'wartet_bestätigung', ?, ?, ?, datetime('now')) RETURNING id`,
      [req.user.username, subtotal, total, mode]
    )
    const oid = ins.rows?.[0]?.id

    for (const l of lines){
      await query(`INSERT INTO order_items(order_id, product_id, name, price_cents, qty, grams)
                   VALUES(?,?,?,?,?,?)`, [oid, l.product_id, l.name, l.price_cents, l.qty, l.grams])
    }

    res.json({ ok:true, order_id: oid, subtotal_cents: subtotal, total_cents: total })
  }catch(e){
    console.error('[orders]', e?.message||e)
    res.status(500).json({ error:'order_create_failed' })
  }
})
export default r
