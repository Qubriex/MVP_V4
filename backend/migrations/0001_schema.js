// migrations/0001_schema.js — the PostgreSQL schema (v4.3.1), equivalent to
// SQLite migrations 0001–0008 (docs/decisions.md D-026). Timestamps stay TEXT
// (ISO 8601 from nowIso(), or 'YYYY-MM-DD HH:MM:SS' from datetime()), so every
// comparison the code makes is unchanged. Integer 0/1 flags stay INTEGER.
//   - datetime(ts [, modifier]) mirrors SQLite's datetime() for defaults and
//     for the few queries that use it ('now', '-7 days', …)
//   - seq BIGSERIAL on session_messages, mastery_checks, passport_shares
//     replaces SQLite's rowid as the insertion-order tiebreak
//   - append-only tables are enforced by triggers
import * as dal from '../core/db/dal.js';

export const id = '0001_schema';

const FUNCTIONS = `
CREATE OR REPLACE FUNCTION datetime(ts text, modifier text DEFAULT NULL) RETURNS text
LANGUAGE sql STABLE AS \$\$
  SELECT to_char(
    (CASE WHEN ts = 'now' THEN (now() AT TIME ZONE 'utc') ELSE ts::timestamp END)
      + COALESCE(modifier::interval, interval '0 seconds'),
    'YYYY-MM-DD HH24:MI:SS')
\$\$;

CREATE OR REPLACE FUNCTION qbx_append_only() RETURNS trigger LANGUAGE plpgsql AS \$\$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END \$\$;

CREATE OR REPLACE FUNCTION qbx_consents_withdraw_only() RETURNS trigger LANGUAGE plpgsql AS \$\$
BEGIN
  IF OLD.withdrawn_at IS NOT NULL OR NEW.withdrawn_at IS NULL
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.learner_id IS DISTINCT FROM OLD.learner_id
    OR NEW.institution_id IS DISTINCT FROM OLD.institution_id OR NEW.level IS DISTINCT FROM OLD.level
    OR NEW.purpose IS DISTINCT FROM OLD.purpose OR NEW.text_version IS DISTINCT FROM OLD.text_version
    OR NEW.granted_by IS DISTINCT FROM OLD.granted_by OR NEW.guardian_ref IS DISTINCT FROM OLD.guardian_ref
    OR NEW.scope_json IS DISTINCT FROM OLD.scope_json OR NEW.granted_at IS DISTINCT FROM OLD.granted_at THEN
    RAISE EXCEPTION 'consents is append-only: only withdrawn_at may be set, once';
  END IF;
  RETURN NEW;
END \$\$;

CREATE OR REPLACE FUNCTION qbx_credentials_supersede_only() RETURNS trigger LANGUAGE plpgsql AS \$\$
BEGIN
  IF NOT (OLD.active = 1 AND NEW.active = 0)
    OR NEW.credential_id IS DISTINCT FROM OLD.credential_id OR NEW.evidence_id IS DISTINCT FROM OLD.evidence_id
    OR NEW.version IS DISTINCT FROM OLD.version OR NEW.sd_jwt IS DISTINCT FROM OLD.sd_jwt OR NEW.kid IS DISTINCT FROM OLD.kid
    OR NEW.valid_from IS DISTINCT FROM OLD.valid_from OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.status_list_id IS DISTINCT FROM OLD.status_list_id OR NEW.status_index IS DISTINCT FROM OLD.status_index THEN
    RAISE EXCEPTION 'credentials is append-only: a reissue adds a version';
  END IF;
  RETURN NEW;
END \$\$;
`;

