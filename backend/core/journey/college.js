// core/journey/college.js — the journey as the college sees it.
//   collegeStages     each student's journey stage for Students and Cohort.
//                     Hiring stages (an employer request, Day-One, applying)
//                     are the learner's own business until they are hired, so
//                     the college sees them as Ready (S7).
//   stuckAtCheck      students whose last check on a skill has not passed, and
//                     how many tries it has taken.
//   helpRequests      "Ask my professor" requests, and the professor's reply.
import * as dal from '../db/dal.js';
import { journeyFacts, stageOf } from './stage.js';
import { STAGE_NAMES } from './accounts.js';
import { notify } from '../notify.js';
import { mapSeq } from '../util/seq.js';

const PRIVATE_TO_LEARNER = new Set(['S8', 'S9', 'S10']);
const err = (status, message) => Object.assign(new Error(message), { status });

/** Stage per enrolment id, at most `limit` students (the rest come back without a stage). */
export async function collegeStages(elIds, { limit = 200 } = {}) {
  const out = new Map();
  await mapSeq(elIds.slice(0, limit), async (id) => {
    const s = stageOf(await journeyFacts(id));
    const stage = PRIVATE_TO_LEARNER.has(s) ? 'S7' : s;
    out.set(id, { stage, stage_name: STAGE_NAMES[stage] || null });
  });
  return out;
}

/**
 * Students whose latest check on a skill did not pass and who have not
 * mastered it since. `scope` is a SQL fragment on el.engagement_id (from
 * scopeClause) so professors see only their cohorts.
 */
export async function stuckAtCheck(institutionId, scope, { engagementId = null } = {}) {
  const rows = await dal.all(`
    SELECT mc.engagement_learner_id AS el_id, mc.skill_node_id AS node_id, sn.node_label, l.name, l.learner_ref, e.id AS engagement_id, e.title AS cohort_title,
      COUNT(*) FILTER (WHERE mc.passed = 0) AS failed_tries, MAX(mc.evaluated_at) AS last_try,
      EXISTS (SELECT 1 FROM check_help_requests h WHERE h.el_id = mc.engagement_learner_id AND h.node_id = mc.skill_node_id AND h.status = 'open') AS asked_for_help
    FROM mastery_checks mc
    JOIN engagement_learners el ON el.id = mc.engagement_learner_id
    JOIN engagements e ON e.id = el.engagement_id
    JOIN learners l ON l.id = el.learner_id
    JOIN skill_nodes sn ON sn.id = mc.skill_node_id
    WHERE e.institution_id = ? ${scope.sql} ${engagementId ? 'AND e.id = ?' : ''}
      AND mc.passed IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM node_mastery nm WHERE nm.engagement_learner_id = mc.engagement_learner_id AND nm.skill_node_id = mc.skill_node_id AND nm.advanced_at IS NOT NULL)
    GROUP BY mc.engagement_learner_id, mc.skill_node_id, sn.node_label, l.name, l.learner_ref, e.id, e.title
    HAVING COUNT(*) FILTER (WHERE mc.passed = 0) > 0
    ORDER BY failed_tries DESC, last_try DESC LIMIT 200`,
  institutionId, ...scope.params, ...(engagementId ? [engagementId] : []));
  return rows.map(r => ({ ...r, failed_tries: Number(r.failed_tries), asked_for_help: !!r.asked_for_help }));
}

export async function helpRequests(institutionId, scope, { status = 'open' } = {}) {
  const rows = await dal.all(`
    SELECT h.id, h.el_id, h.node_id, h.message, h.status, h.reply, h.created_at, h.answered_at, sn.node_label, l.name, l.learner_ref, e.title AS cohort_title, e.id AS engagement_id,
      (SELECT COUNT(*) FROM mastery_checks mc WHERE mc.engagement_learner_id = h.el_id AND mc.skill_node_id = h.node_id AND mc.passed = 0) AS failed_tries
    FROM check_help_requests h
    JOIN engagement_learners el ON el.id = h.el_id
    JOIN engagements e ON e.id = el.engagement_id
    JOIN learners l ON l.id = el.learner_id
    JOIN skill_nodes sn ON sn.id = h.node_id
    WHERE h.institution_id = ? ${scope.sql} AND h.status = ?
    ORDER BY h.created_at ${status === 'open' ? 'ASC' : 'DESC'} LIMIT 200`, institutionId, ...scope.params, status === 'answered' ? 'answered' : 'open');
  return rows.map(r => ({ ...r, failed_tries: Number(r.failed_tries) }));
}

/** The professor answers; the learner gets a notification that links to the skill. */
export async function answerHelp(institutionId, scope, id, { reply, staffId }) {
  const text = String(reply || '').trim().slice(0, 2000);
  if (!text) throw err(400, 'Write a reply first.');
  const h = await dal.one(`SELECT h.id, h.node_id, el.learner_id, sn.node_label FROM check_help_requests h
    JOIN engagement_learners el ON el.id = h.el_id JOIN skill_nodes sn ON sn.id = h.node_id
    WHERE h.id = ? AND h.institution_id = ? ${scope.sql}`, id, institutionId, ...scope.params);
  if (!h) throw err(404, 'Not found');
  await dal.run("UPDATE check_help_requests SET status = 'answered', reply = ?, replied_by = ?, answered_at = ? WHERE id = ?", text, staffId || null, dal.nowIso(), id);
  await notify({ to: { type: 'learner', id: h.learner_id }, kind: 'help_answered', title: `Your professor answered about ${h.node_label}`, body: text.slice(0, 300), href: `/learn/skill/${h.node_id}` });
  return { ok: true };
}
