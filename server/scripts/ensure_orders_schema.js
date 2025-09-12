import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  // orders: Kurier, ETA, Koordinaten, Updates
  try{ await query(`ALTER TABLE orders ADD COLUMN courier_username TEXT`,[]) }catch(e){}
  try{ await query(`ALTER TABLE orders ADD COLUMN eta_minutes INTEGER`,[]) }catch(e){}
  try{ await query(`ALTER TABLE orders ADD COLUMN courier_lat REAL`,[]) }catch(e){}
  try{ await query(`ALTER TABLE orders ADD COLUMN courier_lng REAL`,[]) }catch(e){}
  try{ await query(`ALTER TABLE orders ADD COLUMN updated_at TEXT`,[]) }catch(e){}
  try{ await query(`ALTER TABLE orders ADD COLUMN mode TEXT`,[]) }catch(e){} // falls noch nicht da

  // order_tracking: Status-/Positionsverlauf
  await query(`CREATE TABLE IF NOT EXISTS order_tracking(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    status TEXT,              -- z.B. 'wartet_bestätigung','angenommen','unterwegs','angekommen','abgeschlossen','storniert'
    eta_minutes INTEGER,
    lat REAL,
    lng REAL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,[])

  await query(`CREATE INDEX IF NOT EXISTS idx_track_order ON order_tracking(order_id)`,[])

  // order_messages: Chat (verschlüsselt am Server)
  await query(`CREATE TABLE IF NOT EXISTS order_messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    sender_username TEXT NOT NULL,
    cipher TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,[])

  await query(`CREATE INDEX IF NOT EXISTS idx_msg_order ON order_messages(order_id)`,[])

  // Dummy: falls Items-Tabelle grams noch fehlt
  try{ await query(`ALTER TABLE order_items ADD COLUMN grams REAL DEFAULT 1`,[]) }catch(e){}
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1) })
