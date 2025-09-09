import 'dotenv/config'
import { query } from '../db/index.js'
async function run(){
  await query(`CREATE TABLE IF NOT EXISTS dm_messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_username TEXT,
    recipient_username TEXT,
    body TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    read_at TEXT
  )`, [])
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message); process.exit(1) })
