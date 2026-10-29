// core/demo/cleanup.js — deletes one demo sandbox completely: the world
// core/demo/world.js built, and everything the visitor created in it
// (cohorts, roles, answers, Passports, messages, sessions).
//
// How: start from the sandbox's roots (its college and companies, which carry
// sandbox_id, plus its sessions and inbox), then follow every foreign key from
// parent to child — read from the database's own catalogue, so a new table is
// covered without a change here — and the few id columns that have no foreign
// key (SOFT_EDGES). Only children of collected rows are ever collected, so a
// row outside the sandbox can be reached only through a cross-world link,
// which the world wall (core/testTenant.js) never creates. Everything is then
// deleted children-first in one transaction.
//
// Append-only tables (consents, credentials, demonstrations, faculty reviews,
// access events) refuse deletes, except inside this transaction, which sets
// qbx.demo_cleanup locally (migration 0008). This file is the only place
// allowed to set it (tests/structural/demoCleanup.test.js). The same closure
// also rebuilds the test tenant's journey learners (deleteJourneyLearners).
import * as dal from '../db/dal.js';
import { logger } from '../logger.js';

// Id columns without a foreign key: [child table, child column, parent table, parent column].
const SOFT_EDGES = [
  ['access_events', 'engagement_learner_id', 'engagement_learners', 'id'],
  ['auth_sessions', 'institution_id', 'institutions', 'id'],
  ['auth_sessions', 'employer_id', 'employers', 'id'],
  ['cultural_usage_log', 'learner_id', 'learners', 'id'],
  ['family_instances', 'learner_id', 'learners', 'id'],
  ['help_requests', 'institution_id', 'institutions', 'id'],
  ['help_requests', 'employer_id', 'employers', 'id'],
  ['model_calls', 'institution_id', 'institutions', 'id'],
  ['orchestration_log', 'learner_id', 'learners', 'id'],
  ['outbound_messages', 'institution_id', 'institutions', 'id'],
  ['passport_shares', 'evidence_id', 'credentials', 'evidence_id'],
  ['placements', 'employer_id', 'employers', 'id'],
  ['renewal_runs', 'el_id', 'engagement_learners', 'id'],
  ['review_queue', 'el_id', 'engagement_learners', 'id'],
  ...['learners', 'institution_users', 'institutions', 'employers', 'employer_users'].flatMap(t => [
    ['notifications', 'actor_id', t, 'id'],
    ['notification_state', 'actor_id', t, 'id']
  ]),
  ...[['learners', 'id'], ['engagement_learners', 'id'], ['employers', 'id'], ['credentials', 'evidence_id'], ['engagements', 'id'], ['mastery_logs', 'id']]
    .map(([t, c]) => ['domain_events', 'aggregate_id', t, c])
];
// Shared reference data a sandbox row may point at but never owns.
const NEVER = new Set(['skills', 'skill_aliases', 'skill_prereqs', 'status_lists', 'signing_keys', 'prompt_versions', 'eval_rubrics', 'eval_example_responses', 'cultural_knowledge_base', 'system_secrets', 'schema_migrations']);

let edgesCache = null;
async function edges() {
  if (edgesCache) return edgesCache;
  const fks = await dal.all(`SELECT tc.table_name AS t, kcu.column_name AS c, ccu.table_name AS pt, ccu.column_name AS pc
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = current_schema()`);
  edgesCache = [...fks.map(f => [f.t, f.c, f.pt, f.pc]), ...SOFT_EDGES].filter(([t, , pt]) => !NEVER.has(t) && !NEVER.has(pt));
  return edgesCache;
}

const q = (name) => `"${name.replace(/"/g, '')}"`;

/**
 * Every row of a sandbox, as { table: Set(ctid) }. Read-only.
 * @param {string} sbx
 */
export async function collectSandbox(sbx) {
  return collectFrom([
    ['institutions', 'sandbox_id = ? AND is_demo = 1', [sbx]],
    ['employers', 'sandbox_id = ? AND is_demo = 1', [sbx]],
    ['auth_sessions', 'sandbox_id = ?', [sbx]],
    ['outbound_messages', 'sandbox_id = ?', [sbx]]
  ]);
}

/** Every row reachable, parent to child, from the root rows. Read-only. */
async function collectFrom(roots) {
  const E = await edges();
  const parentCols = new Map(); // table -> Set(referenced columns)
  E.forEach(([, , pt, pc]) => { if (!parentCols.has(pt)) parentCols.set(pt, new Set()); parentCols.get(pt).add(pc); });
  const rows = new Map(); // table -> Set(ctid)
  const values = new Map(); // `${table}.${col}` -> Set(value)
  let frontier = []; // [table, newRowObjects]

  async function take(table, where, args) {
    const cols = [...(parentCols.get(table) || [])];
    const found = await dal.all(`SELECT ctid::text AS _ctid${cols.map(c => `, ${q(c)}::text AS ${q(c)}`).join('')} FROM ${q(table)} WHERE ${where}`, ...args);
    if (!rows.has(table)) rows.set(table, new Set());
    const fresh = found.filter(r => !rows.get(table).has(r._ctid));
    fresh.forEach(r => {
      rows.get(table).add(r._ctid);
      cols.forEach(c => { if (r[c] != null) { const k = `${table}.${c}`; if (!values.has(k)) values.set(k, new Set()); values.get(k).add(r[c]); } });
    });
    if (fresh.length) frontier.push([table, fresh]);
  }

  for (const [table, where, args] of roots) await take(table, where, args);

  while (frontier.length) {
    const level = frontier; frontier = [];
    const touched = new Set(level.map(([t]) => t));
    for (const [child, col, parent, pcol] of E) {
      if (!touched.has(parent)) continue;
      const vals = [...(values.get(`${parent}.${pcol}`) || [])];
      if (!vals.length) continue;
      await take(child, `${q(col)}::text = ANY(?::text[])`, [vals]);
    }
  }
  return rows;
}

