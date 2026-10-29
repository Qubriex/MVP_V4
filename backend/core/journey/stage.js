// core/journey/stage.js — where a learner is on the journey, from their own
// data (never from a seed label), and the one next step that follows.
// Home's "Start here" and "Today", the college's Students and Cohort pages and
// /dev all read it.
//
//   S0 invited (never signed in)   S1 first day          S2 starting check done
//   S3 learning                     S4 last check not passed yet
//   S5 skill group just finished    S6 nearly ready       S7 ready
//   S8 employer request waiting     S9 Day-One assigned   S10 applying / offer
//   S11 hired                       S12 going stale (skills ageing, renewal due)
// The first rule that holds wins, most urgent first.
import * as dal from '../db/dal.js';
import { activeCredential, skillFacts, skillLines } from '../return/credentialEngine.js';
import { STAGE_NAMES } from './accounts.js';
import { nowIsoFor } from '../requestContext.js';

const OPEN_APPLY = ['applied', 'shortlisted', 'interview', 'offer'];

/** The facts the stage is decided from (a handful of small queries). */
export async function journeyFacts(elId) {
  const el = await dal.one(`SELECT el.id, el.learner_id, el.current_node_id, el.last_login_at, el.engagement_id, e.capability_target_id, l.pin_hash IS NOT NULL AS has_pin,
      EXISTS (SELECT 1 FROM learner_profiles lp WHERE lp.learner_id = l.id) AS has_profile
    FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id JOIN learners l ON l.id = el.learner_id WHERE el.id = ?`, elId);
  if (!el) return null;
  const [baseline, mastered, total, lastCheck, lastMastered, pipes, placement, dayone, sessions] = await Promise.all([
    dal.one('SELECT status, placement_json FROM baseline_runs WHERE el_id = ? ORDER BY started_at DESC LIMIT 1', elId),
    dal.one('SELECT COUNT(*) AS n FROM node_mastery WHERE engagement_learner_id = ? AND advanced_at IS NOT NULL', elId),
    dal.one('SELECT COUNT(*) AS n FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = ?', el.capability_target_id),
    dal.one(`SELECT mc.skill_node_id, mc.passed, sn.node_label FROM mastery_checks mc JOIN skill_nodes sn ON sn.id = mc.skill_node_id
      WHERE mc.engagement_learner_id = ? AND mc.passed IS NOT NULL ORDER BY mc.evaluated_at DESC, mc.created_at DESC LIMIT 1`, elId),
    dal.one(`SELECT nm.skill_node_id, sn.cluster_id, sc.cluster_label,
        (SELECT COUNT(*) FROM skill_nodes x WHERE x.cluster_id = sn.cluster_id) AS in_group,
        (SELECT COUNT(*) FROM node_mastery y JOIN skill_nodes z ON z.id = y.skill_node_id WHERE y.engagement_learner_id = nm.engagement_learner_id AND y.advanced_at IS NOT NULL AND z.cluster_id = sn.cluster_id) AS done_in_group
      FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id JOIN skill_clusters sc ON sc.id = sn.cluster_id
      WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL ORDER BY nm.advanced_at DESC LIMIT 1`, elId),
    dal.all('SELECT id, stage FROM employer_pipeline WHERE el_id = ?', elId),
    dal.one("SELECT status FROM placements WHERE el_id = ? AND status = 'placed' LIMIT 1", elId),
    dal.one("SELECT id, status FROM dayone_runs WHERE el_id = ? AND status != 'scored' ORDER BY created_at DESC LIMIT 1", elId),
    dal.one('SELECT COUNT(*) AS n FROM learning_sessions WHERE engagement_learner_id = ?', elId)
  ]);
  const failedOpen = !!lastCheck && !lastCheck.passed && !(await dal.one('SELECT 1 FROM node_mastery WHERE engagement_learner_id = ? AND skill_node_id = ? AND advanced_at IS NOT NULL', elId, lastCheck.skill_node_id));
  const cred = await activeCredential('el_id = ?', elId);
  let minFreshness = null;
  if (cred) {
    const lines = await skillLines(elId, await skillFacts(elId), nowIsoFor());
    minFreshness = lines.length ? Math.min(...lines.map(s => s.freshness)) : null;
  }
  return {
    signed_in: !!el.has_pin && !!el.last_login_at, has_profile: !!el.has_profile,
    baseline: baseline?.status || null,
    mastered: Number(mastered.n), total: Number(total.n), sessions: Number(sessions.n),
    failed_check: failedOpen ? { node_id: lastCheck.skill_node_id, label: lastCheck.node_label } : null,
    group_done: lastMastered && Number(lastMastered.done_in_group) === Number(lastMastered.in_group) ? { label: lastMastered.cluster_label } : null,
    requested: pipes.filter(p => p.stage === 'requested').map(p => p.id),
    applying: pipes.filter(p => OPEN_APPLY.includes(p.stage)).map(p => ({ id: p.id, stage: p.stage })),
    dayone: dayone ? { id: dayone.id, status: dayone.status } : pipes.some(p => p.stage === 'dayone') ? { id: null, status: 'invited' } : null,
    hired: !!placement || pipes.some(p => p.stage === 'hired'),
    passport: !!cred, renewal_due: cred ? cred.valid_until <= new Date(Date.parse(nowIsoFor()) + 60 * 86400000).toISOString() : false,
    min_freshness: minFreshness
  };
}

