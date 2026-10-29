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
const TOAST_SKIP = /\/(parse|preview|transcribe|tts|heartbeat|voice-metrics|session\/|summary-from-speech|tailor|login|logout|verify\/|verify-domain\/request|bulk|ask|assist|read-all|path\/node|doubts|help\/contact|passport\/|reviews\/instances)/;
const TOAST_SCOPE = /^\/(institution|employer|admin|learner|notifications|market\/jobs)\//;
const noteSaved = (res) => {
  const { method, url = '' } = res.config || {};
  if (!['post', 'put', 'patch', 'delete'].includes(method) || res.config?.quiet) return;
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0];
  if (!TOAST_SCOPE.test(path) || TOAST_SKIP.test(path)) return;
  try { window.dispatchEvent(new CustomEvent('qubirex:saved', { detail: { kind: method === 'delete' ? 'deleted' : 'saved' } })); } catch { /* old browsers */ }
};

api.interceptors.response.use(
  res => { noteSaved(res); return res; },
  err => {
    // The developer page's own calls (/dev/*) answer 401 while it is locked;
    // that says nothing about the signed-in session.
    const devCall = /^\/dev\//.test(String(err.config?.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, ''));
    if (err.response?.status === 401 && !devCall) {
      const wasDev = !!localStorage.getItem('qubirex_dev');
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
      const home = wasDev ? '/dev' : { learner: '/learner-login', employer: '/employer/login', admin: '/admin/login' }[role] || '/login';
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
