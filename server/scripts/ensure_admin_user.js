import 'dotenv/config'
import { query } from '../db/index.js'
import * as B from 'bcryptjs'

const ADMIN_USER='admin'
const ADMIN_PASS=process.env.PF_ADMIN_PASSWORD || 'Plug!Admin#2025'

async function run(){
  const r = await query(`SELECT id, username, role, password_hash FROM users WHERE username=?`, [ADMIN_USER])
  if (!r.rows || r.rows.length===0){
    const hash = await B.hash(ADMIN_PASS, 10)
    await query(`INSERT INTO users(username, role, wallet_balance_cents, password_hash) VALUES(?,?,?,?)`,
      [ADMIN_USER,'admin',0,hash])
    console.log('[seed] admin angelegt (username: admin)')
  } else {
    const u = r.rows[0]
    if (!u.password_hash){
      const hash = await B.hash(ADMIN_PASS, 10)
      await query(`UPDATE users SET password_hash=? WHERE id=?`, [hash, u.id])
      console.log('[seed] admin: password_hash ergänzt')
    } else {
      console.log('[seed] admin ok')
    }
  }
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message||e); process.exit(1) })
