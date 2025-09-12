import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  // Preis-Tiers je Produkt
  await query(`CREATE TABLE IF NOT EXISTS product_price_tiers(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    grams REAL NOT NULL,
    price_cents INTEGER NOT NULL,
    UNIQUE(product_id, grams)
  )`,[])

  // grams in order_items
  try { await query(`ALTER TABLE order_items ADD COLUMN grams REAL DEFAULT 1`,[]) } catch(e){}

  // Kategorie-Highlight
  try { await query(`ALTER TABLE categories ADD COLUMN highlight INTEGER DEFAULT 0`,[]) } catch(e){}
  try { await query(`ALTER TABLE categories ADD COLUMN highlight_color TEXT`,[]) } catch(e){}

  // Defaults für vorhandene Produkte: falls KEINE Tiers existieren → 1g/5g/10g aus price_cents ableiten (5g ~ -8%, 10g ~ -20%)
  const prods = (await query(`SELECT id, price_cents FROM products WHERE active=1`,[])).rows || []
  for (const p of prods){
    const tcount = (await query(`SELECT COUNT(1) AS n FROM product_price_tiers WHERE product_id=?`, [p.id])).rows?.[0]?.n || 0
    if (tcount>0) continue
    const base = Number(p.price_cents||0)
    if (!base) continue
    const tiers = [
      { g: 1,   price: base },
      { g: 5,   price: Math.round(base*5*0.92) },
      { g: 10,  price: Math.round(base*10*0.80) },
    ]
    for (const t of tiers){
      try {
        await query(`INSERT OR IGNORE INTO product_price_tiers(product_id, grams, price_cents) VALUES(?,?,?)`, [p.id, t.g, t.price])
      } catch(e){}
    }
  }
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message||e); process.exit(1) })
