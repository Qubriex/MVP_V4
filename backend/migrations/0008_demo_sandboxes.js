// migrations/0008_demo_sandboxes.js — the public working demo (/demo).
// Each visitor gets a private sandbox: a small sample college, students and
// employers created for them alone, deleted after at most 4 hours.
//   is_demo, sandbox_id  on institutions and employers: a third world beside
//                        real and test (core/testTenant.js worldOf). Every
//                        cross-tenant query compares the whole world, so a
//                        sandbox never meets real, test or another sandbox.
//   auth_sessions        is_demo + sandbox_id: a demo session (2 h idle, 4 h max).
//   demo_sandboxes       one row per sandbox: persona, IP, expiry, AI use.
//   outbound_messages    sandbox_id + channel: in a sandbox, nothing is sent;
//                        email / WhatsApp / SMS land here as the Demo inbox.
//   signing_keys         status 'demo': the separate demo signing key, never
//                        in the published JWKS.
//   demo_ai_usage        the global daily AI budget for every demo.
//   qbx_append_only()    still refuses every UPDATE and DELETE, except a DELETE
//                        inside the demo cleanup transaction, which sets
//                        qbx.demo_cleanup locally (core/demo/cleanup.js is the
//                        only code that may; tests/structural enforces it) and
//                        deletes only rows reached from one sandbox's roots.
import * as dal from '../core/db/dal.js';

export const id = '0008_demo_sandboxes';

export async function up() {
  await dal.exec(`
    ALTER TABLE institutions ADD COLUMN IF NOT EXISTS is_demo INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE institutions ADD COLUMN IF NOT EXISTS sandbox_id TEXT;
    ALTER TABLE employers ADD COLUMN IF NOT EXISTS is_demo INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE employers ADD COLUMN IF NOT EXISTS sandbox_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_institutions_sandbox ON institutions(sandbox_id);
    CREATE INDEX IF NOT EXISTS idx_employers_sandbox ON employers(sandbox_id);

    ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS is_demo INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS sandbox_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_sandbox ON auth_sessions(sandbox_id);

    ALTER TABLE outbound_messages ADD COLUMN IF NOT EXISTS sandbox_id TEXT;
    ALTER TABLE outbound_messages ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';
    CREATE INDEX IF NOT EXISTS idx_outbound_sandbox ON outbound_messages(sandbox_id, created_at);

    ALTER TABLE signing_keys DROP CONSTRAINT IF EXISTS signing_keys_status_check;
    ALTER TABLE signing_keys ADD CONSTRAINT signing_keys_status_check CHECK(status IN ('active','retired','compromised','demo'));

    CREATE TABLE IF NOT EXISTS demo_sandboxes (
      id TEXT PRIMARY KEY,                -- 10 lowercase letters/digits, in every row id of the sandbox
      persona TEXT NOT NULL,
      ip TEXT,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,           -- created_at + 4 hours (hard limit)
      ai_calls INTEGER NOT NULL DEFAULT 0,
      voice_seconds INTEGER NOT NULL DEFAULT 0,
      story_json TEXT,                    -- guided-story steps done
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_demo_sandboxes_live ON demo_sandboxes(deleted_at, expires_at);
    CREATE INDEX IF NOT EXISTS idx_demo_sandboxes_ip ON demo_sandboxes(ip, created_at);

    CREATE TABLE IF NOT EXISTS demo_ai_usage (
      day TEXT PRIMARY KEY,               -- YYYY-MM-DD (UTC)
      calls INTEGER NOT NULL DEFAULT 0,
      voice_seconds INTEGER NOT NULL DEFAULT 0
    );

    CREATE OR REPLACE FUNCTION qbx_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' AND current_setting('qbx.demo_cleanup', true) = 'on' THEN
        RETURN OLD;
      END IF;
      RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
    END $$;
  `);
}
