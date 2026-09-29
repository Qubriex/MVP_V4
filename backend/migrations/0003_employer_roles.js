// migrations/0003_employer_roles.js
// v4.3 §14.1: employer users are owner, recruiter or viewer. 0002 used
// owner/admin/member; SQLite cannot alter a CHECK, so the table is rebuilt.
// admin and member become recruiter (both could act on the account).
export const id = '0003_employer_roles';

export function up(db) {
  db.exec(`
    CREATE TABLE employer_users_v3 (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'recruiter' CHECK(role IN ('owner','recruiter','viewer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO employer_users_v3 (id, employer_id, email, password_hash, name, role, status, last_login_at, created_at, updated_at)
      SELECT id, employer_id, email, password_hash, name,
             CASE role WHEN 'owner' THEN 'owner' ELSE 'recruiter' END,
             status, last_login_at, created_at, updated_at FROM employer_users;
    DROP TABLE employer_users;
    ALTER TABLE employer_users_v3 RENAME TO employer_users;
    CREATE INDEX IF NOT EXISTS idx_employer_users_employer ON employer_users(employer_id);
  `);
}
