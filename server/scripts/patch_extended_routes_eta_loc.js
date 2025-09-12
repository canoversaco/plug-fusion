import fs from 'fs'
import path from 'path'
const file = path.join(process.argv[2], 'routes', 'plug-extended.js')
if (!fs.existsSync(file)) process.exit(0)
let src = fs.readFileSync(file, 'utf8')

function injectOnce(haystack, code, marker) {
  if (haystack.includes(marker)) return haystack
  const needle = 'return r'
  const i = haystack.lastIndexOf(needle)
  if (i === -1) return haystack + '\n' + code + '\n'
  return haystack.slice(0,i) + code + '\n  ' + haystack.slice(i)
}

const code = `
// --- Order-Detail + ETA + Order-spezifische Location ---
r.get('/orders/:id', requireAuth, async (req,res)=>{
  const id = req.params.id|0
  const o = await query('SELECT * FROM orders WHERE id=?', [id])
  const items = await query('SELECT * FROM order_items WHERE order_id=? ORDER BY id ASC', [id])
  res.json({ order: o.rows?.[0]||null, items: items.rows||[] })
})

r.post('/orders/:id/eta', requireRole('admin','courier'), async (req,res)=>{
  const id = req.params.id|0
  const { eta_minutes=null, eta_at=null } = req.body||{}
  let etaISO = eta_at
  if (!etaISO && typeof eta_minutes === 'number') {
    etaISO = new Date(Date.now() + eta_minutes*60000).toISOString()
  }
  await query('UPDATE orders SET eta_minutes=?, eta_at=?, updated_at=(datetime(\'now\')) WHERE id=?',
    [eta_minutes, etaISO, id])
  publish('order:'+id, { type:'eta', eta_minutes, eta_at: etaISO })
  res.json({ ok:true, eta_at: etaISO })
})

r.post('/orders/:id/location', requireRole('admin','courier'), async (req,res)=>{
  const id = req.params.id|0
  const { lat, lng } = req.body||{}
  if (typeof lat!=='number' || typeof lng!=='number') return res.status(400).json({ error:'bad_coords' })
  await query('INSERT INTO courier_locations(courier_username,lat,lng,updated_at) VALUES (?,?,?,datetime(\'now\'))',
    [req.user.username, lat, lng])
  publish('order:'+id, { type:'location', lat, lng, by: req.user.username, at: new Date().toISOString() })
  res.json({ ok:true })
})
`

const marker = "r.post('/orders/:id/eta'"
src = injectOnce(src, code, marker)
fs.writeFileSync(file, src)
console.log('[patch] ETA/Location/Detail Routen OK')
