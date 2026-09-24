// src/context/AuthContext.js
import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// ── DEV MODE ────────────────────────────────────────────────────────────────
// Auth is bypassed here so every page can be opened directly, without a real
// login, for layout/component review. A dev session auto-signs in as
// "institution" on load, and DevNav (src/components/DevNav.js) lets the
// tester flip to "learner" to reach the learner-only routes. Real login via
// InstitutionLogin/LearnerLogin still works and overrides the dev session.
//
// Defaults to OFF (real login-gated flow). To re-enable for local layout
// review, set REACT_APP_DEV_MODE=true in frontend/.env.development.local —
// never in a committed .env file, so it can't leak into a deployed build.
const DEV_MODE = process.env.REACT_APP_DEV_MODE === 'true';
const DEV_USERS = {
  institution: { token: 'dev-institution-token', role: 'institution', user: { id: 'dev-inst-1', name: 'Demo Institution (dev)' } },
  learner: { token: 'dev-learner-token', role: 'learner', user: { id: 'dev-learner-1', name: 'Demo Learner (dev)', language: 'telugu' } }
};

// Computed synchronously as the initial state (not in an effect) — a
// protected route reads token on the very first render, so setting it a
// tick later in useEffect would still bounce that first render to /login.
function loadInitialSession() {
  const t = localStorage.getItem('qubirex_token');
  const u = localStorage.getItem('qubirex_user');
  const r = localStorage.getItem('qubirex_role');
  if (t && u) return { token: t, user: JSON.parse(u), role: r };
  if (DEV_MODE) {
    const preset = DEV_USERS.institution;
    return { token: preset.token, user: preset.user, role: preset.role };
  }
  return { token: null, user: null, role: null };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadInitialSession);

  const login = (tokenVal, userData, roleVal) => {
    setSession({ token: tokenVal, user: userData, role: roleVal });
    localStorage.setItem('qubirex_token', tokenVal);
    localStorage.setItem('qubirex_user', JSON.stringify(userData));
    localStorage.setItem('qubirex_role', roleVal);
  };

  const logout = () => {
    setSession({ token: null, user: null, role: null });
    localStorage.removeItem('qubirex_token');
    localStorage.removeItem('qubirex_user');
    localStorage.removeItem('qubirex_role');
  };

  // Dev-only: instantly switch between institution/learner views, no real login.
  const loginAs = (devRole) => {
    const preset = DEV_USERS[devRole];
    if (preset) login(preset.token, preset.user, preset.role);
  };

  return (
    <AuthContext.Provider value={{ ...session, login, logout, devMode: DEV_MODE, loginAs }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
