import fs from 'fs'
import path from 'path'
const file = path.join(process.argv[2], 'index.js')
if (!fs.existsSync(file)) { console.error('[patch] server/index.js fehlt'); process.exit(0) }
let src = fs.readFileSync(file, 'utf8')
if (src.includes('product_meta')) { console.log('[patch] /api/products hat bereits JOIN product_meta'); process.exit(0) }

const old1 = "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.active = 1 ORDER BY p.id DESC"
const newSQL = `SELECT p.*, c.name AS category_name,
    m.featured, m.badge_text, m.badge_color, m.highlight_title, m.highlight_desc,
    m.promo_until, m.sale_price_cents, m.banner_image_url, m.featured_order
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN product_meta m ON m.product_id = p.id
  WHERE p.active = 1
  ORDER BY COALESCE(m.featured,0) DESC, COALESCE(m.featured_order,0) DESC, p.id DESC`

if (src.includes(old1)) {
  src = src.replace(old1, newSQL)
  fs.writeFileSync(file, src)
  console.log('[patch] /api/products Query ersetzt (JOIN product_meta)')
} else {
  console.log('[patch] erwartetes SQL nicht gefunden – kein Replace durchgeführt')
}
