import 'dotenv/config'
import bcrypt from 'bcrypt'
import { driver, query } from '../db/index.js'

function usage() {
  console.log('Usage: node scripts/create_user.js <username> <password> [role]')
  process.exit(1)
}
const [,, username, password, role='admin'] = process.argv
if (!username || !password) usage()

const hashPassword = async (pw) => bcrypt.hash(pw, 12)

;(async () => {
  const pwHash = await hashPassword(password)
  if (driver === 'pg') {
    await query(
      `INSERT INTO users (username, role, password_hash)
       VALUES ($1,$2,$3)
       ON CONFLICT (username) DO UPDATE
       SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash`,
      [username, role, pwHash]
    )
  } else {
    await query(
      `INSERT INTO users (username, role, password_hash)
       VALUES (?,?,?)
       ON CONFLICT(username) DO UPDATE SET
         role=excluded.role,
         password_hash=excluded.password_hash`,
      [username, role, pwHash]
    )
  }
  console.log(`OK: Benutzer "${username}" als ${role} angelegt/aktualisiert.`)
  process.exit(0)
})().catch(e => {
  console.error('Fehler:', e?.message); process.exit(1)
})
