import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export function createSqlite(dbFile) {
  const dir = path.dirname(dbFile);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  function query(text, params = []) {
    try {
      const stmt = db.prepare(text.replace(/\$[0-9]+/g,'?')); // $1 -> ? (falls aus PG kopiert)
      if (/^\s*select/i.test(text)) {
        const rows = stmt.all(...params);
        return { rows };
      } else {
        const info = stmt.run(...params);
        return { rows: [], changes: info.changes, lastInsertRowid: info.lastInsertRowid };
      }
    } catch (e) {
      console.error('[sqlite] query error (weiterlaufen):', e?.message);
      return { rows: [] };
    }
  }

  async function tx(fn) {
    const trx = db.transaction((inner) => fn({ query: (t,p)=> {
      const stmt = db.prepare(t.replace(/\$[0-9]+/g,'?'));
      if (/^\s*select/i.test(t)) return { rows: stmt.all(...(p||[])) };
      const info = stmt.run(...(p||[])); return { rows: [], changes: info.changes };
    }}));
    return trx();
  }

  return { db, query, tx };
}
