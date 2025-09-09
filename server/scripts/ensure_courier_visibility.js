import 'dotenv/config'
import { query } from '../db/index.js'

async function ensureSchema(){
  try{ await query(`ALTER TABLE users ADD COLUMN courier_online INTEGER DEFAULT 0`,[]) }catch(e){}
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
  try{ await query(`ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1`,[]) }catch(e){}
  await query(`UPDATE products SET active=1 WHERE active IS NULL`,[])
  await query(`UPDATE products SET price_cents=100 WHERE price_cents IS NULL`,[])
}

async function seedDemoIfEmpty(){
  const c = (await query(`SELECT COUNT(*) AS n FROM orders`,[])).rows?.[0]?.n || 0
  if (Number(c)>0) return
  // 1 aktives Produkt sicherstellen
  let p = (await query(`SELECT id,name,price_cents FROM products WHERE active=1 ORDER BY id LIMIT 1`,[])).rows?.[0]
  if (!p){
    await query(`INSERT INTO products(name,price_cents,active) VALUES('Demo Produkt',500,1)`,[])
    p = (await query(`SELECT id,name,price_cents FROM products WHERE active=1 ORDER BY id LIMIT 1`,[])).rows?.[0]
  }
  // Demo-Bestellung „wartet_bestätigung“
  await query(`INSERT INTO orders(user_username,status,subtotal_cents,total_cents,mode,created_at)
               VALUES('admin','wartet_bestätigung', ?, ?, 'pickup', datetime('now'))`, [p.price_cents, p.price_cents])
  const oid = (await query(`SELECT last_insert_rowid() AS id`,[])).rows?.[0]?.id
  await query(`INSERT INTO order_items(order_id,product_id,name,price_cents,qty,grams)
               VALUES(?,?,?,?,1,1)`, [oid, p.id, p.name, p.price_cents])
}

(async()=>{ await ensureSchema(); await seedDemoIfEmpty() })()
  .then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1) })
