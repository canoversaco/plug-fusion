import { Router } from 'express'
import { query } from '../db/index.js'

// --- Minimaler Auth-Helper (JWT-Payload aus dem Bearer-Token base64-decodieren)
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

const r = Router()

// ======================= PUBLIC (MENÜ) =======================
// Liefert aktive Produkte inkl. Kategorie & Meta. Für das Frontend-Menü.
r.get('/products', async (_req,res)=>{
  const cats = await query('SELECT * FROM categories WHERE active=1 ORDER BY position ASC, id ASC', [])
  const prods = await query(`
    SELECT p.*, c.name AS category_name, c.position AS category_position,
           m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
           m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_meta m ON m.product_id = p.id
     WHERE p.active = 1
     ORDER BY c.position ASC, p.id DESC
  `, [])
  res.json({ categories: cats.rows||[], products: prods.rows||[] })
})

// ======================= ADMIN CRUD ==========================
r.get('/admin/products/:id', withAuth, requireRole('admin'), async (req,res)=>{
  const id = Number(req.params.id)||0
  const q = await query(`
    SELECT p.*, c.name AS category_name,
           m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
           m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN product_meta m ON m.product_id=p.id
     WHERE p.id = ?
  `, [id])
  res.json({ product: (q.rows||[])[0] || null })
})

r.post('/admin/products', withAuth, requireRole('admin'), async (req,res)=>{
  const { id, category_id, name, price_cents=0, active=true, image_url=null, description=null } = req.body||{}
  if (!name) return res.status(400).json({ error:'name_required' })
  const cid = category_id==null ? null : Number(category_id)
  const act = active ? 1 : 0
  if (id) {
    await query(`UPDATE products SET category_id=?, name=?, price_cents=?, active=?, image_url=?, description=? WHERE id=?`,
      [cid, name, Number(price_cents||0), act, image_url, description, Number(id)])
    return res.json({ ok:true, product:{ id:Number(id) } })
  } else {
    const ins = await query(`INSERT INTO products(category_id,name,price_cents,active,image_url,description,created_at)
                             VALUES(?,?,?,?,?,?,datetime('now')) RETURNING id`, [cid, name, Number(price_cents||0), act, image_url, description])
    const pid = ins.rows?.[0]?.id
    return res.json({ ok:true, product:{ id: pid } })
  }
})

r.delete('/admin/products/:id', withAuth, requireRole('admin'), async (req,res)=>{
  const id = Number(req.params.id)||0
  await query(`DELETE FROM product_meta WHERE product_id=?`, [id])
  await query(`DELETE FROM products WHERE id=?`, [id])
  res.json({ ok:true })
})

r.post('/admin/product-meta', withAuth, requireRole('admin'), async (req,res)=>{
  const { product_id, featured=false, featured_order=0, badge_text=null, badge_color=null, sale_price_cents=null,
          highlight_title=null, highlight_desc=null, banner_image_url=null, promo_until=null } = req.body||{}
  if (!product_id) return res.status(400).json({ error:'product_id_required' })
  await query(`
    INSERT INTO product_meta(product_id, featured, featured_order, badge_text, badge_color, sale_price_cents,
                             highlight_title, highlight_desc, banner_image_url, promo_until)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(product_id) DO UPDATE SET
      featured=excluded.featured,
      featured_order=excluded.featured_order,
      badge_text=excluded.badge_text,
      badge_color=excluded.badge_color,
      sale_price_cents=excluded.sale_price_cents,
      highlight_title=excluded.highlight_title,
      highlight_desc=excluded.highlight_desc,
      banner_image_url=excluded.banner_image_url,
      promo_until=excluded.promo_until
  `, [Number(product_id), featured?1:0, Number(featured_order||0), badge_text, badge_color,
      sale_price_cents==null?null:Number(sale_price_cents), highlight_title, highlight_desc, banner_image_url, promo_until])
  res.json({ ok:true })
})

r.post('/admin/categories', withAuth, requireRole('admin'), async (req,res)=>{
  const { id, name, position=0, active=true } = req.body||{}
  if (!name) return res.status(400).json({ error:'name_required' })
  if (id) {
    await query(`UPDATE categories SET name=?, position=?, active=? WHERE id=?`, [name, Number(position||0), active?1:0, Number(id)])
    res.json({ ok:true, category:{ id:Number(id) } })
  } else {
    const ins = await query(`INSERT INTO categories(name, position, active) VALUES(?,?,?) RETURNING id`, [name, Number(position||0), active?1:0])
    res.json({ ok:true, category:{ id: ins.rows?.[0]?.id } })
  }
})
r.delete('/admin/categories/:id', withAuth, requireRole('admin'), async (req,res)=>{
  await query(`DELETE FROM categories WHERE id=?`, [Number(req.params.id)||0])
  res.json({ ok:true })
})

export default r
