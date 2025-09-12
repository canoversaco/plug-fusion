import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  // categories
  await query(`CREATE TABLE IF NOT EXISTS categories(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
  )`, [])

  // products
  await query(`CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    price_cents INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    image_url TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`, [])

  // product_meta (unique product_id)
  await query(`CREATE TABLE IF NOT EXISTS product_meta(
    product_id INTEGER PRIMARY KEY,
    featured INTEGER DEFAULT 0,
    featured_order INTEGER DEFAULT 0,
    badge_text TEXT,
    badge_color TEXT,
    sale_price_cents INTEGER,
    highlight_title TEXT,
    highlight_desc TEXT,
    banner_image_url TEXT,
    promo_until TEXT
  )`, [])
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message); process.exit(1) })
