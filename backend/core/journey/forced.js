// core/journey/forced.js — forced check results for test learners only.
import * as dal from '../db/dal.js';
import { isTestLearner } from '../requestContext.js';

// Test learners only (the test tenant): '#pass' or '#fail' typed as the
// answer, or the /dev "Pass next check" / "Fail next check" control, decides a
// check without grading, so a tester can walk the journey in minutes.
export async function forcedResult(elId, content) {
  if (!isTestLearner()) return null;
  const typed = /^#(pass|fail)\b/i.exec(String(content || '').trim());
  if (typed) return typed[1].toLowerCase();
  const c = await dal.one('SELECT next_check FROM test_learner_controls WHERE el_id = ?', elId);
  if (!c?.next_check) return null;
  await dal.run('UPDATE test_learner_controls SET next_check = NULL, updated_at = ? WHERE el_id = ?', dal.nowIso(), elId);
  return c.next_check;
}

const FORCED_FEEDBACK = {
  pass: { whatWasGood: 'Test mode: this check was marked as passed.', whatWasMissing: '', nextTime: 'Carry on to the next step.' },
  fail: { whatWasGood: '', whatWasMissing: 'Test mode: this check was marked as not yet passed.', nextTime: 'Try "explain another way", then take the check again.' }
};
export function forcedAssessment(kind, theta) {
  const passed = kind === 'pass';
  const f = FORCED_FEEDBACK[kind];
  return {
    r_c: passed ? Math.min(1, theta + 0.2) : 0.35, theta, passed, provisional: false, persistence: false, level: passed ? 'L1' : null,
    flags: ['forced_test'], review: null, second: null,
    evaluation: { passed, score: passed ? theta + 0.2 : 0.35, evaluation: `forced ${kind} (test learner)`, feedbackForLearner: [f.whatWasGood, f.whatWasMissing, f.nextTime].filter(Boolean).join(' '), understandingGaps: [], ...f }
  };
}

