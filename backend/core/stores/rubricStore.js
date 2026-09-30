// core/stores/rubricStore.js — EVAL brain's store
// Tables: eval_rubrics, eval_example_responses
import { v4 as uuidv4 } from 'uuid';
import { legacyHandle as getDb } from '../db/dal.js';


// ─── Default rubric — used when no node-specific rubric exists ───────────────
const DEFAULT_PASSING_CRITERIA = [
  'Learner demonstrates APPLICATION of the concept — not just recall',
  'Learner uses the concept in a realistic scenario or example',
  'Learner responds in the native language with appropriate technical vocabulary',
  'Learner shows understanding of WHY the concept works, not just what it does'
];

const DEFAULT_FAILING_INDICATORS = [
  'Learner copies the question back without demonstrating understanding',
  'Learner provides a definition only — no application',
  'Learner response is single word or too short to evaluate quality',
  'Learner response shows a fundamental misunderstanding of the core concept',
  'Learner writes "I don\'t know" or equivalent without attempting'
];

// ─── Default gap taxonomy — maps each gap type to a recommended next approach ─
const DEFAULT_GAP_TAXONOMY = {
  concept_not_understood: { approach: 'native_concept', description: 'Learner has not grasped the core concept at all — start from scratch with a different entry point' },
  application_missing: { approach: 'worked_example', description: 'Learner can define but cannot apply — show a worked example first' },
  prerequisite_missing: { approach: 'decomposition', description: 'Learner is missing a foundational concept — decompose to prerequisite' },
  vocabulary_barrier: { approach: 'analogy', description: 'Learner understands concept but blocked by English terms — use deeper analogy' },
  confidence_low: { approach: 'socratic', description: 'Partial understanding but lacks confidence — use Socratic questioning to surface what they know' }
};

// ─── retrieveRubric() ──────────────────────────────────────────────────────────
async function retrieveRubric(nodeLabel, language) {
  const db = getDb();
  const row = await db.prepare(`
    SELECT * FROM eval_rubrics WHERE node_label = ? AND language = ?
  `).get(nodeLabel, language);
  db.close();

  if (row) {
    return {
      passingCriteria: JSON.parse(row.passing_criteria || '[]'),
      failingIndicators: JSON.parse(row.failing_indicators || '[]'),
      gapTaxonomy: JSON.parse(row.gap_taxonomy || '{}')
    };
  }

  return {
    passingCriteria: DEFAULT_PASSING_CRITERIA,
    failingIndicators: DEFAULT_FAILING_INDICATORS,
    gapTaxonomy: DEFAULT_GAP_TAXONOMY
  };
}

// ─── retrieveExampleResponses() ───────────────────────────────────────────────
async function retrieveExampleResponses(nodeLabel, language, outcome, limit = 2) {
  const db = getDb();
  const rows = await db.prepare(`
    SELECT * FROM eval_example_responses
    WHERE node_label = ? AND language = ? AND outcome = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(nodeLabel, language, outcome, limit);
  db.close();
  return rows;
}

// ─── writeEvaluation() ─────────────────────────────────────────────────────────
// Not called: v4.3 §7.3 forbids reusing raw model-scored answers as examples.
// Kept until the gold set (faculty-labelled, consent level 6) replaces it.
async function writeEvaluation(nodeLabel, language, responseText, outcome, score, gapsIdentified = []) {
  const db = getDb();
  await db.prepare(`
    INSERT INTO eval_example_responses (id, node_label, language, response_text, outcome, score, gaps_identified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), nodeLabel, language, responseText, outcome, score, JSON.stringify(gapsIdentified));
  db.close();
}

export { retrieveRubric, retrieveExampleResponses, writeEvaluation, DEFAULT_GAP_TAXONOMY };
