// core/evidence/faculty.js — faculty review verdicts, κ calibration and the
// review-load forecast (v4.3 §7.8).
//
// Verdicts (faculty never see the AI score):
//   decision stratum → decides the check. A provisional pass that faculty
//     confirm stops being provisional; a PASS faculty reject needs a recheck
//     on a fresh instance. The correction is logged as a faculty demonstration.
//   calibration stratum → feeds κ only; on a calibrated node an agreeing
//     review lifts the evidence to L3.
// κ per node: weighted (quadratic) Cohen's κ between the AI band and the
//   faculty band on calibration reviews, with a bootstrap 90% interval:
//   n ≥ 20, lower ≥ 0.50, point ≥ 0.60 → calibrated;
//   upper < 0.60 → rubric under review; otherwise keep sampling.
// Load forecast (minutes/week), shown before a cohort starts:
//   2 × (decision rate × expected checks + Σ p_node × checks_node + A2 escalations)
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import params from '../../config/params.js';
import { emit } from '../events/outbox.js';
import { BANDS, bandOf, pNode } from './calibration.js';

const bandIndex = (b) => BANDS.indexOf(b);

/** Quadratic-weighted Cohen's κ for paired ordinal ratings (0..k-1). */
export function weightedKappa(pairs, k = BANDS.length) {
  const n = pairs.length;
  if (!n) return null;
  const obs = Array.from({ length: k }, () => Array(k).fill(0));
  const ra = Array(k).fill(0); const rb = Array(k).fill(0);
  pairs.forEach(([a, b]) => { obs[a][b] += 1; ra[a] += 1; rb[b] += 1; });
  let num = 0; let den = 0;
  for (let i = 0; i < k; i += 1) {
    for (let j = 0; j < k; j += 1) {
      const w = ((i - j) ** 2) / ((k - 1) ** 2);
      num += w * obs[i][j] / n;
      den += w * (ra[i] * rb[j]) / (n * n);
    }
  }
  if (den === 0) return 1; // perfect agreement with no spread
  return 1 - num / den;
}

/** Deterministic PRNG so the bootstrap interval is reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function bootstrapKappa(pairs, { samples = params.get('evidence.faculty.bootstrapSamples'), ci = params.get('evidence.faculty.kappa.ci'), seed = 42 } = {}) {
  const point = weightedKappa(pairs);
  if (pairs.length < 2) return { point, lower: null, upper: null };
  const rand = mulberry32(seed);
  const stats = [];
  for (let s = 0; s < samples; s += 1) {
    const draw = Array.from({ length: pairs.length }, () => pairs[Math.floor(rand() * pairs.length)]);
    stats.push(weightedKappa(draw));
  }
  stats.sort((a, b) => a - b);
  const lo = (1 - ci) / 2;
  return { point, lower: stats[Math.floor(lo * samples)], upper: stats[Math.min(samples - 1, Math.ceil((1 - lo) * samples) - 1)] };
}

/** Calibration status of one node from its calibration-stratum reviews. */
export function nodeCalibration(nodeId) {
  const k = params.get('evidence.faculty.kappa');
  const pairs = dal.all(`SELECT e.r_c, f.band FROM faculty_reviews f JOIN review_queue q ON q.id = f.queue_id
    JOIN evidence_records e ON e.id = f.evidence_id WHERE q.node_id = ? AND q.stratum = 'calibration'`, nodeId)
    .map(r => [bandIndex(bandOf(r.r_c ?? 0)), bandIndex(r.band)]);
  const n = pairs.length;
  const { point, lower, upper } = bootstrapKappa(pairs);
  let status = 'sampling';
  if (n >= k.minN && lower != null && lower >= k.minLower && point >= k.minPoint) status = 'calibrated';
  else if (upper != null && n >= 5 && upper < k.minPoint) status = 'rubric_under_review';
  return { n, kappa: point, lower, upper, status };
}

/**
 * Apply a faculty verdict. Returns what changed for the learner.
 * @param {{queueId: string, staffId: string|null, verdict: 'pass'|'fail', band: string, notes?: string, secondsSpent?: number}} v
 */
