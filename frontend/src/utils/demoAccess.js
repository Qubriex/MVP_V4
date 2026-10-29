// src/utils/demoAccess.js — the public working demo's client side (/demo,
// the demo bar and the guided story). The server (backend api/routes/demo.js)
// builds the visitor a private sandbox and signs them in as a sample person;
// the browser only names a persona. A marker in localStorage tells the demo
// bar to show; the sandbox itself is identified by an httpOnly cookie.
import api from './api';

export const DEMO_KEY = 'qubirex_demo';

// The sample people, in the order /demo shows them.
export const PERSONAS = [
  { key: 'lakshmi', side: 'learner', initials: 'LP', tone: 'a' },
  { key: 'arjun', side: 'learner', initials: 'AV', tone: 'b' },
  { key: 'placement', side: 'college', initials: 'SR', tone: 'c' },
  { key: 'professor', side: 'college', initials: 'RK', tone: 'd' },
  { key: 'recruiter', side: 'employer', initials: 'MI', tone: 'e' },
  { key: 'verifier', side: 'anyone', initials: 'V', tone: 'f' }
];

// The guided story: Receive → Build → Prove → Return → Hire. `who` is the
// persona the step is done as, `to` where "Show me" goes (a function of the
// sandbox details from /demo/me), `mark` the control it highlights (a
// data-demo name, or a function of the sandbox details giving a CSS selector).
export const STORY = [
  { step: 'jd', who: 'recruiter', to: () => '/employer/roles?new=1', mark: 'jd' },
  { step: 'search', who: 'recruiter', to: (me) => `/employer/roles/${me.sample_role_id}`, mark: null },
  { step: 'request', who: 'recruiter', to: (me) => `/employer/roles/${me.sample_role_id}`, mark: (me) => `[data-ref="${me.lakshmi_ref}"] [data-demo="request"]` },
  { step: 'approve', who: 'lakshmi', to: () => '/learn/jobs', mark: 'approve' },
  { step: 'unlocked', who: 'recruiter', to: () => '/employer/pipeline', mark: null },
  { step: 'dayone', who: 'recruiter', to: () => '/employer/pipeline', mark: 'dayone' },
  { step: 'lesson', who: 'lakshmi', to: () => '/learn/dashboard', mark: 'lesson' },
  { step: 'bridge', who: 'placement', to: () => '/institution/bridges', mark: 'bridge' }
];

// The learner journey story: Lakshmi's side only, lessons use the scripted tutor.
export const LEARNER_STORY = [
  { step: 'lj_home', who: 'lakshmi', to: () => '/learn/dashboard', mark: () => '[data-start-here]' },
  { step: 'lj_lesson', who: 'lakshmi', to: () => '/learn/session?mode=voice', mark: null },
  { step: 'lj_skill', who: 'lakshmi', to: (me) => (me.lakshmi_node_id ? `/learn/skill/${me.lakshmi_node_id}` : '/learn/path'), mark: null },
  { step: 'lj_passport', who: 'lakshmi', to: () => '/learn/passport', mark: null },
  { step: 'lj_readiness', who: 'lakshmi', to: () => '/learn/readiness', mark: null },
  { step: 'lj_jobs', who: 'lakshmi', to: () => '/learn/jobs', mark: null }
];

export function readDemo() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { return null; }
}
function writeDemo(v) {
  try { if (v) localStorage.setItem(DEMO_KEY, JSON.stringify(v)); else localStorage.removeItem(DEMO_KEY); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event('qubirex:demo')); } catch { /* old browsers */ }
}

// Apply a persona session from /demo/start, /switch or /reset.
function enter(data, { login, logout, navigate }) {
  if (data.token) login(data.token, data.user, data.role);
  else logout({ quiet: true });
  writeDemo({ persona: data.persona, ends_at: data.ends_at });
  navigate(data.home);
}

export async function startDemo(persona, ctx, extra = {}) {
  const { data } = await api.post('/demo/start', { persona, ...extra });
  enter(data, ctx);
  return data;
}
export async function switchPersona(persona, ctx) {
  const { data } = await api.post('/demo/switch', { persona });
  enter(data, ctx);
  return data;
}
export async function resetDemo(ctx) {
  const { data } = await api.post('/demo/reset', {});
  enter(data, ctx);
  return data;
}
export async function exitDemo({ logout, navigate }) {
  await api.post('/demo/exit', {}).catch(() => {});
  writeDemo(null);
  logout({ quiet: true });
  navigate('/demo');
}
export const forgetDemo = () => writeDemo(null);

/** True when the signed-in session is a demo session (its token says so). */
export function isDemoSession() {
  try {
    const t = localStorage.getItem('qubirex_token');
    return !!t && !!JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).demo;
  } catch { return false; }
}
