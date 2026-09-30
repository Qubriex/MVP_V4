// src/pages/admin/Login.js — /admin/login — Qubirex platform staff only.
// Admin accounts are created from the server shell (scripts/seed-admin.js).
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import PhoenixMark from '../../components/PhoenixMark';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api.post('/auth/admin/login', { email, password });
      login(r.data.token, { email }, 'admin');
      navigate('/admin/overview');
    } catch (err) { setError(errMsg(err, 'Sign in failed.')); }
    setBusy(false);
  };
  return (
    <div className="ln-login">
      <aside className="ln-login-aside">
        <span className="ln-brand" style={{ fontSize: 24, padding: 0 }}><PhoenixMark size={36} />Qubirex<span className="ln-xs" style={{ color: 'var(--stage-muted)', letterSpacing: '0.08em' }}>PLATFORM ADMIN</span></span>
        <p className="ln-hide-phone" style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 470 }}>Employer verification, the skills ontology and evaluator quality.</p>
        <span />
      </aside>
      <div className="ln-login-main">
        <form className="ln-login-form ln-col" style={{ gap: 16 }} onSubmit={submit}>
          <h2 style={{ fontSize: 30 }}>Admin sign in</h2>
          {error && <div className="ln-error" role="alert">{error}</div>}
          <div className="ln-field"><label className="ln-label" htmlFor="em">Email</label><input id="em" className="ln-input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="pw">Password</label><input id="pw" className="ln-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
