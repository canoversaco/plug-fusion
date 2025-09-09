import 'dotenv/config'
import { query } from '../db/index.js'
async function run(){
  try { await query(`ALTER TABLE users ADD COLUMN password_hash TEXT`,[]) } catch(e){}
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message||e); process.exit(1) })
