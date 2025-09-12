import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  // order_items
  await query(`CREATE TABLE IF NOT EXISTS order_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`, [])

  // optional: mode-Spalte in orders
  try { await query(`ALTER TABLE orders ADD COLUMN mode TEXT`,[]) } catch(e){}
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message||e); process.exit(1) })
