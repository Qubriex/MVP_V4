// migrations/0011_instance_texts.js — one question instance, shown in more
// than one language. When a learner switches the learning language while a
// review or check question is open, the same instance (same seed, scenario
// and values) is shown in the new language; the text is kept here so it does
// not change again and is not regenerated. Switching never issues a new
// attempt.
import * as dal from '../core/db/dal.js';

export const id = '0011_instance_texts';

export async function up() {
  await dal.exec(`
    CREATE TABLE IF NOT EXISTS instance_texts (
      instance_id TEXT NOT NULL REFERENCES family_instances(id),
      language TEXT NOT NULL,
      question_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (instance_id, language)
    );
  `);
}
