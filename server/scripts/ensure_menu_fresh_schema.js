import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  await query(`CREATE TABLE IF NOT EXISTS product_price_tiers(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    grams REAL NOT NULL,
    price_cents INTEGER NOT NULL,
    UNIQUE(product_id, grams)
  )`,[])
  try { await query(`CREATE INDEX IF NOT EXISTS idx_tiers_prod ON product_price_tiers(product_id)`,[]) } catch(e){}

  try { await query(`ALTER TABLE order_items ADD COLUMN grams REAL DEFAULT 1`,[]) } catch(e){}
  try { await query(`ALTER TABLE orders ADD COLUMN mode TEXT`,[]) } catch(e){}

  try { await query(`ALTER TABLE categories ADD COLUMN highlight INTEGER DEFAULT 0`,[]) } catch(e){}
  try { await query(`ALTER TABLE categories ADD COLUMN highlight_color TEXT`,[]) } catch(e){}

  // Degressive Default-Tiers anlegen, falls Produkt noch keine Tiers hat
  const prods = (await query(`SELECT id, price_cents FROM products WHERE active=1`,[])).rows || []
  for (const p of prods){
    const n = (await query(`SELECT COUNT(1) AS n FROM product_price_tiers WHERE product_id=?`,[p.id])).rows?.[0]?.n || 0
    if (n>0) continue
    const base = Number(p.price_cents||0); if(!base) continue
    const tiers = [
      { g: 1,   price: base },
      { g: 3.5, price: Math.round(base*3.5*0.96) },  // ~4% off
      { g: 5,   price: Math.round(base*5*0.92)  },  // ~8% off
      { g: 10,  price: Math.round(base*10*0.80) },  // ~20% off
    ]
    for (const t of tiers){
      await query(`INSERT OR IGNORE INTO product_price_tiers(product_id,grams,price_cents) VALUES(?,?,?)`,[p.id,t.g,t.price])
    }
  }
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message||e); process.exit(1) })