export function applyVerdict({ queueId, staffId, verdict, band, notes = null, secondsSpent = null }) {
  if (!['pass', 'fail'].includes(verdict)) throw Object.assign(new Error('verdict must be pass or fail'), { status: 400 });
  if (!BANDS.includes(band)) throw Object.assign(new Error('band must be one of the four bands'), { status: 400 });
  return dal.tx(() => {
    const q = dal.one('SELECT * FROM review_queue WHERE id = ?', queueId);
    if (!q) throw Object.assign(new Error('Not found'), { status: 404 });
    if (q.status === 'done') throw Object.assign(new Error('Already reviewed'), { status: 409 });
    const ev = dal.one('SELECT * FROM evidence_records WHERE id = ?', q.evidence_id);
    const now = dal.nowIso();
    const reviewId = ulid();
    dal.run(`INSERT INTO faculty_reviews (id, queue_id, evidence_id, reviewer_staff_id, verdict, band, notes, seconds_spent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, reviewId, queueId, q.evidence_id, staffId, verdict, band, notes, secondsSpent, now);
    dal.run("UPDATE review_queue SET status = 'done', done_at = ? WHERE id = ?", now, queueId);

    const aiPass = !!ev.passed;
    const agree = aiPass === (verdict === 'pass');
    const outcome = { agree, recheck: false, lifted: false, provisionalCleared: false };
    const mastery = dal.one('SELECT * FROM node_mastery WHERE engagement_learner_id = ? AND skill_node_id = ?', q.el_id, q.node_id);

    if (aiPass && verdict === 'fail') {
      // Disagreement on a PASS: the learner gets a fresh instance (a recheck).
      if (mastery) dal.run('UPDATE node_mastery SET recheck_required = 1, provisional = 0 WHERE id = ?', mastery.id);
      dal.run(`INSERT INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, evidence_id, created_at)
        VALUES (?, ?, ?, 'faculty', ?, 0, NULL, 'L1', ?, ?, ?)`, ulid(), q.el_id, q.node_id, now, ev.assurance === 'A0' ? 'A1' : ev.assurance, ev.id, now);
      outcome.recheck = true;
    } else if (aiPass && verdict === 'pass') {
      if (mastery && mastery.provisional) { dal.run('UPDATE node_mastery SET provisional = 0 WHERE id = ?', mastery.id); outcome.provisionalCleared = true; }
      if (nodeCalibration(q.node_id).status === 'calibrated' || q.stratum === 'decision') {
        // Faculty-confirmed on a calibrated node → L3 (v4.3 §7.1, §7.8).
        const lift = nodeCalibration(q.node_id).status === 'calibrated';
        if (lift && mastery) dal.run("UPDATE node_mastery SET evidence_level = 'L3' WHERE id = ?", mastery.id);
        dal.run(`INSERT INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, evidence_id, created_at)
          VALUES (?, ?, ?, 'faculty', ?, 1, ?, ?, ?, ?, ?)`, ulid(), q.el_id, q.node_id, now, ev.r_c, lift ? 'L3' : 'L1', ev.assurance === 'A0' ? 'A1' : ev.assurance, ev.id, now);
        outcome.lifted = lift;
      }
    }
    emit('FACULTY_REVIEW_DONE', { aggregateType: 'enrolment', aggregateId: q.el_id, payload: { reviewId, evidenceId: ev.id, verdict, agree, stratum: q.stratum } });
    return outcome;
  });
}

/** Review-load forecast for a cohort (minutes per week), and whether it fits the contract. */
export function loadForecast(engagementId) {
  const f = params.get('evidence.faculty');
  const e = dal.one(`SELECT e.id, e.institution_id, ct.id AS ct_id, COALESCE(ct.time_window_weeks, ?) AS weeks, i.review_minutes_per_100
    FROM engagements e JOIN capability_targets ct ON ct.id = e.capability_target_id JOIN institutions i ON i.id = e.institution_id WHERE e.id = ?`, f.defaultWeeks, engagementId);
  if (!e) return null;
  const learners = dal.one("SELECT COUNT(*) n FROM engagement_learners WHERE engagement_id = ? AND COALESCE(access_status,'active') != 'removed'", engagementId).n;
  const nodes = dal.all('SELECT sn.id FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = ?', e.ct_id);
  const weeks = Math.max(1, e.weeks || f.defaultWeeks);
  const hist = dal.one(`SELECT COUNT(*) total, SUM(CASE WHEN q.stratum = 'decision' THEN 1 ELSE 0 END) decision
    FROM evidence_records r LEFT JOIN review_queue q ON q.evidence_id = r.id
    WHERE r.el_id IN (SELECT id FROM engagement_learners WHERE engagement_id = ?) AND r.assurance != 'A0'`, engagementId);
  const decisionRate = hist.total >= 50 ? (hist.decision || 0) / hist.total : f.decisionRatePrior;
  const perLearnerPerNode = 1.5;
  const checksPerWeek = (learners * nodes.length * perLearnerPerNode) / weeks;
  const calibrationPerWeek = nodes.reduce((a, n) => a + pNode(engagementId, n.id) * (learners * perLearnerPerNode) / weeks, 0);
  const a2Escalations = 0; // instance-bound challenge not yet live (docs/v4.3-gap-audit.md)
  const minutes = f.minutesPerReview * (decisionRate * checksPerWeek + calibrationPerWeek + a2Escalations);
  const contracted = e.review_minutes_per_100 != null ? Math.round(e.review_minutes_per_100 * learners / 100) : null;
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();
  const doneThisWeek = dal.one(`SELECT COUNT(*) n FROM faculty_reviews f JOIN review_queue q ON q.id = f.queue_id WHERE q.engagement_id = ? AND f.created_at >= ?`, engagementId, weekStart).n;
  return {
    learners, nodes: nodes.length, weeks,
    decision_rate: Math.round(decisionRate * 1000) / 1000,
    decision_rate_source: hist.total >= 50 ? 'observed' : 'prior',
    expected_checks_per_week: Math.round(checksPerWeek),
    forecast_minutes_per_week: Math.round(minutes),
    contracted_minutes_per_week: contracted,
    over_contract: contracted != null && minutes > contracted,
    open_items: dal.one("SELECT COUNT(*) n FROM review_queue WHERE engagement_id = ? AND status = 'open'", engagementId).n,
    minutes_used_this_week: doneThisWeek * f.minutesPerReview,
    advice: contracted == null
      ? 'Set the contracted review minutes per 100 learners to compare.'
      : minutes > contracted
        ? 'Forecast exceeds the contract: add reviewers, or accept more provisional (L1) evidence while the queue waits.'
        : 'Forecast fits the contracted review time.'
  };
}
