// core/db/dal.js
// The data-access layer. Every database call in the app goes through these
// functions, all async, against PostgreSQL:
//   - DATABASE_URL (or POSTGRES_URL) set → a pg Pool (production, Neon/Vercel Postgres)
//   - otherwise → PGlite, in process: DB_PATH directory (default ./data/pglite),
//     or ':memory:' for tests
//
//   one(sql, ...params)  → first row or undefined
//   all(sql, ...params)  → rows
//   run(sql, ...params)  → { changes }
//   exec(sql)            → runs one or more statements, no parameters
//   tx(fn)               → runs async fn inside a transaction; nested calls use savepoints
//   nowIso()             → the timestamp format every new row uses (§6)
//
// SQL is written with ? placeholders (or @name with one object); core/db/sql.js
// turns it into $n form. Inside tx(), every call made by fn — however deep —
// uses the transaction's connection (AsyncLocalStorage), so callers never pass
// a client around.
//
// Legacy route code still calls getDb()/legacyHandle() and
// `await db.prepare(sql).get(...)`; that is a thin wrapper over the same calls.
import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as pgDriver from './pg.js';
import * as pgliteDriver from './pglite.js';
import { translate, bind } from './sql.js';

const store = new AsyncLocalStorage();
let conn = null;
let spSeq = 0;

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

/** Opens the connection named by the environment (or the options). */
export function connect({ url = databaseUrl(), file = process.env.DB_PATH || './data/pglite' } = {}) {
  if (conn) { const old = conn; conn = null; old.close().catch?.(() => {}); }
  conn = url ? pgDriver.open(url) : pgliteDriver.open(file);
  return conn;
}

export function db() {
  return conn || connect();
}

export const driverKind = () => db().kind;

export async function close() {
  if (conn) { const c = conn; conn = null; await c.close(); }
}

const executor = () => store.getStore()?.exe || db();

async function query(sql, params) {
  const t = translate(sql);
  const values = bind(t, params);
  try {
    return await executor().query(t.text, values);
  } catch (err) {
    err.sql = t.text.slice(0, 400);
    throw err;
  }
}

export const one = async (sql, ...params) => (await query(sql, params)).rows[0];
export const all = async (sql, ...params) => (await query(sql, params)).rows;
export const run = async (sql, ...params) => ({ changes: (await query(sql, params)).rowCount });
export const exec = (sql) => executor().exec(sql);
export const inTransaction = () => !!store.getStore();

export async function tx(fn) {
  const current = store.getStore();
  if (current) {
    const sp = `sp_${++spSeq}`;
    await current.exe.query(`SAVEPOINT ${sp}`);
    try {
      const result = await fn();
      await current.exe.query(`RELEASE SAVEPOINT ${sp}`);
      return result;
    } catch (err) {
      await current.exe.query(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {});
      throw err;
    }
  }
  return db().transaction((exe) => store.run({ exe }, fn));
}

export const nowIso = () => new Date().toISOString();

// Schema introspection (migrations and tests).
export const tables = async () => (await all(`SELECT table_name AS name FROM information_schema.tables
  WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name`)).map(r => r.name);
export const columns = async (table) => (await all(`SELECT column_name AS name FROM information_schema.columns
  WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position`, table)).map(r => r.name);
export const tableExists = async (table) => (await tables()).includes(table);

/**
 * The better-sqlite3-shaped handle legacy call sites use:
 *   const db = getDb(); const row = await db.prepare(sql).get(...); db.close();
 * transaction(fn) returns an async function that runs fn in tx().
 */
const legacy = {
  prepare: (sql) => ({
    get: (...p) => one(sql, ...p),
    all: (...p) => all(sql, ...p),
    run: (...p) => run(sql, ...p)
  }),
  exec: (sql) => exec(sql),
  transaction: (fn) => (...args) => tx(() => fn(...args)),
  close: () => {}
};
export function legacyHandle() {
  return legacy;
}
