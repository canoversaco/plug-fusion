import fs from 'fs'
import path from 'path'

const file = path.join(process.argv[2], 'index.js')
if (!fs.existsSync(file)) {
  console.error('[x] server/index.js nicht gefunden:', file)
  process.exit(1)
}
let s = fs.readFileSync(file, 'utf8')

// Bereits gepatcht?
if (s.includes('__PF_ADMIN_INLINE__ START')) {
  console.log('[i] Inline-Admin-Endpunkte bereits vorhanden.')
  process.exit(0)
}

// app-Variablennamen finden (z. B. "app")
let appName = 'app'
let m = s.match(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*express\(\s*\)/)
if (m) appName = m[2]
else {
  // Fallback: Suche Zuweisung ohne Deklaration
  m = s.match(/\b([A-Za-z_$][\w$]*)\s*=\s*express\(\s*\)/)
  if (m) appName = m[1]
}

// Einfüge-Punkt: nach erster express()-Deklaration ODER am Datei-Ende
let insertIdx = s.indexOf(`= express(`)
if (insertIdx !== -1) {
  insertIdx = s.indexOf('\n', insertIdx) + 1
} else {
  insertIdx = s.length
}

const block = `
// __PF_ADMIN_INLINE__ START
// Admin/Orders-Fallback direkt in ${appName} (keine Abhängigkeit von vorhandenen Routern)

function __pf_decodeJwt(token){
  try{
    const p = token.split('.')[1]
    return JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  }catch{ return null }
}
function __pf_parseAuth(req){
  if (req.user) return req.user
  const hdr = req.headers?.authorization || ''
  if (!hdr.startsWith('Bearer ')) return null
  const payload = __pf_decodeJwt(hdr.slice(7))
  if (!payload) return null
  return { id: payload.sub ?? payload.id, username: payload.username, role: payload.role || 'user' }
}
function __pf_withAuth(req,res,next){
  const u = __pf_parseAuth(req)
  if (!u) return res.status(401).json({ error:'unauth' })
  req.user = u; next()
}
function __pf_requireRole(){
  const roles = Array.from(arguments)
  return (req,res,next)=>{
    if (!req.user) return res.status(401).json({error:'unauth'})
    if (!roles.length || roles.includes(req.user.role)) return next()
    return res.status(403).json({error:'forbidden'})
  }
}
let __pf_dbmod = null
async function __pf_query(sql, params=[]){
  try{
    if (!__pf_dbmod){
      // dynamischer Import, egal ob ESM/CJS
      __pf_dbmod = await import('./db/index.js')
    }
    const q = __pf_dbmod.query || (__pf_dbmod.default && __pf_dbmod.default.query)
    return await q(sql, params)
  }catch(e){
    console.error('[sql]', e?.message||e)
    return { rows: [] }
  }
}

// Debug: Wer bin ich?
${appName}.get('/api/_whoami', __pf_withAuth, (req,res)=> res.json({ user: req.user }))

// Admin: kompletter Katalog (Produkte+Kategorien+Meta)
${appName}.get('/api/admin/catalog', __pf_withAuth, __pf_requireRole('admin'), async (_req,res)=>{
  const cats = await __pf_query('SELECT * FROM categories ORDER BY position ASC, id ASC', [])
  const prods = await __pf_query(\`
    SELECT p.*, c.name AS category_name,
           m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
           m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN product_meta m ON m.product_id=p.id
      ORDER BY p.id DESC
  \`, [])
  res.json({ categories: cats.rows||[], products: prods.rows||[] })
})

// Admin: Orders & Users
${appName}.get('/api/admin/orders', __pf_withAuth, __pf_requireRole('admin'), async (_req,res)=>{
  const q = await __pf_query('SELECT * FROM orders ORDER BY id DESC LIMIT 300', [])
  res.json({ orders: q.rows||[] })
})
${appName}.get('/api/admin/users', __pf_withAuth, __pf_requireRole('admin'), async (_req,res)=>{
  const q = await __pf_query('SELECT id, username, role, wallet_balance_cents FROM users ORDER BY username ASC', [])
  res.json({ users: q.rows||[] })
})

// User: Eigene Orders
${appName}.get('/api/my/orders', __pf_withAuth, async (req,res)=>{
  const u = req.user.username
  const q = await __pf_query('SELECT * FROM orders WHERE user_username=? ORDER BY id DESC LIMIT 100', [u])
  res.json({ orders: q.rows||[] })
})

// __PF_ADMIN_INLINE__ END
`

s = s.slice(0, insertIdx) + block + s.slice(insertIdx)
fs.writeFileSync(file, s, 'utf8')
console.log('[✓] Inline-Admin-/Orders-Endpoints in server/index.js injiziert (app =', appName, ')')
