// migrations/0006_retention.js — spaced review schedule (v4.3 §8, §8.1).
export const id = '0006_retention';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_retention (
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      interval_days REAL NOT NULL,
      due_at TEXT NOT NULL,
      last_review_at TEXT,
      last_result TEXT CHECK(last_result IN ('pass','fail')),
      reviews_passed INTEGER NOT NULL DEFAULT 0,
      reviews_failed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (el_id, node_id)
    );
    CREATE INDEX IF NOT EXISTS idx_node_retention_due ON node_retention(el_id, due_at);
  `);
  if (!db.prepare('PRAGMA table_info(engagements)').all().some(c => c.name === 'placement_date')) {
    db.exec('ALTER TABLE engagements ADD COLUMN placement_date TEXT');
  }
}
