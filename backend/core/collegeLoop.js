// core/collegeLoop.js — the institution's loop on the v4.3 canvas:
//   I1  action cards, setup checklist, MoU target scoreboard, AI time meter
//   I3  cohort × skill grid, and why a student is not ready yet
//   I8  bridge programmes: extra work for some or all students, then
//       "Did it work?" at the re-test date
//   I9  placements, offers, salary bands and 90-day employer ratings
// Structural facts only, as everywhere on the institution side: no session
// text, no marking detail.
import * as dal from './db/dal.js';
import { ulid } from './db/ulid.js';
import { mapSeq, eachSeq } from './util/seq.js';
import { cohortReadiness, summarise, dropReadinessCache, BAND_LABEL } from './readiness/cohort.js';
import { liveStatus } from './institutionActivity.js';
import { notify } from './notify.js';

const legacy = () => dal.legacyHandle();
const monthStart = () => { const d = new Date(Date.now() + 5.5 * 3600000); return `${d.toISOString().slice(0, 8)}01`; };

// ─── I1 ────────────────────────────────────────────────────────────────────────
export async function commandCentre(institutionId, cohorts) {
  const per = await mapSeq(cohorts, async (c) => {
    const [rows, live] = await Promise.all([cohortReadiness(c), liveStatus(legacy(), c.id)]);
    return { c, sum: summarise(rows), live };
  });
  const quiet = per.reduce((a, x) => a + x.live.students.filter(s => s.light === 'red' && /Inactive|not started/.test(s.reason)).length, 0);
  const stuck = per.reduce((a, x) => a + x.live.students.filter(s => /Stuck/.test(s.reason)).length, 0);
  const nearly = per.reduce((a, x) => a + x.sum.counts.nearly, 0);
  const ready = per.reduce((a, x) => a + x.sum.counts.ready, 0);
  const total = per.reduce((a, x) => a + x.sum.total, 0);
  const topGap = per.map(x => x.sum.top_gap).filter(Boolean).sort((a, b) => b.students - a.students)[0] || null;
  const reviews = Number((await dal.one("SELECT COUNT(*) AS n FROM review_queue WHERE institution_id = ? AND status = 'open'", institutionId)).n);
  const requests = Number((await dal.one(`SELECT COUNT(*) AS n FROM skill_requests sr JOIN engagements e ON e.id = sr.engagement_id WHERE e.institution_id = ? AND sr.status = 'pending'`, institutionId)).n);
  const first = cohorts[0];
  const cards = [
    quiet && { kind: 'quiet', count: quiet, title: `${quiet} student${quiet === 1 ? ' has' : 's have'} gone quiet`, body: 'No activity for 3 days or more, or never started.', why: 'Counted from the live view: last session, message or sign-in more than 3 days ago.', href: first ? `/institution/cohorts/${first.id}/live` : '/institution/cohorts', cta: 'See who' },
    stuck && { kind: 'stuck', count: stuck, title: `${stuck} stuck on one skill`, body: '3 or more tries on the same skill.', why: 'A student is stuck when they needed a skill taught three different ways and still have not passed its check.', href: first ? `/institution/cohorts/${first.id}/live` : '/institution/cohorts', cta: 'See who' },
    nearly && { kind: 'nearly', count: nearly, title: `${nearly} nearly ready`, body: topGap ? `Most need ${topGap.skill}.` : 'One or two required skills left.', why: 'Readiness 60–79: verified skills cover most of the best-fitting role. A bridge programme on the missing skill usually moves them to Ready.', href: '/institution/bridges?new=1', cta: 'Start a bridge programme' },
    reviews && { kind: 'reviews', count: reviews, title: `${reviews} review${reviews === 1 ? '' : 's'} waiting`, body: 'Answers your faculty are asked to double-check.', why: 'Borderline answers, possible authorship concerns and a random sample for calibration come to faculty.', href: '/institution/review', cta: 'Open review queue' },
    requests && { kind: 'requests', count: requests, title: `${requests} skill request${requests === 1 ? '' : 's'}`, body: 'Students asked you to add skills employers want.', why: 'Requested from the job market and emerging-topics pages.', href: '/institution/curriculum', cta: 'See requests' }
  ].filter(Boolean);

  const target = await dal.one('SELECT mou_target_pct, mou_target_label, mou_target_date FROM institutions WHERE id = ?', institutionId);
  const placed = Number((await dal.one("SELECT COUNT(DISTINCT el_id) AS n FROM placements WHERE institution_id = ? AND status = 'placed'", institutionId)).n);
  const scoreboard = {
    target_pct: target?.mou_target_pct ?? null, label: target?.mou_target_label || 'Students placed', due: target?.mou_target_date || null,
    placed, ready, total, placed_pct: total ? Math.round((placed / total) * 100) : 0, ready_pct: total ? Math.round((ready / total) * 100) : 0
  };

  const hasTarget = Number((await dal.one(`SELECT COUNT(*) AS n FROM capability_targets ct WHERE ct.institution_id = ? AND EXISTS (SELECT 1 FROM skill_clusters sc WHERE sc.capability_target_id = ct.id)`, institutionId)).n) > 0;
  const hasStudents = Number((await dal.one(`SELECT COUNT(*) AS n FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id WHERE e.institution_id = ?`, institutionId)).n) > 0;
  const hasLesson = Number((await dal.one(`SELECT COUNT(*) AS n FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id JOIN engagements e ON e.id = el.engagement_id WHERE e.institution_id = ?`, institutionId)).n) > 0;
  const setup = [
    { key: 'target', label: 'Set a capability target and build the pathway', done: hasTarget, href: '/institution/cohorts/new' },
    { key: 'students', label: 'Add students and send their invites', done: hasStudents, href: '/institution/students/add' },
    { key: 'lesson', label: 'First student lesson', done: hasLesson, href: '/institution/students' }
  ];

  const ai = await dal.one(`SELECT COUNT(*) AS calls, COALESCE(SUM(ms), 0) AS ms,
      SUM(CASE WHEN task = 'TEACH.speak' THEN 1 ELSE 0 END) AS voice_calls
    FROM model_calls WHERE institution_id = ? AND created_at >= ? AND task NOT LIKE 'CLIENT.%'`, institutionId, monthStart());
  return {
    cards, scoreboard, setup,
    ai_time: { month: monthStart().slice(0, 7), calls: Number(ai.calls) || 0, minutes: Math.round((Number(ai.ms) || 0) / 60000), voice_clips: Number(ai.voice_calls) || 0 },
    readiness: { ready, nearly, building: total - ready - nearly, total }
  };
}

