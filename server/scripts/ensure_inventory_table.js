import 'dotenv/config'
import { query } from '../db/index.js'
async function run(){
  await query(`CREATE TABLE IF NOT EXISTS inventory_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    item_name TEXT NOT NULL,
    qty INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,[])
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message||e); process.exit(1) })
