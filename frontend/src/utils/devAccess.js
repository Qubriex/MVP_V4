// src/utils/devAccess.js — the developer login's client side (/dev page and
// the developer bar). The server (backend api/routes/dev.js) checks the
// passcode, holds the unlock in an httpOnly cookie, and issues a real session
// for one of the fixed test accounts; this file only asks for one by key.
import api from './api';

// The role cards, in the order the page shows them. `key` is the only thing
// the browser ever sends.
export const DEV_CARDS = [
  { key: 'learner_te', label: 'devx.card.learnerTe', home: '/learn/dashboard' },
  { key: 'learner_hi', label: 'devx.card.learnerHi', home: '/learn/dashboard' },
  { key: 'learner_new', label: 'devx.card.learnerNew', home: '/learn/welcome' },
  { key: 'college_admin', label: 'devx.card.collegeAdmin', home: '/institution/home' },
  { key: 'professor', label: 'devx.card.professor', home: '/institution/home' },
  { key: 'employer_verified', label: 'devx.card.employerVerified', home: '/employer/home' },
  { key: 'employer_pending', label: 'devx.card.employerPending', home: '/employer/home' },
  { key: 'admin', label: 'devx.card.admin', home: '/admin/overview' }
];
// One test learner at each stage of the learning journey (backend
// core/journey/accounts.js). The /dev page lists them from GET /dev/journey.
export const JOURNEY_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's1-hi', 's3-hi', 's7-hi', 'topics']
  .map(k => ({ key: `journey_${k.replace('-', '_')}`, journey: k, stage: k.split('-')[0].toUpperCase(), hindi: k.endsWith('-hi') }));
export const cardFor = (key) => DEV_CARDS.find(c => c.key === key) || null;
export const journeyFor = (key) => JOURNEY_KEYS.find(j => j.key === key) || null;
export const isDevLearner = (key) => key === 'learner_te' || key === 'learner_hi' || key === 'learner_new' || !!journeyFor(key);

// The learner path, step by step, for /dev/journey: which stage account to
// open and where. `invite` opens a fresh invite link instead of signing in.
export const JOURNEY_STEPS = [
  { id: 'invite', account: 'journey_s0', invite: true },
  { id: 'signin', account: 'journey_s0', invite: true },
  { id: 'welcome', account: 'journey_s1', to: '/learn/welcome' },
  { id: 'baseline', account: 'journey_s1', to: '/learn/baseline' },
  { id: 'lesson', account: 'journey_s2', to: '/learn/session' },
  { id: 'check', account: 'journey_s3', to: '/learn/session' },
  { id: 'result', account: 'journey_s4', to: '/learn/session' },
  { id: 'review', account: 'journey_s3', to: '/learn/reviews' },
  { id: 'certificate', account: 'journey_s5', to: '/learn/record' },
  { id: 'readiness', account: 'journey_s6', to: '/learn/readiness' },
  { id: 'bridge', account: 'journey_s3', to: '/learn/assigned' },
  { id: 'passport', account: 'journey_s7', to: '/learn/passport' },
  { id: 'share', account: 'journey_s7', to: '/learn/passport' },
  { id: 'request', account: 'journey_s8', to: '/learn/jobs' },
  { id: 'dayone', account: 'journey_s9', to: '/learn/dayone' },
  { id: 'apply', account: 'journey_s7', to: '/learn/jobs' },
  { id: 'offer', account: 'journey_s10', to: '/learn/jobs' },
  { id: 'hired', account: 'journey_s11', to: '/learn/passport' },
  { id: 'renewal', account: 'journey_s12', to: '/learn/passport' }
];

/** A fresh invite link for the S0 learner (who has never signed in). */
export async function openInviteLink({ logout, navigate, token }) {
  const { data } = await api.post('/dev/journey/invite', {});
  if (token) logout();
  navigate(data.path);
}

/** Run one /dev time-or-state control on the signed-in test learner. */
export async function journeyControl(body) {
  const { data } = await api.post('/dev/journey/control', body);
  return data;
}

/** Sign in as one test account and go to its home (or to `to`). */
export async function openDevAccount(key, { login, navigate }, to = null) {
  const { data } = await api.post('/dev/login', { account_key: key });
  login(data.token, data.user, data.role, { dev: { account_key: data.account_key, expires_at: data.expires_at } });
  navigate(to || data.home);
}

