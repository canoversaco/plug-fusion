import 'dotenv/config'
import { driver, query } from './db/index.js'

async function ensureTables(){
  // CATEGORIES
  await query(`CREATE TABLE IF NOT EXISTS categories(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
  )`, [])
  // PRODUCTS
  await query(`CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`, [])
  // Optional-Spalten (SQLite/PG tolerant: wir versuchen einfach, Fehler werden ignoriert)
  const alters = [
    `ALTER TABLE products ADD COLUMN image_url TEXT`,
    `ALTER TABLE products ADD COLUMN description TEXT`,
    `ALTER TABLE products ADD COLUMN updated_at TEXT`
  ]
  for (const sql of alters) { try { await query(sql, []) } catch(e) {} }
}
;(async()=>{ await ensureTables(); console.log('[migrate] catalog tables OK'); process.exit(0) })()
  .catch(e=>{ console.error(e?.message); process.exit(1) })
