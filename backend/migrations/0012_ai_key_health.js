// migrations/0012_ai_key_health.js — Gemini key health shared by every
// instance, and the speech model each voice key last spoke with.
// Keys are never stored: only the slot (1, 2, 3) and a 6-character
// fingerprint (first 6 hex of SHA-256), so a replaced key starts healthy.
import * as dal from '../core/db/dal.js';

export const id = '0012_ai_key_health';

export async function up() {
  await dal.exec(`
    CREATE TABLE IF NOT EXISTS ai_key_health (
      slot INTEGER NOT NULL,
      fingerprint TEXT NOT NULL,
      status TEXT NOT NULL,
      until TEXT,
      last_error_code TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (slot, fingerprint)
    );
    CREATE TABLE IF NOT EXISTS ai_voice_models (
      slot INTEGER NOT NULL,
      fingerprint TEXT NOT NULL,
      model TEXT NOT NULL,
      worked_at TEXT NOT NULL,
      PRIMARY KEY (slot, fingerprint)
    );
  `);
}
