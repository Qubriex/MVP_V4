// The check path (v4.3 §7): TEACH decides when, the evidence module writes
// the question, the authenticity gate runs first, EVAL decides with θ and the
// borderline second pass, and everything commits with its events.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN } from '../helpers/setup.js';
import { setResponder } from '../../core/ai/adapters/mock.js';

let app; let A; let P; let learner;
let evalScores = [];
let restore = () => {};

// Scripted models: TEACH always says CHECK (and tries to write the question),
// EVAL returns the next queued score.
function script() {
  restore = setResponder((req) => {
    if (req.task === 'EVAL.mastery') {
      const score = evalScores.length ? evalScores.shift() : 0.9;
      return { passed: score >= 0.75, score, evaluation: 'ok', feedbackForLearner: 'feedback', loopApproachIfFailed: 'concept_not_understood', understandingGaps: [] };
    }
    if (req.task === 'EVIDENCE.conceptItem') return { question: `Generated question ${req.hash.slice(0, 6)}` };
    return { message: 'lesson', captionEn: 'caption', decision: 'CHECK', checkQuestion: 'TEACH WROTE THIS QUESTION', behaviourSignal: 'engaged' };
  });
}

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = seedInstitution('a');
  P = seedPathway(A);
  learner = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
});
afterEach(() => restore());

const post = (path, body) => learner.agent.post(path).set('X-CSRF-Token', learner.csrf).send(body);
const typed = { mode: 'typed', pasted_chars: 0, paste_events: 0, largest_paste: 0 };

async function toCheck() {
  const start = await post('/api/learner/session/start', {});
  expect(start.status).toBe(200);
  const r = await post('/api/learner/session/message', { content: 'I know a bit', session_id: start.body.session_id });
  expect(r.status).toBe(200);
  return { sessionId: start.body.session_id, check: r.body };
}

