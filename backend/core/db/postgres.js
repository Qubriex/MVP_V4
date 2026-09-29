// core/db/postgres.js
// PostgreSQL driver (Phase 1+). Same shape as core/db/sqlite.js so the move is
// a driver swap, not a rewrite. Not wired up in Phase 0.
export function open() {
  throw new Error('The PostgreSQL driver is not available in Phase 0. Set DB_DRIVER=sqlite.');
}
export function columns() { throw new Error('postgres: not implemented'); }
export function tableExists() { throw new Error('postgres: not implemented'); }
export function tables() { throw new Error('postgres: not implemented'); }
