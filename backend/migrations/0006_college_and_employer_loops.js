// migrations/0006_college_and_employer_loops.js — the v4.3 canvas screens:
//   institution  MoU target (I1), bridge programmes (I8), placements and
//                90-day ratings (I9)
//   employer     roles from a JD (E2), the hiring pipeline with watch,
//                request, interview, Day-One, offer, hold (E3–E6), cohort
//                sponsorships (E7)
//   learner      applications with status and withdraw (L8)
import * as dal from '../core/db/dal.js';

export const id = '0006_college_and_employer_loops';

export async function up() {
  await dal.exec(`
    ALTER TABLE institutions ADD COLUMN IF NOT EXISTS mou_target_pct INTEGER;
    ALTER TABLE institutions ADD COLUMN IF NOT EXISTS mou_target_label TEXT;
    ALTER TABLE institutions ADD COLUMN IF NOT EXISTS mou_target_date TEXT;

    CREATE TABLE IF NOT EXISTS bridge_programmes (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      title TEXT NOT NULL,
      node_ids_json TEXT NOT NULL,        -- the skills to strengthen
      scope TEXT NOT NULL CHECK(scope IN ('cohort','students')),
      note TEXT,
      retest_at TEXT NOT NULL,            -- when "Did it work?" is read
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bridge_assignments (
      id TEXT PRIMARY KEY,
      bridge_id TEXT NOT NULL REFERENCES bridge_programmes(id),
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      baseline_readiness INTEGER,
      baseline_mastered_json TEXT,        -- which of the bridge skills were mastered when assigned
      assigned_at TEXT NOT NULL,
      UNIQUE(bridge_id, el_id)
    );

    CREATE TABLE IF NOT EXISTS placements (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      engagement_id TEXT REFERENCES engagements(id),
      el_id TEXT REFERENCES engagement_learners(id),
      learner_id TEXT REFERENCES learners(id),
      employer_name TEXT NOT NULL,
      employer_id TEXT,
      role_title TEXT,
      status TEXT NOT NULL CHECK(status IN ('offer','placed','declined')),
      salary_lpa DOUBLE PRECISION,
      offer_date TEXT,
      joined_date TEXT,
      rating_90d INTEGER CHECK(rating_90d BETWEEN 1 AND 5),
      rating_note TEXT,
      rated_at TEXT,
      source TEXT NOT NULL DEFAULT 'institution' CHECK(source IN ('institution','employer')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_placements_inst ON placements(institution_id, engagement_id);

    CREATE TABLE IF NOT EXISTS employer_roles (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      title TEXT NOT NULL,
      city TEXT,
      jd_text TEXT,
      skills_json TEXT NOT NULL,          -- [{ key, name, required, weight }]
      bar INTEGER NOT NULL DEFAULT 80,    -- readiness the employer asks for
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
      published INTEGER NOT NULL DEFAULT 0, -- shared with colleges as a target
      interview_promise INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS employer_pipeline (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      role_id TEXT NOT NULL REFERENCES employer_roles(id),
      el_id TEXT NOT NULL REFERENCES engagement_learners(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      stage TEXT NOT NULL CHECK(stage IN ('watching','requested','declined','access_granted','interview','dayone','offer','hired','hold','not_now','withdrawn','applied')),
      share_json TEXT,                    -- what the learner agreed to show
      interview_promised INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      nudged_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(role_id, el_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pipeline_employer ON employer_pipeline(employer_id, stage);
    CREATE INDEX IF NOT EXISTS idx_pipeline_learner ON employer_pipeline(learner_id);

    CREATE TABLE IF NOT EXISTS sponsorships (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL REFERENCES employers(id),
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      role_id TEXT REFERENCES employer_roles(id),
      seats INTEGER NOT NULL,
      interview_promise INTEGER NOT NULL DEFAULT 1,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','accepted','declined','running','done')),
      engagement_id TEXT REFERENCES engagements(id),
      created_at TEXT NOT NULL,
      decided_at TEXT
    );

    ALTER TABLE learner_jobs DROP CONSTRAINT IF EXISTS learner_jobs_status_check;
    ALTER TABLE learner_jobs ADD CONSTRAINT learner_jobs_status_check CHECK(status IN ('saved','applied','withdrawn'));
    ALTER TABLE learner_jobs ADD COLUMN IF NOT EXISTS applied_at TEXT;
    ALTER TABLE learner_jobs ADD COLUMN IF NOT EXISTS withdrawn_at TEXT;
  `);
}
