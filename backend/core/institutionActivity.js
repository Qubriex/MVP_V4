// core/institutionActivity.js
// ─────────────────────────────────────────────────────────────────────────────
// What institutions see about student activity: live status, activity over a
// date range, daily active students, each student's own pathway, and the
// evidence report management uses to answer "why didn't my child get placed?".
//
// Same boundary as the rest of the institution side: structural facts only.
// Session text, doubts and how answers were marked (per-point scores, rubrics,
// fused scores) are never read here.
//
// Timestamps are stored either as ISO (…T…Z) or as 'YYYY-MM-DD HH:MM:SS' UTC;
// ts() reads both. Days are counted in India time (Asia/Kolkata).
// ─────────────────────────────────────────────────────────────────────────────
import { mapSeq } from './util/seq.js';
import { readinessTimeline } from './insights.js';

// Live status thresholds.
export const LIVE = Object.freeze({
  activeMinutes: 5,     // green: activity in the last 5 minutes
  inactiveDays: 3,      // red: no activity for 3 days (or never)
  stuckLoops: 3         // red: 3+ loops on the current node; 1–2 loops is yellow
});

const ts = (col) => `(CASE WHEN ${col} IS NULL THEN NULL WHEN ${col} LIKE '%Z' OR ${col} LIKE '%+%' THEN ${col} ELSE ${col} || 'Z' END)::timestamptz`;
const istDay = (col) => `to_char(${ts(col)} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`;
const iso = (v) => {
  if (!v) return null;
  const s = String(v);
  const d = new Date(/[Z+]/.test(s.slice(10)) ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const latest = (...vals) => vals.map(iso).filter(Boolean).sort().pop() || null;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A validated {from, to} pair of YYYY-MM-DD days (India time); defaults to the last 30 days. */
export function dayRange(from, to) {
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const t = DAY_RE.test(to || '') ? to : today;
  const f = DAY_RE.test(from || '') ? from : new Date(Date.parse(`${t}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  return f <= t ? { from: f, to: t } : { from: t, to: f };
}

/** Enrolled students of a cohort (removed ones only when asked), optionally a selection. */
async function roster(db, engagementId, { elIds = null, includeRemoved = false } = {}) {
  const rows = await db.prepare(`
    SELECT el.id AS el_id, el.enrolled_at, el.last_login_at, el.overall_status, el.access_status, el.current_node_id,
      l.id AS learner_id, l.name, l.learner_ref, l.language, l.age_status,
      sn.node_label AS current_node_label
    FROM engagement_learners el JOIN learners l ON l.id = el.learner_id
    LEFT JOIN skill_nodes sn ON sn.id = el.current_node_id
    WHERE el.engagement_id = ? ${includeRemoved ? '' : "AND COALESCE(el.access_status, 'active') != 'removed'"}
    ORDER BY l.name`).all(engagementId);
  return elIds ? rows.filter(r => elIds.includes(r.el_id)) : rows;
}

/** Last activity per student: heartbeat, a message they sent, a session start, or sign-in. */
async function lastActivity(db, engagementId) {
  const rows = await db.prepare(`
    SELECT ls.engagement_learner_id AS el_id, MAX(ls.last_heartbeat_at) AS hb, MAX(ls.started_at) AS started,
      MIN(ls.started_at) AS first_started,
      (SELECT MAX(sm.created_at) FROM session_messages sm JOIN learning_sessions s2 ON s2.id = sm.session_id
        WHERE s2.engagement_learner_id = ls.engagement_learner_id AND sm.role = 'learner') AS msg
    FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id
    WHERE el.engagement_id = ? GROUP BY ls.engagement_learner_id`).all(engagementId);
  return new Map(rows.map(r => [r.el_id, { last: latest(r.hb, r.started, r.msg), first: iso(r.first_started) }]));
}

// ─── Live ──────────────────────────────────────────────────────────────────────
export async function liveStatus(db, engagementId, now = Date.now()) {
  const students = await roster(db, engagementId);
  const acts = await lastActivity(db, engagementId);
  const loops = new Map((await db.prepare(`
    SELECT ls.engagement_learner_id AS el_id, MAX(ls.loop_count) AS loops
    FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id
    WHERE el.engagement_id = ? AND ls.skill_node_id = el.current_node_id
      AND NOT EXISTS (SELECT 1 FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.skill_node_id = el.current_node_id AND nm.advanced_at IS NOT NULL)
    GROUP BY ls.engagement_learner_id`).all(engagementId)).map(r => [r.el_id, Number(r.loops) || 0]));
  const todayStart = `${new Date(now + 5.5 * 3600000).toISOString().slice(0, 10)}`;
  const today = new Map((await db.prepare(`
    SELECT ls.engagement_learner_id AS el_id, COALESCE(SUM(ls.active_minutes), 0) AS m
    FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id
    WHERE el.engagement_id = ? AND ${istDay('COALESCE(ls.last_heartbeat_at, ls.started_at)')} = ?
    GROUP BY ls.engagement_learner_id`).all(engagementId, todayStart)).map(r => [r.el_id, Math.round(Number(r.m))]));

  const rows = students.map(st => {
    const a = acts.get(st.el_id) || {};
    const last = latest(a.last, st.last_login_at);
    const mins = last ? (now - Date.parse(last)) / 60000 : Infinity;
    const l = st.overall_status === 'completed' ? 0 : (loops.get(st.el_id) || 0);
    let light; let reason;
    if (st.overall_status === 'completed') { light = mins <= LIVE.activeMinutes ? 'green' : 'yellow'; reason = 'Pathway completed'; }
    else if (!last || mins > LIVE.inactiveDays * 1440) { light = 'red'; reason = last ? `Inactive for over ${LIVE.inactiveDays} days` : 'Has not started yet'; }
    else if (l >= LIVE.stuckLoops) { light = 'red'; reason = `Stuck: ${l} loops on the current skill`; }
    else if (mins <= LIVE.activeMinutes) { light = l > 0 ? 'yellow' : 'green'; reason = l > 0 ? `Learning now, ${l} loop${l === 1 ? '' : 's'} on this skill` : 'Learning now'; }
    else { light = 'yellow'; reason = l > 0 ? `Idle, ${l} loop${l === 1 ? '' : 's'} on the current skill` : 'Idle'; }
    return {
      el_id: st.el_id, name: st.name, learner_ref: st.learner_ref, language: st.language,
      current_node: st.overall_status === 'completed' ? null : st.current_node_label,
      last_active_at: last, active_minutes_today: today.get(st.el_id) || 0, loops: l, light, reason
    };
  });
  const order = { green: 0, yellow: 1, red: 2 };
  rows.sort((a, b) => order[a.light] - order[b.light] || String(b.last_active_at || '').localeCompare(String(a.last_active_at || '')));
  return {
    generated_at: new Date(now).toISOString(),
    thresholds: LIVE,
    counts: { green: rows.filter(r => r.light === 'green').length, yellow: rows.filter(r => r.light === 'yellow').length, red: rows.filter(r => r.light === 'red').length },
    students: rows
  };
}

// ─── Activity over a date range ────────────────────────────────────────────────
export async function activitySummary(db, engagementId, { from, to, elIds = null }) {
  const students = await roster(db, engagementId, { elIds, includeRemoved: true });
  const acts = await lastActivity(db, engagementId);
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN engagements e ON e.capability_target_id = sc.capability_target_id WHERE e.id = ?`).get(engagementId)).n;
  const sess = new Map((await db.prepare(`
    SELECT ls.engagement_learner_id AS el_id, COUNT(*) AS sessions, COALESCE(SUM(ls.active_minutes), 0) AS minutes, COALESCE(SUM(ls.loop_count), 0) AS loops
    FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id
    WHERE el.engagement_id = ? AND ${istDay('ls.started_at')} BETWEEN ? AND ?
    GROUP BY ls.engagement_learner_id`).all(engagementId, from, to)).map(r => [r.el_id, r]));
  const days = new Map((await db.prepare(`
    SELECT el_id, COUNT(DISTINCT d) AS days FROM (
      SELECT ls.engagement_learner_id AS el_id, ${istDay('sm.created_at')} AS d
      FROM session_messages sm JOIN learning_sessions ls ON ls.id = sm.session_id JOIN engagement_learners el ON el.id = ls.engagement_learner_id
      WHERE el.engagement_id = ? AND sm.role = 'learner'
      UNION
      SELECT ls.engagement_learner_id, ${istDay('ls.started_at')}
      FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id WHERE el.engagement_id = ?
    ) x WHERE d BETWEEN ? AND ? GROUP BY el_id`).all(engagementId, engagementId, from, to)).map(r => [r.el_id, Number(r.days)]));
  const mastered = new Map((await db.prepare(`
    SELECT nm.engagement_learner_id AS el_id, COUNT(*) AS total,
      SUM(CASE WHEN ${istDay('nm.advanced_at')} BETWEEN ? AND ? THEN 1 ELSE 0 END) AS in_range
    FROM node_mastery nm JOIN engagement_learners el ON el.id = nm.engagement_learner_id
    WHERE el.engagement_id = ? AND nm.advanced_at IS NOT NULL GROUP BY nm.engagement_learner_id`).all(from, to, engagementId)).map(r => [r.el_id, r]));
  return students.map(st => {
    const a = acts.get(st.el_id) || {};
    const s = sess.get(st.el_id) || {};
    const m = mastered.get(st.el_id) || {};
    return {
      el_id: st.el_id, learner_ref: st.learner_ref, name: st.name, language: st.language,
      access: st.access_status || 'active', enrolled_at: iso(st.enrolled_at),
      started_at: a.first || null,
      last_active_at: latest(a.last, st.last_login_at),
      completed: st.overall_status === 'completed',
      days_active: days.get(st.el_id) || 0,
      sessions: Number(s.sessions) || 0,
      active_minutes: Math.round(Number(s.minutes) || 0),
      loops: Number(s.loops) || 0,
      nodes_mastered_in_range: Number(m.in_range) || 0,
      nodes_mastered_total: Number(m.total) || 0,
      total_nodes: Number(total) || 0,
      current_node: st.overall_status === 'completed' ? null : st.current_node_label
    };
  });
}

/** Students who practised on each day (India time) for the last `days` days. */
export async function activityDays(db, engagementId, days = 365, now = Date.now()) {
  const to = new Date(now + 5.5 * 3600000).toISOString().slice(0, 10);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const pairs = await db.prepare(`
    SELECT DISTINCT el_id, d FROM (
      SELECT ls.engagement_learner_id AS el_id, ${istDay('sm.created_at')} AS d
      FROM session_messages sm JOIN learning_sessions ls ON ls.id = sm.session_id JOIN engagement_learners el ON el.id = ls.engagement_learner_id
      WHERE el.engagement_id = ? AND sm.role = 'learner'
      UNION
      SELECT ls.engagement_learner_id, ${istDay('ls.started_at')}
      FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id WHERE el.engagement_id = ?
    ) x WHERE d BETWEEN ? AND ?`).all(engagementId, engagementId, from, to);
  const enrolled = (await db.prepare("SELECT COUNT(*) AS n FROM engagement_learners WHERE engagement_id = ? AND COALESCE(access_status, 'active') != 'removed'").get(engagementId)).n;
  // Distinct students per day, and per week (weeks start on Monday).
  const weekOf = (d) => { const t = Date.parse(`${d}T00:00:00Z`); const dow = (new Date(t).getUTCDay() + 6) % 7; return new Date(t - dow * 86400000).toISOString().slice(0, 10); };
  const byDay = new Map(); const byWeek = new Map();
  pairs.forEach(({ el_id: el, d }) => {
    if (!byDay.has(d)) byDay.set(d, new Set()); byDay.get(d).add(el);
    const w = weekOf(d); if (!byWeek.has(w)) byWeek.set(w, new Set()); byWeek.get(w).add(el);
  });
  const series = []; const weeks = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    series.push({ date: d, students: byDay.get(d)?.size || 0 });
    const w = weekOf(d);
    if (!weeks.length || weeks[weeks.length - 1].week !== w) weeks.push({ week: w, students: byWeek.get(w)?.size || 0 });
  }
  const unique = new Set(pairs.map(p => p.el_id)).size;
  return { from, to, enrolled: Number(enrolled), unique_active: unique, days_with_practice: byDay.size, series, weeks };
}

// ─── One student's pathway ─────────────────────────────────────────────────────
// Only what this student has actually done: a node is 100% when they
// mastered it, otherwise 0% — "learning now" marks their current node without
// giving it credit. Nothing projected and nothing from other students.
export async function studentPathway(db, engagement, elId) {
  const el = await db.prepare(`SELECT el.id, el.current_node_id, el.overall_status, l.name, l.learner_ref FROM engagement_learners el
    JOIN learners l ON l.id = el.learner_id WHERE el.id = ? AND el.engagement_id = ?`).get(elId, engagement.id);
  if (!el) return null;
  const nodes = await db.prepare(`
    SELECT sn.id, sn.node_label, sc.id AS cluster_id, sc.cluster_label,
      nm.advanced_at, nm.evidence_level, nm.provisional,
      (SELECT COALESCE(SUM(ls.loop_count), 0) FROM learning_sessions ls WHERE ls.engagement_learner_id = ? AND ls.skill_node_id = sn.id) AS loops,
      (SELECT COALESCE(SUM(ls.active_minutes), 0) FROM learning_sessions ls WHERE ls.engagement_learner_id = ? AND ls.skill_node_id = sn.id) AS minutes
    FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    LEFT JOIN node_mastery nm ON nm.skill_node_id = sn.id AND nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL
    WHERE sc.capability_target_id = ? ORDER BY sc.sequence_order, sn.sequence_order`).all(elId, elId, elId, engagement.capability_target_id);
  const clusters = [];
  nodes.forEach(n => {
    let c = clusters.find(x => x.id === n.cluster_id);
    if (!c) { c = { id: n.cluster_id, label: n.cluster_label, nodes: [] }; clusters.push(c); }
    const mastered = !!n.advanced_at;
    const current = !mastered && el.overall_status !== 'completed' && n.id === el.current_node_id;
    c.nodes.push({
      id: n.id, label: n.node_label, pct: mastered ? 100 : 0,
      status: mastered ? 'mastered' : current ? 'learning' : 'not_started',
      mastered_at: iso(n.advanced_at), evidence_level: n.evidence_level || null, provisional: !!n.provisional,
      loops: Number(n.loops) || 0, active_minutes: Math.round(Number(n.minutes) || 0)
    });
  });
  clusters.forEach(c => { c.pct = c.nodes.length ? Math.round((c.nodes.filter(n => n.status === 'mastered').length / c.nodes.length) * 100) : 0; });
  const done = nodes.filter(n => n.advanced_at).length;
  return { student: { el_id: el.id, name: el.name, learner_ref: el.learner_ref }, pct: nodes.length ? Math.round((done / nodes.length) * 100) : 0, mastered: done, total: nodes.length, clusters };
}

// ─── Evidence report ───────────────────────────────────────────────────────────
const monthEnds = (from, toDay) => {
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const to = toDay > today ? today : toDay; // never report the future
  const out = [];
  const end = new Date(`${to}T00:00:00Z`);
  let d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  while (d <= end) {
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const last = new Date(next - 86400000).toISOString().slice(0, 10);
    out.push(last > to ? to : last);
    d = next;
  }
  return out.slice(-12);
};

export async function evidenceReport(db, engagement, { from, to, elIds = null }) {
  const summary = await activitySummary(db, engagement.id, { from, to, elIds });
  const ids = summary.map(s => s.el_id);
  const readiness = await readinessTimeline(db, engagement, ids, monthEnds(from, to));
  const students = await mapSeq(summary, async (s) => {
    const el = await db.prepare('SELECT learner_id FROM engagement_learners WHERE id = ?').get(s.el_id);
    const learner = await db.prepare('SELECT age_status FROM learners WHERE id = ?').get(el.learner_id);
    const pathway = await studentPathway(db, engagement, s.el_id);
    const nodes = pathway.clusters.flatMap(c => c.nodes.map(n => ({ ...n, cluster: c.label })));
    const reviews = await db.prepare(`SELECT nr.node_id, sn.node_label, nr.due_at, nr.last_review_at, nr.reviews_passed, nr.reviews_failed
      FROM node_retention nr JOIN skill_nodes sn ON sn.id = nr.node_id WHERE nr.el_id = ?`).all(s.el_id);
    const nowIso = new Date().toISOString();
    const missed = reviews.filter(r => iso(r.due_at) < nowIso && (!r.last_review_at || iso(r.last_review_at) < iso(r.due_at)))
      .map(r => ({ skill: r.node_label, due_at: iso(r.due_at) }));
    const demos = (await db.prepare(`SELECT d.kind, d.date, d.passed, d.level, sn.node_label FROM demonstrations d JOIN skill_nodes sn ON sn.id = d.node_id
      WHERE d.el_id = ? AND d.kind IN ('practical','dayone') ORDER BY d.date`).all(s.el_id))
      .map(d => ({ kind: d.kind === 'dayone' ? 'Day-One task' : 'Practical', skill: d.node_label, date: iso(d.date), passed: !!d.passed, level: d.level }));
    const consents = await db.prepare('SELECT level, granted_by, scope_json, granted_at, withdrawn_at FROM consents WHERE learner_id = ? AND institution_id = ? ORDER BY granted_at').all(el.learner_id, engagement.institution_id);
    const activeConsent = (lvl) => consents.some(c => c.level === lvl && !c.withdrawn_at);
    const guardian = consents.some(c => c.granted_by === 'guardian' && !c.withdrawn_at);
    const employers = consents.filter(c => c.level === 4).map(c => {
      let scope = {}; try { scope = JSON.parse(c.scope_json || '{}'); } catch { /* ignore */ }
      return { employer: scope.employer_name || scope.employer || scope.employer_id || 'An employer', granted_at: iso(c.granted_at), withdrawn_at: iso(c.withdrawn_at), stage: scope.stage || null };
    });
    const r = readiness.get(s.el_id) || { timeline: [], role: null, match: 0, below_requirements: [] };
    const age = learner?.age_status || 'unknown';
    const parentShare = age === 'minor'
      ? { allowed: guardian, rule: 'Minor: a parent or guardian may see this report when a guardian consent is on file.' }
      : { allowed: activeConsent(2), rule: age === 'adult' ? 'Adult: share with parents only with the student’s consent (level 2, institution profile share).' : 'Age not recorded: treat as an adult and share with parents only with the student’s consent (level 2).' };
    const stuck = nodes.filter(n => n.status !== 'mastered' && n.loops >= LIVE.stuckLoops).map(n => ({ skill: n.label, loops: n.loops }));
    return {
      ...s,
      age_status: age,
      parent_share: parentShare,
      skills_mastered: nodes.filter(n => n.status === 'mastered').map(n => ({ skill: n.label, cluster: n.cluster, mastered_at: n.mastered_at, evidence_level: n.evidence_level, provisional: n.provisional })),
      skills_stuck: stuck,
      skills_not_started: nodes.filter(n => n.status === 'not_started').length,
      current_skill: nodes.find(n => n.status === 'learning')?.label || null,
      missed_reviews: missed,
      practical_results: demos,
      employer_access: employers,
      readiness: r,
      plain_summary: plainSummary(s, r, stuck, missed)
    };
  });
  return { engagement: { id: engagement.id, title: engagement.title }, from, to, generated_at: new Date().toISOString(), students };
}

function plainSummary(s, r, stuck, missed) {
  const parts = [];
  parts.push(`${s.name} practised on ${s.days_active} day${s.days_active === 1 ? '' : 's'} between these dates, for ${s.active_minutes} active minutes in total, and has mastered ${s.nodes_mastered_total} of ${s.total_nodes} skills in the pathway.`);
  if (r.role) {
    parts.push(r.below_requirements.length
      ? `For the role that fits best, ${r.role} (${r.match}% match), these required skills are not yet verified: ${r.below_requirements.join(', ')}.`
      : `All the required skills for ${r.role} are verified (${r.match}% match).`);
  }
  if (stuck.length) parts.push(`Needed repeated attempts on: ${stuck.map(x => x.skill).join(', ')}.`);
  if (missed.length) parts.push(`${missed.length} spaced review${missed.length === 1 ? ' was' : 's were'} missed.`);
  return parts.join(' ');
}
