// core/db/pg.js
// PostgreSQL over the network (production: Neon / Vercel Postgres), via a
// small pg Pool. A transaction checks out one client and holds it until
// COMMIT or ROLLBACK.
import pg from 'pg';

// COUNT/SUM (int8) and AVG/ROUND (numeric) come back as numbers, as they did
// from SQLite. Values stay well inside Number's safe range.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export function open(url) {
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 10000,
    ssl: /localhost|127\.0\.0\.1/.test(url) || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false }
  });
  return {
    kind: 'pg',
    pool,
    query: (text, values) => pool.query(text, values),
    exec: (sql) => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const exe = { query: (t, v) => client.query(t, v), exec: (s) => client.query(s) };
        const result = await fn(exe);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end()
  };
}
