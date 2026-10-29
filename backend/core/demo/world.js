// core/demo/world.js — builds one demo sandbox: a small sample college that
// belongs to a single /demo visitor (api/routes/demo.js).
//
//   1 college (placement head + professor), 2 cohorts (Telugu, Hindi),
//   12 students with recent history, 3 employers (2 verified), 6 open roles,
//   a faculty review queue, and Lakshmi's Capability Passport — signed with
//   the separate demo key (core/return/signing.js), never the real one.
//
// Every id contains the sandbox id, every row is in that sandbox's world
// (institutions/employers: is_demo = 1, sandbox_id), and dates are relative
// to now, so history always looks recent. Rows are inserted in batches inside
// one transaction: about 40 statements, well under the 2-second budget.
// Nothing here has a password or PIN: demo people are reached only through
// a demo session from POST /api/demo/start or /switch.
import crypto from 'crypto';
import * as dal from '../db/dal.js';
import { resolveSkill } from '../graph/resolveSkill.js';
import { LEVELS } from '../consent/levels.js';

export const PERSONAS = {
  lakshmi: { actor: 'learner', key: 'l01', home: '/learn/dashboard' },
  arjun: { actor: 'learner', key: 'l02', home: '/learn/welcome' },
  placement: { actor: 'staff', key: 'admin', home: '/institution/home' },
  professor: { actor: 'staff', key: 'prof', home: '/institution/home' },
  recruiter: { actor: 'employer', key: 'e1', home: '/employer/home' },
  verifier: { actor: null, home: '/verify' }
};

// Clusters and nodes of the sample programme.
const PROGRAMME = [
  ['Web Basics', ['HTML semantics', 'CSS box model', 'CSS flexbox', 'Responsive design', 'Git basics']],
  ['JavaScript Core', ['Variables and types', 'Functions and scope', 'Array methods', 'DOM events', 'Async and fetch']],
  ['Frontend Foundations', ['React components', 'React state and props', 'Hooks', 'Forms in React', 'Calling APIs']],
  ['Backend and Data', ['Node.js basics', 'Express routes', 'REST design', 'SQL queries', 'Joins']]
];
const NODE_COUNT = PROGRAMME.reduce((n, [, nodes]) => n + nodes.length, 0);

// [key, name, cohort (te|hi), nodes mastered, discoverable, city]
const STUDENTS = [
  ['l01', 'Lakshmi Prasanna', 'te', 13, true, 'Hyderabad'],
  ['l02', 'Arjun Verma', 'hi', 0, false, 'Hyderabad'],
  ['l03', 'Kavya Nair', 'te', 15, true, 'Hyderabad'],
  ['l04', 'Rahul Reddy', 'te', 9, true, 'Warangal'],
  ['l05', 'Sana Fatima', 'te', 11, true, 'Hyderabad'],
  ['l06', 'Vamsi Krishna', 'te', 6, false, 'Vijayawada'],
  ['l07', 'Divya Teja', 'te', 3, false, 'Hyderabad'],
  ['l08', 'Pooja Sharma', 'hi', 12, true, 'Hyderabad'],
  ['l09', 'Imran Khan', 'hi', 7, true, 'Hyderabad'],
  ['l10', 'Neha Gupta', 'hi', 4, false, 'Hyderabad'],
  ['l11', 'Suresh Babu', 'te', 16, true, 'Hyderabad'],
  ['l12', 'Ananya Rao', 'te', 1, false, 'Visakhapatnam']
];

// [key, name, kyb, domain]
const EMPLOYERS = [
  ['e1', 'Sample Tech Pvt Ltd', 'verified', 'sampletech.demo'],
  ['e2', 'Bright Analytics (sample)', 'verified', 'brightanalytics.demo'],
  ['e3', 'Nova Retail (sample)', 'pending', 'novaretail.demo']
];
// [employer, title, city, skills [key, required], bar]
const ROLES = [
  ['e1', 'Frontend developer (React)', 'Hyderabad', [['html_css', 1], ['javascript', 1], ['react', 1], ['git', 0]], 70],
  ['e1', 'Full-stack trainee', 'Hyderabad', [['javascript', 1], ['node', 1], ['sql', 1], ['rest', 0]], 65],
  ['e2', 'Junior data analyst', 'Hyderabad', [['sql', 1], ['excel', 1], ['statistics', 0], ['python', 0]], 60],
  ['e2', 'Web developer', 'Bengaluru', [['html_css', 1], ['javascript', 1], ['a11y', 0]], 60],
  ['e3', 'Support engineer', 'Hyderabad', [['linux', 1], ['networking', 0], ['sql', 0]], 55],
  ['e3', 'QA trainee', 'Hyderabad', [['testing', 1], ['javascript', 0]], 55]
];

