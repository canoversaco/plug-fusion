import { Router } from 'express'
import { query } from '../db/index.js'
import * as JWTNS from 'jsonwebtoken'
const jwt = JWTNS.default || JWTNS

const r = Router()
const SECRET = process.env.JWT_SECRET || 'plug_fusion_dev'

const safeQuery = async (sql, params=[])=>{
  try { return await query(sql, params) } catch(e){ console.error('[sql]', e?.message); return { rows: [] } }
}

function parseAuth(req){
  if (req.user) return req.user
  const hdr = req.headers?.authorization || ''
  if (!hdr.startsWith('Bearer ')) return null
  const token = hdr.slice(7)
  try { return jwt.verify(token, SECRET) }
  catch { try { return jwt.decode(token) } catch { return null } }
}
function withAuth(req,res,next){
  const p = parseAuth(req)
  if (!p) return res.status(401).json({ error:'unauth' })
  req.user = { id: p.sub ?? p.id, username: p.username, role: p.role || 'user' }
  next()
}
const requireRole = (...roles)=>(req,res,next)=>{
  if (!req.user) return res.status(401).json({error:'unauth'})
  if (roles.length===0 || roles.includes(req.user.role)) return next()
  return res.status(403).json({error:'forbidden'})
}

// Debug: Wer bin ich?
r.get('/_whoami', withAuth, (req,res)=> res.json({ user: req.user }))

// ---------- ADMIN: CATALOG ----------
r.get('/admin/catalog', withAuth, requireRole('admin'), async (_req,res)=>{
  const cats = await safeQuery('SELECT * FROM categories ORDER BY position ASC, id ASC')
  const prods = await safeQuery(`
    SELECT p.*, c.name AS category_name,
           m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
           m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN product_meta m ON m.product_id=p.id
      ORDER BY p.id DESC
  `)
  res.json({ categories: cats.rows||[], products: prods.rows||[] })
})

// Produkt-Detail inkl. Meta
r.get('/admin/products/:id', withAuth, requireRole('admin'), async (req,res)=>{
  const id = req.params.id|0
  const q = await safeQuery(`
    SELECT p.*, c.name AS category_name,
           m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
           m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN product_meta m ON m.product_id=p.id
      WHERE p.id=?
  `,[id])
  res.json({ product: q.rows?.[0]||null })
})

// ---------- ADMIN: Orders & Users ----------
r.get('/admin/orders', withAuth, requireRole('admin'), async (_req,res)=>{
  const q = await safeQuery('SELECT * FROM orders ORDER BY id DESC LIMIT 300')
  res.json({ orders: q.rows||[] })
})
r.get('/admin/users', withAuth, requireRole('admin'), async (_req,res)=>{
  const q = await safeQuery('SELECT id, username, role, wallet_balance_cents FROM users ORDER BY username ASC')
  res.json({ users: q.rows||[] })
})

// ---------- USER: Eigene Orders ----------
r.get('/my/orders', withAuth, async (req,res)=>{
  const u = req.user.username
  const q = await safeQuery('SELECT * FROM orders WHERE user_username=? ORDER BY id DESC LIMIT 100',[u])
  res.json({ orders: q.rows||[] })
})

// ---------- COURIER: Status/ETA ----------
r.post('/orders/:id/status', withAuth, requireRole('courier','admin'), async (req,res)=>{
  const id = req.params.id|0; const { status='bestätigt' } = req.body||{}
  await safeQuery('UPDATE orders SET status=? WHERE id=?',[status,id])
  res.json({ ok:true })
})
r.post('/orders/:id/eta', withAuth, requireRole('courier','admin'), async (req,res)=>{
  const id = req.params.id|0; const { eta_minutes=15 } = req.body||{}
  await safeQuery(`UPDATE orders SET eta_at = datetime('now', ?) WHERE id=?`, [`+${Number(eta_minutes||15)} minutes`, id])
  res.json({ ok:true })
})

export default r
