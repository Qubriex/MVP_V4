// core/db/sqlite.js
// The SQLite driver. This is the only module that imports better-sqlite3 and
// the only place SQLite-specific behaviour (pragmas, WAL) may live; the rest
// of the app talks to core/db/dal.js. Swapping to PostgreSQL means providing
// core/db/postgres.js with the same shape.
import Database from 'better-sqlite3';
import path from 'path';

/**
 * @typedef {object} Driver
 * @property {string} dialect
 * @property {(sql: string) => any} prepare
 * @property {(sql: string) => void} exec
 * @property {<T>(fn: () => T) => T} transaction  runs fn in a transaction (nested calls use savepoints)
 * @property {() => boolean} inTransaction
 * @property {(sql: string) => any} pragma
 * @property {() => void} close
 * @property {any} raw                             the underlying connection, for legacy call sites only
 */

/** @returns {Driver} */
export function open(file) {
  const target = file === ':memory:' ? ':memory:' : path.resolve(file);
  const db = new Database(target);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return {
    dialect: 'sqlite',
    prepare: (sql) => db.prepare(sql),
    exec: (sql) => db.exec(sql),
    transaction: (fn) => db.transaction(fn)(),
    inTransaction: () => db.inTransaction,
    pragma: (sql) => db.pragma(sql),
    close: () => db.close(),
    raw: db
  };
}

// SQLite-only helpers used by migrations (other drivers use information_schema).
export function columns(driver, table) {
  return driver.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

export function tableExists(driver, table) {
  return !!driver.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
}

export function tables(driver) {
  return driver.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
}
