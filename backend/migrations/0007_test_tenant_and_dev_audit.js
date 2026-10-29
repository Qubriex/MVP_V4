// migrations/0007_test_tenant_and_dev_audit.js — keeps the seeded test
// tenant apart from real data, and records developer-login activity.
//   is_test   on institutions, employers and admin_users: set only for the
//             fixed test IDs (core/testTenant.js). Matching, benchmarks,
//             jobs and admin analytics compare it, so test and real data
//             never meet.
//   is_dev    on auth_sessions: a session opened from /dev (8 hours).
//   dev_audit who unlocked /dev, which test account they opened, resets and
//             skipped waits, with time and IP. Never the passcode.
import * as dal from '../core/db/dal.js';

export const id = '0007_test_tenant_and_dev_audit';

export async function up() {
  await dal.exec(`
    ALTER TABLE institutions ADD COLUMN IF NOT EXISTS is_test INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE employers ADD COLUMN IF NOT EXISTS is_test INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_test INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS is_dev INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS dev_audit (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,             -- unlock | unlock_failed | login | end | reset | skip_waits
      account_key TEXT,                 -- the test account opened (login)
      role TEXT,
      session_id TEXT,
      ip TEXT,
      user_agent TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dev_audit_created ON dev_audit(created_at);

    UPDATE institutions SET is_test = 1 WHERE id IN ('test-inst-0001', 'test-peer-inst-1', 'test-peer-inst-2', 'test-peer-inst-3');
    UPDATE employers SET is_test = 1 WHERE id IN ('test-employer-0001', 'test-employer-0002');
    UPDATE admin_users SET is_test = 1 WHERE id = 'test-admin-0001' OR lower(email) = 'test.admin@qubirex.local';
  `);
}
