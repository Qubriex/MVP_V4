// core/db/dal.js
// The data-access layer. One shared connection per process, opened lazily
// from DB_PATH (default ./qubirex.db) with the driver named by DB_DRIVER
// (sqlite in Phase 0). Everything outside core/db talks to the database
// through these functions, so the PostgreSQL move is a driver swap.
//
//   one(sql, ...params)  → first row or undefined
//   all(sql, ...params)  → rows
//   run(sql, ...params)  → { changes }
//   tx(fn)               → runs fn inside a transaction and returns its result
//   nowIso()             → the timestamp format every new row uses (§6)
//
// Legacy route code written against better-sqlite3 still calls getDb() from
// db/init.js; that returns legacyHandle(), the same shared connection with
// close() made harmless.
import 'dotenv/config';
import * as sqlite from './sqlite.js';
import * as postgres from './postgres.js';

const DRIVERS = { sqlite, postgres };

/** @type {import('./sqlite.js').Driver | null} */
let conn = null;
let driverModule = null;
let legacy = null;

export function connect({ file = process.env.DB_PATH || './qubirex.db', driver = process.env.DB_DRIVER || 'sqlite' } = {}) {
  if (conn) close();
  driverModule = DRIVERS[driver];
  if (!driverModule) throw new Error(`Unknown DB_DRIVER "${driver}"`);
  conn = driverModule.open(file);
  return conn;
}

/** @returns {import('./sqlite.js').Driver} */
export function db() {
  return conn || connect();
}

export function driver() {
  db();
  return driverModule;
}

export function close() {
  if (conn) conn.close();
  conn = null;
  legacy = null;
}

export const one = (sql, ...params) => db().prepare(sql).get(...params);
export const all = (sql, ...params) => db().prepare(sql).all(...params);
export const run = (sql, ...params) => {
  const r = db().prepare(sql).run(...params);
  return { changes: r.changes };
};
export const exec = (sql) => db().exec(sql);
export const tx = (fn) => db().transaction(fn);
export const inTransaction = () => db().inTransaction();
export const nowIso = () => new Date().toISOString();

// Schema introspection, answered by the driver (used by migrations and tests).
export const columns = (table) => driver().columns(db(), table);
export const tableExists = (table) => driver().tableExists(db(), table);
export const tables = () => driver().tables(db());

/**
 * The shared connection in better-sqlite3 form for legacy call sites that
 * still do `const db = getDb(); ...; db.close()`. close() is a no-op so one
 * route can't close the connection under another.
 */
export function legacyHandle() {
  const raw = db().raw;
  if (legacy && legacy.target === raw) return legacy.proxy;
  const proxy = new Proxy(raw, {
    get(target, prop) {
      if (prop === 'close') return () => {};
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  legacy = { target: raw, proxy };
  return proxy;
}
