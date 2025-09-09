import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  await query(`CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_username TEXT,
    status TEXT,
    subtotal_cents INTEGER DEFAULT 0,
    total_cents INTEGER DEFAULT 0,
    mode TEXT,
    courier_username TEXT,
    eta_minutes INTEGER,
    courier_lat REAL,
    courier_lng REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  )`,[])

  await query(`CREATE TABLE IF NOT EXISTS order_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    name TEXT,
    price_cents INTEGER NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    grams REAL DEFAULT 1
  )`,[])

  await query(`CREATE TABLE IF NOT EXISTS product_price_tiers(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    grams REAL NOT NULL,
    price_cents INTEGER NOT NULL
  )`,[])

  try{ await query(`ALTER TABLE users ADD COLUMN wallet_balance_cents INTEGER DEFAULT 0`,[]) }catch(e){}

  // Falls products.active fehlt → als aktiv annehmen
  try{ await query(`ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1`,[]) }catch(e){}
  await query(`UPDATE products SET active=1 WHERE active IS NULL`,[])
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1) })
