// core/assist.js — "Ask Qubirex", the command box on every side (v4.3 canvas,
// shared kit 1). A question in English, Telugu or Hindi is answered ONLY from
// the asker's own data:
//   learner     their progress, current skill, reviews due, readiness and gaps
//   staff       the cohorts in their scope: readiness bands, who is nearly
//               ready, what holds students back, who has gone quiet, reviews
//   employer    their company, roles and pipeline
// plus a plain-words glossary. Never session text, never other people's data.
// The model may only link to pages listed in the facts. Without a model the
// common questions are still answered from the same facts.
import * as dal from './db/dal.js';
import { generate, aiNotConfigured } from './ai/gateway.js';
import { cohortReadiness, summarise, BAND_LABEL, BANDS } from './readiness/cohort.js';
import { liveStatus } from './institutionActivity.js';
import { mapSeq } from './util/seq.js';

export const GLOSSARY = {
  A0: 'Authorship A0 — not checked yet.',
  A1: 'Authorship A1 — the learner did it on their own, in their own words.',
  A2: 'Authorship A2 — the learner explained the answer aloud and handled a follow-up question.',
  A3: 'Authorship A3 — done under supervision, watched live.',
  L1: 'Evidence L1 — checked against a rubric.',
  L2: 'Evidence L2 — the learner\'s code was run and worked.',
  L3: 'Evidence L3 — a faculty member reviewed it.',
  L4: 'Evidence L4 — confirmed outside Qubirex, for example by an employer.',
  readiness: `Readiness — how well verified skills match the best-fitting target role, out of 100. Ready from ${BANDS.ready}, Nearly ready from ${BANDS.nearly}, Building below that.`,
  fresh: 'Fresh — shown recently. Ageing — a short review is due soon. Needs refresh — not shown for a long time; re-check before relying on it.',
  bridge: 'Bridge programme — extra work for students who are nearly ready, followed by a re-test that shows whether it worked.',
  passport: 'Capability Passport — the learner\'s signed record of what they proved. Anyone can check it with the Evidence ID; the learner chooses who sees the details.'
};

const LANG = { en: 'English', te: 'Telugu', hi: 'Hindi', english: 'English', telugu: 'Telugu', hindi: 'Hindi' };

async function learnerFacts(req) {
  const el = await dal.one(`SELECT el.id, el.current_node_id, el.overall_status, e.id AS engagement_id, e.title, e.capability_target_id, e.institution_id, sn.node_label AS current_node
    FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id LEFT JOIN skill_nodes sn ON sn.id = el.current_node_id WHERE el.id = ?`, req.user.el_id);
  if (!el) return { facts: {}, links: [] };
  const total = (await dal.one(`SELECT COUNT(*) AS n FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = ?`, el.capability_target_id)).n;
  const mastered = (await dal.one('SELECT COUNT(*) AS n FROM node_mastery WHERE engagement_learner_id = ? AND advanced_at IS NOT NULL', el.id)).n;
  const due = (await dal.one('SELECT COUNT(*) AS n FROM node_retention WHERE el_id = ? AND due_at <= ?', el.id, dal.nowIso())).n;
  const weakest = await dal.one(`SELECT sn.node_label, SUM(ls.loop_count) AS loops FROM learning_sessions ls JOIN skill_nodes sn ON sn.id = ls.skill_node_id
    WHERE ls.engagement_learner_id = ? AND NOT EXISTS (SELECT 1 FROM node_mastery nm WHERE nm.engagement_learner_id = ls.engagement_learner_id AND nm.skill_node_id = ls.skill_node_id AND nm.advanced_at IS NOT NULL)
    GROUP BY sn.node_label ORDER BY loops DESC LIMIT 1`, el.id);
  const me = (await cohortReadiness({ id: el.engagement_id, capability_target_id: el.capability_target_id, institution_id: el.institution_id })).find(r => r.el_id === el.id);
  return {
    facts: {
      programme: el.title, skills_mastered: `${mastered} of ${total}`, current_skill: el.overall_status === 'completed' ? 'programme complete' : el.current_node,
      reviews_due: Number(due), weakest_skill: weakest?.loops > 0 ? weakest.node_label : null,
      readiness: me ? { score: me.readiness, band: BAND_LABEL[me.band], best_role: me.role, skills_missing_for_role: me.below_requirements } : null
    },
    links: [
      { label: 'Continue learning', href: '/learn/session' }, { label: 'Skill path', href: '/learn/record' },
      { label: 'Reviews', href: '/learn/reviews' }, { label: 'My Passport', href: '/learn/passport' },
      { label: 'Jobs & applications', href: '/learn/jobs' }, { label: 'Job market', href: '/learn/market' }, { label: 'Settings', href: '/learn/settings' }
    ]
  };
}

