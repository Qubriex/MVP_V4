// src/utils/api.js
import axios from 'axios';

const api = axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL || '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('qubirex_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Every successful create / update / delete on a portal record raises a
// "qubirex:saved" event; the ToastProvider turns it into a short toast.
// Previews, AI calls, transcription, heartbeats, sign-in and reads sent as
// POST are left out — they are not changes the person made.
const TOAST_SKIP = /\/(parse|preview|transcribe|tts|heartbeat|voice-metrics|session\/|summary-from-speech|tailor|login|logout|verify\/|verify-domain\/request|bulk|ask|assist|read-all|path\/node|doubts|help\/contact|passport\/|reviews\/instances|lessons\/|modules\/|learning-language)/;
const TOAST_SCOPE = /^\/(institution|employer|admin|learner|notifications|market\/jobs)\//;
const noteSaved = (res) => {
  const { method, url = '' } = res.config || {};
  if (!['post', 'put', 'patch', 'delete'].includes(method) || res.config?.quiet) return;
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0];
  if (!TOAST_SCOPE.test(path) || TOAST_SKIP.test(path)) return;
  try { window.dispatchEvent(new CustomEvent('qubirex:saved', { detail: { kind: method === 'delete' ? 'deleted' : 'saved' } })); } catch { /* old browsers */ }
};

export const SESSION_ENDED = new Set(['unauthenticated', 'invalid_session', 'signed_in_elsewhere', 'demo_ended', 'account_inactive', 'access_removed', 'moved_cohort']);

api.interceptors.response.use(
  res => { noteSaved(res); return res; },
  err => {
    // The developer page's own calls (/dev/*) answer 401 while it is locked;
    // that says nothing about the signed-in session.
    // The same for the demo's own calls (/demo/*).
    const devCall = /^\/(dev|demo)\//.test(String(err.config?.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, ''));
    // Sign out only when the server says the session itself has ended (one of
    // these codes). Any other error, from a feature such as the voice or a
    // check, is shown as a normal message and never signs anyone out.
    const data = err.response?.data || {};
    const code = data.code || (typeof data.error === 'object' ? data.error?.code : null);
    if (err.response?.status === 401 && !devCall && SESSION_ENDED.has(code)) {
      const wasDev = !!localStorage.getItem('qubirex_dev');
      const wasDemo = !!localStorage.getItem('qubirex_demo');
      localStorage.removeItem('qubirex_demo');
      const role = localStorage.getItem('qubirex_role');
      // Signed out because the account was used on another device: say so on the sign-in page.
      const e = err.response?.data?.error;
      const msg = typeof e === 'string' ? e : e?.message;
      if (/another device/i.test(msg || '')) { try { sessionStorage.setItem('qubirex_signout_reason', msg); } catch { /* ignore */ } }
      localStorage.removeItem('qubirex_token');
      localStorage.removeItem('qubirex_user');
      localStorage.removeItem('qubirex_role');
      localStorage.removeItem('qubirex_dev');
      // A developer session that ended goes back to /dev, not a sign-in form.
      // A demo that ended (4 hours, or 2 idle) goes back to /demo to start again.
      const home = wasDemo ? '/demo?ended=1' : wasDev ? '/dev' : { learner: '/learner-login', employer: '/employer/login', admin: '/admin/login' }[role] || '/login';
      // Only pages inside a portal send you to sign in. Public pages (home,
      // demo, pricing, verify, Talk to us, sign-in screens) stay where they are.
      const inPortal = /^\/(learn|institution|employer|admin)\//.test(window.location.pathname)
        && !/^\/(employer\/(login|register|invite)|admin\/login|institution\/invite)/.test(window.location.pathname);
      if (inPortal) window.location.href = home;
    }
    return Promise.reject(err);
  }
);

// GET with a dev fallback: resolves to `fallback` when the request fails or
// the body fails `isValid` — an unreachable backend can resolve 200 with the
// SPA's HTML page (host rewrite) instead of erroring, so the shape is checked.
export function getOr(path, fallback, isValid = d => !!d && typeof d === 'object') {
  return api.get(path)
    .then(r => { if (!isValid(r.data)) throw new Error('unexpected response shape'); return r.data; })
    .catch(() => fallback);
}

export default api;
