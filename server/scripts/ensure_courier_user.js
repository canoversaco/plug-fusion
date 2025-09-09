import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { query } from '../db/index.js'

const username = process.env.SEED_COURIER_USERNAME || 'courier'
const password = process.env.SEED_COURIER_PASSWORD || 'Plug!Courier#2025'
const hash = bcrypt.hashSync(password, 10)

async function run(){
  // users Tabelle minimal absichern
  try{ await query(`ALTER TABLE users ADD COLUMN wallet_balance_cents INTEGER DEFAULT 0`,[]) }catch(e){}
  try{ await query(`ALTER TABLE users ADD COLUMN courier_online INTEGER DEFAULT 0`,[]) }catch(e){}
  const exists = (await query(`SELECT id,role FROM users WHERE username=?`,[username])).rows?.[0]
  if (!exists){
    await query(`INSERT INTO users(username,password_hash,role,wallet_balance_cents,courier_online)
                 VALUES(?,?, 'courier', 0, 1)`, [username, hash])
    console.log('[seed] courier user created:', username)
  }else{
    await query(`UPDATE users SET role='courier', password_hash=?, courier_online=1 WHERE username=?`, [hash, username])
    console.log('[seed] courier user updated:', username)
  }
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1) })
