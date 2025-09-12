import fs from 'fs'
import path from 'path'
const file = path.join(process.argv[2], 'routes', 'plug-extended.js')
if (!fs.existsSync(file)) { console.error('[patch] routes/plug-extended.js fehlt'); process.exit(0) }
let src = fs.readFileSync(file, 'utf8')

// Admin-Katalog-Endpunkte schon vorhanden?
if (src.includes("/admin/categories") && src.includes("/admin/products")) {
  console.log('[patch] Admin-CRUD bereits vorhanden')
  process.exit(0)
}

const block = `
  // --- Admin: Kategorien ---
  r.get('/admin/categories', requireRole('admin'), async (_req,res)=>{
    const q = await query('SELECT * FROM categories ORDER BY position ASC, id ASC', [])
    res.json({ categories: q.rows })
  })
  r.post('/admin/categories', requireRole('admin'), async (req,res)=>{
    const { id=null, name, position=0, active=1 } = req.body||{}
    if(!name) return res.status(400).json({ error:'missing_name' })
    if(id){
      await query('UPDATE categories SET name=?, position=?, active=? WHERE id=?',[name, position|0, active?1:0, id|0])
      const r2 = await query('SELECT * FROM categories WHERE id=?',[id|0])
      return res.json({ category: r2.rows?.[0] })
    }
    await query('INSERT INTO categories(name,position,active) VALUES (?,?,?)',[name, position|0, active?1:0])
    const r3 = await query('SELECT * FROM categories ORDER BY id DESC LIMIT 1', [])
    res.json({ category: r3.rows?.[0] })
  })
  r.delete('/admin/categories/:id', requireRole('admin'), async (req,res)=>{
    await query('DELETE FROM categories WHERE id=?',[req.params.id|0])
    res.json({ ok:true })
  })

  // --- Admin: Produkte ---
  r.get('/admin/products', requireRole('admin'), async (_req,res)=>{
    const q = await query(
      \`SELECT p.*, c.name AS category_name,
              m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
              m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order
         FROM products p
         LEFT JOIN categories c ON c.id=p.category_id
         LEFT JOIN product_meta m ON m.product_id=p.id
         ORDER BY p.id DESC\`, []
    )
    res.json({ products: q.rows })
  })
  r.post('/admin/products', requireRole('admin'), async (req,res)=>{
    const { id=null, category_id=null, name, price_cents=0, active=1, image_url=null, description=null } = req.body||{}
    if(!name) return res.status(400).json({ error:'missing_name' })
    if(id){
      await query('UPDATE products SET category_id=?, name=?, price_cents=?, active=?, image_url=?, description=?, updated_at=(datetime(\\'now\\')) WHERE id=?',
        [category_id, name, price_cents|0, active?1:0, image_url, description, id|0])
      const r2 = await query('SELECT * FROM products WHERE id=?',[id|0])
      return res.json({ product: r2.rows?.[0] })
    }
    await query('INSERT INTO products(category_id,name,price_cents,active,image_url,description) VALUES (?,?,?,?,?,?)',
      [category_id, name, price_cents|0, active?1:0, image_url, description])
    const r3 = await query('SELECT * FROM products ORDER BY id DESC LIMIT 1', [])
    res.json({ product: r3.rows?.[0] })
  })
  r.delete('/admin/products/:id', requireRole('admin'), async (req,res)=>{
    await query('DELETE FROM products WHERE id=?',[req.params.id|0])
    res.json({ ok:true })
  })
`

const needle = 'return r'
const idx = src.lastIndexOf(needle)
if (idx === -1) {
  // Fallback: einfach am Ende einfügen
  src += '\n' + block + '\n'
} else {
  src = src.slice(0, idx) + block + '\n  ' + src.slice(idx)
}

fs.writeFileSync(file, src)
console.log('[patch] Admin-CRUD hinzugefügt')
