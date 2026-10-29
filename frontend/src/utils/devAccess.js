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

/** Sign in as one test account and go to its home. */
export async function openDevAccount(key, { login, navigate }) {
  const { data } = await api.post('/dev/login', { account_key: key });
  login(data.token, data.user, data.role, { dev: { account_key: data.account_key, expires_at: data.expires_at } });
  navigate(data.home);
}

/** End the developer session on the server (signs the test account out) and locally. */
export async function endDevSession({ logout, navigate }) {
  await api.post('/dev/end').catch(() => {});
  logout();
  navigate('/dev');
}