async function staffFacts(req) {
  const institutionId = req.session.institution_id || req.user.id;
  let cohorts = await dal.all(`SELECT e.id, e.title, e.capability_target_id, e.institution_id FROM engagements e WHERE e.institution_id = ? ORDER BY e.created_at DESC LIMIT 6`, institutionId);
  if (req.staff?.role === 'professor') {
    const mine = new Set((await dal.all('SELECT engagement_id FROM staff_cohorts WHERE staff_id = ?', req.staff.id)).map(r => r.engagement_id));
    cohorts = cohorts.filter(c => mine.has(c.id));
  }
  const facts = await mapSeq(cohorts, async (c) => {
    const rows = await cohortReadiness(c);
    const sum = summarise(rows);
    const live = await liveStatus(dal.legacyHandle(), c.id);
    const quiet = live.students.filter(s => s.light === 'red' && !/Stuck/.test(s.reason)).length;
    const hardest = await dal.one(`SELECT sn.node_label FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id
      JOIN skill_nodes sn ON sn.id = ls.skill_node_id WHERE el.engagement_id = ? GROUP BY sn.node_label ORDER BY AVG(ls.loop_count) DESC LIMIT 1`, c.id);
    return {
      cohort: c.title, students: sum.total,
      ready: sum.counts.ready, nearly_ready: sum.counts.nearly, building: sum.counts.building,
      nearly_ready_students: rows.filter(r => r.band === 'nearly').slice(0, 12).map(r => `${r.name} (${r.readiness}${r.below_requirements[0] ? `, needs ${r.below_requirements[0]}` : ''})`),
      skill_holding_most_back: sum.top_gap?.skill || hardest?.node_label || null,
      gone_quiet_3_days: quiet, learning_now: live.counts.green,
      link_to_cohort: `/institution/cohorts/${c.id}`
    };
  });
  const reviews = (await dal.one("SELECT COUNT(*) AS n FROM review_queue WHERE institution_id = ? AND status = 'open'", institutionId)).n;
  return {
    facts: { cohorts: facts, faculty_reviews_waiting: Number(reviews), your_role: req.staff?.role || 'admin' },
    links: [
      ...cohorts.map(c => ({ label: c.title, href: `/institution/cohorts/${c.id}` })),
      { label: 'Students & access', href: '/institution/students' }, { label: 'Faculty review', href: '/institution/review' },
      { label: 'Bridge programmes', href: '/institution/bridges' }, { label: 'Placements', href: '/institution/placements' }
    ]
  };
}

async function employerFacts(req) {
  const employerId = req.session.employer_id;
  const company = await dal.one('SELECT name, kyb_status, city FROM employers WHERE id = ?', employerId);
  const hasRoles = await dal.tableExists('employer_roles');
  const roles = hasRoles ? await dal.all("SELECT id, title FROM employer_roles WHERE employer_id = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 6", employerId) : [];
  const waiting = hasRoles ? Number((await dal.one("SELECT COUNT(*) AS n FROM employer_pipeline WHERE employer_id = ? AND stage IN ('access_granted','applied')", employerId))?.n || 0) : 0;
  return {
    facts: { company: company?.name, verification: company?.kyb_status, open_roles: roles.map(r => r.title), waiting_for_your_decision: waiting },
    links: [{ label: 'Roles', href: '/employer/roles' }, { label: 'Colleges & insights', href: '/employer/colleges' }, { label: 'Pipeline', href: '/employer/pipeline' }, { label: 'Verify in bulk', href: '/employer/verify-bulk' }]
  };
}

export async function contextFor(req) {
  const t = req.session?.actor_type;
  if (t === 'learner') return learnerFacts(req);
  if (t === 'staff') return staffFacts(req);
  if (t === 'employer') return employerFacts(req);
  return { facts: {}, links: [] };
}

