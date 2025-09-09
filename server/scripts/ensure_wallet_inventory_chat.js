import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  // users: wallet balance
  try { await query(`ALTER TABLE users ADD COLUMN wallet_balance_cents INTEGER DEFAULT 0`, []) } catch(e){}
  await query(`CREATE TABLE IF NOT EXISTS wallet_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    delta_cents INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`, [])

  // inventory
  await query(`CREATE TABLE IF NOT EXISTS user_inventory(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    item_name TEXT NOT NULL,
    qty INTEGER DEFAULT 1,
    meta_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`, [])

  // courier locations
  await query(`CREATE TABLE IF NOT EXISTS courier_locations(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courier_username TEXT,
    lat REAL,
    lng REAL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`, [])

  // order chat
  await query(`CREATE TABLE IF NOT EXISTS order_chat(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    sender_username TEXT NOT NULL,
    recipient_username TEXT,
    ciphertext TEXT NOT NULL,
    iv TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`, [])
  await query(`CREATE INDEX IF NOT EXISTS idx_order_chat ON order_chat(order_id, id)`, [])

  console.log('[ensure] wallet/inventory/chat tables OK')
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message); process.exit(1) })
