// migrations/0005_shared_kit.js — the parts every side shares (v4.3 canvas,
// "Shared kit"): notifications, help requests, and when each person last
// opened their notifications.
import * as dal from '../core/db/dal.js';

export const id = '0005_shared_kit';

export async function up() {
  await dal.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL CHECK(actor_type IN ('learner','staff','employer','admin','institution')),
      actor_id TEXT NOT NULL,          -- learner id, staff id, institution id (all staff), employer id (all users)
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      href TEXT,
      created_at TEXT NOT NULL,
      read_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_actor ON notifications(actor_type, actor_id, created_at);

    CREATE TABLE IF NOT EXISTS notification_state (
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      seen_at TEXT NOT NULL,
      channels_json TEXT,              -- { email: true, whatsapp: false, sms: false }
      PRIMARY KEY (actor_type, actor_id)
    );

    CREATE TABLE IF NOT EXISTS help_requests (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      institution_id TEXT,
      employer_id TEXT,
      type TEXT NOT NULL,              -- question | problem | data_request | grievance
      message TEXT NOT NULL,
      reply_to TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
      created_at TEXT NOT NULL
    );
  `);
}
