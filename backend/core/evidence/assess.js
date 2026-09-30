// core/evidence/assess.js
// Deciding a concept check (v4.3 §4.3, §7.3, §7.6).
//
//   θ = max(node θ ?? 0.70, cluster θ ?? 0.70, 0.60)
//   pass = r_c ≥ θ
//   borderline |r_c − θ| ≤ 0.10 → EVAL runs again at temperature 0 with the
//     rubric order shuffled; if the passes disagree the result is provisional
//     (the learner is not held back by evaluator noise) and the check goes to
//     the faculty decision queue.
//   persistence (concept only): loops ≥ 5 and r_c ≥ max(θ − 0.10, 0.60) → pass,
//     capped at L1, always queued for faculty review.
import params from '../../config/params.js';
import * as evalBrain from '../brains/evalBrain.js';

export { resolveTheta } from '../graph/theta.js';

/**
 * @returns {Promise<{r_c: number, theta: number, passed: boolean, provisional: boolean, persistence: boolean,
 *   level: 'L1'|null, flags: string[], review: null|{stratum: 'decision', reason: string}, evaluation: object, second: object|null}>}
 */
export async function assessConcept({ nodeLabel, language, question, answer, theta, loops = 0 }) {
  const first = await evalBrain.evaluate({ nodeLabel, language, question, learnerResponse: answer, theta, temperature: 0.3 });
  const r = first.score;
  const flags = [];
  let second = null;
  let provisional = false;
  let passCore = r >= theta;

  if (Math.abs(r - theta) <= params.get('evidence.faculty.borderline')) {
    second = await evalBrain.evaluate({ nodeLabel, language, question, learnerResponse: answer, theta, temperature: 0, shuffleRubric: true });
    const secondPass = second.score >= theta;
    if (secondPass !== passCore) {
      provisional = true;
      flags.push('borderline_disagreement');
      passCore = passCore || secondPass;
    } else {
      flags.push('borderline_agreed');
    }
  }

  const f = params.get('evidence.fusion');
  const persistence = !passCore && loops >= f.persistenceLoops && r >= Math.max(theta - f.persistenceMargin, f.persistenceFloor);
  if (persistence) flags.push('persistence');
  const passed = passCore || persistence;

  let review = null;
  if (persistence) review = { stratum: 'decision', reason: 'persistence' };
  else if (provisional) review = { stratum: 'decision', reason: 'borderline' };

  return { r_c: r, theta, passed, provisional, persistence, level: passed ? 'L1' : null, flags, review, evaluation: first, second };
}