// Answers for the common questions straight from the facts (no model needed).
function quickAnswer(q, facts, links) {
  const s = q.toLowerCase();
  const term = Object.keys(GLOSSARY).find(k => new RegExp(`\\b${k.toLowerCase()}\\b`).test(s));
  if (term && /mean|what is|explain|అంటే|मतलब|क्या/.test(s)) return { answer: GLOSSARY[term], links: [] };
  if (facts.cohorts) {
    if (/nearly ready|ready/.test(s)) {
      const lines = facts.cohorts.map(c => `${c.cohort}: ${c.nearly_ready} nearly ready${c.nearly_ready_students.length ? ` — ${c.nearly_ready_students.slice(0, 5).join(', ')}` : ''}.`);
      return { answer: lines.join(' ') || 'No cohorts yet.', links: links.slice(0, 2) };
    }
    if (/hold|back|stuck|hardest/.test(s)) return { answer: facts.cohorts.map(c => `${c.cohort}: ${c.skill_holding_most_back || 'not enough data yet'}.`).join(' '), links: links.slice(0, 2) };
    if (/quiet|inactive/.test(s)) return { answer: facts.cohorts.map(c => `${c.cohort}: ${c.gone_quiet_3_days} have not been active for 3 days.`).join(' '), links: links.slice(0, 2) };
    if (/pin/.test(s)) return { answer: 'Open Students & access, select the student, then Reset PIN. You can print a one-time PIN slip or send a new invite link.', links: [{ label: 'Students & access', href: '/institution/students' }] };
    if (/bridge/.test(s)) return { answer: 'Open Bridge programmes, choose the cohort or students and the skills to strengthen, and set a date for the re-test. Qubirex shows afterwards whether it worked.', links: [{ label: 'Bridge programmes', href: '/institution/bridges' }] };
  }
  if (facts.skills_mastered) {
    if (/next|start|today|weak/.test(s)) return { answer: `You have mastered ${facts.skills_mastered} skills. Next: ${facts.current_skill || 'your next skill'}.${facts.weakest_skill ? ` The skill to strengthen first is ${facts.weakest_skill}.` : ''}${facts.reviews_due ? ` ${facts.reviews_due} short reviews are due.` : ''}`, links: links.slice(0, 3) };
    if (/ready|job|role/.test(s) && facts.readiness) return { answer: `Your readiness is ${facts.readiness.score} (${facts.readiness.band}) for ${facts.readiness.best_role || 'your target roles'}.${facts.readiness.skills_missing_for_role?.length ? ` Still to prove: ${facts.readiness.skills_missing_for_role.join(', ')}.` : ''}`, links: [links[0], links[4]] };
  }
  return null;
}

/**
 * @returns {Promise<{answer: string, links: {label: string, href: string}[], source: 'model'|'facts'}>}
 */
export async function ask(req, { question, lang = 'en' }) {
  const q = String(question || '').trim().slice(0, 500);
  const { facts, links } = await contextFor(req);
  const language = LANG[lang] || 'English';
  const allowed = new Map(links.map(l => [l.href, l]));
  try {
    const r = await generate({
      task: 'ASSIST.ask', thinking: false, maxTokens: 1500, temperature: 0.2, institutionId: req.session?.institution_id || null,
      schema: { required: ['answer'] },
      system: `You are Ask Qubirex, the help box inside the Qubirex app. Answer in ${language}, in two to four short, plain sentences.
Use ONLY the facts below and the glossary. If the facts do not answer the question, say so plainly and suggest where to look. Never invent names, numbers or people.
Plain words: no jargon. Groups smaller than 5 people: say "too few to show" instead of naming them, except a staff member's own students.
Links: you may include up to 2, chosen ONLY from this list (copy href exactly): ${JSON.stringify(links)}
Respond ONLY with JSON: {"answer": "...", "links": [{"label": "...", "href": "..."}]}

FACTS: ${JSON.stringify(facts)}
GLOSSARY: ${JSON.stringify(GLOSSARY)}`,
      input: q
    });
    const out = (r.json.links || []).filter(l => allowed.has(l?.href)).slice(0, 2).map(l => allowed.get(l.href));
    return { answer: String(r.json.answer || '').trim(), links: out, source: 'model' };
  } catch (err) {
    const quick = quickAnswer(q, facts, links);
    if (quick) return { ...quick, source: 'facts' };
    if (aiNotConfigured(err)) return { answer: 'Ask Qubirex needs the AI model, which is not set up on this deployment yet. Try Help for common questions.', links: [], source: 'facts' };
    throw err;
  }
}
