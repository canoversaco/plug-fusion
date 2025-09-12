import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  // order_items (falls nicht vorhanden)
  await query(`CREATE TABLE IF NOT EXISTS order_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    name TEXT,
    price_cents INTEGER DEFAULT 0,
    qty INTEGER DEFAULT 1
  )`, [])

  // Orders: Zusatzfelder
  const alters = [
    `ALTER TABLE orders ADD COLUMN fulfillment_type TEXT`,
    `ALTER TABLE orders ADD COLUMN delivery_details_json TEXT`,
    `ALTER TABLE orders ADD COLUMN courier_username TEXT`,
    `ALTER TABLE orders ADD COLUMN eta_minutes INTEGER`,
    `ALTER TABLE orders ADD COLUMN eta_at TEXT`,
    `ALTER TABLE orders ADD COLUMN updated_at TEXT`
  ]
  for (const sql of alters) { try { await query(sql, []) } catch (e) {} }
  console.log('[ensure] orders extended OK')
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message); process.exit(1) })
