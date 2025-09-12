import { Router } from 'express'
import { query } from '../db/index.js'
const r = Router()

function parseUser(req){
  if (req.user) return req.user
  const a = req.headers?.authorization||''
  if (!a.startsWith('Bearer ')) return null
  try{
    const p = JSON.parse(Buffer.from(a.slice(7).split('.')[1],'base64url').toString('utf8'))
    return { id:p.sub??p.id, username:p.username, role:p.role||'user' }
  }catch{ return null }
}
const withAuth = (req,res,next)=>{ const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next() }

async function priceFor(product, grams){
  const t = (await query(`SELECT price_cents FROM product_price_tiers WHERE product_id=? AND grams=? LIMIT 1`, [product.id, grams])).rows?.[0]
  if (t) return Number(t.price_cents)
  const g = Math.max(.1, Number(grams||1))
  const base = Math.max(0, Number(product.price_cents||0))
  return Math.round(base * g)
}

r.post('/orders/validate', withAuth, async (req,res)=>{
  try{
    const body = typeof req.body==='string' ? JSON.parse(req.body) : (req.body||{})
    const items = Array.isArray(body.items)?body.items:[]
    if (!items.length) return res.status(400).json({error:'empty_cart'})
    const ids = [...new Set(items.map(x=>Number(x.product_id)).filter(Boolean))]
    const ph = ids.map(()=>'?').join(',')
    const prows = (await query(`SELECT id,name,price_cents,active FROM products WHERE id IN (${ph})`, ids)).rows||[]
    let subtotal=0, lines=[]
    for (const it of items){
      const p = prows.find(r=>Number(r.id)===Number(it.product_id))
      if (!p) return res.status(400).json({error:'product_not_found', product_id:it.product_id})
      if (Number(p.active)===0) return res.status(400).json({error:'product_inactive', product_id:it.product_id})
      const grams = Math.max(.1, Number(it.grams||1))
      const qty = Math.max(1, Number(it.qty||1))
      const unit = await priceFor(p, grams)
      subtotal += unit*qty
      lines.push({ name:p.name, grams, qty, unit_cents:unit, total_cents: unit*qty })
    }
    res.json({ ok:true, subtotal_cents:subtotal, lines })
  }catch(e){ res.status(500).json({error:'validate_failed', message:String(e?.message||e)}) }
})

r.post('/orders', withAuth, async (req,res)=>{
  try{
    const body = typeof req.body==='string' ? JSON.parse(req.body) : (req.body||{})
    const items = Array.isArray(body.items)?body.items:[]
    const mode = String(body.mode||'pickup')
    if (!items.length) return res.status(400).json({error:'empty_cart', message:'Warenkorb leer'})

    const ids = [...new Set(items.map(x=>Number(x.product_id)).filter(Boolean))]
    const ph = ids.map(()=>'?').join(',')
    const prows = (await query(`SELECT id,name,price_cents,active FROM products WHERE id IN (${ph})`, ids)).rows||[]

    let subtotal=0
    const lines=[]
    for (const it of items){
      const p = prows.find(r=>Number(r.id)===Number(it.product_id))
      if (!p) return res.status(400).json({error:'product_not_found', product_id:it.product_id})
      if (Number(p.active)===0) return res.status(400).json({error:'product_inactive', product_id:it.product_id})
      const grams = Math.max(.1, Number(it.grams||1))
      const qty = Math.max(1, Number(it.qty||1))
      const unit = await priceFor(p, grams)
      subtotal += unit*qty
      lines.push({ product_id:Number(it.product_id), name:p.name, grams, price_cents:unit, qty })
    }

    // SQLite-safe: ohne RETURNING + last_insert_rowid()
    await query(`INSERT INTO orders(user_username,status,subtotal_cents,total_cents,mode,created_at)
                 VALUES(?, 'wartet_bestätigung', ?, ?, ?, datetime('now'))`,
                 [req.user.username, subtotal, subtotal, mode])
    const oid = (await query(`SELECT last_insert_rowid() AS id`,[])).rows?.[0]?.id
    if (!oid) return res.status(500).json({error:'no_order_id', message:'Konnte Bestell-ID nicht lesen'})

    for (const l of lines){
      await query(`INSERT INTO order_items(order_id,product_id,name,price_cents,qty,grams) VALUES(?,?,?,?,?,?)`,
        [oid, l.product_id, l.name, l.price_cents, l.qty, l.grams])
    }

    res.json({ ok:true, order_id:oid, subtotal_cents:subtotal, total_cents:subtotal })
  }catch(e){ res.status(500).json({error:'order_create_failed', message:String(e?.message||e)}) }
})

export default r
