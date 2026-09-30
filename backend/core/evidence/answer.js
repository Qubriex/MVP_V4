// core/evidence/answer.js — answering a review, recheck or renewal instance
// (v4.3 §7.11, §7.12, §8, §9.5). Same path as a lesson check: authenticity
// gate (A0 stops), blind EVAL with θ and the borderline second pass, then the
// evidence record, a dated demonstration (every review, pass or fail, is one),
// the next review date, the faculty sample and outbox events — one transaction.
import crypto from 'crypto';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import { emit } from '../events/outbox.js';
import { authenticityGate } from './assurance.js';
import { assessConcept, resolveTheta } from './assess.js';
import { enqueueReview } from './calibration.js';
import { reschedule } from '../retention/schedule.js';
import { recordAttempt as recordVocabulary } from '../learner/vocabulary.js';

const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const KIND = { review: 'review', check: 'review', renewal: 'renewal' };

export async function answerInstance({ instanceId, elId, learnerId, language, engagementId, answer, provenance }) {
  const inst = await dal.one('SELECT * FROM family_instances WHERE id = ? AND el_id = ?', instanceId, elId);
  if (!inst) throw Object.assign(new Error('Not found'), { status: 404 });
  if (!['review', 'check', 'renewal'].includes(inst.purpose)) throw Object.assign(new Error('Not a review instance'), { status: 400 });
  if (await dal.one("SELECT 1 FROM evidence_records WHERE instance_id = ? AND assurance != 'A0'", instanceId)) {
    throw Object.assign(new Error('This question was already answered.'), { status: 409 });
  }
  const node = await dal.one(`SELECT sn.id, sn.node_label, sn.mastery_threshold AS node_theta, sc.mastery_threshold AS cluster_theta, ct.institution_id
    FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id JOIN capability_targets ct ON ct.id = sc.capability_target_id WHERE sn.id = ?`, inst.node_id);
  const theta = resolveTheta(node.node_theta, node.cluster_theta);
  const text = String(answer || '').trim();
  if (!text) throw Object.assign(new Error('Answer required'), { status: 400 });

  const gate = authenticityGate(provenance || null, text);
  const record = async (fields) => {
    const id = ulid();
    await dal.run(`INSERT INTO evidence_records (id, el_id, node_id, family_id, instance_id, purpose, answer_hash, per_point_json, r_c, fused_score, passed, level,
        assurance, authentic, flags_json, provisional, theta, model_id, prompt_version, rubric_version, family_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'gateway', 'EVAL.mastery.v1', ?, ?, ?)`, id, elId, inst.node_id, inst.family_id, instanceId,
    inst.purpose, sha256(text), fields.perPoint ?? null, fields.r ?? null, fields.r ?? null, fields.passed ?? null, fields.level ?? null, gate.assurance,
    gate.assurance === 'A0' ? 0 : 1, JSON.stringify(fields.flags || []), fields.provisional ? 1 : 0, theta, fields.rubric ?? null, inst.family_version, dal.nowIso());
    const p = gate.provenance;
    await dal.run(`INSERT INTO answer_provenance (evidence_id, mode, answer_chars, pasted_chars, paste_events, largest_paste, edit_ratio, tab_hidden_ms, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, p.mode, p.answer_chars ?? null, p.pasted_chars ?? null, p.paste_events ?? null, p.largest_paste ?? null,
    p.edit_ratio ?? null, p.tab_hidden_ms ?? null, p.device_id ?? null);
    await dal.run('INSERT INTO check_answers (evidence_id, answer_text, created_at) VALUES (?, ?, ?)', id, text.slice(0, 20000), dal.nowIso());
    return id;
  };

  if (gate.assurance === 'A0') {
    await dal.tx(async () => await record({ flags: [gate.reason] }));
    return { result: 'hold', reason: gate.reason };
  }

  const a = await assessConcept({ nodeLabel: node.node_label, language, question: inst.question_text, answer: text, theta, loops: 0 });
  // Persistence is a mastery-check rule only; reviews and renewals are judged at θ.
  const passed = a.persistence ? false : a.passed;
  const now = dal.nowIso();
  const out = await dal.tx(async () => {
    const evidenceId = await record({ r: a.r_c, passed: passed ? 1 : 0, level: passed ? 'L1' : null, flags: a.flags.filter(f => f !== 'persistence'),
      provisional: a.provisional, rubric: a.evaluation.rubricVersion || 'default', perPoint: JSON.stringify({ gaps: a.evaluation.understandingGaps || [] }) });
    const kind = KIND[inst.purpose];
    await dal.run(`INSERT INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, evidence_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'L1', ?, ?, ?)`, ulid(), elId, inst.node_id, kind, now, passed ? 1 : 0, a.r_c, gate.assurance, evidenceId, now);
    const next = await reschedule(null, elId, inst.node_id, { passed, score: a.r_c, theta, atIso: now });
    if (inst.purpose === 'check' && passed) await dal.run('UPDATE node_mastery SET recheck_required = 0 WHERE engagement_learner_id = ? AND skill_node_id = ?', elId, inst.node_id);
    const review = await enqueueReview({ evidenceId, elId, nodeId: inst.node_id, institutionId: node.institution_id, engagementId, decision: a.provisional ? { stratum: 'decision', reason: 'borderline' } : null });
    await recordVocabulary(learnerId, { passed, vocabGap: a.evaluation.loopApproachIfFailed === 'vocabulary_barrier' });
    await emit('CHECK_EVALUATED', { aggregateType: 'enrolment', aggregateId: elId, payload: { evidenceId, nodeId: inst.node_id, passed, purpose: inst.purpose } });
    await emit(passed ? 'REVIEW_PASSED' : 'REVIEW_FAILED', { aggregateType: 'enrolment', aggregateId: elId, payload: { evidenceId, nodeId: inst.node_id, purpose: inst.purpose } });
    return { evidenceId, next, review };
  });
  return {
    result: passed ? 'passed' : 'not_yet', passed, provisional: a.provisional, purpose: inst.purpose,
    feedback: a.evaluation.feedbackForLearner || null, next_review_at: out.next.due, review_pending: !!(out.review && out.review.stratum === 'decision')
  };
}
