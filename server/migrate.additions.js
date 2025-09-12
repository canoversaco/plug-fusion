import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { driver, query } from './db/index.js'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runFile(pth, splitter=/;\s*[\r\n]+/) {
  const sql = fs.readFileSync(pth, 'utf8')
  if (driver === 'pg') {
    await query(sql, [])
  } else {
    sql.split(splitter).forEach(stmt => { if (stmt.trim()) query(stmt, []) })
  }
}

;(async ()=>{
  try {
    if (driver === 'pg') {
      await runFile(path.join(__dirname, '..', 'infra', 'schema.additions.pg.sql'))
      console.log('[migrate+] PG additions OK')
    } else {
      await runFile(path.join(__dirname, '..', 'infra', 'schema.additions.sqlite.sql'))
      console.log('[migrate+] SQLite additions OK')
    }
    process.exit(0)
  } catch(e) {
    console.error('[migrate+] Fehler:', e?.message); process.exit(1)
  }
})()
