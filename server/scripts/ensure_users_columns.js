import 'dotenv/config'
import { query } from '../db/index.js'

async function run(){
  try { await query(`ALTER TABLE users ADD COLUMN wallet_balance_cents INTEGER DEFAULT 0`,[]) } catch(e){}
  try { await query(`ALTER TABLE users ADD COLUMN password_hash TEXT`,[]) } catch(e){}

  // In SQLite sind bestehende Zeilen nach ALTER oft NULL → auf 0 setzen
  try { await query(`UPDATE users SET wallet_balance_cents=0 WHERE wallet_balance_cents IS NULL`,[]) } catch(e){}

  // sanity: kleine Abfrage damit der Server danach nicht stolpert
  await query(`SELECT id, username, role, wallet_balance_cents FROM users LIMIT 1`,[])
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message||e); process.exit(1) })
