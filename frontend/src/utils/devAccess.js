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
export const cardFor = (key) => DEV_CARDS.find(c => c.key === key) || null;

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
