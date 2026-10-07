// tests/structural/walls.js
// The two dependency walls from spec §2 / §11, as data, so the test and its
// self-test (against tests/structural/fixtures/) run the same rules.
import fs from 'fs';
import path from 'path';
import { closure } from './importGraph.js';

const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const globDir = (root, dir) => (exists(root, dir)
  ? fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js')).map(f => `${dir}/${f}`)
  : []);

// ─── Wall 1: teaching never writes its own exam ──────────────────────────────
export const TEACHING = {
  name: 'teaching/assessment wall',
  entries: (root) => [
    'core/brains/teachBrain.js', 'core/brains/cultBrain.js', 'core/brains/memBrain.js',
    ...globDir(root, 'core/cult')
  ].filter(e => exists(root, e)),
  required: ['core/brains/teachBrain.js', 'core/brains/cultBrain.js', 'core/brains/memBrain.js'],
  forbiddenFile: (rel) =>
    rel.startsWith('core/evidence/') ||
    rel.startsWith('core/validators/') ||
    rel === 'core/stores/rubricStore.js' ||
    rel === 'core/brains/evalBrain.js' ||
    /item[-_]?famil/i.test(rel) ||
    /mutant/i.test(rel),
  forbiddenTables: ['eval_rubrics', 'eval_example_responses', 'item_families', 'family_mutants', 'family_instances',
    'evidence_records', 'gold_examples', 'faculty_reviews'],
  forbiddenPackages: []
};

// ─── Wall 2: employers never touch session data ──────────────────────────────
export const EMPLOYER = {
  name: 'employer/session wall',
  entries: (root) => [
    'api/routes/employer.js', 'api/routes/employerHiring.js', 'api/routes/verify.js', 'api/middleware/employerAuth.js',
    ...globDir(root, 'core/match')
  ].filter(e => exists(root, e)),
  required: ['api/routes/employer.js', 'api/middleware/employerAuth.js'],
  forbiddenFile: (rel) =>
    rel === 'core/stores/learnerMemoryStore.js' ||
    rel === 'core/stores/culturalStore.js' ||      // CKB usage log
    rel === 'core/stores/rubricStore.js' ||        // evaluation store
    rel === 'core/orchestrator.js' ||
    rel.startsWith('core/brains/') ||
    rel.startsWith('core/evidence/') ||
    rel.startsWith('core/retrieval/') ||
    /session|memory|provenance|usage|evaluation/i.test(path.basename(rel)),
  forbiddenTables: ['learning_sessions', 'session_messages', 'session_summaries', 'learner_memory', 'learner_behaviour_fingerprint',
    'memory_chunks', 'chunk_embeddings', 'cultural_usage_log', 'answer_provenance', 'evidence_records', 'mastery_checks',
    'eval_example_responses', 'orchestration_log', 'retrieval_logs', 'doubts', 'approach_choices', 'ckb_choices'],
  forbiddenPackages: []
};

/** @returns {string[]} human-readable violations (empty = wall holds) */
export function checkWall(root, wall) {
  const violations = [];
  for (const req of wall.required) if (!exists(root, req)) violations.push(`${wall.name}: required entry ${req} is missing`);
  const { files, computed, missing } = closure(root, wall.entries(root));
  for (const [rel, chain] of files) {
    if (wall.forbiddenFile(rel)) violations.push(`${wall.name}: ${chain.join(' → ')}`);
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const t of wall.forbiddenTables) {
      if (new RegExp(`\\b${t}\\b`).test(text)) violations.push(`${wall.name}: ${rel} names table ${t} (reached via ${chain.join(' → ')})`);
    }
  }
  computed.forEach(c => violations.push(`${wall.name}: ${c.file} has a computed dynamic import (${c.expr}); the wall cannot be proven`));
  missing.forEach(m => violations.push(`${wall.name}: ${m.file} imports ${m.spec}, which does not resolve`));
  return violations;
}
