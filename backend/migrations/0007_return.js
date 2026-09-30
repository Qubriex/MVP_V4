// migrations/0007_return.js — RETURN (v4.3 §9, §10): signing keys (public
// halves only), credentials (append-only versions), status lists, passport
// sharing, renewal runs, and Mastery Log integrity (Evidence ID + SHA-256 of
// the canonical JSON, signed).
export const id = '0007_return';

const cols = (db, t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS signing_keys (
      kid TEXT PRIMARY KEY,
      public_jwk_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired','compromised')),
      created_at TEXT NOT NULL,
      retired_at TEXT
    );

    CREATE TABLE IF NOT EXISTS status_lists (
      id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL CHECK(purpose IN ('revocation','suspension','reissue')),
      bits BLOB NOT NULL,
      next_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- One row per credential version; a reissue adds a row (append-only).
    -- Only 'active' may flip from 1 to 0 when a newer version supersedes it.
    CREATE TABLE IF NOT EXISTS credentials (
      credential_id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      target_id TEXT NOT NULL REFERENCES capability_targets(id),
      sd_jwt TEXT NOT NULL,
      kid TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      status_list_id TEXT NOT NULL REFERENCES status_lists(id),
      status_index INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(evidence_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_credentials_evidence ON credentials(evidence_id, active);
    CREATE TRIGGER IF NOT EXISTS credentials_no_delete BEFORE DELETE ON credentials
    BEGIN SELECT RAISE(ABORT, 'credentials is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS credentials_supersede_only BEFORE UPDATE ON credentials
    WHEN NOT (OLD.active = 1 AND NEW.active = 0)
      OR NEW.credential_id IS NOT OLD.credential_id OR NEW.evidence_id IS NOT OLD.evidence_id OR NEW.version IS NOT OLD.version
      OR NEW.sd_jwt IS NOT OLD.sd_jwt OR NEW.kid IS NOT OLD.kid OR NEW.valid_from IS NOT OLD.valid_from OR NEW.valid_until IS NOT OLD.valid_until
      OR NEW.status_list_id IS NOT OLD.status_list_id OR NEW.status_index IS NOT OLD.status_index
    BEGIN SELECT RAISE(ABORT, 'credentials is append-only: a reissue adds a version'); END;

    CREATE TABLE IF NOT EXISTS passport_shares (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      is_public INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_passport_shares ON passport_shares(evidence_id, created_at);

    CREATE TABLE IF NOT EXISTS renewal_runs (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      el_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','complete','abandoned')),
      instances_json TEXT NOT NULL,          -- [{skill_id, node_id, instance_id}]
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
  `);
  const ml = cols(db, 'mastery_logs');
  if (!ml.includes('evidence_id')) db.exec('ALTER TABLE mastery_logs ADD COLUMN evidence_id TEXT');
  if (!ml.includes('sha256')) db.exec('ALTER TABLE mastery_logs ADD COLUMN sha256 TEXT');
  if (!ml.includes('signature_json')) db.exec('ALTER TABLE mastery_logs ADD COLUMN signature_json TEXT');
}