export async function setMouTarget(institutionId, { pct, label, date }) {
  const p = Number(pct);
  await dal.run('UPDATE institutions SET mou_target_pct = ?, mou_target_label = ?, mou_target_date = ? WHERE id = ?',
    Number.isFinite(p) && p > 0 && p <= 100 ? Math.round(p) : null, String(label || 'Students placed').slice(0, 80), /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : null, institutionId);
}

// ─── I3 ────────────────────────────────────────────────────────────────────────
export async function cohortGrid(engagement) {
  const clusters = await dal.all(`SELECT sc.id, sc.cluster_label AS label, COUNT(sn.id) AS nodes FROM skill_clusters sc JOIN skill_nodes sn ON sn.cluster_id = sc.id
    WHERE sc.capability_target_id = ? GROUP BY sc.id, sc.cluster_label, sc.sequence_order ORDER BY sc.sequence_order`, engagement.capability_target_id);
  const mastered = await dal.all(`SELECT nm.engagement_learner_id AS el_id, sn.cluster_id, COUNT(*) AS n FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN engagement_learners el ON el.id = nm.engagement_learner_id WHERE el.engagement_id = ? AND nm.advanced_at IS NOT NULL GROUP BY nm.engagement_learner_id, sn.cluster_id`, engagement.id);
  const m = new Map(mastered.map(r => [`${r.el_id}|${r.cluster_id}`, Number(r.n)]));
  const [rows, live] = await Promise.all([cohortReadiness(engagement), liveStatus(legacy(), engagement.id)]);
  const lights = new Map(live.students.map(s => [s.el_id, s]));
  const students = rows.map(r => ({
    el_id: r.el_id, name: r.name, learner_ref: r.learner_ref, readiness: r.readiness, band: r.band, band_label: BAND_LABEL[r.band], role: r.role,
    light: lights.get(r.el_id)?.light || null, last_active_at: lights.get(r.el_id)?.last_active_at || null,
    cells: clusters.map(c => { const n = m.get(`${r.el_id}|${c.id}`) || 0; return Math.round((n / Number(c.nodes)) * 100); })
  }));
  return { clusters: clusters.map(c => ({ id: c.id, label: c.label, nodes: Number(c.nodes) })), students, summary: summarise(rows) };
}

