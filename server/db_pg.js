import pg from 'pg';
const { Pool } = pg;

function paramify(text){
  let i=0;
  return text.replace(/\?/g, ()=>'$'+(++i));
}

export function createPg(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
  pool.on('error', (err) => {
    console.error('[pg] Pool error (weiterlaufen):', err?.message);
  });

  async function query(text, params = []) {
    try {
      const t = paramify(text);
      const r = await pool.query(t, params);
      return { rows: r.rows };
    } catch (e) {
      console.error('[pg] query error (weiterlaufen):', e?.message);
      return { rows: [] };
    }
  }

  async function tx(fn) {
    const client = await pool.connect();
    const q = (t,p)=> client.query(paramify(t), p).then(r=>({ rows:r.rows }));
    try {
      await client.query('BEGIN');
      const result = await fn({ query:q });
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK'); throw e;
    } finally {
      client.release();
    }
  }

  return { pool, query, tx };
}
