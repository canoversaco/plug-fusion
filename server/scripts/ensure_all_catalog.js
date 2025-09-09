import 'dotenv/config'
import { driver, query } from '../db/index.js'

async function ensureBase(){
  await query(`CREATE TABLE IF NOT EXISTS categories(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
  )`, [])
  await query(`CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`, [])
  const alters = [
    `ALTER TABLE products ADD COLUMN image_url TEXT`,
    `ALTER TABLE products ADD COLUMN description TEXT`,
    `ALTER TABLE products ADD COLUMN updated_at TEXT`
  ]
  for (const sql of alters) { try { await query(sql, []) } catch(e) {} }
}

async function ensureMeta(){
  await query(`CREATE TABLE IF NOT EXISTS product_meta(
    product_id INTEGER PRIMARY KEY,
    featured INTEGER DEFAULT 0,
    badge_text TEXT,
    badge_color TEXT,
    highlight_title TEXT,
    highlight_desc TEXT,
    promo_until TEXT,
    sale_price_cents INTEGER,
    banner_image_url TEXT,
    featured_order INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`, [])
  await query(`CREATE INDEX IF NOT EXISTS idx_product_meta_featured ON product_meta(featured, featured_order)`, [])
}

await ensureBase()
await ensureMeta()
console.log('[ensure] catalog + product_meta OK (driver=' + driver + ')')
