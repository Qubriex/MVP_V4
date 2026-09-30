// migrations/0004_capability_graph.js
// Capability Graph (v4.3 §3): skills, aliases, prerequisite DAG, node → skill
// map and the ontology review queue; seeds the ontology and maps every
// existing pathway through resolveSkill (unmapped nodes are queued).
import { SEED_SKILLS, SEED_PREREQS } from '../core/graph/ontologySeed.js';
import { normalise } from '../core/graph/resolveSkill.js';
import { addPrereq } from '../core/graph/ontology.js';
import { mapPathway } from '../core/graph/coverage.js';

export const id = '0004_capability_graph';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      skill_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      description TEXT,
      typical_hours REAL,
      parent_skill_id TEXT REFERENCES skills(skill_id),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS skill_aliases (
      alias_norm TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills(skill_id),
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_skill_aliases_skill ON skill_aliases(skill_id);
    CREATE TABLE IF NOT EXISTS skill_prereqs (
      skill_id TEXT NOT NULL REFERENCES skills(skill_id),
      prereq_skill_id TEXT NOT NULL REFERENCES skills(skill_id),
      PRIMARY KEY (skill_id, prereq_skill_id)
    );
    CREATE TABLE IF NOT EXISTS node_skill_map (
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      skill_id TEXT NOT NULL REFERENCES skills(skill_id),
      weight REAL NOT NULL CHECK(weight > 0 AND weight <= 1),
      source TEXT NOT NULL,              -- curr | resolve | review
      confidence REAL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (node_id, skill_id)
    );
    CREATE INDEX IF NOT EXISTS idx_node_skill_map_skill ON node_skill_map(skill_id);
    CREATE TABLE IF NOT EXISTS ontology_review_queue (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      text_norm TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,              -- node | jd | declared | curr
      context_json TEXT,
      occurrences INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','aliased','created','rejected')),
      resolved_skill_id TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);

  const now = new Date().toISOString();
  const insSkill = db.prepare(`INSERT OR IGNORE INTO skills (skill_id, name, domain, typical_hours, parent_skill_id, version, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)`);
  const insAlias = db.prepare('INSERT OR IGNORE INTO skill_aliases (alias_norm, skill_id, source, created_at) VALUES (?, ?, ?, ?)');
  SEED_SKILLS.forEach(([sid, name, domain, parent, hours]) => insSkill.run(sid, name, domain, hours, parent, now));
  SEED_SKILLS.forEach(([sid, name, , , , aliases]) => {
    [name, sid.replace(/_/g, ' '), ...aliases].forEach(a => { const n = normalise(a); if (n) insAlias.run(n, sid, 'seed', now); });
  });
  SEED_PREREQS.forEach(([s, p]) => addPrereq(s, p));

  db.prepare('SELECT id FROM capability_targets').all().forEach(t => mapPathway(t.id));
}