describe('the teacher never writes the check (v4.3 §7)', () => {
  it('ignores a question TEACH puts in its output; the evidence module writes it from the node spec', async () => {
    script();
    const { check } = await toCheck();
    expect(check.decision).toBe('CHECK');
    expect(check.check_question).toMatch(/^Generated question/);
    expect(check.check_question).not.toContain('TEACH WROTE');
    const mc = dal.one("SELECT question_text, instance_id FROM mastery_checks WHERE engagement_learner_id = ? AND passed IS NULL", A.elId);
    expect(mc.question_text).toBe(check.check_question);
    const inst = dal.one('SELECT family_id, purpose, attempt_no, seed FROM family_instances WHERE id = ?', mc.instance_id);
    expect(inst).toMatchObject({ family_id: `gen:${P.nodes[0]}`, purpose: 'check', attempt_no: 1 });
    expect(inst.seed).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('authenticity gate (v4.3 §7.11)', () => {
  it('A0 (no provenance or bulk paste) stops: no evaluation, no demonstration, the check stays open', async () => {
    script();
    const sid = dal.one("SELECT id FROM learning_sessions WHERE engagement_learner_id = ? AND status = 'active'", A.elId).id;
    const r1 = await post('/api/learner/session/message', { content: 'answer', session_id: sid });
    expect(r1.body).toMatchObject({ result: 'hold', reason: 'no_provenance' });
    const r2 = await post('/api/learner/session/message', { content: 'x'.repeat(200), session_id: sid, provenance: { mode: 'typed', pasted_chars: 200, paste_events: 1, largest_paste: 200 } });
    expect(r2.body).toMatchObject({ result: 'hold', reason: 'bulk_paste' });
    expect(dal.all("SELECT assurance FROM evidence_records WHERE el_id = ?", A.elId).map(r => r.assurance)).toEqual(['A0', 'A0']);
    expect(dal.one('SELECT COUNT(*) n FROM demonstrations WHERE el_id = ?', A.elId).n).toBe(0);
    expect(dal.one('SELECT COUNT(*) n FROM mastery_checks WHERE engagement_learner_id = ? AND passed IS NULL', A.elId).n).toBe(1);
  });

  it('A1 passes through to EVAL; a pass advances, records evidence, a mastery demonstration, a review in 3 days and events', async () => {
    script();
    evalScores = [0.95];
    const sid = dal.one("SELECT id FROM learning_sessions WHERE engagement_learner_id = ? AND status = 'active'", A.elId).id;
    const r = await post('/api/learner/session/message', { content: 'A SELECT reads rows from a table where the filter matches.', session_id: sid, provenance: typed });
    expect(r.body).toMatchObject({ result: 'advance', passed: true, provisional: false });
    expect(r.body).not.toHaveProperty('score');
    expect(dal.one("SELECT assurance, level, passed, theta FROM evidence_records WHERE el_id = ? AND assurance = 'A1'", A.elId))
      .toEqual({ assurance: 'A1', level: 'L1', passed: 1, theta: 0.75 });
    expect(dal.one('SELECT kind, passed, assurance, level FROM demonstrations WHERE el_id = ?', A.elId)).toEqual({ kind: 'mastery', passed: 1, assurance: 'A1', level: 'L1' });
    const ret = dal.one('SELECT interval_days, due_at FROM node_retention WHERE el_id = ? AND node_id = ?', A.elId, P.nodes[0]);
    expect(ret.interval_days).toBe(3);
    expect(Date.parse(ret.due_at) - Date.now()).toBeGreaterThan(2.9 * 86400000);
    const types = dal.all("SELECT type FROM domain_events WHERE aggregate_id = ? ORDER BY id", A.elId).map(e => e.type);
    expect(types).toEqual(expect.arrayContaining(['CHECK_EVALUATED', 'NODE_ADVANCED']));
    expect(dal.one('SELECT current_node_id FROM engagement_learners WHERE id = ?', A.elId).current_node_id).toBe(P.nodes[1]);
    expect(dal.one('SELECT provisional, persistence, theta FROM node_mastery WHERE engagement_learner_id = ?', A.elId)).toEqual({ provisional: 0, persistence: 0, theta: 0.75 });
  });
});

describe('borderline second pass (v4.3 §7.3)', () => {
  it('disagreeing passes give a provisional result and a faculty decision-queue entry', async () => {
    script();
    const { sessionId } = await toCheck();
    evalScores = [0.78, 0.70]; // first passes θ 0.75, second (temp 0, shuffled rubric) fails
    const r = await post('/api/learner/session/message', { content: 'Joins combine rows from two tables.', session_id: sessionId, provenance: typed });
    expect(r.body).toMatchObject({ result: 'advance', provisional: true, review_pending: true });
    const q = dal.one("SELECT stratum, reason, priority FROM review_queue WHERE node_id = ?", P.nodes[1]);
    expect(q).toEqual({ stratum: 'decision', reason: 'borderline', priority: 4 });
    expect(dal.one('SELECT provisional FROM node_mastery WHERE skill_node_id = ?', P.nodes[1]).provisional).toBe(1);
  });

  it('a clear result gets no second pass', async () => {
    script();
    const { sessionId } = await toCheck();
    let evalCalls = 0;
    restore();
    restore = setResponder((req) => {
      if (req.task === 'EVAL.mastery') { evalCalls += 1; return { score: 0.2, evaluation: 'e', feedbackForLearner: 'f', understandingGaps: [] }; }
      return { message: 'loop lesson', decision: 'CONTINUE' };
    });
    const r = await post('/api/learner/session/message', { content: 'Loops repeat.', session_id: sessionId, provenance: typed });
    expect(r.body).toMatchObject({ result: 'loop', passed: false });
    expect(evalCalls).toBe(1);
    expect(dal.all("SELECT type FROM domain_events WHERE type = 'NODE_LOOPED'")).toHaveLength(1);
  });
});
