// migrations/0010_courses_and_voice.js — structured teaching and the voice cache.
//   learners.learning_language  the language lessons, notes, practice and
//                          reviews come in (telugu, hindi, english, telugu_en,
//                          hindi_en). NULL means the cohort's language.
//   learner_courses        courses a learner added (Explore topics) or that
//                          their college programme uses.
//   lesson_progress        per learner and lesson: where they are in
//                          Learn → See the code → Practise → Check, and the result.
//   course_evidence        dated facts from course lessons and modules:
//                          practice (code ran against tests), check, spoken
//                          challenge, test-out, module test, module project.
//                          Labels are computed from these like demonstrations.
//   module_results         module test and project: passing both adds the
//                          module's skill group to the Capability Passport.
//   content_feedback       "Was this clear?" on each part of a lesson.
//   content_reviews        a college's faculty marking a lesson Reviewed or
//                          suggesting an edit, per language.
//   tts_cache              generated speech for repeated lines, shared by
//                          every server instance, so they start at once.
import * as dal from '../core/db/dal.js';

export const id = '0010_courses_and_voice';

export async function up() {
  await dal.exec(`
    ALTER TABLE learners ADD COLUMN IF NOT EXISTS learning_language TEXT;

    CREATE TABLE IF NOT EXISTS learner_courses (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      course_id TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'self' CHECK(source IN ('self','college')),
      added_at TEXT NOT NULL,
      last_lesson_id TEXT,
      last_at TEXT,
      PRIMARY KEY (learner_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      lesson_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','known','done')),
      step TEXT NOT NULL DEFAULT 'learn' CHECK(step IN ('learn','code','practise','check','result')),
      practice_passed INTEGER NOT NULL DEFAULT 0,
      practice_tries INTEGER NOT NULL DEFAULT 0,
      hints_used INTEGER NOT NULL DEFAULT 0,
      check_question TEXT,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (learner_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS course_evidence (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      course_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      lesson_id TEXT,
      kind TEXT NOT NULL CHECK(kind IN ('practice','check','challenge','testout','module_test','project','review')),
      passed INTEGER NOT NULL,
      score DOUBLE PRECISION,
      level TEXT,
      assurance TEXT,
      answer_hash TEXT,
      detail_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_course_evidence_learner ON course_evidence(learner_id, lesson_id, created_at);

    CREATE TABLE IF NOT EXISTS module_results (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      module_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      test_passed INTEGER NOT NULL DEFAULT 0,
      test_score DOUBLE PRECISION,
      project_passed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (learner_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS content_feedback (
      id TEXT PRIMARY KEY,
      learner_id TEXT REFERENCES learners(id),
      institution_id TEXT,
      lesson_id TEXT NOT NULL,
      part TEXT NOT NULL,
      language TEXT NOT NULL,
      vote INTEGER NOT NULL CHECK(vote IN (-1, 1)),
      comment TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_content_feedback_lesson ON content_feedback(lesson_id);

    CREATE TABLE IF NOT EXISTS content_reviews (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      lesson_id TEXT NOT NULL,
      language TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('reviewed','suggested')),
      suggestion TEXT,
      staff_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_content_reviews_lesson ON content_reviews(institution_id, lesson_id);

    CREATE TABLE IF NOT EXISTS tts_cache (
      key TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      audio_b64 TEXT NOT NULL,
      engine TEXT,
      bytes INTEGER NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}
