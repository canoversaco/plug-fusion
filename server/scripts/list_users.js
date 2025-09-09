import 'dotenv/config'
import { query, driver } from '../db/index.js'
const r = await query('SELECT id, username, role FROM users ORDER BY id ASC', [])
console.log({ driver, users: r.rows })
process.exit(0)