export const SAMPLE_JD = `Frontend developer (React) — Sample Tech Pvt Ltd, Hyderabad
We are hiring freshers to build customer dashboards.
Must know: HTML and CSS, JavaScript, React.
Good to have: Git, REST APIs, accessibility.`;

const DAY = 86400000;
const sqlTs = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString().replace('T', ' ').slice(0, 19);
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** A new sandbox id: 10 lowercase letters and digits. */
export const newSandboxId = () => {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(10), b => abc[b % abc.length]).join('');
};

/** The ids of a sandbox's people, for sessions and switching. */
export function idsFor(sbx) {
  const p = `dm${sbx}`;
  return {
    institution: `${p}-inst`, ct: `${p}-ct`, engTe: `${p}-eng-te`, engHi: `${p}-eng-hi`,
    staff: (k) => `${p}-staff-${k}`, learner: (k) => `${p}-${k}`, el: (k) => `${p}-el-${k}`,
    employer: (k) => `${p}-${k}`, employerUser: (k) => `${p}-${k}-u1`, node: (c, n) => `${p}-n${c}-${n}`, cluster: (c) => `${p}-c${c}`
  };
}

// Batched INSERT: one statement per table (chunked to stay under 65 535 parameters).
async function insert(table, cols, rows) {
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const one = `(${cols.map(() => '?').join(', ')})`;
    await dal.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${chunk.map(() => one).join(', ')}`, ...chunk.flat());
  }
}

// Node label → skill ids, resolved once per process (the same Capability Graph
// lookup as mapPathway, without its per-node queries on every sandbox).
let skillMapCache = null;
async function skillMap() {
  if (skillMapCache) return skillMapCache;
  const m = new Map();
  for (const [, nodes] of PROGRAMME) {
    for (const label of nodes) {
      const r = await resolveSkill(label, { source: 'node', queue: false });
      if (r.skill) m.set(label, r.skill.skill_id);
    }
  }
  skillMapCache = m;
  return m;
}

/**
 * Create the sandbox's world. Call inside dal.tx.
 * @returns {{ ids: ReturnType<typeof idsFor> }}
 */
export async function buildWorld(sbx) {
  const ids = idsFor(sbx);
  const now = iso(0);
  const mapped = await skillMap();

  // ── College, staff, programme ──────────────────────────────────────────────
  await insert('institutions', ['id', 'name', 'type', 'contact_name', 'contact_email', 'city', 'password_hash', 'is_demo', 'sandbox_id', 'mou_target_pct', 'mou_target_label', 'mou_target_date'],
    [[ids.institution, 'Sample Engineering College (demo)', 'engineering_college', 'Sunita Reddy', `placement.${sbx}@demo.invalid`, 'Hyderabad', '!demo', 1, sbx, 60, '60% placed by June', iso(-200).slice(0, 10)]]);
  await insert('institution_users', ['id', 'institution_id', 'email', 'password_hash', 'role', 'status', 'name', 'title', 'department', 'profile_completed', 'teaching_languages', 'subjects', 'target_roles'], [
    [ids.staff('admin'), ids.institution, `placement.${sbx}@demo.invalid`, '!demo', 'admin', 'active', 'Sunita Reddy', 'Ms.', 'Training & Placement', 1, null, null, null],
    [ids.staff('prof'), ids.institution, `professor.${sbx}@demo.invalid`, '!demo', 'professor', 'active', 'Ravi Kumar', 'Dr.', 'Computer Science & Engineering', 1,
      '["english","telugu","hindi"]', '["Web Technologies (CS501)"]', '["Frontend developer","Full-stack developer"]']
  ]);
  await insert('capability_targets', ['id', 'institution_id', 'version', 'title', 'path', 'domain', 'raw_input', 'confirmed', 'confirmed_at', 'time_window_weeks', 'cohort_size', 'status'],
    [[ids.ct, ids.institution, '1.0', 'Full-Stack Developer Programme', 'A', 'software', 'Sample programme for the demo', 1, sqlTs(40), 16, 12, 'active']]);
  const nodeList = [];
  const clusters = []; const nodes = [];
  PROGRAMME.forEach(([label, ns], ci) => {
    clusters.push([ids.cluster(ci + 1), ids.ct, label, `C${ci + 1}`, ci + 1, ns.length * 0.5]);
    ns.forEach((n, ni) => {
      const id = ids.node(ci + 1, ni + 1);
      nodes.push([id, ids.cluster(ci + 1), n, ni + 1, Math.min(ci + 1, 5), 20]);
      nodeList.push({ id, label: n, cluster: ids.cluster(ci + 1) });
    });
  });
  await insert('skill_clusters', ['id', 'capability_target_id', 'cluster_label', 'cluster_ref', 'sequence_order', 'estimated_hours'], clusters);
  await insert('skill_nodes', ['id', 'cluster_id', 'node_label', 'sequence_order', 'difficulty_level', 'estimated_minutes'], nodes);
  const perSkill = new Map();
  nodeList.forEach(n => { const s = mapped.get(n.label); if (s) perSkill.set(s, (perSkill.get(s) || 0) + 1); });
  await insert('node_skill_map', ['node_id', 'skill_id', 'weight', 'source', 'confidence', 'created_at'],
    nodeList.filter(n => mapped.get(n.label)).map(n => [n.id, mapped.get(n.label), 1 / perSkill.get(mapped.get(n.label)), 'resolve', 0.9, now]));

  await insert('engagements', ['id', 'institution_id', 'capability_target_id', 'title', 'language', 'status', 'started_at', 'join_code'], [
    [ids.engTe, ids.institution, ids.ct, 'CSE 2026 — Batch A', 'telugu', 'active', sqlTs(40), `QX-DEMO-${sbx.toUpperCase()}-A`],
    [ids.engHi, ids.institution, ids.ct, 'CSE 2026 — Batch B (Hindi)', 'hindi', 'active', sqlTs(7), `QX-DEMO-${sbx.toUpperCase()}-B`]
  ]);
  await insert('staff_cohorts', ['staff_id', 'engagement_id', 'cohort_role'], [[ids.staff('prof'), ids.engTe, 'lead'], [ids.staff('prof'), ids.engHi, 'lead']]);

  // ── Students and their history ─────────────────────────────────────────────
  const learners = []; const els = []; const mastery = []; const sessions = []; const checks = [];
  const consents = []; const profiles = []; const streaks = [];
  STUDENTS.forEach(([k, name, co, mastered, disc, city], si) => {
    const lid = ids.learner(k); const el = ids.el(k);
    const cur = nodeList[Math.min(mastered, NODE_COUNT - 1)];
    learners.push([lid, ids.institution, name, k.toUpperCase().replace('L', 'DEMO-L'), co === 'hi' ? 'hindi' : 'telugu', 'college_student', disc ? 1 : 0, disc ? city : null, 'adult', 0]);
    els.push([el, co === 'hi' ? ids.engHi : ids.engTe, lid, cur.id, cur.cluster, sqlTs(Math.max(0, si % 4)), 'active', 'slip']);
    nodeList.slice(0, mastered).forEach((n, j) => {
      const days = Math.max(1, 30 - j * 2 + (si % 3));
      const score = 0.78 + ((j + si) % 4) * 0.05;
      mastery.push([`${el}-nm${j}`, el, n.id, score, 1 + ((j + si) % 3), 18 + ((j * 7 + si) % 25), sqlTs(days), 0.6, 'L1', (j + si) % 3]);
      sessions.push([`${el}-ls${j}`, el, n.id, co === 'hi' ? 'hindi' : 'telugu', 'completed', sqlTs(days), sqlTs(days), (j + si) % 3, 14 + ((j + si) % 9)]);
      checks.push([`${el}-mc${j}`, `${el}-ls${j}`, n.id, el, 1, 'Sample check', 1, score, sqlTs(days), sqlTs(days)]);
    });
    if (disc) consents.push([`${lid}-cs3`, lid, ids.institution, LEVELS.DISCOVERABLE, 'Let verified employers find me by my verified skills, without my name until I say yes', 'discoverable-v1', 'learner', null, iso(10)]);
    if (k !== 'l02') profiles.push([lid, city, co === 'hi' ? 'hindi' : 'telugu', k === 'l01' ? 'Aspiring frontend developer' : null, 1, '2026']);
    if (mastered) streaks.push([`${el}-st`, el, 1 + (si % 6), 4 + (si % 9), mastered, iso(1).slice(0, 10)]);
  });
  await insert('learners', ['id', 'institution_id', 'name', 'learner_ref', 'language', 'profile_type', 'is_discoverable', 'city', 'age_status', 'pin_must_change'], learners);
  await insert('engagement_learners', ['id', 'engagement_id', 'learner_id', 'current_node_id', 'current_cluster_id', 'last_login_at', 'access_status', 'delivery'], els);
  await insert('node_mastery', ['id', 'engagement_learner_id', 'skill_node_id', 'mastery_attainment', 'attempt_count', 'time_to_mastery_minutes', 'advanced_at', 'theta', 'evidence_level', 'loops'], mastery);
  await insert('learning_sessions', ['id', 'engagement_learner_id', 'skill_node_id', 'language', 'status', 'started_at', 'completed_at', 'loop_count', 'active_minutes'], sessions);
  await insert('mastery_checks', ['id', 'session_id', 'skill_node_id', 'engagement_learner_id', 'check_number', 'question_text', 'passed', 'score', 'evaluated_at', 'created_at'], checks);
  await insert('consents', ['id', 'learner_id', 'institution_id', 'level', 'purpose', 'text_version', 'granted_by', 'scope_json', 'granted_at'], consents);
  await insert('learner_profiles', ['learner_id', 'city', 'ui_language', 'headline', 'share_with_institution', 'graduation_year'], profiles);
  await insert('streaks', ['id', 'engagement_learner_id', 'current_streak', 'longest_streak', 'total_session_days', 'last_session_date'], streaks);

  // Lakshmi's evidence: the check she passed per mastered node (typed answer →
  // A1), its mastery demonstration, an earlier review for the older nodes,
  // and two reviews due now. This is what her Passport signs.
  const lk = ids.el('l01'); const lkLearner = ids.learner('l01');
  const fis = []; const evs = []; const provs = []; const demos = []; const ret = [];
  nodeList.slice(0, STUDENTS[0][3]).forEach((n, j) => {
    const days = Math.max(1, 30 - j * 2);
    const at = iso(days); const score = 0.78 + (j % 4) * 0.05;
    fis.push([`${lk}-fi${j}`, lk, lkLearner, n.id, `gen:${n.id}`, 'check', 1, 'seed', '{}', `In your own words: how would you use ${n.label} in a small project?`, 'template', at]);
    evs.push([`${lk}-ev${j}`, lk, n.id, `gen:${n.id}`, `${lk}-fi${j}`, 'check', sha(`${lk}-ev${j}`), score, 1, 'L1', 'A1', 1, 0, 0.6, at]);
    provs.push([`${lk}-ev${j}`, 'typed', 240, 0, 0, 0, 0.1]);
    demos.push([`${lk}-dm${j}`, lk, n.id, 'mastery', at, 1, score, 'L1', 'A1', `${lk}-ev${j}`, at]);
    if (days >= 10) demos.push([`${lk}-dr${j}`, lk, n.id, 'review', iso(days - 4), 1, Math.min(0.95, score + 0.04), 'L1', 'A1', null, iso(days - 4)]);
    ret.push([lk, n.id, days >= 10 ? 7.5 : 3, iso(j < 2 ? 1 : -(j + 2)), days >= 10 ? at : null, days >= 10 ? 'pass' : null, days >= 10 ? 1 : 0, 0, at]);
  });
  // Two answers waiting in the professor's faculty review queue.
  const rq = [['l03', 3, 'borderline', 'decision', 'I would use flexbox with flex-wrap so the cards go onto new lines. On a phone each card is full width and on a laptop they sit three in a row.'],
    ['l05', 3, 'random', 'calibration', 'CSS grid with repeat(auto-fill, minmax(220px, 1fr)) wraps the cards by itself, so no media query is needed.']];
  const answers = [];
  const queue = [];
  rq.forEach(([k, ni, reason, stratum, answer]) => {
    const el = ids.el(k); const n = nodeList[ni]; const at = iso(0.1);
    fis.push([`${el}-fiq`, el, ids.learner(k), n.id, `gen:${n.id}`, 'check', 2, 'seed', '{}', 'A shop page shows 12 product cards. How would you lay them out so they wrap on a phone and a laptop?', 'template', at]);
    evs.push([`${el}-evq`, el, n.id, `gen:${n.id}`, `${el}-fiq`, 'check', sha(answer), reason === 'borderline' ? 0.64 : 0.82, 1, 'L1', 'A1', 1, reason === 'borderline' ? 1 : 0, 0.6, at]);
    answers.push([`${el}-evq`, answer, at]);
    queue.push([`${el}-rq`, `${el}-evq`, el, n.id, ids.institution, ids.engTe, stratum, reason, reason === 'borderline' ? 4 : 5, 'open', at]);
  });
  await insert('family_instances', ['id', 'el_id', 'learner_id', 'node_id', 'family_id', 'purpose', 'attempt_no', 'seed', 'params_json', 'question_text', 'generator', 'created_at'], fis);
  await insert('evidence_records', ['id', 'el_id', 'node_id', 'family_id', 'instance_id', 'purpose', 'answer_hash', 'r_c', 'passed', 'level', 'assurance', 'authentic', 'provisional', 'theta', 'created_at'], evs);
  await insert('answer_provenance', ['evidence_id', 'mode', 'answer_chars', 'pasted_chars', 'paste_events', 'largest_paste', 'edit_ratio'], provs);
  await insert('demonstrations', ['id', 'el_id', 'node_id', 'kind', 'date', 'passed', 'score', 'level', 'assurance', 'evidence_id', 'created_at'], demos);
  await insert('node_retention', ['el_id', 'node_id', 'interval_days', 'due_at', 'last_review_at', 'last_result', 'reviews_passed', 'reviews_failed', 'updated_at'], ret);
  await insert('check_answers', ['evidence_id', 'answer_text', 'created_at'], answers);
  await insert('review_queue', ['id', 'evidence_id', 'el_id', 'node_id', 'institution_id', 'engagement_id', 'stratum', 'reason', 'priority', 'status', 'created_at'], queue);
  await dal.run('UPDATE institutions SET review_minutes_per_100 = 120 WHERE id = ?', ids.institution);

  // ── Employers and roles ────────────────────────────────────────────────────
  await insert('employers', ['id', 'name', 'domain', 'kyb_status', 'domain_verified_at', 'city', 'contact_name', 'created_at', 'updated_at', 'is_demo', 'sandbox_id'],
    EMPLOYERS.map(([k, name, kyb, domain]) => [ids.employer(k), name, domain, kyb, kyb === 'verified' ? iso(20) : null, 'Hyderabad', 'Hiring team', iso(30), now, 1, sbx]));
  await insert('employer_users', ['id', 'employer_id', 'email', 'password_hash', 'name', 'role', 'status', 'created_at', 'updated_at'],
    EMPLOYERS.map(([k, , , domain]) => [ids.employerUser(k), ids.employer(k), `recruiter.${sbx}@${domain}.invalid`, '!demo', k === 'e1' ? 'Meera Iyer' : 'Hiring lead', 'owner', 'active', iso(30), now]));
  const { SKILLS } = await import('../market/sampleMarket.js');
  await insert('employer_roles', ['id', 'employer_id', 'title', 'city', 'jd_text', 'skills_json', 'bar', 'status', 'published', 'interview_promise', 'created_by', 'created_at'],
    ROLES.map(([e, title, city, skills, bar], i) => [`${ids.employer(e)}-r${i + 1}`, ids.employer(e), title, city, i === 0 ? SAMPLE_JD : null,
      JSON.stringify(skills.map(([key, req]) => ({ key, name: SKILLS[key]?.name || key, required: !!req }))), bar, 'open', 1, 1, ids.employerUser(e), iso(12 - i)]));
  // Some history at the second company: one student at interview stage.
  await insert('employer_pipeline', ['id', 'employer_id', 'role_id', 'el_id', 'learner_id', 'stage', 'share_json', 'interview_promised', 'created_at', 'updated_at'],
    [[`${ids.employer('e2')}-p1`, ids.employer('e2'), `${ids.employer('e2')}-r4`, ids.el('l11'), ids.learner('l11'), 'interview', JSON.stringify({ asked: ['skills'], granted: ['skills'] }), 1, iso(6), iso(2)]]);
  return { ids };
}
