// db/init.js — Qubirex Database Schema Initialisation
// Inferexaa Private Limited
//
// SQLite (better-sqlite3), WAL mode, foreign keys ON. All tables IF NOT EXISTS.
// Production path: process.env.DB_PATH or ./qubirex.db.
//
// Schema is organised in two layers:
//   V1 — Core platform tables (institutions, learners, engagements, mastery)
//   V2 — RAG Multi-Brain tables, one block per brain (MEM / CULT / EVAL / CURR / ORCH)
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './qubirex.db';

function getDb() {
  const db = new Database(path.resolve(DB_PATH));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    -- ═══════════════════════════════════════════════════════════════════════
    -- V1 — CORE PLATFORM TABLES
    -- ═══════════════════════════════════════════════════════════════════════

    -- ─── INSTITUTIONS ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN (
        'coding_bootcamp','engineering_college','corporate_ld',
        'government_skilling','ngo','vocational','other'
      )),
      contact_name TEXT,
      contact_email TEXT NOT NULL UNIQUE,
      contact_phone TEXT,
      city TEXT DEFAULT 'Hyderabad',
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    );

    -- ─── INSTITUTION PORTAL USERS (admin/viewer seats on an institution account) ─
    -- Staff: admins, professors, viewers. Each has their own login; a row is
    -- created by an admin's invite and becomes 'active' when the invite is
    -- accepted (password set). The institution's contact email signs in as
    -- an admin row too (created on first login).
    CREATE TABLE IF NOT EXISTS institution_users (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,            -- NULL until the invite is accepted
      role TEXT DEFAULT 'professor' CHECK(role IN ('admin','professor','viewer')),
      status TEXT DEFAULT 'invited' CHECK(status IN ('invited','active','disabled')),
      name TEXT,
      title TEXT,                    -- Dr., Prof., Mr., Ms.
      designation TEXT,
      department TEXT,
      employee_id TEXT,              -- admin-only
      phone TEXT,                    -- admin-only
      qualification TEXT,
      years_teaching INTEGER,
      specialisations TEXT,          -- JSON array
      teaching_languages TEXT,       -- JSON array: english | telugu | hindi
      subjects TEXT,                 -- JSON array
      office_hours TEXT,
      target_roles TEXT,             -- JSON array
      photo_data_url TEXT,           -- small resized image (client-side, ≤ ~200 KB)
      notification_prefs TEXT,       -- JSON
      profile_completed INTEGER DEFAULT 0,
      invite_token_hash TEXT,        -- sha256 of the invite token; the token itself is never stored
      invite_expires_at TEXT,
      invited_by TEXT,
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Which cohorts (engagements) a professor or viewer is assigned to.
    CREATE TABLE IF NOT EXISTS staff_cohorts (
      staff_id TEXT NOT NULL REFERENCES institution_users(id),
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      cohort_role TEXT DEFAULT 'co' CHECK(cohort_role IN ('lead','co')),
      PRIMARY KEY (staff_id, engagement_id)
    );

    -- ─── LEARNERS ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS learners (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      name TEXT NOT NULL,
      email TEXT,
      learner_ref TEXT NOT NULL,
      pin_hash TEXT,                 -- secret login factor, set at creation; never returned after
      language TEXT NOT NULL CHECK(language IN ('hindi','telugu')),
      profile_type TEXT CHECK(profile_type IN (
        'college_student','working_professional','bootcamp_participant',
        'skilling_program','career_switcher'
      )),
      current_capability_level TEXT,
      notification_prefs TEXT, -- JSON
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1,
      UNIQUE(institution_id, learner_ref)
    );

    -- ─── CAPABILITY TARGET DOCUMENTS (institution briefs, Path A/B) ──────────
    CREATE TABLE IF NOT EXISTS capability_targets (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      path TEXT NOT NULL CHECK(path IN ('A','B')),
      domain TEXT,
      raw_input TEXT,
      extracted_targets TEXT,        -- JSON
      confirmed INTEGER DEFAULT 0,
      confirmed_at TEXT,
      time_window_weeks INTEGER,
      cohort_size INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending','confirmed','active','completed'
      ))
    );

    -- ─── SKILL CLUSTERS ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS skill_clusters (
      id TEXT PRIMARY KEY,
      capability_target_id TEXT NOT NULL REFERENCES capability_targets(id),
      cluster_label TEXT NOT NULL,
      cluster_ref TEXT,              -- institution's own label/number
      description TEXT,
      required_proficiency TEXT,
      mastery_threshold REAL DEFAULT 0.75,
      priority TEXT DEFAULT 'normal',
      evidence_type TEXT,
      estimated_hours REAL,
      sequence_order INTEGER DEFAULT 0
    );

    -- ─── SKILL NODES (atomic teachable units within a cluster) ───────────────
    CREATE TABLE IF NOT EXISTS skill_nodes (
      id TEXT PRIMARY KEY,
      cluster_id TEXT NOT NULL REFERENCES skill_clusters(id),
      node_label TEXT NOT NULL,
      description TEXT,
      prerequisite_node_ids TEXT,    -- JSON array of node IDs
      sequence_order INTEGER DEFAULT 0,
      difficulty_level INTEGER DEFAULT 1 CHECK(difficulty_level BETWEEN 1 AND 5),
      node_type TEXT DEFAULT 'concept' CHECK(node_type IN (
        'concept','applied','procedural','analytical'
      )),
      phase INTEGER DEFAULT 1,       -- 1=Learning, 2=Coding/Applied, 3=Interview/Verbal
      estimated_minutes INTEGER DEFAULT 20,
      concept_tags TEXT,             -- JSON array — links to CKB retrieval
      mastery_threshold REAL DEFAULT 0.70
    );

    -- ─── ENGAGEMENTS ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS engagements (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      capability_target_id TEXT NOT NULL REFERENCES capability_targets(id),
      title TEXT NOT NULL,
      language TEXT NOT NULL CHECK(language IN ('hindi','telugu')),
      status TEXT DEFAULT 'setup' CHECK(status IN (
        'setup','active','completed','on_hold'
      )),
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── ENGAGEMENT_LEARNERS (a learner enrolled in an engagement) ────────────
    CREATE TABLE IF NOT EXISTS engagement_learners (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      current_node_id TEXT,
      current_cluster_id TEXT,
      overall_status TEXT DEFAULT 'in_progress' CHECK(overall_status IN (
        'in_progress','completed','paused'
      )),
      enrolled_at TEXT DEFAULT (datetime('now')),
      UNIQUE(engagement_id, learner_id)
    );

    -- ─── LEARNING SESSIONS (one session per node attempt) ─────────────────────
    CREATE TABLE IF NOT EXISTS learning_sessions (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      session_number INTEGER DEFAULT 1,
      language TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed')),
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      active_minutes REAL DEFAULT 0,
      loop_count INTEGER DEFAULT 0,
      current_approach TEXT DEFAULT 'native_concept'
        CHECK(current_approach IN (
          'native_concept','analogy','worked_example',
          'decomposition','socratic'
        )),
      behaviour_signal TEXT DEFAULT 'engaged'
    );

    -- ─── SESSION MESSAGES ─────────────────────────────────────────────────────
    -- Full interaction log — learner-private, never shared with institutions
    CREATE TABLE IF NOT EXISTS session_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES learning_sessions(id),
      role TEXT NOT NULL CHECK(role IN ('ai','learner')),
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'instruction' CHECK(message_type IN (
        'diagnosis','instruction','doubt','doubt_answer','response','mastery_check',
        'feedback','loop_trigger','advance_trigger'
      )),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── LOOP APPROACHES USED (per learner per node — never repeat) ───────────
    CREATE TABLE IF NOT EXISTS loop_approaches_used (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      approach TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(engagement_learner_id, skill_node_id, approach)
    );

    -- ─── MASTERY CHECKS ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS mastery_checks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES learning_sessions(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      check_number INTEGER DEFAULT 1,
      question_text TEXT NOT NULL,
      learner_response TEXT,
      passed INTEGER,               -- 1 = advance, 0 = loop, NULL = pending
      score REAL,                   -- 0.0 to 1.0
      ai_evaluation TEXT,           -- AI's evaluation reasoning
      evaluated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── NODE MASTERY RECORDS ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS node_mastery (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      mastery_attainment REAL,       -- 0.0 to 1.0
      time_to_mastery_minutes REAL,
      attempt_count INTEGER DEFAULT 0,
      confidence_indicator REAL,     -- 0.0 to 1.0 — stability measure
      advanced_at TEXT,
      UNIQUE(engagement_learner_id, skill_node_id)
    );

    -- ─── DOUBTS — learner-private, never shown to institutions ────────────────
    CREATE TABLE IF NOT EXISTS doubts (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT,
      question_text TEXT NOT NULL,
      ai_answer TEXT,
      status TEXT DEFAULT 'answered' CHECK(status IN ('answered','escalated','resolved')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── STUDY PLANS — learner-private ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS study_plans (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      planned_date TEXT NOT NULL,
      planned_duration_minutes INTEGER DEFAULT 30,
      notes TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── STREAKS — learner-private, engagement/motivation data ────────────────
    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL UNIQUE REFERENCES engagement_learners(id),
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      total_session_days INTEGER DEFAULT 0,
      last_session_date TEXT
    );

    -- ─── MASTERY LOGS — the final output document per learner ─────────────────
    CREATE TABLE IF NOT EXISTS mastery_logs (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      capability_target_ref TEXT NOT NULL,
      produced_at TEXT DEFAULT (datetime('now')),
      -- These two fields are ALWAYS blank — owned by commissioning client
      readiness_classification TEXT DEFAULT NULL,
      external_score TEXT DEFAULT NULL,
      log_data TEXT,                 -- JSON: full structured log
      delivered INTEGER DEFAULT 0,
      delivered_at TEXT
    );

    -- ─── ADMIN USERS (Inferexaa staff) ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════════════════════════
    -- V1.5 — LEARNER PORTFOLIO & CAREER TABLES (learner side, /learn/*)
    -- All learner-private: never returned to institutions, except
    -- skill_requests, which exist to be read by the institution.
    -- ═══════════════════════════════════════════════════════════════════════

    -- ─── LEARNER PROFILE (one row per learner; name/ref stay on learners) ────
    CREATE TABLE IF NOT EXISTS learner_profiles (
      learner_id TEXT PRIMARY KEY REFERENCES learners(id),
      phone TEXT,
      city TEXT,
      link_url TEXT,                 -- LinkedIn or GitHub
      headline TEXT,                 -- e.g. "Aspiring frontend developer"
      about TEXT,                    -- resume summary, English
      target_roles TEXT,             -- JSON array
      preferred_cities TEXT,         -- JSON array
      available_from TEXT,
      expected_salary TEXT,          -- private, used for job filters only
      self_skills TEXT,              -- JSON array — self-declared, never "verified"
      experience TEXT,               -- JSON array of {role, org, period, notes}
      certifications TEXT,           -- JSON array of {name, issuer, year}
      ui_language TEXT DEFAULT 'telugu' CHECK(ui_language IN ('telugu','hindi','english')),
      voice_prefs TEXT,              -- JSON: {voice, rate, startInVoice, showEnglishCaptions, dailyReminder}
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learner_education (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      degree TEXT NOT NULL,
      institution_name TEXT,
      city TEXT,
      start_year TEXT,
      end_year TEXT,
      grade TEXT,
      sequence_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS learner_projects (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      title TEXT NOT NULL,
      description TEXT,
      tools TEXT,                    -- JSON array
      link_url TEXT,
      sequence_order INTEGER DEFAULT 0
    );

    -- ─── RESUME VERSIONS (each save is a new version; latest = highest) ─────
    CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      version INTEGER NOT NULL,
      template TEXT DEFAULT 'classic' CHECK(template IN ('classic','modern','compact')),
      sections TEXT,                 -- JSON array of {key, on}
      summary TEXT,                  -- resume-only summary; profile.about is untouched
      skill_order TEXT,              -- JSON array of skill names
      tailored_job_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(learner_id, version)
    );

    -- ─── SAVED / APPLIED JOBS (job ids come from the market feed) ───────────
    CREATE TABLE IF NOT EXISTS learner_jobs (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      job_id TEXT NOT NULL,
      status TEXT DEFAULT 'saved' CHECK(status IN ('saved','applied')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(learner_id, job_id)
    );

    -- ─── SKILL REQUESTS — learner asks the institution to add a skill ───────
    -- The institution owns the pathway, so a learner can only request.
    CREATE TABLE IF NOT EXISTS skill_requests (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      skill_name TEXT NOT NULL,
      source TEXT,                   -- 'job:<id>' | 'topic:<id>' | 'dashboard'
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','added','declined')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(engagement_learner_id, skill_name)
    );

    -- ─── STUDENT ACCESS — invites, access history, outgoing messages ──────
    CREATE TABLE IF NOT EXISTS learner_invites (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      token_hash TEXT NOT NULL UNIQUE,  -- sha256; the token is only ever in the link
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_by TEXT,                  -- staff id
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Who did what to a student's access, and when. Shown on the roster.
    CREATE TABLE IF NOT EXISTS access_events (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      learner_id TEXT REFERENCES learners(id),
      engagement_learner_id TEXT,
      event TEXT NOT NULL,              -- invited | invite_resent | pin_set | pin_reset | slip_issued | signed_in | locked | removed | restored | moved | pin_reset_requested
      detail TEXT,
      actor_staff_id TEXT,
      resolved INTEGER DEFAULT 0,       -- for pin_reset_requested
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Emails the app would send. No mail provider is wired up yet, so they
    -- are recorded here (and logged in development); the UI also shows the
    -- links so staff can share them directly.
    CREATE TABLE IF NOT EXISTS outbound_messages (
      id TEXT PRIMARY KEY,
      institution_id TEXT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT,                        -- staff_invite | learner_invite
      status TEXT DEFAULT 'queued',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════════════════════════
    -- V2 — RAG MULTI-BRAIN TABLES
    -- ═══════════════════════════════════════════════════════════════════════

    -- ─── MEM — Learner Memory ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS learner_memory (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      memory_type TEXT NOT NULL CHECK(memory_type IN (
        'interaction','struggle','vocabulary','milestone'
      )),
      node_id TEXT,
      cluster_id TEXT,
      content TEXT,
      metadata TEXT,                 -- JSON: role, decision, approachUsed, behaviourSignal, masteryScore, timestamp
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learner_behaviour_fingerprint (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL UNIQUE REFERENCES learners(id),
      avg_response_time_seconds REAL DEFAULT 0,
      disengagement_rate REAL DEFAULT 0,
      avg_loops_per_node REAL DEFAULT 0,
      preferred_approach TEXT,
      vocabulary_level TEXT DEFAULT 'beginner' CHECK(vocabulary_level IN ('beginner','intermediate','advanced')),
      session_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── CULT — Cultural Knowledge Base ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS cultural_knowledge_base (
      id TEXT PRIMARY KEY,
      concept_tag TEXT NOT NULL,
      language TEXT NOT NULL CHECK(language IN ('telugu','hindi')),
      region TEXT NOT NULL,
      vocabulary_level TEXT DEFAULT 'beginner',
      entry_point TEXT NOT NULL,
      explanation_text TEXT,
      effectiveness_score REAL DEFAULT 0.75,
      advance_count INTEGER DEFAULT 0,
      loop_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cultural_usage_log (
      id TEXT PRIMARY KEY,
      ckb_entry_id TEXT NOT NULL REFERENCES cultural_knowledge_base(id),
      learner_id TEXT,
      session_id TEXT,
      node_id TEXT,
      outcome TEXT CHECK(outcome IN ('ADVANCE','LOOP')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── EVAL — Mastery Evaluator ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS eval_rubrics (
      id TEXT PRIMARY KEY,
      node_label TEXT NOT NULL,
      language TEXT NOT NULL,
      passing_criteria TEXT,          -- JSON array
      failing_indicators TEXT,        -- JSON array
      gap_taxonomy TEXT,              -- JSON object
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
      gaps_identified TEXT,           -- JSON array
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── CURR — Curriculum Brain ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS brief_store (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      domain TEXT NOT NULL,
      language TEXT NOT NULL,
      raw_input_summary TEXT,
      extracted_clusters TEXT,        -- JSON
      extraction_confidence REAL,
      confirmed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS curriculum_node_specs (
      id TEXT PRIMARY KEY,
      skill_node_id TEXT NOT NULL UNIQUE REFERENCES skill_nodes(id),
      node_label TEXT NOT NULL,
      cluster_label TEXT,
      learning_objectives TEXT,       -- JSON array
      prerequisite_labels TEXT,       -- JSON array
      mastery_threshold REAL DEFAULT 0.70,
      phase INTEGER DEFAULT 1,
      difficulty_level INTEGER DEFAULT 1,
      estimated_minutes INTEGER DEFAULT 20,
      concept_tags TEXT,              -- JSON array
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── ORCH — Orchestration Log ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS orchestration_log (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      learner_id TEXT,
      request_type TEXT NOT NULL,
      brains_activated TEXT,          -- JSON array
      processing_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Lightweight migrations (no framework — SQLite has no ADD COLUMN IF NOT EXISTS) ─
  const learnerColumns = db.prepare("PRAGMA table_info(learners)").all().map(c => c.name);
  if (!learnerColumns.includes('pin_hash')) {
    db.exec('ALTER TABLE learners ADD COLUMN pin_hash TEXT');
  }
  // Voice session: English caption line + board content (diagram/code) per AI turn
  const messageColumns = db.prepare("PRAGMA table_info(session_messages)").all().map(c => c.name);
  if (!messageColumns.includes('caption_en')) db.exec('ALTER TABLE session_messages ADD COLUMN caption_en TEXT');
  if (!messageColumns.includes('mermaid')) db.exec('ALTER TABLE session_messages ADD COLUMN mermaid TEXT');
  if (!messageColumns.includes('code')) db.exec('ALTER TABLE session_messages ADD COLUMN code TEXT');
  if (!messageColumns.includes('input_mode')) db.exec("ALTER TABLE session_messages ADD COLUMN input_mode TEXT"); // 'voice' | 'text'

  // Staff table: the first version allowed only admin/viewer and required a
  // password. SQLite can't alter a CHECK, so rebuild it once (nothing used it).
  const staffSql = (db.prepare("SELECT sql FROM sqlite_master WHERE name = 'institution_users'").get() || {}).sql || '';
  if (!staffSql.includes("'professor'")) {
    db.exec(`
      ALTER TABLE institution_users RENAME TO institution_users_v1;
      CREATE TABLE institution_users (
        id TEXT PRIMARY KEY, institution_id TEXT NOT NULL REFERENCES institutions(id), email TEXT NOT NULL UNIQUE,
        password_hash TEXT, role TEXT DEFAULT 'professor' CHECK(role IN ('admin','professor','viewer')),
        status TEXT DEFAULT 'invited' CHECK(status IN ('invited','active','disabled')),
        name TEXT, title TEXT, designation TEXT, department TEXT, employee_id TEXT, phone TEXT, qualification TEXT,
        years_teaching INTEGER, specialisations TEXT, teaching_languages TEXT, subjects TEXT, office_hours TEXT,
        target_roles TEXT, photo_data_url TEXT, notification_prefs TEXT, profile_completed INTEGER DEFAULT 0,
        invite_token_hash TEXT, invite_expires_at TEXT, invited_by TEXT, last_login_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO institution_users (id, institution_id, email, password_hash, role, status, created_at)
        SELECT id, institution_id, email, password_hash, role, 'active', created_at FROM institution_users_v1;
      DROP TABLE institution_users_v1;
    `);
  }

  // Student access: join codes, per-enrolment access state, PIN lifecycle.
  const engagementColumns = db.prepare("PRAGMA table_info(engagements)").all().map(c => c.name);
  if (!engagementColumns.includes('join_code')) db.exec('ALTER TABLE engagements ADD COLUMN join_code TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_engagements_join_code ON engagements(join_code)');
  const { generateJoinCode } = require('../core/access');
  db.prepare('SELECT id, title FROM engagements WHERE join_code IS NULL').all()
    .forEach(e => db.prepare('UPDATE engagements SET join_code = ? WHERE id = ?').run(generateJoinCode(db, e.title), e.id));

  const elColumns = db.prepare("PRAGMA table_info(engagement_learners)").all().map(c => c.name);
  if (!elColumns.includes('access_status')) db.exec("ALTER TABLE engagement_learners ADD COLUMN access_status TEXT DEFAULT 'active'"); // active | removed
  if (!elColumns.includes('last_login_at')) db.exec('ALTER TABLE engagement_learners ADD COLUMN last_login_at TEXT');
  if (!elColumns.includes('failed_pin_attempts')) db.exec('ALTER TABLE engagement_learners ADD COLUMN failed_pin_attempts INTEGER DEFAULT 0');
  if (!elColumns.includes('locked_at')) db.exec('ALTER TABLE engagement_learners ADD COLUMN locked_at TEXT');
  if (!elColumns.includes('removed_at')) db.exec('ALTER TABLE engagement_learners ADD COLUMN removed_at TEXT');
  if (!elColumns.includes('delivery')) db.exec('ALTER TABLE engagement_learners ADD COLUMN delivery TEXT'); // email | slip | legacy
  if (!learnerColumns.includes('pin_must_change')) db.exec('ALTER TABLE learners ADD COLUMN pin_must_change INTEGER DEFAULT 0');
  if (!learnerColumns.includes('pin_set_at')) db.exec('ALTER TABLE learners ADD COLUMN pin_set_at TEXT');

  const profileColumns = db.prepare("PRAGMA table_info(learner_profiles)").all().map(c => c.name);
  if (!profileColumns.includes('share_with_institution')) db.exec('ALTER TABLE learner_profiles ADD COLUMN share_with_institution INTEGER DEFAULT 0');

  console.log('Qubirex database initialised at:', DB_PATH);
  db.close();
}

module.exports = { getDb, initDb };
