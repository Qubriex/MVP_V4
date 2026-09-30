// src/pages/employer/Login.js — /employer/login (sign in) and
// /employer/register (create a company account). A new account starts with
// KYB pending: verify the company domain email, then Qubirex approves (§14.1).
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import PhoenixMark from '../../components/PhoenixMark';

export function EmployerAside() {
  return (
    <aside className="ln-login-aside">
      <span className="ln-brand" style={{ fontSize: 24, padding: 0 }}><PhoenixMark size={36} />Qubirex<span className="ln-xs" style={{ color: 'var(--stage-muted)', letterSpacing: '0.08em', fontFamily: 'var(--font-body)' }}>FOR EMPLOYERS</span></span>
      <div className="ln-col ln-hide-phone" style={{ gap: 22 }}>
        <h1 style={{ fontSize: 'clamp(32px, 3vw + 10px, 50px)' }}>Hire on evidence, not claims.</h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 470 }}>Every Qubirex skill is backed by signed evidence you can check yourself. Verify your company domain to get started.</p>
      </div>
      <span className="ln-small ln-hide-phone" style={{ color: 'var(--stage-muted)' }}>Receive. Build. Return.</span>
    </aside>
  );
}

export default function EmployerLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const tab = location.pathname.endsWith('/register') ? 'register' : 'signin';
  const [f, setF] = useState({ email: '', password: '', company_name: '', name: '', website: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }));

  const signIn = async (email, password) => {
    const r = await api.post('/auth/employer/login', { email, password });
    login(r.data.token, { email, employer_id: r.data.employer.id }, 'employer');
    navigate('/employer/home');
  };
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (tab === 'register') await api.post('/auth/employer/register', f);
      await signIn(f.email, f.password);
    } catch (err) { setError(errMsg(err, 'Sign in failed.')); }
    setLoading(false);
  };

  return (
    <div className="ln-login">
      <EmployerAside />
      <div className="ln-login-main">
        <div className="ln-login-form">
          <div className="ln-seg" role="tablist" style={{ padding: 4, background: 'var(--color-surface-2)', borderRadius: 12 }}>
            <button type="button" role="tab" aria-selected={tab === 'signin'} aria-pressed={tab === 'signin'} onClick={() => navigate('/employer/login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={tab === 'register'} aria-pressed={tab === 'register'} onClick={() => navigate('/employer/register')}>Create account</button>
          </div>
          <form className="ln-col" style={{ gap: 16 }} onSubmit={submit}>
            <div className="ln-col" style={{ gap: 6 }}>
              <h2 style={{ fontSize: 32 }}>{tab === 'register' ? 'Create an employer account' : 'Employer sign in'}</h2>
              <p className="ln-muted">{tab === 'register' ? 'Use your work email — its domain becomes your company domain.' : 'For recruiters and hiring teams.'}</p>
            </div>
            {error && <div className="ln-error" role="alert">{error}</div>}
            {tab === 'register' && <>
              <div className="ln-field"><label className="ln-label" htmlFor="co">Company name</label><input id="co" className="ln-input" value={f.company_name} onChange={set('company_name')} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="nm">Your name</label><input id="nm" className="ln-input" autoComplete="name" value={f.name} onChange={set('name')} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="ws">Website (optional)</label><input id="ws" className="ln-input" placeholder="https://" value={f.website} onChange={set('website')} /></div>
            </>}
            <div className="ln-field"><label className="ln-label" htmlFor="em">Work email</label><input id="em" className="ln-input" type="email" autoComplete="username" placeholder="you@company.com" value={f.email} onChange={set('email')} required /></div>
            <div className="ln-field"><label className="ln-label" htmlFor="pw">Password</label><input id="pw" className="ln-input" type="password" autoComplete={tab === 'register' ? 'new-password' : 'current-password'} minLength={tab === 'register' ? 10 : undefined} value={f.password} onChange={set('password')} required />
              {tab === 'register' && <span className="ln-xs ln-muted">At least 10 characters.</span>}</div>
            <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 16 }} disabled={loading}>{loading ? 'Please wait…' : tab === 'register' ? 'Create account' : 'Sign in'}</button>
            <p className="ln-small ln-muted" style={{ textAlign: 'center' }}>Only checking one credential? <Link to="/verify" className="ln-link" style={{ fontSize: 13 }}>Verify an Evidence ID</Link> — no account needed.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
