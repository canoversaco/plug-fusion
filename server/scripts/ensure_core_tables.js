import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  try { await query(`ALTER TABLE users ADD COLUMN wallet_balance_cents INTEGER DEFAULT 0`,[]) } catch(e){}
  await query(`CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_username TEXT,
    status TEXT DEFAULT 'wartet_bestätigung',
    subtotal_cents INTEGER DEFAULT 0,
    total_cents INTEGER DEFAULT 0,
    courier_username TEXT,
    eta_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,[])
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message||e); process.exit(1) })
