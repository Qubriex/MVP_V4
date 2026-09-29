// core/db/migrate.js
// Applies migrations/NNNN_name.js in order, each in its own transaction, and
// records them in schema_migrations. A migration exports `id` and `up(db)`,
// where db is the DAL driver. Applied migrations are never edited: a schema
// change is a new file.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as dal from './dal.js';
import { logger } from '../logger.js';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

export async function loadMigrations(dir = MIGRATIONS_DIR) {
  const files = fs.readdirSync(dir).filter(f => /^\d{4}_.+\.js$/.test(f)).sort();
  const out = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    if (!mod.id || typeof mod.up !== 'function') throw new Error(`Migration ${f} must export id and up()`);
    out.push({ id: mod.id, file: f, up: mod.up });
  }
  return out;
}

/** @returns {Promise<string[]>} ids applied by this call */
export async function migrate({ dir } = {}) {
  const conn = dal.db();
  conn.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const done = new Set(conn.prepare('SELECT id FROM schema_migrations').all().map(r => r.id));
  const applied = [];
  for (const m of await loadMigrations(dir)) {
    if (done.has(m.id)) continue;
    conn.transaction(() => {
      m.up(conn);
      conn.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(m.id, dal.nowIso());
    });
    applied.push(m.id);
    logger.info('migration.applied', { id: m.id });
  }
  return applied;
}
