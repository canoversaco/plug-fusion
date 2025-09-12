import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { driver, query } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateSqlite() {
  const schemaPath = path.join(__dirname, '..', 'infra', 'schema.sqlite.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  // split rudimentär: in SQLite können wir den ganzen Block ausführen
  sql.split(/;\s*[\r\n]+/).forEach((stmt) => {
    if (stmt.trim()) query(stmt);
  });
  console.log('[migrate] SQLite OK');
}

async function migratePg() {
  const schemaPath = path.join(__dirname, '..', 'infra', 'schema.pg.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
  console.log('[migrate] Postgres OK');
}

(async () => {
  try {
    if (driver === 'pg') await migratePg();
    else await migrateSqlite();
    process.exit(0);
  } catch (e) {
    console.error('[migrate] Fehler:', e?.message);
    process.exit(1);
  }
})();
