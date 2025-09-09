import fs from 'fs'
import path from 'path'
const file = path.join(process.argv[2], 'routes', 'plug-extended.js')
if (!fs.existsSync(file)) { console.log('[patch] routes/plug-extended.js fehlt (überspringe)'); process.exit(0) }
let s = fs.readFileSync(file,'utf8')
if (s.includes("r.get('/admin/products/:id'")) { console.log('[patch] /admin/products/:id existiert'); process.exit(0) }

const block = `
// --- Admin: Produkt-Detail (inkl. Meta) ---
r.get('/admin/products/:id', requireRole('admin'), async (req,res)=>{
  const id = req.params.id|0
  const q = await query(
    \`SELECT p.*, c.name AS category_name,
            m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
            m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
       FROM products p
       LEFT JOIN categories c ON c.id=p.category_id
       LEFT JOIN product_meta m ON m.product_id=p.id
       WHERE p.id=?\`, [id]
  )
  res.json({ product: q.rows?.[0]||null })
})
`
const needle = 'return r'
const i = s.lastIndexOf(needle)
s = i===-1 ? (s + '\n' + block + '\n') : (s.slice(0,i) + block + '\n  ' + s.slice(i))
fs.writeFileSync(file, s)
console.log('[patch] /admin/products/:id ergänzt')
