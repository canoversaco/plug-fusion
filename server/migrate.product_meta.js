import 'dotenv/config'
import { driver, query } from './db/index.js'

async function ensureSqlite() {
  await query(`CREATE TABLE IF NOT EXISTS product_meta(
    product_id INTEGER PRIMARY KEY,
    featured INTEGER DEFAULT 0,
    badge_text TEXT,
    badge_color TEXT,            -- z.B. #22c55e / #ef4444
    highlight_title TEXT,
    highlight_desc TEXT,
    promo_until TEXT,            -- ISO Datum
    sale_price_cents INTEGER,    -- optionaler Sale-Preis
    banner_image_url TEXT,
    featured_order INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`, [])
  // Indexe
  await query(`CREATE INDEX IF NOT EXISTS idx_product_meta_featured ON product_meta(featured, featured_order)`, [])
}

async function ensurePg() {
  await query(`
  CREATE TABLE IF NOT EXISTS product_meta(
    product_id BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    featured INTEGER DEFAULT 0,
    badge_text TEXT,
    badge_color TEXT,
    highlight_title TEXT,
    highlight_desc TEXT,
    promo_until TEXT,
    sale_price_cents INTEGER,
    banner_image_url TEXT,
    featured_order INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
  );`, [])
  await query(`CREATE INDEX IF NOT EXISTS idx_product_meta_featured ON product_meta(featured, featured_order)`, [])
}

;(async () => {
  if (driver === 'pg') await ensurePg(); else await ensureSqlite();
  console.log('[migrate] product_meta OK (driver=' + driver + ')')
  process.exit(0)
})().catch(e => { console.error(e?.message); process.exit(1) })
