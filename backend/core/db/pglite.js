// core/db/pglite.js
// PostgreSQL compiled to WebAssembly (PGlite), in-process. Used for local
// development (a data directory) and tests (in memory), so both run the same
// SQL dialect as production without a database server. PGlite has one
// connection: its transaction() holds a lock, so statements from other
// requests wait until the transaction ends.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

const parsers = { 20: (v) => Number(v), 1700: (v) => Number(v) };

export function open(file) {
  const memory = !file || file === ':memory:';
  if (!memory) fs.mkdirSync(path.resolve(file), { recursive: true });
  const db = memory ? new PGlite({ parsers }) : new PGlite(path.resolve(file), { parsers });
  const shape = (r) => ({ rows: r.rows, rowCount: r.affectedRows ?? r.rows.length });
  return {
    kind: 'pglite',
    query: async (text, values) => shape(await db.query(text, values)),
    exec: (sql) => db.exec(sql),
    transaction: (fn) => db.transaction((tx) => fn({
      query: async (t, v) => shape(await tx.query(t, v)),
      exec: (s) => tx.exec(s)
    })),
    close: () => db.close()
  };
}
