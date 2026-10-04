// migrations/0004_speed_devices_graduation.js
//   - Indexes for the reads that run on every review list, lesson and live
//     view (each was a scan, and each scan is a round trip to the database).
//   - Devices: which device and city a session came from, and why it ended,
//     so a learner signed out by another device sees why (one device at a time).
//   - Graduation year on the learner profile (replaces "Available from").
import * as dal from '../core/db/dal.js';

export const id = '0004_speed_devices_graduation';

export async function up() {
  await dal.exec(`
    CREATE INDEX IF NOT EXISTS idx_evidence_instance ON evidence_records(instance_id);
    CREATE INDEX IF NOT EXISTS idx_learning_sessions_el_node ON learning_sessions(engagement_learner_id, skill_node_id);
    CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_access_events_el ON access_events(engagement_learner_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_skill_requests_el ON skill_requests(engagement_learner_id);

    ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS device_label TEXT;
    ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

    ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS graduation_year INTEGER;
  `);
}