export async function whyNotReady(engagement, elId) {
  const rows = await cohortReadiness(engagement);
  const r = rows.find(x => x.el_id === elId);
  if (!r) return null;
  const stuck = await dal.all(`SELECT sn.id, sn.node_label, MAX(ls.loop_count) AS loops FROM learning_sessions ls JOIN skill_nodes sn ON sn.id = ls.skill_node_id
    WHERE ls.engagement_learner_id = ? AND NOT EXISTS (SELECT 1 FROM node_mastery nm WHERE nm.engagement_learner_id = ls.engagement_learner_id AND nm.skill_node_id = ls.skill_node_id AND nm.advanced_at IS NOT NULL)
    GROUP BY sn.id, sn.node_label HAVING MAX(ls.loop_count) >= 2 ORDER BY loops DESC`, elId);
  const nodeLabels = r.bridge_nodes.length ? await dal.all(`SELECT id, node_label FROM skill_nodes WHERE id IN (${r.bridge_nodes.map(() => '?').join(',')})`, ...r.bridge_nodes) : [];
  const live = (await liveStatus(legacy(), engagement.id)).students.find(s => s.el_id === elId);
  const reasons = [];
  if (r.band === 'ready') reasons.push(`Ready for ${r.role}: verified skills cover what the role asks for.`);
  else {
    if (r.below_requirements.length) reasons.push(`For ${r.role || 'the best-fitting role'}, these required skills are not verified yet: ${r.below_requirements.join(', ')}.`);
    if (stuck.length) reasons.push(`Needed repeated attempts on ${stuck.map(s => s.node_label).join(', ')}.`);
    if (live?.light === 'red' && !/Stuck/.test(live.reason)) reasons.push(`${live.reason}.`);
    if (!reasons.length) reasons.push('Still early in the programme: the core skills are being learned.');
  }
  const suggested = [...new Set([...nodeLabels.map(n => n.id), ...stuck.map(s => s.id)])].slice(0, 4);
  return {
    student: { el_id: r.el_id, name: r.name, learner_ref: r.learner_ref }, readiness: r.readiness, band: r.band, band_label: BAND_LABEL[r.band], role: r.role,
    reasons, missing_skills: r.below_requirements, stuck: stuck.map(s => ({ skill: s.node_label, loops: Number(s.loops) })),
    last_active_at: live?.last_active_at || null, light: live?.light || null,
    suggested_bridge: suggested.map(id => ({ id, label: [...nodeLabels, ...stuck.map(s => ({ id: s.id, node_label: s.node_label }))].find(n => n.id === id)?.node_label }))
  };
}

