// core/stores/learnerMemoryStore.js — MEM brain's store
// Tables: learner_memory, learner_behaviour_fingerprint
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');

// Defensive — safe to run on every startup, mirrors db/init.js.
function initMemorySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS learner_memory (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      engagement_learner_id TEXT NOT NULL,
      memory_type TEXT NOT NULL CHECK(memory_type IN ('interaction','struggle','vocabulary','milestone')),
      node_id TEXT,
      cluster_id TEXT,
      content TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS learner_behaviour_fingerprint (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL UNIQUE,
      avg_response_time_seconds REAL DEFAULT 0,
      disengagement_rate REAL DEFAULT 0,
      avg_loops_per_node REAL DEFAULT 0,
      preferred_approach TEXT,
      vocabulary_level TEXT DEFAULT 'beginner',
      session_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── retrieveLearnerContext() ─────────────────────────────────────────────────
// Returns everything TEACH needs about this learner at this node.
function retrieveLearnerContext(learnerId, nodeId) {
  const db = getDb();

  const recentHistory = db.prepare(`
    SELECT content, metadata, memory_type, created_at
    FROM learner_memory
    WHERE learner_id = ? AND memory_type = 'interaction'
    ORDER BY created_at DESC LIMIT 20
  `).all(learnerId).map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }));

  const nodeStruggles = db.prepare(`
    SELECT content, metadata, created_at
    FROM learner_memory
    WHERE learner_id = ? AND node_id = ? AND memory_type = 'struggle'
    ORDER BY created_at
  `).all(learnerId, nodeId).map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }));

  const approachesUsedAtNode = [...new Set(
    recentHistory
      .filter(h => h.metadata && h.metadata.nodeId === nodeId && h.metadata.approachUsed)
      .map(h => h.metadata.approachUsed)
  )];

  const lastBehaviourSignals = recentHistory
    .filter(h => h.metadata && h.metadata.behaviourSignal)
    .slice(0, 5)
    .map(h => h.metadata.behaviourSignal);

  const fingerprint = db.prepare(`
    SELECT * FROM learner_behaviour_fingerprint WHERE learner_id = ?
  `).get(learnerId) || {
    vocabulary_level: 'beginner', avg_loops_per_node: 0,
    disengagement_rate: 0, avg_response_time_seconds: 0,
    preferred_approach: null, session_count: 0
  };

  db.close();
  return { recentHistory, nodeStruggles, approachesUsedAtNode, lastBehaviourSignals, fingerprint };
}

// ─── writeInteraction() ───────────────────────────────────────────────────────
function writeInteraction(learnerId, elId, turnData) {
  const db = getDb();
  db.prepare(`
    INSERT INTO learner_memory (id, learner_id, engagement_learner_id, memory_type, node_id, cluster_id, content, metadata)
    VALUES (?, ?, ?, 'interaction', ?, ?, ?, ?)
  `).run(
    uuidv4(), learnerId, elId, turnData.nodeId || null, turnData.clusterId || null,
    turnData.content || '', JSON.stringify({
      role: turnData.role, decision: turnData.decision || null,
      approachUsed: turnData.approachUsed || null, behaviourSignal: turnData.behaviourSignal || null,
      masteryScore: turnData.masteryScore ?? null, nodeId: turnData.nodeId || null,
      timestamp: new Date().toISOString()
    })
  );
  db.close();
}

// ─── updateBehaviourFingerprint() ─────────────────────────────────────────────
// Running averages: newAvg = ((oldAvg * (n-1)) + newValue) / n where n = session_count + 1
function updateBehaviourFingerprint(learnerId, turnData) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM learner_behaviour_fingerprint WHERE learner_id = ?').get(learnerId);

  const n = (existing ? existing.session_count : 0) + 1;
  const runningAvg = (oldAvg, newValue) => ((oldAvg * (n - 1)) + newValue) / n;

  const responseTime = turnData.responseTimeSeconds ?? (existing ? existing.avg_response_time_seconds : 0);
  const disengaged = turnData.behaviourSignal === 'disengaged' ? 1 : 0;
  const loopsThisTurn = turnData.loopCount ?? (existing ? existing.avg_loops_per_node : 0);

  const newAvgResponseTime = runningAvg(existing ? existing.avg_response_time_seconds : 0, responseTime);
  const newDisengagementRate = runningAvg(existing ? existing.disengagement_rate : 0, disengaged);
  const newAvgLoops = runningAvg(existing ? existing.avg_loops_per_node : 0, loopsThisTurn);
  const preferredApproach = turnData.approachUsed || (existing ? existing.preferred_approach : null);
  const vocabularyLevel = turnData.vocabularyLevel || (existing ? existing.vocabulary_level : 'beginner');

  db.prepare(`
    INSERT INTO learner_behaviour_fingerprint
      (id, learner_id, avg_response_time_seconds, disengagement_rate, avg_loops_per_node, preferred_approach, vocabulary_level, session_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(learner_id) DO UPDATE SET
      avg_response_time_seconds = excluded.avg_response_time_seconds,
      disengagement_rate = excluded.disengagement_rate,
      avg_loops_per_node = excluded.avg_loops_per_node,
      preferred_approach = excluded.preferred_approach,
      vocabulary_level = excluded.vocabulary_level,
      session_count = excluded.session_count,
      updated_at = datetime('now')
  `).run(uuidv4(), learnerId, newAvgResponseTime, newDisengagementRate, newAvgLoops, preferredApproach, vocabularyLevel, n);

  db.close();
}

// ─── writeStrugglePattern() ───────────────────────────────────────────────────
// Upsert: if a struggle record already exists for this learner at this node, update it.
function writeStrugglePattern(learnerId, elId, opts) {
  const db = getDb();
  const existing = db.prepare(`
    SELECT id FROM learner_memory WHERE learner_id = ? AND node_id = ? AND memory_type = 'struggle'
  `).get(learnerId, opts.nodeId);

  const metadata = JSON.stringify({
    loopCount: opts.loopCount,
    approachThatFailed: opts.approachThatFailed,
    approachThatResolved: opts.approachThatResolved || null,
    gapsIdentified: opts.gapsIdentified || []
  });

  if (existing) {
    db.prepare(`
      UPDATE learner_memory SET content = ?, metadata = ?, updated_at = datetime('now') WHERE id = ?
    `).run(opts.content || '', metadata, existing.id);
  } else {
    db.prepare(`
      INSERT INTO learner_memory (id, learner_id, engagement_learner_id, memory_type, node_id, content, metadata)
      VALUES (?, ?, ?, 'struggle', ?, ?, ?)
    `).run(uuidv4(), learnerId, elId, opts.nodeId, opts.content || '', metadata);
  }
  db.close();
}

module.exports = {
  initMemorySchema,
  retrieveLearnerContext,
  writeInteraction,
  updateBehaviourFingerprint,
  writeStrugglePattern
};
