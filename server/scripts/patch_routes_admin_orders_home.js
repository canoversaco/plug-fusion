import fs from 'fs'
import path from 'path'

function pickRouteFile(base){
  const cands = [
    path.join(base, 'routes', 'plug-extended.js'),
    path.join(base, 'routes', 'plug.js')
  ]
  for (const f of cands) if (fs.existsSync(f)) return f
  return null
}

const base = process.argv[2]
const file = pickRouteFile(base)
if (!file) { console.log('[patch] keine routes/plug-*.js gefunden – bitte Projektstruktur prüfen'); process.exit(0) }

let s = fs.readFileSync(file, 'utf8')

function injectOnce(code, marker){
  if (s.includes(marker)) return
  const needle = 'return r'
  const i = s.lastIndexOf(needle)
  s = (i === -1) ? (s + '\n' + code + '\n') : (s.slice(0,i) + code + '\n  ' + s.slice(i))
}

function ensureHelper(){
  if (!s.includes('safePublish(')) {
    const helper = `
  // helper: safe publish (no-op wenn broker fehlt)
  const safePublish = (channel, payload)=>{ try{ publish && publish(channel, payload) }catch(e){} }
`
    const i = s.indexOf('export function')
    if (i > -1) s = s.slice(0,i) + helper + s.slice(i)
    else s += helper
  }
}

ensureHelper()

injectOnce(`
// --- Admin: kompletter Katalog (Produkte+Kategorien+Meta)
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
  res.json({ categories: cats.rows||[], products: prods.rows||[] })
})
`, "/admin/catalog'")

injectOnce(`
// --- Admin: Bestellungen & Benutzer
r.get('/admin/orders', requireRole('admin'), async (_req,res)=>{
  const q = await query('SELECT * FROM orders ORDER BY id DESC LIMIT 300', [])
  res.json({ orders: q.rows||[] })
})
r.get('/admin/users', requireRole('admin'), async (_req,res)=>{
  const q = await query('SELECT id, username, role, wallet_balance_cents FROM users ORDER BY username ASC', [])
  res.json({ users: q.rows||[] })
})
`, "/admin/orders'")

injectOnce(`
// --- User: Eigene Bestellungen
r.get('/my/orders', requireAuth, async (req,res)=>{
  const u = req.user.username
  const q = await query('SELECT * FROM orders WHERE user_username=? ORDER BY id DESC LIMIT 100', [u])
  res.json({ orders: q.rows||[] })
})
`, "/my/orders'")

injectOnce(`
// --- DM minimal (Empfänger & Senden)
r.get('/dm/recipients', requireAuth, async (_req,res)=>{
  const q = await query("SELECT username, role FROM users WHERE role IN ('admin','courier') ORDER BY role, username", [])
  res.json({ recipients: q.rows||[] })
})
r.post('/dm/send', requireAuth, async (req,res)=>{
  const { recipient_username, body } = req.body||{}
  if (!recipient_username || !body) return res.status(400).json({ error:'missing' })
  await query("INSERT INTO dm_messages(sender_username,recipient_username,body,created_at) VALUES (?,?,?,datetime('now'))",
    [req.user.username, recipient_username, body])
  res.json({ ok:true })
})
`, "/dm/recipients'")

fs.writeFileSync(file, s)
console.log('[patch] Admin/Orders/DM Routen OK ->', file)
