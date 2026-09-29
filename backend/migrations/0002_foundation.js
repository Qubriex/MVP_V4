// migrations/0002_foundation.js
// Phase 0, step 1 (Foundation):
//   - domain_events (transactional outbox) + event_consumptions (idempotent subscribers)
//   - consents (append-only; withdrawal only through core/consent/levels.js)
//   - access_events made append-only; PIN-reset resolution becomes an event
//   - learners: discoverability, availability, city, age_status (unknown = minor)
//   - employers, employer_users (the fourth actor type)
//   - auth_sessions (cookie sessions, CSRF binding, real logout), login_failures (lockout)
//   - model_calls, prompt_versions (AI gateway log)
//   - node_mastery loses confidence_indicator: sign facts, compute labels (§2, §6)
// SQLite dialect (triggers, DROP COLUMN); see docs/decisions.md D-004.
export const id = '0002_foundation';

const cols = (db, t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);

const appendOnly = (table) => `
  CREATE TRIGGER IF NOT EXISTS ${table}_no_update BEFORE UPDATE ON ${table}
  BEGIN SELECT RAISE(ABORT, '${table} is append-only'); END;
  CREATE TRIGGER IF NOT EXISTS ${table}_no_delete BEFORE DELETE ON ${table}
  BEGIN SELECT RAISE(ABORT, '${table} is append-only'); END;
`;

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS domain_events (
      id TEXT PRIMARY KEY,                 -- ULID
      type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,                -- retry backoff
      last_error TEXT,
      dead_lettered_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_domain_events_pending ON domain_events(delivered_at, dead_lettered_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id, created_at);

    CREATE TABLE IF NOT EXISTS event_consumptions (
      event_id TEXT NOT NULL REFERENCES domain_events(id),
      subscriber TEXT NOT NULL,
      consumed_at TEXT NOT NULL,
      PRIMARY KEY (event_id, subscriber)
    );

    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 6),
      purpose TEXT NOT NULL,
      text_version TEXT NOT NULL,
      granted_by TEXT NOT NULL DEFAULT 'learner' CHECK(granted_by IN ('learner','guardian')),
      guardian_ref TEXT,                   -- signed-form reference for minors
      scope_json TEXT,                     -- e.g. the employer a level-4 consent covers
      granted_at TEXT NOT NULL,
      withdrawn_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_consents_learner ON consents(learner_id, level);
    CREATE TRIGGER IF NOT EXISTS consents_no_delete BEFORE DELETE ON consents
    BEGIN SELECT RAISE(ABORT, 'consents is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS consents_withdraw_only BEFORE UPDATE ON consents
    WHEN OLD.withdrawn_at IS NOT NULL OR NEW.withdrawn_at IS NULL
      OR NEW.id IS NOT OLD.id OR NEW.learner_id IS NOT OLD.learner_id OR NEW.institution_id IS NOT OLD.institution_id
      OR NEW.level IS NOT OLD.level OR NEW.purpose IS NOT OLD.purpose OR NEW.text_version IS NOT OLD.text_version
      OR NEW.granted_by IS NOT OLD.granted_by OR NEW.guardian_ref IS NOT OLD.guardian_ref
      OR NEW.scope_json IS NOT OLD.scope_json OR NEW.granted_at IS NOT OLD.granted_at
    BEGIN SELECT RAISE(ABORT, 'consents is append-only: only withdrawn_at may be set, once'); END;

    CREATE TABLE IF NOT EXISTS employers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,                -- company email domain, verified later
      website TEXT,
      kyb_status TEXT NOT NULL DEFAULT 'pending' CHECK(kyb_status IN ('pending','verified','rejected','suspended')),
      domain_verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employer_users (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_employer_users_employer ON employer_users(employer_id);

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,                 -- ULID, carried in the signed session token as sid
      actor_type TEXT NOT NULL CHECK(actor_type IN ('staff','learner','employer','admin')),
      actor_id TEXT NOT NULL,
      institution_id TEXT,
      employer_id TEXT,
      csrf_hash TEXT NOT NULL,             -- sha256 of the CSRF token handed to the client
      ip TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_actor ON auth_sessions(actor_type, actor_id);

    CREATE TABLE IF NOT EXISTS login_failures (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL,
      account_key TEXT NOT NULL,           -- lower-cased email
      ip TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_login_failures_account ON login_failures(actor_type, account_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_login_failures_ip ON login_failures(ip, created_at);

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      version INTEGER NOT NULL,
      author TEXT,
      changelog TEXT,
      content_hash TEXT,                   -- the text itself lives in secure-config
      gold_result TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(task, version)
    );

    CREATE TABLE IF NOT EXISTS model_calls (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      adapter TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_version TEXT,
      prompt_id TEXT,
      prompt_version TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      ms INTEGER,
      cost REAL,
      institution_id TEXT,
      status TEXT NOT NULL,                -- ok | fallback | schema_failed | error
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_model_calls_task ON model_calls(task, created_at);
  `);

  // Learners: consent-relevant attributes. Unknown age is treated as a minor.
  const lc = cols(db, 'learners');
  if (!lc.includes('is_discoverable')) db.exec('ALTER TABLE learners ADD COLUMN is_discoverable INTEGER NOT NULL DEFAULT 0');
  if (!lc.includes('availability')) db.exec('ALTER TABLE learners ADD COLUMN availability TEXT');
  if (!lc.includes('city')) db.exec('ALTER TABLE learners ADD COLUMN city TEXT');
  if (!lc.includes('age_status')) {
    db.exec("ALTER TABLE learners ADD COLUMN age_status TEXT NOT NULL DEFAULT 'unknown' CHECK(age_status IN ('adult','minor','unknown'))");
  }
  if (!lc.includes('updated_at')) db.exec('ALTER TABLE learners ADD COLUMN updated_at TEXT');

  // access_events: a resolved PIN-reset request was a flag flipped in place.
  // It becomes its own event so the table can be append-only. The old code
  // resolved all of a learner's requests at once, so any still-open request is
  // newer than every resolved one: one resolution per enrolment, stamped at the
  // newest resolved request, closes exactly the resolved ones.
  const resolved = db.prepare(`SELECT institution_id, learner_id, engagement_learner_id, MAX(created_at) AS at
    FROM access_events WHERE event = 'pin_reset_requested' AND resolved = 1 GROUP BY engagement_learner_id`).all();
  const insert = db.prepare(`INSERT INTO access_events (id, institution_id, learner_id, engagement_learner_id, event, detail, actor_staff_id, created_at)
    VALUES (?, ?, ?, ?, 'pin_reset_resolved', 'Migrated from the resolved flag', NULL, ?)`);
  resolved.forEach((r, i) => insert.run(`MIG0002-${String(i).padStart(6, '0')}`, r.institution_id, r.learner_id, r.engagement_learner_id, r.at));
  db.exec(appendOnly('access_events'));

  // Sign facts, compute labels: node_mastery keeps no confidence (it is
  // computed from mastery_checks at read time).
  if (cols(db, 'node_mastery').includes('confidence_indicator')) {
    db.exec('ALTER TABLE node_mastery DROP COLUMN confidence_indicator');
  }
}
