// migrations/0008_employer_kyb.js — employer onboarding and KYB (v4.3 §14.1):
// company details with optional GSTIN, domain-email OTP, manual approval,
// user invites (owner / recruiter / viewer), API keys, signing identity.
export const id = '0008_employer_kyb';

const cols = (db, t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);

export function up(db) {
  const e = cols(db, 'employers');
  [['gstin', 'TEXT'], ['gst_state_code', 'TEXT'], ['contact_name', 'TEXT'], ['contact_phone', 'TEXT'], ['city', 'TEXT'],
    ['kyb_note', 'TEXT'], ['kyb_decided_by', 'TEXT'], ['kyb_decided_at', 'TEXT']].forEach(([c, t]) => {
    if (!e.includes(c)) db.exec(`ALTER TABLE employers ADD COLUMN ${c} ${t}`);
  });
  db.exec(`
    CREATE TABLE IF NOT EXISTS employer_domain_otps (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      user_id TEXT NOT NULL REFERENCES employer_users(id),
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS employer_invites (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      email TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL CHECK(role IN ('recruiter','viewer')),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS employer_api_keys (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      name TEXT NOT NULL,
      prefix TEXT NOT NULL UNIQUE,
      key_hash TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS employer_signing_identities (
      employer_id TEXT PRIMARY KEY REFERENCES employers(id),
      kind TEXT NOT NULL CHECK(kind IN ('did_web','jwks_url')),
      value TEXT NOT NULL,
      activated INTEGER NOT NULL DEFAULT 0,   -- Phase 3: employer-held keys
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