// Every page of the app, by side, with the test account that opens it.
// `:x` parts are filled from GET /dev/route-ids (the seeded test data).
export const ALL_PAGES = [
  { side: 'devx.pages.public', account: null, paths: ['/', '/pricing', '/learners', '/colleges', '/employers', '/demo', '/signin', '/legal/privacy', '/legal/terms', '/legal/dpdp', '/legal/grievance', '/developers', '/verify', '/verify/:evidence_id', '/login', '/learner-login', '/employer/login', '/employer/register', '/admin/login'] },
  { side: 'devx.pages.learner', account: 'learner_te', paths: ['/learn/dashboard', '/learn/session', '/learn/record', '/learn/reviews', '/learn/passport', '/learn/jobs', '/learn/market', '/learn/market/:job_id', '/learn/market/:job_id/interview', '/learn/topics', '/learn/profile', '/learn/resume', '/learn/settings'] },
  { side: 'devx.pages.learnerNew', account: 'learner_new', paths: ['/learn/welcome'] },
  // The learner side again, by journey stage: each page opened as the stage that shows it best.
  { side: 'devx.pages.byStage.s1', account: 'journey_s1', paths: ['/learn/welcome', '/learn/baseline'] },
  { side: 'devx.pages.byStage.s2', account: 'journey_s2', paths: ['/learn/dashboard', '/learn/session', '/learn/skill/test-node-1-3'] },
  { side: 'devx.pages.byStage.s3', account: 'journey_s3', paths: ['/learn/dashboard', '/learn/reviews', '/learn/assigned', '/learn/history', '/learn/skill/test-node-2-2'] },
  { side: 'devx.pages.byStage.s4', account: 'journey_s4', paths: ['/learn/session', '/learn/skill/test-node-2-3', '/learn/history'] },
  { side: 'devx.pages.byStage.s5', account: 'journey_s5', paths: ['/learn/record', '/learn/passport'] },
  { side: 'devx.pages.byStage.s6', account: 'journey_s6', paths: ['/learn/readiness', '/learn/jobs', '/learn/resume'] },
  { side: 'devx.pages.byStage.s7', account: 'journey_s7', paths: ['/learn/passport', '/learn/jobs', '/learn/apply/test-role-0002', '/learn/notifications'] },
  { side: 'devx.pages.byStage.s8', account: 'journey_s8', paths: ['/learn/jobs', '/learn/requests/test-j-s8-pipe'] },
  { side: 'devx.pages.byStage.s9', account: 'journey_s9', paths: ['/learn/dayone', '/learn/jobs'] },
  { side: 'devx.pages.byStage.s10', account: 'journey_s10', paths: ['/learn/jobs'] },
  { side: 'devx.pages.byStage.s11', account: 'journey_s11', paths: ['/learn/passport', '/learn/jobs'] },
  { side: 'devx.pages.byStage.s12', account: 'journey_s12', paths: ['/learn/passport', '/learn/reviews', '/learn/dashboard'] },
  { side: 'devx.pages.college', account: 'college_admin', paths: ['/institution/home', '/institution/welcome', '/institution/team', '/institution/students', '/institution/students/add', '/institution/cohorts', '/institution/cohorts/new', '/institution/cohorts/:engagement_id', '/institution/cohorts/:engagement_id/live', '/institution/cohorts/:engagement_id/report', '/institution/curriculum', '/institution/benchmark', '/institution/review', '/institution/bridges', '/institution/bridges/:bridge_id', '/institution/placements', '/institution/board-report', '/institution/profile', '/institution/mastery-log/:mastery_log_id'] },
  { side: 'devx.pages.professor', account: 'professor', paths: ['/institution/home', '/institution/review', '/institution/cohorts/:engagement_id'] },
  { side: 'devx.pages.employer', account: 'employer_verified', paths: ['/employer/home', '/employer/company', '/employer/team', '/employer/api-keys', '/employer/roles', '/employer/roles/:role_id', '/employer/pipeline', '/employer/candidates/:candidate_id', '/employer/sponsor', '/employer/colleges', '/employer/verify-bulk', '/employer/templates', '/employer/billing'] },
  { side: 'devx.pages.employerPending', account: 'employer_pending', paths: ['/employer/home', '/employer/company'] },
  { side: 'devx.pages.admin', account: 'admin', paths: ['/admin/overview', '/admin/employers', '/admin/ontology', '/admin/quality', '/admin/messages'] }
];
/** A path with its ids filled in, or null when an id is missing. */
export const fillPath = (path, ids) => {
  let missing = false;
  const out = path.replace(/:(\w+)/g, (_, k) => { if (!ids?.[k]) missing = true; return ids?.[k] || ''; });
  return missing ? null : out;
};

/** End the developer session on the server (signs the test account out) and locally. */
export async function endDevSession({ logout, navigate }) {
  await api.post('/dev/end').catch(() => {});
  logout();
  navigate('/dev');
}