const TABLES = `
CREATE TABLE institutions (
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
    , review_minutes_per_100 INTEGER);

CREATE TABLE institution_users (
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

CREATE TABLE capability_targets (
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

CREATE TABLE engagements (
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
    , join_code TEXT, placement_date TEXT);

CREATE TABLE staff_cohorts (
      staff_id TEXT NOT NULL REFERENCES institution_users(id),
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      cohort_role TEXT DEFAULT 'co' CHECK(cohort_role IN ('lead','co')),
      PRIMARY KEY (staff_id, engagement_id)
    );

CREATE TABLE learners (
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
      is_active INTEGER DEFAULT 1, pin_must_change INTEGER DEFAULT 0, pin_set_at TEXT, is_discoverable INTEGER NOT NULL DEFAULT 0, availability TEXT, city TEXT, age_status TEXT NOT NULL DEFAULT 'unknown' CHECK(age_status IN ('adult','minor','unknown')), updated_at TEXT,
      UNIQUE(institution_id, learner_ref)
    );

CREATE TABLE skill_clusters (
      id TEXT PRIMARY KEY,
      capability_target_id TEXT NOT NULL REFERENCES capability_targets(id),
      cluster_label TEXT NOT NULL,
      cluster_ref TEXT,              -- institution's own label/number
      description TEXT,
      required_proficiency TEXT,
      mastery_threshold DOUBLE PRECISION DEFAULT 0.75,
      priority TEXT DEFAULT 'normal',
      evidence_type TEXT,
      estimated_hours DOUBLE PRECISION,
      sequence_order INTEGER DEFAULT 0
    );

CREATE TABLE skill_nodes (
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
      mastery_threshold DOUBLE PRECISION DEFAULT 0.70
    );

CREATE TABLE engagement_learners (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      current_node_id TEXT,
      current_cluster_id TEXT,
      overall_status TEXT DEFAULT 'in_progress' CHECK(overall_status IN (
        'in_progress','completed','paused'
      )),
      enrolled_at TEXT DEFAULT (datetime('now')), access_status TEXT DEFAULT 'active', last_login_at TEXT, failed_pin_attempts INTEGER DEFAULT 0, locked_at TEXT, removed_at TEXT, delivery TEXT,
      UNIQUE(engagement_id, learner_id)
    );

CREATE TABLE learning_sessions (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      session_number INTEGER DEFAULT 1,
      language TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed')),
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      active_minutes DOUBLE PRECISION DEFAULT 0,
      loop_count INTEGER DEFAULT 0,
      current_approach TEXT DEFAULT 'native_concept'
        CHECK(current_approach IN (
          'native_concept','analogy','worked_example',
          'decomposition','socratic'
        )),
      behaviour_signal TEXT DEFAULT 'engaged'
    , last_heartbeat_at TEXT);

CREATE TABLE session_messages (
      seq BIGSERIAL,
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES learning_sessions(id),
      role TEXT NOT NULL CHECK(role IN ('ai','learner')),
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'instruction' CHECK(message_type IN (
        'diagnosis','instruction','doubt','doubt_answer','response','mastery_check',
        'feedback','loop_trigger','advance_trigger'
      )),
      created_at TEXT DEFAULT (datetime('now'))
    , caption_en TEXT, mermaid TEXT, code TEXT, input_mode TEXT);

CREATE TABLE loop_approaches_used (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      approach TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(engagement_learner_id, skill_node_id, approach)
    );

CREATE TABLE mastery_checks (
      seq BIGSERIAL,
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES learning_sessions(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      check_number INTEGER DEFAULT 1,
      question_text TEXT NOT NULL,
      learner_response TEXT,
      passed INTEGER,               -- 1 = advance, 0 = loop, NULL = pending
      score DOUBLE PRECISION,                   -- 0.0 to 1.0
      ai_evaluation TEXT,           -- AI's evaluation reasoning
      evaluated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    , instance_id TEXT, purpose TEXT DEFAULT 'check');

CREATE TABLE node_mastery (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      mastery_attainment DOUBLE PRECISION,       -- 0.0 to 1.0
      time_to_mastery_minutes DOUBLE PRECISION,
      attempt_count INTEGER DEFAULT 0,
      advanced_at TEXT, theta DOUBLE PRECISION, evidence_level TEXT DEFAULT 'L1', persistence INTEGER NOT NULL DEFAULT 0, provisional INTEGER NOT NULL DEFAULT 0, recheck_required INTEGER NOT NULL DEFAULT 0, loops INTEGER, active_minutes DOUBLE PRECISION,
      UNIQUE(engagement_learner_id, skill_node_id)
    );

CREATE TABLE doubts (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT,
      question_text TEXT NOT NULL,
      ai_answer TEXT,
      status TEXT DEFAULT 'answered' CHECK(status IN ('answered','escalated','resolved')),
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE study_plans (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      planned_date TEXT NOT NULL,
      planned_duration_minutes INTEGER DEFAULT 30,
      notes TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE streaks (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL UNIQUE REFERENCES engagement_learners(id),
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      total_session_days INTEGER DEFAULT 0,
      last_session_date TEXT
    );

CREATE TABLE mastery_logs (
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
    , evidence_id TEXT, sha256 TEXT, signature_json TEXT);

CREATE TABLE admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE learner_profiles (
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
    , share_with_institution INTEGER DEFAULT 0);

CREATE TABLE learner_education (
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

CREATE TABLE learner_projects (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      title TEXT NOT NULL,
      description TEXT,
      tools TEXT,                    -- JSON array
      link_url TEXT,
      sequence_order INTEGER DEFAULT 0
    );

CREATE TABLE resume_versions (
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

CREATE TABLE learner_jobs (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      job_id TEXT NOT NULL,
      status TEXT DEFAULT 'saved' CHECK(status IN ('saved','applied')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(learner_id, job_id)
    );

CREATE TABLE skill_requests (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      skill_name TEXT NOT NULL,
      source TEXT,                   -- 'job:<id>' | 'topic:<id>' | 'dashboard'
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','added','declined')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(engagement_learner_id, skill_name)
    );

CREATE TABLE learner_invites (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      token_hash TEXT NOT NULL UNIQUE,  -- sha256; the token is only ever in the link
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_by TEXT,                  -- staff id
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE access_events (
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

CREATE TABLE outbound_messages (
      id TEXT PRIMARY KEY,
      institution_id TEXT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT,                        -- staff_invite | learner_invite
      status TEXT DEFAULT 'queued',
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE learner_memory (
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

CREATE TABLE learner_behaviour_fingerprint (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL UNIQUE REFERENCES learners(id),
      avg_response_time_seconds DOUBLE PRECISION DEFAULT 0,
      disengagement_rate DOUBLE PRECISION DEFAULT 0,
      avg_loops_per_node DOUBLE PRECISION DEFAULT 0,
      preferred_approach TEXT,
      vocabulary_level TEXT DEFAULT 'beginner' CHECK(vocabulary_level IN ('beginner','intermediate','advanced')),
      session_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE cultural_knowledge_base (
      id TEXT PRIMARY KEY,
      concept_tag TEXT NOT NULL,
      language TEXT NOT NULL CHECK(language IN ('telugu','hindi')),
      region TEXT NOT NULL,
      vocabulary_level TEXT DEFAULT 'beginner',
      entry_point TEXT NOT NULL,
      explanation_text TEXT,
      effectiveness_score DOUBLE PRECISION DEFAULT 0.75,
      advance_count INTEGER DEFAULT 0,
      loop_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE cultural_usage_log (
      id TEXT PRIMARY KEY,
      ckb_entry_id TEXT NOT NULL REFERENCES cultural_knowledge_base(id),
      learner_id TEXT,
      session_id TEXT,
      node_id TEXT,
      outcome TEXT CHECK(outcome IN ('ADVANCE','LOOP')),
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE eval_rubrics (
      id TEXT PRIMARY KEY,
      node_label TEXT NOT NULL,
      language TEXT NOT NULL,
      passing_criteria TEXT,          -- JSON array
      failing_indicators TEXT,        -- JSON array
      gap_taxonomy TEXT,              -- JSON object
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(node_label, language)
    );

CREATE TABLE eval_example_responses (
      id TEXT PRIMARY KEY,
      node_label TEXT NOT NULL,
      language TEXT NOT NULL,
      response_text TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('pass','fail')),
      score DOUBLE PRECISION,
      gaps_identified TEXT,           -- JSON array
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE brief_store (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      domain TEXT NOT NULL,
      language TEXT NOT NULL,
      raw_input_summary TEXT,
      extracted_clusters TEXT,        -- JSON
      extraction_confidence DOUBLE PRECISION,
      confirmed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE curriculum_node_specs (
      id TEXT PRIMARY KEY,
      skill_node_id TEXT NOT NULL UNIQUE REFERENCES skill_nodes(id),
      node_label TEXT NOT NULL,
      cluster_label TEXT,
      learning_objectives TEXT,       -- JSON array
      prerequisite_labels TEXT,       -- JSON array
      mastery_threshold DOUBLE PRECISION DEFAULT 0.70,
      phase INTEGER DEFAULT 1,
      difficulty_level INTEGER DEFAULT 1,
      estimated_minutes INTEGER DEFAULT 20,
      concept_tags TEXT,              -- JSON array
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE orchestration_log (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      learner_id TEXT,
      request_type TEXT NOT NULL,
      brains_activated TEXT,          -- JSON array
      processing_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE domain_events (
      id TEXT PRIMARY KEY,                 -- ULID
      type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,                -- retry backoff
      last_error TEXT,
      dead_lettered_at TEXT
    );

CREATE TABLE event_consumptions (
      event_id TEXT NOT NULL REFERENCES domain_events(id),
      subscriber TEXT NOT NULL,
      consumed_at TEXT NOT NULL,
      PRIMARY KEY (event_id, subscriber)
    );

CREATE TABLE consents (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 6),
      purpose TEXT NOT NULL,
      text_version TEXT NOT NULL,
      granted_by TEXT NOT NULL DEFAULT 'learner' CHECK(granted_by IN ('learner','guardian')),
      guardian_ref TEXT,                   -- signed-form reference for minors
      scope_json TEXT,                     -- e.g. the employer a level-4 consent covers
      granted_at TEXT NOT NULL,
      withdrawn_at TEXT
    );

CREATE TABLE employers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,                -- company email domain, verified later
      website TEXT,
      kyb_status TEXT NOT NULL DEFAULT 'pending' CHECK(kyb_status IN ('pending','verified','rejected','suspended')),
      domain_verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    , gstin TEXT, gst_state_code TEXT, contact_name TEXT, contact_phone TEXT, city TEXT, kyb_note TEXT, kyb_decided_by TEXT, kyb_decided_at TEXT);

CREATE TABLE auth_sessions (
      id TEXT PRIMARY KEY,                 -- ULID, carried in the signed session token as sid
      actor_type TEXT NOT NULL CHECK(actor_type IN ('staff','learner','employer','admin')),
      actor_id TEXT NOT NULL,
      institution_id TEXT,
      employer_id TEXT,
      csrf_hash TEXT NOT NULL,             -- sha256 of the CSRF token handed to the client
      ip TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );

CREATE TABLE login_failures (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL,
      account_key TEXT NOT NULL,           -- lower-cased email
      ip TEXT,
      created_at TEXT NOT NULL
    );

CREATE TABLE prompt_versions (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      version INTEGER NOT NULL,
      author TEXT,
      changelog TEXT,
      content_hash TEXT,                   -- the text itself lives in secure-config
      gold_result TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(task, version)
    );

CREATE TABLE model_calls (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      adapter TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_version TEXT,
      prompt_id TEXT,
      prompt_version TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      ms INTEGER,
      cost DOUBLE PRECISION,
      institution_id TEXT,
      status TEXT NOT NULL,                -- ok | fallback | schema_failed | error
      error TEXT,
      created_at TEXT NOT NULL
    );

CREATE TABLE employer_users (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'recruiter' CHECK(role IN ('owner','recruiter','viewer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE skills (
      skill_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      description TEXT,
      typical_hours DOUBLE PRECISION,
      parent_skill_id TEXT REFERENCES skills(skill_id),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

CREATE TABLE skill_aliases (
      alias_norm TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills(skill_id),
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE skill_prereqs (
      skill_id TEXT NOT NULL REFERENCES skills(skill_id),
      prereq_skill_id TEXT NOT NULL REFERENCES skills(skill_id),
      PRIMARY KEY (skill_id, prereq_skill_id)
    );

CREATE TABLE node_skill_map (
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      skill_id TEXT NOT NULL REFERENCES skills(skill_id),
      weight DOUBLE PRECISION NOT NULL CHECK(weight > 0 AND weight <= 1),
      source TEXT NOT NULL,              -- curr | resolve | review
      confidence DOUBLE PRECISION,
      created_at TEXT NOT NULL,
      PRIMARY KEY (node_id, skill_id)
    );

CREATE TABLE ontology_review_queue (
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

CREATE TABLE family_instances (
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

CREATE TABLE evidence_records (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      family_id TEXT,
      instance_id TEXT REFERENCES family_instances(id),
      purpose TEXT NOT NULL CHECK(purpose IN ('check','review','testout','renewal','practical','dayone')),
      answer_hash TEXT NOT NULL,
      per_point_json TEXT,
      r_c DOUBLE PRECISION,
      exec_json TEXT,
      viva_score DOUBLE PRECISION,
      fused_score DOUBLE PRECISION,
      passed INTEGER,
      level TEXT CHECK(level IN ('L1','L2','L3','L4')),
      assurance TEXT NOT NULL CHECK(assurance IN ('A0','A1','A2','A3')),
      authentic INTEGER NOT NULL,
      flags_json TEXT NOT NULL DEFAULT '[]',
      provisional INTEGER NOT NULL DEFAULT 0,
      theta DOUBLE PRECISION,
      model_id TEXT,
      prompt_version TEXT,
      rubric_version TEXT,
      validator_version TEXT,
      family_version INTEGER,
      active_ms INTEGER,
      created_at TEXT NOT NULL
    );

CREATE TABLE answer_provenance (
      evidence_id TEXT PRIMARY KEY REFERENCES evidence_records(id),
      mode TEXT NOT NULL CHECK(mode IN ('voice','typed')),
      answer_chars INTEGER,
      pasted_chars INTEGER,
      paste_events INTEGER,
      largest_paste INTEGER,
      edit_ratio DOUBLE PRECISION,
      tab_hidden_ms INTEGER,
      device_id TEXT
    );

CREATE TABLE demonstrations (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      kind TEXT NOT NULL CHECK(kind IN ('mastery','review','renewal','practical','dayone','faculty','employer')),
      date TEXT NOT NULL,
      passed INTEGER NOT NULL,
      score DOUBLE PRECISION,
      level TEXT CHECK(level IN ('L1','L2','L3','L4')),
      assurance TEXT NOT NULL CHECK(assurance IN ('A1','A2','A3')),
      evidence_id TEXT REFERENCES evidence_records(id),
      attestation_id TEXT,
      created_at TEXT NOT NULL
    );

CREATE TABLE review_queue (
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

CREATE TABLE faculty_reviews (
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

CREATE TABLE check_answers (
      evidence_id TEXT PRIMARY KEY REFERENCES evidence_records(id),
      answer_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE learner_vocabulary (
      learner_id TEXT PRIMARY KEY REFERENCES learners(id),
      level TEXT NOT NULL DEFAULT 'beginner' CHECK(level IN ('beginner','intermediate','advanced')),
      clean_pass_streak INTEGER NOT NULL DEFAULT 0,
      recent_json TEXT NOT NULL DEFAULT '[]',   -- last 3 attempts: 1 = vocabulary_barrier gap
      updated_at TEXT NOT NULL
    );

CREATE TABLE node_retention (
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      interval_days DOUBLE PRECISION NOT NULL,
      due_at TEXT NOT NULL,
      last_review_at TEXT,
      last_result TEXT CHECK(last_result IN ('pass','fail')),
      reviews_passed INTEGER NOT NULL DEFAULT 0,
      reviews_failed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (el_id, node_id)
    );

CREATE TABLE signing_keys (
      kid TEXT PRIMARY KEY,
      public_jwk_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired','compromised')),
      created_at TEXT NOT NULL,
      retired_at TEXT
    );

CREATE TABLE status_lists (
      id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL CHECK(purpose IN ('revocation','suspension','reissue')),
      bits BYTEA NOT NULL,
      next_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE credentials (
      credential_id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      target_id TEXT NOT NULL REFERENCES capability_targets(id),
      sd_jwt TEXT NOT NULL,
      kid TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      status_list_id TEXT NOT NULL REFERENCES status_lists(id),
      status_index INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(evidence_id, version)
    );

CREATE TABLE passport_shares (
      seq BIGSERIAL,
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      is_public INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE renewal_runs (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      el_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','complete','abandoned')),
      instances_json TEXT NOT NULL,          -- [{skill_id, node_id, instance_id}]
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

CREATE TABLE employer_domain_otps (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      user_id TEXT NOT NULL REFERENCES employer_users(id),
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

CREATE TABLE employer_invites (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      email TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL CHECK(role IN ('recruiter','viewer')),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE employer_api_keys (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      name TEXT NOT NULL,
      prefix TEXT NOT NULL UNIQUE,
      key_hash TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );

CREATE TABLE employer_signing_identities (
      employer_id TEXT PRIMARY KEY REFERENCES employers(id),
      kind TEXT NOT NULL CHECK(kind IN ('did_web','jwks_url')),
      value TEXT NOT NULL,
      activated INTEGER NOT NULL DEFAULT 0,   -- Phase 3: employer-held keys
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE UNIQUE INDEX idx_engagements_join_code ON engagements(join_code);
CREATE INDEX idx_domain_events_pending ON domain_events(delivered_at, dead_lettered_at, created_at);
CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id, created_at);
CREATE INDEX idx_consents_learner ON consents(learner_id, level);
CREATE INDEX idx_auth_sessions_actor ON auth_sessions(actor_type, actor_id);
CREATE INDEX idx_login_failures_account ON login_failures(actor_type, account_key, created_at);
CREATE INDEX idx_login_failures_ip ON login_failures(ip, created_at);
CREATE INDEX idx_model_calls_task ON model_calls(task, created_at);
CREATE INDEX idx_employer_users_employer ON employer_users(employer_id);
CREATE INDEX idx_skill_aliases_skill ON skill_aliases(skill_id);
CREATE INDEX idx_node_skill_map_skill ON node_skill_map(skill_id);
CREATE INDEX idx_family_instances_el ON family_instances(el_id, node_id, created_at);
CREATE INDEX idx_evidence_el_node ON evidence_records(el_id, node_id, created_at);
CREATE INDEX idx_demonstrations_el_node ON demonstrations(el_id, node_id, date);
CREATE INDEX idx_review_queue_open ON review_queue(institution_id, status, priority, created_at);
CREATE INDEX idx_node_retention_due ON node_retention(el_id, due_at);
CREATE INDEX idx_credentials_evidence ON credentials(evidence_id, active);
CREATE INDEX idx_passport_shares ON passport_shares(evidence_id, created_at);
`;

const appendOnly = (t, ops = ['UPDATE', 'DELETE']) => ops.map(op =>
  `CREATE TRIGGER ${t}_no_${op.toLowerCase()} BEFORE ${op} ON ${t} FOR EACH ROW EXECUTE FUNCTION qbx_append_only();`).join('\n');

const TRIGGERS = [
  appendOnly('access_events'),
  appendOnly('demonstrations'),
  appendOnly('faculty_reviews'),
  appendOnly('consents', ['DELETE']),
  'CREATE TRIGGER consents_withdraw_only BEFORE UPDATE ON consents FOR EACH ROW EXECUTE FUNCTION qbx_consents_withdraw_only();',
  appendOnly('credentials', ['DELETE']),
  'CREATE TRIGGER credentials_supersede_only BEFORE UPDATE ON credentials FOR EACH ROW EXECUTE FUNCTION qbx_credentials_supersede_only();'
].join('\n');

export async function up() {
  await dal.exec(FUNCTIONS);
  await dal.exec(TABLES);
  await dal.exec(TRIGGERS);
}
