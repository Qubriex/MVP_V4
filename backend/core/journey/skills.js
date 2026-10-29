// core/journey/skills.js — the learner's side of one skill beyond the voice
// lesson: the Concept primer, Practice items, the Apply work task, the spoken
// challenge, attempt history, and the starting (baseline) check.
//
// Evidence rules (v4.3 §7, label_v2):
//   quick questions        learning only, never a demonstration
//   written practice       rubric-graded; a pass is a 'practice' demonstration, L1
//   code practice          checked against the item's test cases; a pass is 'practice', L2
//   work task              fixed for 30 days, a visible marking guide; a pass is 'task', L2
//   spoken challenge       after a passed check, bound to the learner's own answer;
//                          a pass is 'challenge' at A2 (typed only for test learners)
// Practice and tasks count toward a label only after the skill is mastered
// (labelFn: demonstrations since mastery), which the screens say plainly.
import crypto from 'crypto';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import { lessonFor, common, grade, slugOf } from '../ai/adapters/scripted.js';
import { paramsFromSeed, deriveSeed } from '../evidence/checkWriter.js';
import { authenticityGate } from '../evidence/assurance.js';
import { nodeLabelNow } from '../return/credentialEngine.js';
import { nowIsoFor, isTestLearner } from '../requestContext.js';
import { forcedResult } from './forced.js';

const DAY = 86400000;
const err = (status, message) => Object.assign(new Error(message), { status });
const fill = (s, v) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const hashInt = (s) => parseInt(sha(s).slice(0, 8), 16);
const json = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

/** A node of the learner's own programme, or a 404. */
export async function nodeFor(elId, nodeId) {
  const n = await dal.one(`SELECT sn.id, sn.node_label, sn.cluster_id, sn.estimated_minutes, sc.cluster_label, sc.capability_target_id,
      sn.mastery_threshold AS node_theta, sc.mastery_threshold AS cluster_theta
    FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN engagements e ON e.capability_target_id = sc.capability_target_id JOIN engagement_learners el ON el.engagement_id = e.id
    WHERE sn.id = ? AND el.id = ?`, nodeId, elId);
  if (!n) throw err(404, 'This skill is not in your programme.');
  return n;
}

// ─── Practice items ──────────────────────────────────────────────────────────
// Quick questions come from the skill's rubric terms (the right answer) and
// other skills' terms (the distractors), in a fixed order for this learner.
async function quickItems(elId, node, language) {
  const mine = lessonFor(node.node_label, language).check.rubric.groups.map(g => g[0]);
  const others = (await dal.all(`SELECT sn.node_label FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? AND sn.cluster_id != ? ORDER BY sn.id`, node.capability_target_id, node.cluster_id))
    .flatMap(r => lessonFor(r.node_label, language).check.rubric.groups.map(g => g[0]))
    .filter(t => !mine.includes(t));
  const stem = fill(common(language).quickStem, { skill: node.node_label });
  return mine.slice(0, 3).map((answer, i) => {
    const seed = hashInt(`${elId}|${node.id}|q${i}`);
    const pool = [...new Set(others)];
    const wrong = [0, 1, 2].map(k => pool[(seed + k * 7) % Math.max(1, pool.length)]).filter(Boolean);
    const options = [answer, ...wrong.slice(0, 3)];
    const rot = seed % options.length;
    return { key: `quick-${i}`, kind: 'quick', stem, options: [...options.slice(rot), ...options.slice(0, rot)] };
  });
}

function writtenItem(elId, learnerId, node, language) {
  const s = lessonFor(node.node_label, language);
  const p = paramsFromSeed(deriveSeed(learnerId, `practice:${node.id}`, 1), language, node);
  return { key: 'written-1', kind: 'written', prompt: fill(s.check.questions[(p.variant + 1) % s.check.questions.length], { context: p.context, skill: node.node_label }) };
}

function codeItem(node, language) {
  const c = lessonFor(node.node_label, language).practice?.code;
  if (!c) return null;
  return { key: 'code-1', kind: 'code', prompt: c.prompt, starter: c.starter, checks: c.checks.map(x => x.label) };
}

