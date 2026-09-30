// core/benchmarks.js — institution benchmarks (v4.3 §16): the same metrics for
// this cohort, the institution's other cohorts, and the anonymised regional
// median. The regional median is published only when at least 3 OTHER
// institutions in the region contribute, and never names them.
import * as dal from './db/dal.js';
import params from '../config/params.js';

const median = (xs) => {
  const s = xs.filter(x => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

export const METRICS = [
  { key: 'progress_pct', label: 'Average progress', unit: '%', higher: true },
  { key: 'mastered_per_learner', label: 'Nodes mastered per learner', unit: '', higher: true },
  { key: 'minutes_per_node', label: 'Active minutes per mastered node (median)', unit: 'min', higher: false },
  { key: 'loops_per_node', label: 'Loops per mastered node', unit: '', higher: false },
  { key: 'review_pass_rate', label: 'Review pass rate', unit: '%', higher: true },
  { key: 'a1_share', label: 'Checks with provenance (A1+)', unit: '%', higher: true },
  { key: 'provisional_share', label: 'Passes awaiting faculty review', unit: '%', higher: false }
];

export function cohortMetrics(engagementId) {
  const els = dal.all("SELECT id FROM engagement_learners WHERE engagement_id = ? AND COALESCE(access_status,'active') != 'removed'", engagementId).map(r => r.id);
  const total = dal.one(`SELECT COUNT(*) n FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id JOIN engagements e ON e.capability_target_id = sc.capability_target_id WHERE e.id = ?`, engagementId).n;
  if (!els.length) return { learners: 0 };
  const inList = els.map(() => '?').join(',');
  const mastery = dal.all(`SELECT nm.engagement_learner_id el, nm.loops, nm.provisional,
      COALESCE((SELECT SUM(active_minutes) FROM learning_sessions ls WHERE ls.engagement_learner_id = nm.engagement_learner_id AND ls.skill_node_id = nm.skill_node_id), 0) AS minutes
    FROM node_mastery nm WHERE nm.advanced_at IS NOT NULL AND nm.engagement_learner_id IN (${inList})`, ...els);
  const reviews = dal.one(`SELECT COUNT(*) n, SUM(passed) p FROM demonstrations WHERE kind = 'review' AND el_id IN (${inList})`, ...els);
  const checks = dal.one(`SELECT COUNT(*) n, SUM(CASE WHEN assurance != 'A0' THEN 1 ELSE 0 END) a1 FROM evidence_records WHERE el_id IN (${inList})`, ...els);
  return {
    learners: els.length,
    progress_pct: r1(total ? (mastery.length / (els.length * total)) * 100 : 0),
    mastered_per_learner: r1(mastery.length / els.length),
    minutes_per_node: r1(median(mastery.map(m => m.minutes).filter(m => m > 0))),
    loops_per_node: r1(mastery.length ? mastery.reduce((a, m) => a + (m.loops || 0), 0) / mastery.length : null),
    review_pass_rate: reviews.n ? r1(((reviews.p || 0) / reviews.n) * 100) : null,
    a1_share: checks.n ? r1(((checks.a1 || 0) / checks.n) * 100) : null,
    provisional_share: mastery.length ? r1((mastery.filter(m => m.provisional).length / mastery.length) * 100) : null
  };
}

export function benchmarks(institutionId, engagementId) {
  const inst = dal.one('SELECT city FROM institutions WHERE id = ?', institutionId);
  const ours = cohortMetrics(engagementId);
  const cohorts = dal.all('SELECT id, title FROM engagements WHERE institution_id = ? AND id != ? ORDER BY created_at DESC', institutionId, engagementId)
    .map(e => ({ id: e.id, title: e.title, ...cohortMetrics(e.id) })).filter(c => c.learners > 0);

  const region = inst?.city || null;
  const others = region ? dal.all(`SELECT i.id, e.id AS eid FROM institutions i JOIN engagements e ON e.institution_id = i.id
    WHERE i.id != ? AND lower(COALESCE(i.city, '')) = lower(?)`, institutionId, region) : [];
  const byInst = new Map();
  others.forEach(o => { const m = cohortMetrics(o.eid); if (m.learners > 0) { if (!byInst.has(o.id)) byInst.set(o.id, []); byInst.get(o.id).push(m); } });
  const minInst = params.get('institution.benchmarkMinInstitutions');
  const published = byInst.size >= minInst;
  const perInst = [...byInst.values()].map(ms => Object.fromEntries(METRICS.map(({ key }) => [key, median(ms.map(m => m[key]))])));
  const regional = published ? Object.fromEntries(METRICS.map(({ key }) => [key, r1(median(perInst.map(m => m[key])))])) : null;

  return {
    metrics: METRICS, ours, cohorts,
    regional: {
      region, published, institutions: published ? byInst.size : null, min_institutions: minInst, values: regional,
      note: published ? `Median of ${byInst.size} other institutions in ${region}; no institution is named.` : `Not published: fewer than ${minInst} other institutions in ${region || 'your region'} have active cohorts.`
    }
  };
}
