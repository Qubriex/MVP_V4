// migrations/0005_evidence.js
// Evidence and learner-model records (v4.3 §6, §7, §20):
//   - family_instances: every check a learner sees, generated outside TEACH
//   - evidence_records, answer_provenance, demonstrations (append-only)
//   - node_mastery facts: θ, evidence level, persistence, provisional, loops
//   - review_queue + faculty_reviews (append-only) for §7.8
//   - learner_vocabulary (§6), session heartbeat time (§6 active minutes)
//   - institutions.review_minutes_per_100: the contracted faculty review time
export const id = '0005_evidence';

const cols = (db, t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
const addCol = (db, t, c, def) => { if (!cols(db, t).includes(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
const appendOnly = (t) => `
  CREATE TRIGGER IF NOT EXISTS ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, '${t} is append-only'); END;
  CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, '${t} is append-only'); END;`;

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_instances (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      learner_id TEXT NOT NULL,
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      family_id TEXT NOT NULL,              -- gen:<node> until reviewed families exist (§7.2)
      family_version INTEGER NOT NULL DEFAULT 1,
      purpose TEXT NOT NULL CHECK(purpose IN ('check','review','testout','renewal','practical','dayone')),
      attempt_no INTEGER NOT NULL,
      seed TEXT NOT NULL,                    -- HMAC(secret, learner ‖ family ‖ attempt)
      params_json TEXT NOT NULL,
      question_text TEXT NOT NULL,
      generator TEXT NOT NULL,               -- model | template
      prompt_version TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(el_id, family_id, attempt_no)
    );
    CREATE INDEX IF NOT EXISTS idx_family_instances_el ON family_instances(el_id, node_id, created_at);

    CREATE TABLE IF NOT EXISTS evidence_records (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      family_id TEXT,
      instance_id TEXT REFERENCES family_instances(id),
      purpose TEXT NOT NULL CHECK(purpose IN ('check','review','testout','renewal','practical','dayone')),
      answer_hash TEXT NOT NULL,
      per_point_json TEXT,
      r_c REAL,
      exec_json TEXT,
      viva_score REAL,
      fused_score REAL,
      passed INTEGER,
      level TEXT CHECK(level IN ('L1','L2','L3','L4')),
      assurance TEXT NOT NULL CHECK(assurance IN ('A0','A1','A2','A3')),
      authentic INTEGER NOT NULL,
      flags_json TEXT NOT NULL DEFAULT '[]',
      provisional INTEGER NOT NULL DEFAULT 0,
      theta REAL,
      model_id TEXT,
      prompt_version TEXT,
      rubric_version TEXT,
      validator_version TEXT,
      family_version INTEGER,
      active_ms INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_el_node ON evidence_records(el_id, node_id, created_at);

    CREATE TABLE IF NOT EXISTS answer_provenance (
      evidence_id TEXT PRIMARY KEY REFERENCES evidence_records(id),
      mode TEXT NOT NULL CHECK(mode IN ('voice','typed')),
      answer_chars INTEGER,
      pasted_chars INTEGER,
      paste_events INTEGER,
      largest_paste INTEGER,
      edit_ratio REAL,
      tab_hidden_ms INTEGER,
      device_id TEXT
    );

    CREATE TABLE IF NOT EXISTS demonstrations (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      kind TEXT NOT NULL CHECK(kind IN ('mastery','review','renewal','practical','dayone','faculty','employer')),
      date TEXT NOT NULL,
      passed INTEGER NOT NULL,
      score REAL,
      level TEXT CHECK(level IN ('L1','L2','L3','L4')),
      assurance TEXT NOT NULL CHECK(assurance IN ('A1','A2','A3')),
      evidence_id TEXT REFERENCES evidence_records(id),
      attestation_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_demonstrations_el_node ON demonstrations(el_id, node_id, date);

    CREATE TABLE IF NOT EXISTS review_queue (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL REFERENCES evidence_records(id),
      el_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      engagement_id TEXT NOT NULL,
      stratum TEXT NOT NULL CHECK(stratum IN ('decision','calibration')),
      reason TEXT NOT NULL CHECK(reason IN ('persistence','authenticity','weak_viva','borderline','random')),
      priority INTEGER NOT NULL,             -- 1 persistence … 5 random
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
      created_at TEXT NOT NULL,
      done_at TEXT,
      UNIQUE(evidence_id)
    );
    CREATE INDEX IF NOT EXISTS idx_review_queue_open ON review_queue(institution_id, status, priority, created_at);

    CREATE TABLE IF NOT EXISTS faculty_reviews (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL REFERENCES review_queue(id),
      evidence_id TEXT NOT NULL REFERENCES evidence_records(id),
      reviewer_staff_id TEXT,
      verdict TEXT NOT NULL CHECK(verdict IN ('pass','fail')),
      band TEXT NOT NULL CHECK(band IN ('0.0-0.49','0.5-0.69','0.7-0.89','0.9-1.0')),
      notes TEXT,
      seconds_spent INTEGER,
      created_at TEXT NOT NULL
    );

    -- The answer text itself, kept apart from the evidence record (which holds
    -- only its hash) so faculty can review it and erasure can remove it.
    CREATE TABLE IF NOT EXISTS check_answers (
      evidence_id TEXT PRIMARY KEY REFERENCES evidence_records(id),
      answer_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learner_vocabulary (
      learner_id TEXT PRIMARY KEY REFERENCES learners(id),
      level TEXT NOT NULL DEFAULT 'beginner' CHECK(level IN ('beginner','intermediate','advanced')),
      clean_pass_streak INTEGER NOT NULL DEFAULT 0,
      recent_json TEXT NOT NULL DEFAULT '[]',   -- last 3 attempts: 1 = vocabulary_barrier gap
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(appendOnly('demonstrations'));
  db.exec(appendOnly('faculty_reviews'));

  addCol(db, 'node_mastery', 'theta', 'REAL');
  addCol(db, 'node_mastery', 'evidence_level', "TEXT DEFAULT 'L1'");
  addCol(db, 'node_mastery', 'persistence', 'INTEGER NOT NULL DEFAULT 0');
  addCol(db, 'node_mastery', 'provisional', 'INTEGER NOT NULL DEFAULT 0');
  addCol(db, 'node_mastery', 'recheck_required', 'INTEGER NOT NULL DEFAULT 0');
  addCol(db, 'node_mastery', 'loops', 'INTEGER');
  addCol(db, 'node_mastery', 'active_minutes', 'REAL');
  addCol(db, 'mastery_checks', 'instance_id', 'TEXT');
  addCol(db, 'mastery_checks', 'purpose', "TEXT DEFAULT 'check'");
  addCol(db, 'learning_sessions', 'last_heartbeat_at', 'TEXT');
  addCol(db, 'institutions', 'review_minutes_per_100', 'INTEGER');

  // Pre-v4.3 mastery rows are NOT turned into demonstrations: the old flow
  // recorded no provenance, so they cannot claim A1 (docs/decisions.md D-021).
}
