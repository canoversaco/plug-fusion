import fs from 'fs'
import path from 'path'
const file = path.join(process.argv[2], 'index.js')
if (!fs.existsSync(file)) process.exit(0)
let src = fs.readFileSync(file, 'utf8')
if (src.includes('fulfillment_type')) { console.log('[patch] create order schon erweitert'); process.exit(0) }

const find = "app.post('/api/orders', async (req, res) => {"
const idx = src.indexOf(find)
if (idx === -1) process.exit(0)

// Ersetze den gesamten Block bis zur nächsten schließenden Klammer '})'
const endIdx = src.indexOf("})", idx)
if (endIdx === -1) process.exit(0)

const newBlock = `
app.post('/api/orders', async (req, res) => {
  const { user_username, items = [], address, slot, notes,
          fulfillment_type=null, delivery_details=null } = req.body || {}
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items erforderlich' })
  try {
    const order = await tx(async (dbx) => {
      const tot = items.reduce((s, it) => s + (it.price_cents|0) * (it.qty|0), 0)
      await dbx.query?.(
        \`INSERT INTO orders(user_username,address,slot,notes,status,subtotal_cents,delivery_fee_cents,total_cents,fulfillment_type,delivery_details_json,updated_at)
         VALUES (?,?,?,?, 'wartet_bestätigung', ?, 0, ?, ?, ?, (datetime('now')))\`,
        [user_username||null, address||null, slot||null, notes||null, tot, tot,
         fulfillment_type, JSON.stringify(delivery_details||{})]
      )
      const sel = await dbx.query?.('SELECT * FROM orders ORDER BY id DESC LIMIT 1', [])
      const ord = sel.rows?.[0]
      for (const it of items) {
        await dbx.query?.(
          \`INSERT INTO order_items(order_id,product_id,name,price_cents,qty)
           VALUES (?,?,?,?,?)\`,
          [ord.id, it.product_id||null, it.name||null, it.price_cents|0, it.qty|0]
        )
      }
      return ord
    })
    res.json({ order })
  } catch (e) {
    console.error('[orders] tx error:', e?.message)
    res.status(500).json({ error: 'order_failed' })
  }
})
`

const before = src.slice(0, idx)
const rest = src.slice(endIdx+2)
src = before + newBlock + rest
fs.writeFileSync(file, src)
console.log('[patch] create order erweitert')
