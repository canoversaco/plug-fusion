import 'dotenv/config'
import { query, driver } from '../db/index.js'

async function run(){
  const isPg = (driver==='pg')

  const conv = isPg
    ? `CREATE TABLE IF NOT EXISTS conversations(
         id SERIAL PRIMARY KEY, type TEXT, title TEXT, direct_key TEXT UNIQUE,
         order_id INTEGER, created_by TEXT, created_at TIMESTAMPTZ DEFAULT now()
       )`
    : `CREATE TABLE IF NOT EXISTS conversations(
         id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, title TEXT, direct_key TEXT UNIQUE,
         order_id INTEGER, created_by TEXT, created_at TEXT DEFAULT (datetime('now'))
       )`

  const parts = isPg
    ? `CREATE TABLE IF NOT EXISTS conversation_participants(
         conversation_id INTEGER REFERENCES conversations(id),
         username TEXT, PRIMARY KEY(conversation_id, username)
       )`
    : `CREATE TABLE IF NOT EXISTS conversation_participants(
         conversation_id INTEGER, username TEXT, PRIMARY KEY(conversation_id, username)
       )`

  const msgs = isPg
    ? `CREATE TABLE IF NOT EXISTS messages(
         id SERIAL PRIMARY KEY, conversation_id INTEGER REFERENCES conversations(id),
         sender_username TEXT, text TEXT, created_at TIMESTAMPTZ DEFAULT now()
       )`
    : `CREATE TABLE IF NOT EXISTS messages(
         id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER,
         sender_username TEXT, text TEXT, created_at TEXT DEFAULT (datetime('now'))
       )`

  await query(conv,[])
  await query(parts,[])
  await query(msgs,[])
  console.log('[chat] tables ok')
}
run().then(()=>process.exit(0)).catch((e)=>{ console.error(e); process.exit(1) })
