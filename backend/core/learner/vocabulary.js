// core/learner/vocabulary.js
// Vocabulary level (v4.3 §6): beginner · intermediate · advanced.
//   promote after 5 consecutive passes with no vocabulary_barrier gap
//   demote after 2 vocabulary_barrier gaps in the last 3 attempts
// It shapes CKB retrieval and lesson wording, so it is kept for every learner
// (it is not the behaviour fingerprint, which minors never get).
import * as dal from '../db/dal.js';
import params from '../../config/params.js';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

export const vocabularyLevel = async (learnerId) => (await dal.one('SELECT level FROM learner_vocabulary WHERE learner_id = ?', learnerId))?.level || 'beginner';

/** Apply one evaluated check. `vocabGap` = EVAL reported a vocabulary_barrier gap. Returns the new level. */
export async function recordAttempt(learnerId, { passed, vocabGap }) {
  const v = params.get('learner.vocabulary');
  const row = await dal.one('SELECT * FROM learner_vocabulary WHERE learner_id = ?', learnerId) || { level: 'beginner', clean_pass_streak: 0, recent_json: '[]' };
  const recent = [...JSON.parse(row.recent_json || '[]'), vocabGap ? 1 : 0].slice(-v.demoteWindow);
  let streak = passed && !vocabGap ? row.clean_pass_streak + 1 : 0;
  let idx = LEVELS.indexOf(row.level);
  if (recent.filter(Boolean).length >= v.demoteGaps && idx > 0) {
    idx -= 1; streak = 0; recent.length = 0;
  } else if (streak >= v.promoteAfterPasses && idx < LEVELS.length - 1) {
    idx += 1; streak = 0;
  }
  await dal.run(`INSERT INTO learner_vocabulary (learner_id, level, clean_pass_streak, recent_json, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(learner_id) DO UPDATE SET level = excluded.level, clean_pass_streak = excluded.clean_pass_streak,
      recent_json = excluded.recent_json, updated_at = excluded.updated_at`, learnerId, LEVELS[idx], streak, JSON.stringify(recent), dal.nowIso());
  return LEVELS[idx];
}
