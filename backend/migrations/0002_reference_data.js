// migrations/0002_reference_data.js — reference data every deployment starts
// with: the Cultural Knowledge Base seed examples (§5.5) and the skills
// ontology with aliases and prerequisites (§3). Idempotent.
import * as dal from '../core/db/dal.js';
import { seedInitialExamples } from '../core/stores/culturalStore.js';
import { SEED_SKILLS, SEED_PREREQS } from '../core/graph/ontologySeed.js';
import { normalise } from '../core/graph/resolveSkill.js';
import { addPrereq } from '../core/graph/ontology.js';

export const id = '0002_reference_data';

export async function up() {
  await seedInitialExamples();
  const now = dal.nowIso();
  for (const [sid, name, domain, parent, hours] of SEED_SKILLS) {
    await dal.run(`INSERT OR IGNORE INTO skills (skill_id, name, domain, typical_hours, parent_skill_id, version, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)`, sid, name, domain, hours, parent, now);
  }
  for (const [sid, name, , , , aliases] of SEED_SKILLS) {
    for (const a of [name, sid.replace(/_/g, ' '), ...aliases]) {
      const n = normalise(a);
      if (n) await dal.run('INSERT OR IGNORE INTO skill_aliases (alias_norm, skill_id, source, created_at) VALUES (?, ?, ?, ?)', n, sid, 'seed', now);
    }
  }
  for (const [s, p] of SEED_PREREQS) await addPrereq(s, p);
}
