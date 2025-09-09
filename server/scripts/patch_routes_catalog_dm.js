import fs from 'fs'
import path from 'path'
const file = path.join(process.argv[2], 'routes', 'plug-extended.js')
if (!fs.existsSync(file)) { console.log('[patch] routes/plug-extended.js fehlt'); process.exit(0) }
let s = fs.readFileSync(file,'utf8')

function injectOnce(haystack, code, marker){
  if (haystack.includes(marker)) return haystack
  const needle = 'return r'
  const i = haystack.lastIndexOf(needle)
  if (i === -1) return haystack + '\n' + code + '\n'
  return haystack.slice(0,i) + code + '\n  ' + haystack.slice(i)
}

const blockCatalog = `
// --- Admin: Gesamter Katalog (Produkte + Kategorien) ---
r.get('/admin/catalog', requireRole('admin'), async (_req,res)=>{
  const cats = await query('SELECT * FROM categories ORDER BY position ASC, id ASC', [])
  const prods = await query(
    \`SELECT p.*, c.name AS category_name,
            m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
            m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
       FROM products p
       LEFT JOIN categories c ON c.id=p.category_id
       LEFT JOIN product_meta m ON m.product_id=p.id
       ORDER BY p.id DESC\`, []
  )
  res.json({ categories: cats.rows || [], products: prods.rows || [] })
})
`

const blockDM = `
// --- Direct Messages (Kunde -> Admin/Kurier) ---
r.get('/dm/recipients', requireAuth, async (_req,res)=>{
  const q = await query("SELECT username, role FROM users WHERE role IN ('admin','courier') ORDER BY role ASC, username ASC", [])
  res.json({ recipients: q.rows || [] })
})

r.get('/dm/inbox', requireAuth, async (req,res)=>{
  const u = req.user.username
  const q = await query(
    "SELECT * FROM dm_messages WHERE sender_username = ? OR recipient_username = ? ORDER BY id DESC LIMIT 100",
    [u, u]
  )
  res.json({ messages: q.rows || [] })
})

r.post('/dm/send', requireAuth, async (req,res)=>{
  const { recipient_username, body } = req.body || {}
  const sender = req.user.username
  if (!recipient_username || !body) return res.status(400).json({ error:'missing_fields' })
  const a = [ sender, recipient_username, body ]
  await query(
    "INSERT INTO dm_messages(sender_username,recipient_username,body,created_at) VALUES (?,?,?,datetime('now'))",
    a
  )
  res.json({ ok:true })
})
`

s = injectOnce(s, blockCatalog, "/admin/catalog")
s = injectOnce(s, blockDM, "/dm/recipients")
fs.writeFileSync(file, s)
console.log('[patch] /admin/catalog & DM-Routen ergänzt/ok')
