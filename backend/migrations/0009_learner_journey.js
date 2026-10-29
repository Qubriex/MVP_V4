// migrations/0009_learner_journey.js — the complete learner journey.
//   test_learner_controls  per test learner (test tenant only): a time offset
//                          read instead of the real clock, a forced next check
//                          result and the tutor (scripted or live) — the /dev
//                          journey controls. Never consulted outside the test tenant.
//   baseline_runs          the starting check and the placement it gave.
//   practice_attempts      the Practice tab: quick questions, short written
//                          answers, code checked against test cases.
//   work_tasks             the Apply tab: one work task per skill, fixed for 30 days.
//   check_challenges       the spoken challenge after a passed check (A2).
//   check_help_requests    "Ask my professor" after a failed check.
//   share_decisions        a learner's decisions on an employer request, item by item.
//   passport_views         who viewed a Passport: type and date only, no personal data.
//   resume_claims          what an uploaded résumé says (never counts toward readiness).
//   notification_prefs     per event and channel.
//   dayone_runs            the learner side of a Day-One Simulation.
//   account_deletions      delete with an OTP and a grace period.
//   learner_plan           skills a learner added to their plan.
//   demonstrations.kind    + practice, task, challenge.
//   evidence_records       + feedback_json: what was good / missing / next time,
//                          for the result screen and attempt history.
//   employer_pipeline      + shortlisted, interview date, source (request or
//                          apply) and the stage history the learner sees.
import * as dal from '../core/db/dal.js';

export const id = '0009_learner_journey';

export async function up() {
  await dal.exec(`
    CREATE TABLE IF NOT EXISTS test_learner_controls (
      el_id TEXT PRIMARY KEY REFERENCES engagement_learners(id),
      time_offset_days INTEGER NOT NULL DEFAULT 0,
      next_check TEXT CHECK(next_check IN ('pass','fail')),
      tutor TEXT CHECK(tutor IN ('scripted','live')),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS baseline_runs (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      status TEXT NOT NULL CHECK(status IN ('started','done','skipped')),
      items_json TEXT NOT NULL,
      answers_json TEXT,
      placement_json TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_baseline_el ON baseline_runs(el_id, started_at);

    CREATE TABLE IF NOT EXISTS practice_attempts (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      kind TEXT NOT NULL CHECK(kind IN ('quick','written','code','task')),
      item_key TEXT NOT NULL,
      answer_text TEXT,
      score DOUBLE PRECISION,
      passed INTEGER,
      feedback_json TEXT,
      level TEXT,
      assurance TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_practice_el_node ON practice_attempts(el_id, node_id, created_at);

    CREATE TABLE IF NOT EXISTS work_tasks (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      task_key TEXT NOT NULL,
      brief_json TEXT NOT NULL,
      guide_json TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      locked_until TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted')),
      submitted_at TEXT,
      UNIQUE(el_id, node_id)
    );

    CREATE TABLE IF NOT EXISTS check_challenges (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      evidence_id TEXT REFERENCES evidence_records(id),
      question TEXT NOT NULL,
      answer_text TEXT,
      mode TEXT,
      passed INTEGER,
      created_at TEXT NOT NULL,
      answered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS check_help_requests (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      evidence_id TEXT REFERENCES evidence_records(id),
      message TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered')),
      reply TEXT,
      replied_by TEXT,
      created_at TEXT NOT NULL,
      answered_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_check_help_inst ON check_help_requests(institution_id, status);

    CREATE TABLE IF NOT EXISTS share_decisions (
      id TEXT PRIMARY KEY,
      pipeline_id TEXT NOT NULL REFERENCES employer_pipeline(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      decision TEXT NOT NULL CHECK(decision IN ('approved','declined','question','withdrawn')),
      granted_json TEXT,
      expires_at TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_share_decisions_pipe ON share_decisions(pipeline_id, created_at);

    CREATE TABLE IF NOT EXISTS passport_views (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      viewer_type TEXT NOT NULL CHECK(viewer_type IN ('employer','public','college')),
      viewed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_passport_views ON passport_views(evidence_id, viewed_at);

    CREATE TABLE IF NOT EXISTS resume_claims (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      skill_name TEXT NOT NULL,
      source_line TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_prefs (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      event TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('in_app','whatsapp','email')),
      enabled INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (learner_id, event, channel)
    );

    CREATE TABLE IF NOT EXISTS dayone_runs (
      id TEXT PRIMARY KEY,
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      pipeline_id TEXT REFERENCES employer_pipeline(id),
      role_title TEXT,
      status TEXT NOT NULL CHECK(status IN ('assigned','practice_done','scored')),
      checks_json TEXT,
      practice_at TEXT,
      scored_at TEXT,
      score DOUBLE PRECISION,
      passed INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS account_deletions (
      learner_id TEXT PRIMARY KEY REFERENCES learners(id),
      otp_hash TEXT,
      otp_expires_at TEXT,
      requested_at TEXT NOT NULL,
      confirmed_at TEXT,
      purge_after TEXT,
      cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS learner_plan (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      skill_name TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(learner_id, skill_name)
    );

    ALTER TABLE demonstrations DROP CONSTRAINT IF EXISTS demonstrations_kind_check;
    ALTER TABLE demonstrations ADD CONSTRAINT demonstrations_kind_check
      CHECK(kind IN ('mastery','review','renewal','practical','dayone','faculty','employer','practice','task','challenge'));

    ALTER TABLE employer_pipeline DROP CONSTRAINT IF EXISTS employer_pipeline_stage_check;
    ALTER TABLE employer_pipeline ADD CONSTRAINT employer_pipeline_stage_check
      CHECK(stage IN ('watching','requested','declined','access_granted','interview','dayone','offer','hired','hold','not_now','withdrawn','applied','shortlisted'));
    ALTER TABLE employer_pipeline ADD COLUMN IF NOT EXISTS interview_at TEXT;
    ALTER TABLE employer_pipeline ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'request';
    ALTER TABLE employer_pipeline ADD COLUMN IF NOT EXISTS history_json TEXT;
    ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS feedback_json TEXT;
  `);
}
