// core/stores/briefStore.js — CURR brain's store
// Tables: brief_store, curriculum_node_specs
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');

function initBriefSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brief_store (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      language TEXT NOT NULL,
      raw_input_summary TEXT,
      extracted_clusters TEXT,
      extraction_confidence REAL,
      confirmed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS curriculum_node_specs (
      id TEXT PRIMARY KEY,
      skill_node_id TEXT NOT NULL UNIQUE,
      node_label TEXT NOT NULL,
      cluster_label TEXT,
      learning_objectives TEXT,
      prerequisite_labels TEXT,
      mastery_threshold REAL DEFAULT 0.70,
      phase INTEGER DEFAULT 1,
      difficulty_level INTEGER DEFAULT 1,
      estimated_minutes INTEGER DEFAULT 20,
      concept_tags TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── retrieveSimilarBriefs() — RAG extraction templates ───────────────────────
// Only confirmed=1 briefs are used (institution-validated). Higher
// extraction_confidence appears first. If none exist, extraction proceeds
// from first principles.
function retrieveSimilarBriefs(domain, language, proficiencyLevel, limit = 2) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM brief_store
    WHERE domain = ? AND language = ? AND confirmed = 1
    ORDER BY extraction_confidence DESC LIMIT ?
  `).all(domain, language, limit);
  db.close();
  return rows.map(r => ({ ...r, extracted_clusters: JSON.parse(r.extracted_clusters || '{}') }));
}

// ─── writeBrief() — extraction result written immediately as confirmed=false ──
function writeBrief(institutionId, domain, language, rawInputSummary, extractedClusters, extractionConfidence) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO brief_store (id, institution_id, domain, language, raw_input_summary, extracted_clusters, extraction_confidence, confirmed)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, institutionId, domain, language, rawInputSummary, JSON.stringify(extractedClusters), extractionConfidence);
  db.close();
  return id;
}

// ─── confirmBrief() — only confirmed briefs are used as extraction templates ──
function confirmBrief(briefId) {
  const db = getDb();
  db.prepare(`UPDATE brief_store SET confirmed = 1 WHERE id = ?`).run(briefId);
  db.close();
}

// ─── writeNodeSpec() — creates the node spec TEACH retrieves at SESSION_START ─
function writeNodeSpec(skillNodeId, spec) {
  const db = getDb();
  db.prepare(`
    INSERT INTO curriculum_node_specs
      (id, skill_node_id, node_label, cluster_label, learning_objectives, prerequisite_labels, mastery_threshold, phase, difficulty_level, estimated_minutes, concept_tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(skill_node_id) DO UPDATE SET
      node_label = excluded.node_label, cluster_label = excluded.cluster_label,
      learning_objectives = excluded.learning_objectives, prerequisite_labels = excluded.prerequisite_labels,
      mastery_threshold = excluded.mastery_threshold, phase = excluded.phase,
      difficulty_level = excluded.difficulty_level, estimated_minutes = excluded.estimated_minutes,
      concept_tags = excluded.concept_tags
  `).run(
    uuidv4(), skillNodeId, spec.nodeLabel, spec.clusterLabel || null,
    JSON.stringify(spec.learningObjectives || []), JSON.stringify(spec.prerequisiteLabels || []),
    spec.masteryThreshold ?? 0.70, spec.phase ?? 1, spec.difficultyLevel ?? 1,
    spec.estimatedMinutes ?? 20, JSON.stringify(spec.conceptTags || [])
  );
  db.close();
}

function parseNodeSpecRow(row) {
  if (!row) return null;
  return {
    ...row,
    learning_objectives: JSON.parse(row.learning_objectives || '[]'),
    prerequisite_labels: JSON.parse(row.prerequisite_labels || '[]'),
    concept_tags: JSON.parse(row.concept_tags || '[]')
  };
}

// ─── retrieveNodeSpecById() — precise lookup ──────────────────────────────────
function retrieveNodeSpecById(skillNodeId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM curriculum_node_specs WHERE skill_node_id = ?').get(skillNodeId);
  db.close();
  return parseNodeSpecRow(row);
}

// ─── retrieveNodeSpecByLabel() — fallback lookup ──────────────────────────────
function retrieveNodeSpecByLabel(nodeLabel) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM curriculum_node_specs WHERE node_label = ? ORDER BY created_at DESC LIMIT 1').get(nodeLabel);
  db.close();
  return parseNodeSpecRow(row);
}

module.exports = {
  initBriefSchema,
  retrieveSimilarBriefs,
  writeBrief,
  confirmBrief,
  writeNodeSpec,
  retrieveNodeSpecById,
  retrieveNodeSpecByLabel
};
