// core/stores/rubricStore.js — EVAL brain's store
// Tables: eval_rubrics, eval_example_responses
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');

function initRubricSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS eval_rubrics (
      id TEXT PRIMARY KEY,
      node_label TEXT NOT NULL,
      language TEXT NOT NULL,
      passing_criteria TEXT,
      failing_indicators TEXT,
      gap_taxonomy TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(node_label, language)
    );
    CREATE TABLE IF NOT EXISTS eval_example_responses (
      id TEXT PRIMARY KEY,
      node_label TEXT NOT NULL,
      language TEXT NOT NULL,
      response_text TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('pass','fail')),
      score REAL,
      gaps_identified TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

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
function retrieveRubric(nodeLabel, language) {
  const db = getDb();
  const row = db.prepare(`
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
function retrieveExampleResponses(nodeLabel, language, outcome, limit = 2) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM eval_example_responses
    WHERE node_label = ? AND language = ? AND outcome = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(nodeLabel, language, outcome, limit);
  db.close();
  return rows;
}

// ─── writeEvaluation() ─────────────────────────────────────────────────────────
// Automatically builds the calibration corpus — every evaluation feeds back in.
function writeEvaluation(nodeLabel, language, responseText, outcome, score, gapsIdentified = []) {
  const db = getDb();
  db.prepare(`
    INSERT INTO eval_example_responses (id, node_label, language, response_text, outcome, score, gaps_identified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), nodeLabel, language, responseText, outcome, score, JSON.stringify(gapsIdentified));
  db.close();
}

module.exports = {
  initRubricSchema,
  retrieveRubric,
  retrieveExampleResponses,
  writeEvaluation,
  DEFAULT_GAP_TAXONOMY
};