/** The stage code (S0 … S12) from the facts. */
export function stageOf(f) {
  if (!f) return null;
  if (f.hired) return 'S11';
  if (f.applying.length) return 'S10';
  if (f.dayone) return 'S9';
  if (f.requested.length) return 'S8';
  if (f.failed_check) return 'S4';
  if (f.passport && ((f.min_freshness != null && f.min_freshness < 0.85) || f.renewal_due)) return 'S12';
  if (f.total && f.mastered >= f.total) return 'S7';
  if (f.total && f.mastered / f.total >= 0.6) return 'S6';
  if (f.group_done) return 'S5';
  if (f.mastered > 0) return 'S3';
  if (f.baseline || f.sessions > 0) return 'S2';
  if (f.signed_in || f.has_profile) return 'S1';
  return 'S0';
}

// The one next step for each stage: where "Start here" points.
const NEXT = {
  S0: { key: 'set_pin', href: '/learner-login' },
  S1: { key: 'welcome_then_baseline', href: '/learn/welcome' },
  S2: { key: 'first_lesson', href: '/learn/session' },
  S3: { key: 'continue_lesson', href: '/learn/session' },
  S4: { key: 'retry_check', href: '/learn/session' },
  S5: { key: 'see_certificate', href: '/learn/record' },
  S6: { key: 'close_gap', href: '/learn/readiness' },
  S7: { key: 'share_passport', href: '/learn/passport' },
  S8: { key: 'answer_request', href: '/learn/jobs' },
  S9: { key: 'dayone', href: '/learn/dayone' },
  S10: { key: 'application', href: '/learn/jobs' },
  S11: { key: 'keep_fresh', href: '/learn/passport' },
  S12: { key: 'renew', href: '/learn/reviews' }
};

/** { stage, stage_name, next: { key, href, id? }, facts } for an enrolment. */
export async function journeyStage(elId) {
  const facts = await journeyFacts(elId);
  const stage = stageOf(facts);
  if (!stage) return null;
  const next = { ...NEXT[stage] };
  if (stage === 'S1' && facts.has_profile) Object.assign(next, { key: 'baseline', href: '/learn/baseline' });
  if (stage === 'S8') next.href = `/learn/requests/${facts.requested[0]}`;
  if (stage === 'S4') next.label = facts.failed_check.label;
  return { stage, stage_name: STAGE_NAMES[stage], next, facts };
}