// ─── I8 ────────────────────────────────────────────────────────────────────────
export async function createBridge({ engagement, title, nodeIds, scope, elIds, retestAt, note, staffId }) {
  const nodes = await dal.all(`SELECT sn.id, sn.node_label FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? AND sn.id IN (${nodeIds.map(() => '?').join(',') || "''"})`, engagement.capability_target_id, ...nodeIds);
  if (!nodes.length) throw Object.assign(new Error('Choose at least one skill from this cohort’s pathway.'), { status: 400 });
  const roster = (await dal.all("SELECT id FROM engagement_learners WHERE engagement_id = ? AND COALESCE(access_status, 'active') != 'removed'", engagement.id)).map(r => r.id);
  const targets = scope === 'cohort' ? roster : roster.filter(id => elIds.includes(id));
  if (!targets.length) throw Object.assign(new Error('Choose at least one student.'), { status: 400 });
  const readiness = new Map((await cohortReadiness(engagement)).map(r => [r.el_id, r.readiness]));
  const id = ulid();
  const now = dal.nowIso();
  await dal.tx(async () => {
    await dal.run(`INSERT INTO bridge_programmes (id, institution_id, engagement_id, title, node_ids_json, scope, note, retest_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, engagement.institution_id, engagement.id, String(title || `Bridge: ${nodes.map(n => n.node_label).join(', ')}`).slice(0, 160),
    JSON.stringify(nodes.map(n => n.id)), scope === 'cohort' ? 'cohort' : 'students', note ? String(note).slice(0, 500) : null, retestAt, staffId || null, now);
    await eachSeq(targets, async (elId) => {
      const had = (await dal.all(`SELECT skill_node_id FROM node_mastery WHERE engagement_learner_id = ? AND advanced_at IS NOT NULL AND skill_node_id IN (${nodes.map(() => '?').join(',')})`, elId, ...nodes.map(n => n.id))).map(r => r.skill_node_id);
      await dal.run('INSERT INTO bridge_assignments (id, bridge_id, el_id, baseline_readiness, baseline_mastered_json, assigned_at) VALUES (?, ?, ?, ?, ?, ?)',
        ulid(), id, elId, readiness.get(elId) ?? null, JSON.stringify(had), now);
    });
  });
  // Tell each student: it appears on their Home under "Today".
  const learners = await dal.all(`SELECT el.learner_id FROM engagement_learners el WHERE el.id IN (${targets.map(() => '?').join(',')})`, ...targets);
  await eachSeq(learners, async (l) => notify({ to: { type: 'learner', id: l.learner_id }, kind: 'bridge', title: `New practice from your college: ${nodes.map(n => n.node_label).join(', ')}`, body: `Re-test by ${retestAt.slice(0, 10)}.`, href: '/learn/dashboard' }));
  return id;
}

/** "Did it work?" — for each student, the bridge skills mastered since, and readiness then vs now. */
export async function bridgeOutcome(bridge, engagement) {
  const nodeIds = JSON.parse(bridge.node_ids_json);
  const nodes = await dal.all(`SELECT id, node_label FROM skill_nodes WHERE id IN (${nodeIds.map(() => '?').join(',')})`, ...nodeIds);
  const assigns = await dal.all(`SELECT ba.el_id, ba.baseline_readiness, ba.baseline_mastered_json, l.name, l.learner_ref FROM bridge_assignments ba
    JOIN engagement_learners el ON el.id = ba.el_id JOIN learners l ON l.id = el.learner_id WHERE ba.bridge_id = ? ORDER BY l.name`, bridge.id);
  dropReadinessCache(engagement.id);
  const now = new Map((await cohortReadiness(engagement)).map(r => [r.el_id, r]));
  const students = await mapSeq(assigns, async (a) => {
    const masteredNow = (await dal.all(`SELECT skill_node_id FROM node_mastery WHERE engagement_learner_id = ? AND advanced_at IS NOT NULL AND skill_node_id IN (${nodeIds.map(() => '?').join(',')})`, a.el_id, ...nodeIds)).map(r => r.skill_node_id);
    const before = JSON.parse(a.baseline_mastered_json || '[]');
    const r = now.get(a.el_id);
    return {
      el_id: a.el_id, name: a.name, learner_ref: a.learner_ref,
      skills_before: before.length, skills_now: masteredNow.length, skills_total: nodeIds.length,
      newly_mastered: nodes.filter(n => masteredNow.includes(n.id) && !before.includes(n.id)).map(n => n.node_label),
      readiness_before: a.baseline_readiness, readiness_now: r?.readiness ?? null, band_now: r ? BAND_LABEL[r.band] : null
    };
  });
  const improved = students.filter(s => s.skills_now > s.skills_before || (s.readiness_now ?? 0) > (s.readiness_before ?? 0)).length;
  const completed = students.filter(s => s.skills_now === s.skills_total).length;
  const due = bridge.retest_at <= new Date().toISOString().slice(0, 10);
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    skills: nodes.map(n => ({ id: n.id, label: n.node_label })), students,
    result: {
      assigned: students.length, completed, improved,
      readiness_before: avg(students.map(s => s.readiness_before).filter(x => x != null)),
      readiness_now: avg(students.map(s => s.readiness_now).filter(x => x != null)),
      retest_due: due,
      verdict: !students.length ? 'No students.' : !due ? 'Too early to say: the re-test date has not come yet.'
        : completed / students.length >= 0.6 ? `It worked: ${completed} of ${students.length} now hold every bridge skill.`
          : improved / students.length >= 0.5 ? `Partly: ${improved} of ${students.length} improved, ${completed} hold every bridge skill.`
            : `Not yet: only ${improved} of ${students.length} improved. Try a different approach or more time.`
    }
  };
}

export async function learnerBridges(elId) {
  const rows = await dal.all(`SELECT bp.id, bp.title, bp.node_ids_json, bp.retest_at, bp.note FROM bridge_assignments ba JOIN bridge_programmes bp ON bp.id = ba.bridge_id
    WHERE ba.el_id = ? AND bp.status = 'open' ORDER BY bp.retest_at`, elId);
  return mapSeq(rows, async (b) => {
    const ids = JSON.parse(b.node_ids_json);
    const nodes = await dal.all(`SELECT sn.id, sn.node_label, EXISTS (SELECT 1 FROM node_mastery nm WHERE nm.engagement_learner_id = ? AND nm.skill_node_id = sn.id AND nm.advanced_at IS NOT NULL) AS mastered
      FROM skill_nodes sn WHERE sn.id IN (${ids.map(() => '?').join(',')})`, elId, ...ids);
    return { id: b.id, title: b.title, retest_at: b.retest_at, note: b.note, skills: nodes.map(n => ({ id: n.id, label: n.node_label, mastered: !!n.mastered })) };
  });
}

// ─── I9 ────────────────────────────────────────────────────────────────────────
const BANDS = [['Under 3 LPA', 0, 3], ['3–5 LPA', 3, 5], ['5–8 LPA', 5, 8], ['8 LPA and above', 8, Infinity]];
export async function placementSummary(institutionId, engagementId = null) {
  const rows = await dal.all(`SELECT p.*, l.name, l.learner_ref, e.title AS cohort FROM placements p LEFT JOIN learners l ON l.id = p.learner_id
    LEFT JOIN engagements e ON e.id = p.engagement_id WHERE p.institution_id = ? ${engagementId ? 'AND p.engagement_id = ?' : ''} ORDER BY p.created_at DESC`,
  ...(engagementId ? [institutionId, engagementId] : [institutionId]));
  const placed = rows.filter(r => r.status === 'placed');
  const offers = rows.filter(r => r.status !== 'declined');
  const salaries = offers.map(r => Number(r.salary_lpa)).filter(x => x > 0).sort((a, b) => a - b);
  const rated = placed.filter(r => r.rating_90d);
  const sponsored = Number((await dal.one("SELECT COUNT(*) AS n FROM sponsorships WHERE institution_id = ? AND status IN ('accepted','running','done')", institutionId)).n);
  return {
    rows,
    summary: {
      placed: new Set(placed.map(r => r.el_id || r.id)).size, offers: offers.length,
      median_salary_lpa: salaries.length ? salaries[Math.floor(salaries.length / 2)] : null,
      salary_bands: BANDS.map(([label, lo, hi]) => ({ label, count: salaries.filter(s => s >= lo && s < hi).length })),
      rated_90d: rated.length, avg_rating_90d: rated.length ? Math.round((rated.reduce((a, r) => a + r.rating_90d, 0) / rated.length) * 10) / 10 : null,
      sponsored_cohorts: sponsored
    }
  };
}
