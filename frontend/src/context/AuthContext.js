// src/context/AuthContext.js
import React, { createContext, useContext, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

// Developer sessions (/dev, backend api/routes/dev.js) are real server
// sessions for the seeded test accounts. Their details — which test account,
// when it expires — are kept beside the token so the developer bar
// (components/DevBar.js) can show them. There is no client-side bypass:
// every token here was issued by the server.
const DEV_KEY = 'qubirex_dev';
const SESSION_KEYS = ['qubirex_token', 'qubirex_user', 'qubirex_role', 'qubirex_session_only', DEV_KEY];

function readDev() {
  try { return JSON.parse(localStorage.getItem(DEV_KEY) || 'null'); } catch { return null; }
}

// Computed synchronously as the initial state (not in an effect) — a
// protected route reads token on the very first render, so setting it a
// tick later in useEffect would still bounce that first render to /login.
// "Keep me signed in" unticked: the session is marked session-only and the
// marker in sessionStorage dies with the tab, so a later visit starts signed out.
function loadInitialSession() {
  if (localStorage.getItem('qubirex_session_only') && !sessionStorage.getItem('qubirex_alive')) {
    SESSION_KEYS.forEach(k => localStorage.removeItem(k));
  }
  const t = localStorage.getItem('qubirex_token');
  const u = localStorage.getItem('qubirex_user');
  const r = localStorage.getItem('qubirex_role');
  if (t && u) return { token: t, user: JSON.parse(u), role: r, dev: readDev() };
  return { token: null, user: null, role: null, dev: null };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadInitialSession);

  // dev: { account_key, expires_at } for a developer session, else null.
  const login = (tokenVal, userData, roleVal, { persist = true, dev = null } = {}) => {
    setSession({ token: tokenVal, user: userData, role: roleVal, dev });
    if (dev) localStorage.setItem(DEV_KEY, JSON.stringify(dev)); else localStorage.removeItem(DEV_KEY);
    localStorage.setItem('qubirex_token', tokenVal);
    localStorage.setItem('qubirex_user', JSON.stringify(userData));
    localStorage.setItem('qubirex_role', roleVal);
    if (persist) localStorage.removeItem('qubirex_session_only');
    else { localStorage.setItem('qubirex_session_only', '1'); sessionStorage.setItem('qubirex_alive', '1'); }
  };

  // quiet: the server has already ended the session (a demo switch or exit).
  const logout = ({ quiet = false } = {}) => {
    // End the session on the server too, so the token stops working at once.
    // The header is passed explicitly: localStorage is cleared below before
    // the request interceptor runs.
    const current = localStorage.getItem('qubirex_token');
    if (current && !quiet) {
      api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${current}` } }).catch(() => {});
    }
    setSession({ token: null, user: null, role: null, dev: null });
    SESSION_KEYS.forEach(k => localStorage.removeItem(k));
  };

  return (
    <AuthContext.Provider value={{ ...session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