/** The work task for this skill: fixed for 30 days from first opening. */
export async function workTask(el, node, language, { create = false } = {}) {
  const cur = await dal.one('SELECT * FROM work_tasks WHERE el_id = ? AND node_id = ?', el.el_id, node.id);
  const now = nowIsoFor();
  if (cur && cur.locked_until > now) return { ...cur, brief: json(cur.brief_json, {}), guide: json(cur.guide_json, []) };
  if (!create) return cur ? { ...cur, brief: json(cur.brief_json, {}), guide: json(cur.guide_json, []), expired: true } : null;
  const s = lessonFor(node.node_label, language);
  const c = common(language);
  const p = paramsFromSeed(deriveSeed(el.learner_id, `task:${node.id}`, cur ? 2 : 1), language, node);
  const question = fill(s.check.questions[p.variant % s.check.questions.length], { context: p.context, skill: node.node_label });
  const groups = s.check.rubric.groups;
  const share = Math.round(70 / groups.length);
  const guide = [
    ...groups.map((g, i) => ({ criterion: fill(c.guide.covers, { term: g[0] }), weight: i === groups.length - 1 ? 70 - share * (groups.length - 1) : share })),
    { criterion: c.guide.ownWords, weight: 15 }, { criterion: c.guide.scenario, weight: 15 }
  ];
  const brief = { task: fill(c.taskIntro, { question }), deliverable: c.taskDeliverable };
  const lockedUntil = new Date(Date.parse(now) + 30 * DAY).toISOString();
  if (cur) {
    await dal.run("UPDATE work_tasks SET task_key = ?, brief_json = ?, guide_json = ?, assigned_at = ?, locked_until = ?, status = 'open', submitted_at = NULL WHERE id = ?",
      `${slugOf(node.node_label)}-${p.variant}`, JSON.stringify(brief), JSON.stringify(guide), now, lockedUntil, cur.id);
  } else {
    await dal.run(`INSERT INTO work_tasks (id, el_id, node_id, task_key, brief_json, guide_json, assigned_at, locked_until, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      ulid(), el.el_id, node.id, `${slugOf(node.node_label)}-${p.variant}`, JSON.stringify(brief), JSON.stringify(guide), now, lockedUntil);
  }
  return workTask(el, node, language);
}

/** Everything the five tabs of a skill show. */
export async function skillView(el, nodeId, language) {
  const node = await nodeFor(el.el_id, nodeId);
  const s = lessonFor(node.node_label, language);
  const mastery = await dal.one('SELECT advanced_at FROM node_mastery WHERE engagement_learner_id = ? AND skill_node_id = ? AND advanced_at IS NOT NULL', el.el_id, node.id);
  const label = await nodeLabelNow(el.el_id, node.id);
  const attempts = await attemptHistory(el.el_id, { nodeId: node.id });
  const passes = attempts.filter(a => a.result === 'pass');
  const task = await workTask(el, node, language);
  const nextStep = !mastery ? { key: 'lesson', href: '/learn/session' }
    : label.missing_for_confirmed.includes('second_kind') ? { key: 'task', tab: 'apply' }
      : label.missing_for_confirmed.includes('challenge_bound') ? { key: 'challenge', tab: 'progress' }
        : label.missing_for_confirmed.length ? { key: 'review', href: '/learn/reviews' } : { key: 'done' };
  return {
    node: { id: node.id, label: node.node_label, group: node.cluster_label, minutes: node.estimated_minutes || 20 },
    mastered: !!mastery, mastered_at: mastery?.advanced_at || null,
    concept: { primer: s.turns.explain.message, caption_en: s.turns.explain.captionEn, example: s.turns.example.message, code: s.turns.explain.code, mermaid: s.turns.explain.mermaid },
    practice: [...await quickItems(el.el_id, node, language), writtenItem(el.el_id, el.learner_id, node, language), codeItem(node, language)].filter(Boolean),
    task: task ? { brief: task.brief, guide: task.guide, assigned_at: task.assigned_at, locked_until: task.locked_until, status: task.status, expired: !!task.expired } : null,
    progress: {
      label: label.label, kinds: label.kinds || [], missing_for_confirmed: label.missing_for_confirmed,
      attempts: attempts.length, passes: passes.length, best: passes.length ? 'pass' : attempts.some(a => a.result === 'partial') ? 'partial' : attempts.length ? 'fail' : null,
      next: nextStep, recent: attempts.slice(0, 6)
    }
  };
}

async function demonstrate(el, node, kind, { score, level, assurance, evidenceId = null, at }) {
  await dal.run(`INSERT INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, evidence_id, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    ulid(), el.el_id, node.id, kind, at, score, level, assurance, evidenceId, at);
}

const theta = (n) => Math.max(n.node_theta ?? 0.7, n.cluster_theta ?? 0.7, 0.6);

/**
 * Answer one practice item or the work task.
 * @returns {Promise<{ result: 'pass'|'partial'|'fail', correct?: boolean, checks?: {label, passed}[], feedback: {good, missing, next}, counts: boolean, label_change: object }>}
 */
export async function answerPractice(el, nodeId, { kind, itemKey, answer, provenance, language }) {
  const node = await nodeFor(el.el_id, nodeId);
  const text = String(answer || '').slice(0, 20000);
  if (!text.trim()) throw err(400, 'Write an answer first.');
  const at = nowIsoFor();
  const before = await nodeLabelNow(el.el_id, node.id, at);
  const mastered = before.label !== 'none';
  let out;
  if (kind === 'quick') {
    const item = (await quickItems(el.el_id, node, language)).find(q => q.key === itemKey);
    if (!item) throw err(404, 'Unknown question.');
    const right = lessonFor(node.node_label, language).check.rubric.groups.map(g => g[0])[Number(itemKey.split('-')[1])];
    const correct = text === right;
    out = { result: correct ? 'pass' : 'fail', correct, right_answer: right, feedback: { good: '', missing: '', next: '' }, counts: false };
    await dal.run('INSERT INTO practice_attempts (id, el_id, node_id, kind, item_key, answer_text, score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ulid(), el.el_id, node.id, 'quick', itemKey, text.slice(0, 200), correct ? 1 : 0, correct ? 1 : 0, at);
    return { ...out, label_change: { from: before.label, to: before.label, missing_for_confirmed: before.missing_for_confirmed } };
  }
  const gate = authenticityGate(provenance || null, text);
  if (gate.assurance === 'A0' && !isTestLearner()) throw err(422, 'This answer needs to be in your own words. Please type it without pasting.');
  const forced = await forcedResult(el.el_id, text);
  if (kind === 'code') {
    const c = lessonFor(node.node_label, language).practice?.code;
    if (!c) throw err(404, 'No code practice for this skill.');
    const checks = c.checks.map(x => ({ label: x.label, passed: forced ? forced === 'pass' : new RegExp(x.re, x.flags).test(text) }));
    const ok = checks.filter(x => x.passed).length;
    const result = ok === checks.length ? 'pass' : ok >= checks.length / 2 ? 'partial' : 'fail';
    out = { result, checks, feedback: { good: '', missing: checks.filter(x => !x.passed).map(x => x.label).join(', '), next: '' } };
    await dal.run('INSERT INTO practice_attempts (id, el_id, node_id, kind, item_key, answer_text, score, passed, feedback_json, level, assurance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ulid(), el.el_id, node.id, 'code', itemKey || 'code-1', text, ok / checks.length, result === 'pass' ? 1 : 0, JSON.stringify(out.feedback), 'L2', 'A1', at);
    if (result === 'pass' && mastered) await demonstrate(el, node, 'practice', { score: 0.9, level: 'L2', assurance: 'A1', at });
  } else {
    const isTask = kind === 'task';
    if (isTask) {
      const task = await workTask(el, node, language);
      if (!task || task.expired) throw err(409, 'Open the work task first.');
    }
    const g = forced ? { passed: forced === 'pass', score: forced === 'pass' ? 0.9 : 0.35, whatWasGood: '', whatWasMissing: '', nextTime: '' }
      : grade({ nodeLabel: node.node_label, language, answer: text, theta: theta(node) });
    const result = g.passed ? 'pass' : g.score >= 0.5 ? 'partial' : 'fail';
    out = { result, feedback: { good: g.whatWasGood || '', missing: g.whatWasMissing || '', next: g.nextTime || '' } };
    await dal.run('INSERT INTO practice_attempts (id, el_id, node_id, kind, item_key, answer_text, score, passed, feedback_json, level, assurance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ulid(), el.el_id, node.id, isTask ? 'task' : 'written', itemKey || (isTask ? 'task' : 'written-1'), text, g.score, g.passed ? 1 : 0, JSON.stringify(out.feedback), isTask ? 'L2' : 'L1', 'A1', at);
    if (isTask && g.passed) await dal.run("UPDATE work_tasks SET status = 'submitted', submitted_at = ? WHERE el_id = ? AND node_id = ?", at, el.el_id, node.id);
    if (g.passed && mastered) await demonstrate(el, node, isTask ? 'task' : 'practice', { score: g.score, level: isTask ? 'L2' : 'L1', assurance: 'A1', at });
  }
  const after = await nodeLabelNow(el.el_id, node.id, at);
  return { ...out, counts: out.result === 'pass' && mastered, label_change: { from: before.label, to: after.label, missing_for_confirmed: after.missing_for_confirmed } };
}

// ─── Spoken challenge (A2) ─────────────────────────────────────────────────────
export async function startChallenge(el, nodeId, language) {
  const node = await nodeFor(el.el_id, nodeId);
  const pass = await dal.one(`SELECT e.id, ca.answer_text FROM evidence_records e JOIN check_answers ca ON ca.evidence_id = e.id
    WHERE e.el_id = ? AND e.node_id = ? AND e.passed = 1 AND e.assurance != 'A0' ORDER BY e.created_at DESC LIMIT 1`, el.el_id, node.id);
  if (!pass) throw err(409, 'Pass the check for this skill first; the challenge asks about your own answer.');
  const open = await dal.one('SELECT * FROM check_challenges WHERE el_id = ? AND node_id = ? AND answered_at IS NULL ORDER BY created_at DESC LIMIT 1', el.el_id, node.id);
  if (open) return { id: open.id, question: open.question };
  const words = String(pass.answer_text || '').replace(/\s+/g, ' ').trim().split(' ');
  const excerpt = words.slice(0, 18).join(' ') + (words.length > 18 ? '…' : '');
  const question = fill(common(language).challengeAsk, { excerpt });
  const id = ulid();
  await dal.run('INSERT INTO check_challenges (id, el_id, node_id, evidence_id, question, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, el.el_id, node.id, pass.id, question, nowIsoFor());
  return { id, question };
}

export async function answerChallenge(el, challengeId, { answer, mode, language }) {
  const ch = await dal.one('SELECT * FROM check_challenges WHERE id = ? AND el_id = ? AND answered_at IS NULL', challengeId, el.el_id);
  if (!ch) throw err(404, 'This challenge is closed.');
  if (mode !== 'voice' && !isTestLearner()) throw err(422, 'The challenge is spoken: answer with your voice.');
  const node = await nodeFor(el.el_id, ch.node_id);
  const text = String(answer || '').trim();
  if (!text) throw err(400, 'Say your answer first.');
  const forced = await forcedResult(el.el_id, text);
  const g = forced ? { passed: forced === 'pass', score: forced === 'pass' ? 0.9 : 0.3, whatWasGood: '', whatWasMissing: '', nextTime: '' }
    : grade({ nodeLabel: node.node_label, language, answer: text, theta: 0.6 });
  const at = nowIsoFor();
  const before = await nodeLabelNow(el.el_id, node.id, at);
  await dal.run('UPDATE check_challenges SET answer_text = ?, mode = ?, passed = ?, answered_at = ? WHERE id = ?', text.slice(0, 4000), mode === 'voice' ? 'voice' : 'typed', g.passed ? 1 : 0, at, ch.id);
  if (g.passed && before.label !== 'none') await demonstrate(el, node, 'challenge', { score: g.score, level: 'L1', assurance: 'A2', evidenceId: ch.evidence_id, at });
  const after = await nodeLabelNow(el.el_id, node.id, at);
  return { result: g.passed ? 'pass' : g.score >= 0.45 ? 'partial' : 'fail', feedback: { good: g.whatWasGood || '', missing: g.whatWasMissing || '', next: g.nextTime || '' }, label_change: { from: before.label, to: after.label, missing_for_confirmed: after.missing_for_confirmed } };
}

// ─── Attempt history ───────────────────────────────────────────────────────────
const band = (passed, score) => (passed ? 'pass' : score != null && score >= 0.5 ? 'partial' : 'fail');

/** Every check, review, practice item, task, challenge and Day-One run, newest first. */
export async function attemptHistory(elId, { nodeId = null, limit = 200 } = {}) {
  const nf = nodeId ? 'AND x.node_id = ?' : '';
  const args = nodeId ? [elId, nodeId] : [elId];
  const evidence = await dal.all(`SELECT x.id, x.node_id, sn.node_label, x.purpose, x.passed, x.r_c, x.level, x.assurance, x.created_at, x.feedback_json,
      (SELECT fr.verdict FROM faculty_reviews fr WHERE fr.evidence_id = x.id ORDER BY fr.created_at DESC LIMIT 1) AS faculty_verdict,
      (SELECT fr.notes FROM faculty_reviews fr WHERE fr.evidence_id = x.id ORDER BY fr.created_at DESC LIMIT 1) AS faculty_notes
    FROM evidence_records x JOIN skill_nodes sn ON sn.id = x.node_id WHERE x.el_id = ? ${nf} AND x.assurance != 'A0' AND x.passed IS NOT NULL ORDER BY x.created_at DESC LIMIT ${limit}`, ...args);
  const practice = await dal.all(`SELECT x.id, x.node_id, sn.node_label, x.kind, x.passed, x.score, x.level, x.assurance, x.created_at, x.feedback_json
    FROM practice_attempts x JOIN skill_nodes sn ON sn.id = x.node_id WHERE x.el_id = ? ${nf} AND x.kind != 'quick' ORDER BY x.created_at DESC LIMIT ${limit}`, ...args);
  const challenges = await dal.all(`SELECT x.id, x.node_id, sn.node_label, x.passed, x.mode, x.answered_at AS created_at
    FROM check_challenges x JOIN skill_nodes sn ON sn.id = x.node_id WHERE x.el_id = ? ${nf} AND x.answered_at IS NOT NULL ORDER BY x.answered_at DESC LIMIT ${limit}`, ...args);
  const dayone = nodeId ? [] : await dal.all("SELECT id, role_title, status, score, passed, scored_at AS created_at FROM dayone_runs WHERE el_id = ? AND status = 'scored'", elId);
  const KIND = { check: 'check', review: 'review', renewal: 'renewal', testout: 'check', practical: 'practice', dayone: 'dayone' };
  const rows = [
    ...evidence.map(e => ({ id: e.id, kind: KIND[e.purpose] || 'check', node_id: e.node_id, skill: e.node_label, date: e.created_at, result: band(!!e.passed, e.r_c),
      evidence: e.level || 'L1', authorship: e.assurance, feedback: json(e.feedback_json, null), marker: e.faculty_verdict ? { verdict: e.faculty_verdict, notes: e.faculty_notes || null } : null })),
    ...practice.map(p => ({ id: p.id, kind: p.kind === 'task' ? 'task' : 'practice', node_id: p.node_id, skill: p.node_label, date: p.created_at, result: band(!!p.passed, p.score),
      evidence: p.level || 'L1', authorship: p.assurance || 'A1', feedback: json(p.feedback_json, null), marker: null })),
    ...challenges.map(c => ({ id: c.id, kind: 'challenge', node_id: c.node_id, skill: c.node_label, date: c.created_at, result: c.passed ? 'pass' : 'fail', evidence: 'L1', authorship: 'A2', feedback: null, marker: null, mode: c.mode })),
    ...dayone.map(d => ({ id: d.id, kind: 'dayone', node_id: null, skill: d.role_title, date: d.created_at, result: d.passed ? 'pass' : 'fail', evidence: 'L3', authorship: 'A3', feedback: null, marker: null }))
  ];
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}

// ─── Starting check (baseline) ─────────────────────────────────────────────────
// About two short questions per skill group, rule-graded (no model, no cost).
// Both right in a group → "you already know this group": start after it.
export async function baselineState(el) {
  const run = await dal.one('SELECT * FROM baseline_runs WHERE el_id = ? ORDER BY started_at DESC LIMIT 1', el.el_id);
  if (!run) return { status: 'not_started' };
  return { status: run.status, id: run.id, items: json(run.items_json, []).map(({ key, group, skill, question }) => ({ key, group, skill, question })), answers: json(run.answers_json, {}), placement: json(run.placement_json, null) };
}

export async function startBaseline(el, language) {
  const cur = await baselineState(el);
  if (cur.status === 'started') return cur;
  const nodes = await dal.all(`SELECT sn.id, sn.node_label, sn.sequence_order, sc.id AS cluster_id, sc.cluster_label, sc.sequence_order AS cso
    FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = ? ORDER BY sc.sequence_order, sn.sequence_order`, el.capability_target_id);
  const groups = [...new Set(nodes.map(n => n.cluster_id))];
  const items = groups.flatMap(g => {
    const inG = nodes.filter(n => n.cluster_id === g);
    const pick = inG.length > 2 ? [inG[0], inG[Math.floor(inG.length / 2)]] : inG;
    return pick.map((n, i) => {
      const p = paramsFromSeed(deriveSeed(el.learner_id, `baseline:${n.id}`, 1), language, n);
      const s = lessonFor(n.node_label, language);
      return { key: `${g}-${i}`, group: n.cluster_label, group_id: g, skill: n.node_label, node_id: n.id, question: fill(s.check.questions[p.variant % s.check.questions.length], { context: p.context, skill: n.node_label }) };
    });
  });
  const id = ulid();
  await dal.run("INSERT INTO baseline_runs (id, el_id, status, items_json, answers_json, started_at) VALUES (?, ?, 'started', ?, '{}', ?)", id, el.el_id, JSON.stringify(items), nowIsoFor());
  return { ...(await baselineState(el)), intro: common(language).baselineIntro };
}

export async function answerBaseline(el, { key, answer, language }) {
  const run = await dal.one("SELECT * FROM baseline_runs WHERE el_id = ? AND status = 'started' ORDER BY started_at DESC LIMIT 1", el.el_id);
  if (!run) throw err(409, 'Start the starting check first.');
  const items = json(run.items_json, []);
  const item = items.find(i => i.key === key);
  if (!item) throw err(404, 'Unknown question.');
  const text = String(answer || '').trim();
  const forced = text ? await forcedResult(el.el_id, text) : null;
  const g = !text ? { passed: false, score: 0 } : forced ? { passed: forced === 'pass', score: forced === 'pass' ? 0.9 : 0.3 } : grade({ nodeLabel: item.skill, language, answer: text, theta: 0.7 });
  const answers = { ...json(run.answers_json, {}), [key]: { known: !!g.passed, skipped: !text } };
  await dal.run('UPDATE baseline_runs SET answers_json = ? WHERE id = ?', JSON.stringify(answers), run.id);
  return { saved: true, answered: Object.keys(answers).length, total: items.length };
}

/** Finish (or skip) the starting check: placement, "why we start you here", and the first lesson. */
export async function finishBaseline(el, { skip = false } = {}) {
  let run = await dal.one("SELECT * FROM baseline_runs WHERE el_id = ? AND status = 'started' ORDER BY started_at DESC LIMIT 1", el.el_id);
  if (!run && !skip) throw err(409, 'Start the starting check first.');
  const items = run ? json(run.items_json, []) : [];
  const answers = run ? json(run.answers_json, {}) : {};
  const nodes = await dal.all(`SELECT sn.id, sn.node_label, sc.id AS cluster_id, sc.cluster_label FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? ORDER BY sc.sequence_order, sn.sequence_order`, el.capability_target_id);
  const groupIds = [...new Set(nodes.map(n => n.cluster_id))];
  const groups = Object.fromEntries(groupIds.map(g => {
    const its = items.filter(i => i.group_id === g);
    const known = its.filter(i => answers[i.key]?.known).length;
    return [g, skip || !its.length ? 'new' : known === its.length ? 'known' : known ? 'some' : 'new'];
  }));
  // Start at the first group the learner does not already know.
  const firstGroup = groupIds.find(g => groups[g] !== 'known') || groupIds[groupIds.length - 1];
  const start = nodes.find(n => n.cluster_id === firstGroup) || nodes[0];
  const placement = {
    skipped: !!skip, start_node: start?.id, start_label: start?.node_label, start_group: start?.cluster_label,
    known_groups: nodes.filter((n, i, a) => groups[n.cluster_id] === 'known' && a.findIndex(x => x.cluster_id === n.cluster_id) === i).map(n => n.cluster_label),
    groups: groupIds.map(g => ({ id: g, label: nodes.find(n => n.cluster_id === g).cluster_label, status: groups[g] }))
  };
  const now = nowIsoFor();
  if (run) await dal.run("UPDATE baseline_runs SET status = ?, placement_json = ?, completed_at = ? WHERE id = ?", skip ? 'skipped' : 'done', JSON.stringify(placement), now, run.id);
  else {
    run = { id: ulid() };
    await dal.run("INSERT INTO baseline_runs (id, el_id, status, items_json, answers_json, placement_json, started_at, completed_at) VALUES (?, ?, 'skipped', '[]', '{}', ?, ?, ?)", run.id, el.el_id, JSON.stringify(placement), now, now);
  }
  const progressed = await dal.one('SELECT 1 FROM node_mastery WHERE engagement_learner_id = ? AND advanced_at IS NOT NULL', el.el_id);
  if (start && !progressed) await dal.run('UPDATE engagement_learners SET current_node_id = ?, current_cluster_id = ? WHERE id = ?', start.id, start.cluster_id, el.el_id);
  return { status: skip ? 'skipped' : 'done', placement };
}