// Children before parents, from the foreign keys among the tables to delete.
async function deleteOrder(tables) {
  const E = await edges();
  const set = new Set(tables);
  const children = new Map(tables.map(t => [t, new Set()]));
  E.forEach(([c, , p]) => { if (set.has(c) && set.has(p) && c !== p) children.get(p).add(c); });
  const order = []; const done = new Set();
  while (order.length < tables.length) {
    const next = tables.filter(t => !done.has(t) && [...children.get(t)].every(c => done.has(c)));
    if (!next.length) { tables.filter(t => !done.has(t)).forEach(t => { done.add(t); order.push(t); }); break; } // a cycle: let the database say
    next.forEach(t => { done.add(t); order.push(t); });
  }
  return order;
}

/**
 * Delete one sandbox and mark it deleted. Safe to call twice.
 * @returns {Promise<{ rows: number, tables: number }>}
 */
export async function deleteSandbox(sbx) {
  if (!/^[a-z0-9]{10}$/.test(String(sbx || ''))) throw new Error('Not a sandbox id');
  let total = 0; let tableCount = 0;
  await dal.tx(async () => {
    await dal.run("UPDATE auth_sessions SET revoked_at = ? WHERE sandbox_id = ? AND revoked_at IS NULL", dal.nowIso(), sbx);
    const rows = await collectSandbox(sbx);
    const tables = [...rows.keys()].filter(t => rows.get(t).size);
    await dal.one("SELECT set_config('qbx.demo_cleanup', 'on', true) AS on");
    for (const t of await deleteOrder(tables)) {
      const r = await dal.run(`DELETE FROM ${q(t)} WHERE ctid = ANY(?::tid[])`, [...rows.get(t)]);
      total += r.changes; tableCount += 1;
    }
    await dal.one("SELECT set_config('qbx.demo_cleanup', 'off', true) AS off");
    await dal.run('UPDATE demo_sandboxes SET deleted_at = COALESCE(deleted_at, ?) WHERE id = ?', dal.nowIso(), sbx);
  });
  logger.info('demo.sandbox_deleted', { sandbox: sbx, rows: total, tables: tableCount });
  return { rows: total, tables: tableCount };
}

// The journey learners (scripts/journeyData.js) are rebuilt on every "Reset
// test data", including their append-only evidence, so each stage comes back
// exactly. Only learners with a journey id in the test institution are
// accepted; everything else is refused before anything is read.
const JOURNEY_ID = /^test-j-[a-z0-9-]+$/;
export async function deleteJourneyLearners(learnerIds, testInstitutionId) {
  const ids = [...new Set(learnerIds)];
  if (!ids.length) return { rows: 0, tables: 0 };
  if (!ids.every(id => JOURNEY_ID.test(id))) throw new Error('Not a journey learner id');
  const ok = await dal.all(`SELECT l.id FROM learners l JOIN institutions i ON i.id = l.institution_id
    WHERE l.id = ANY(?::text[]) AND l.institution_id = ? AND i.is_test = 1`, ids, testInstitutionId);
  const present = new Set(ok.map(r => r.id));
  const existing = (await dal.all('SELECT id FROM learners WHERE id = ANY(?::text[])', ids)).map(r => r.id);
  if (existing.some(id => !present.has(id))) throw new Error('A journey learner is outside the test tenant');
  if (!existing.length) return { rows: 0, tables: 0 };
  let total = 0; let tableCount = 0;
  await dal.tx(async () => {
    await dal.run("UPDATE auth_sessions SET revoked_at = ? WHERE actor_type = 'learner' AND actor_id = ANY(?::text[]) AND revoked_at IS NULL", dal.nowIso(), existing);
    const rows = await collectFrom([['learners', 'id = ANY(?::text[])', [existing]]]);
    const tables = [...rows.keys()].filter(t => rows.get(t).size);
    await dal.one("SELECT set_config('qbx.demo_cleanup', 'on', true) AS on");
    for (const t of await deleteOrder(tables)) {
      const r = await dal.run(`DELETE FROM ${q(t)} WHERE ctid = ANY(?::tid[])`, [...rows.get(t)]);
      total += r.changes; tableCount += 1;
    }
    await dal.one("SELECT set_config('qbx.demo_cleanup', 'off', true) AS off");
  });
  return { rows: total, tables: tableCount };
}

/** Delete sandboxes past their hard expiry or 2 hours idle (oldest first). */
export async function deleteExpired({ limit = 5, idleMs = 2 * 3600000 } = {}) {
  const now = dal.nowIso();
  const idle = new Date(Date.now() - idleMs).toISOString();
  const due = await dal.all('SELECT id FROM demo_sandboxes WHERE deleted_at IS NULL AND (expires_at <= ? OR last_active_at <= ?) ORDER BY created_at LIMIT ?', now, idle, limit);
  let n = 0;
  for (const { id } of due) {
    try { await deleteSandbox(id); n += 1; } catch (err) { logger.error('demo.cleanup_failed', { sandbox: id, error: err.message }); }
  }
  return n;
}
