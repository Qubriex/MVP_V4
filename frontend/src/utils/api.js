// src/utils/api.js
import axios from 'axios';

const api = axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL || '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('qubirex_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const role = localStorage.getItem('qubirex_role');
      localStorage.removeItem('qubirex_token');
      localStorage.removeItem('qubirex_user');
      localStorage.removeItem('qubirex_role');
      const home = { learner: '/learner-login', employer: '/employer/login', admin: '/admin/login' }[role] || '/login';
      // Public pages (verifier, sign-in screens) never redirect.
      if (!/^\/(verify|employer\/login|employer\/register|admin\/login|login|learner-login)/.test(window.location.pathname)) window.location.href = home;
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
