import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { createPg } from '../db_pg.js';
import { createSqlite } from '../db_sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRIVER = (process.env.DB_DRIVER || '').toLowerCase();
const HAS_PG_URL = (process.env.DATABASE_URL || '').startsWith('postgres://');

let driver = 'sqlite';
if (DRIVER === 'pg' || (DRIVER !== 'sqlite' && HAS_PG_URL)) driver = 'pg';

let db, query, tx;

if (driver === 'pg') {
  const pg = createPg(process.env.DATABASE_URL);
  db = pg.pool; query = pg.query; tx = pg.tx;
  console.log('[db] Treiber: Postgres');
} else {
  const dbPath = process.env.SQLITE_FILE || path.join(__dirname, '..', '..', 'data', 'plug_fusion.db');
  const sqlite = createSqlite(dbPath);
  db = sqlite.db; query = sqlite.query; tx = sqlite.tx;
  console.log('[db] Treiber: SQLite ->', dbPath);
}

export { db, query, tx, driver };
