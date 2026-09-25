// src/pages/inst/StaffLogin.js — /login
// Staff sign in (admins, professors, viewers — each with their own email and
// password). "I have an invite" takes the invite link or code from the email
// and continues to /institution/invite/:token to set a password.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import PhoenixMark from '../../components/PhoenixMark';

export function StaffAside() {
  return (
    <aside className="ln-login-aside">
      <span className="ln-brand" style={{ fontSize: 24, padding: 0 }}><PhoenixMark size={36} />Qubirex<span className="ln-xs" style={{ color: 'var(--stage-muted)', letterSpacing: '0.08em', fontFamily: 'var(--font-body)' }}>FOR INSTITUTIONS</span></span>
      <div className="ln-col ln-hide-phone" style={{ gap: 22 }}>
        <h1 style={{ fontSize: 'clamp(32px, 3vw + 10px, 50px)' }}>See how your students are building, and what the market wants next.</h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 470 }}>Faculty accounts are created by your institution admin. You’ll get an email with a link to set your password and profile.</p>
      </div>
      <span className="ln-small ln-hide-phone" style={{ color: 'var(--stage-muted)' }}>Receive. Build. Return.</span>
    </aside>
  );
}

export default function StaffLogin() {
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const signIn = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/institution/login', { email, password });
      login(res.data.token, { ...res.data.staff, institution_name: res.data.institution?.name }, 'institution');
      navigate(res.data.staff?.profile_completed ? '/institution/home' : '/institution/welcome');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign in failed.');
    }
    setLoading(false);
  };

  const openInvite = (e) => {
    e.preventDefault();
    const token = invite.trim().split('/').filter(Boolean).pop();
    if (token) navigate(`/institution/invite/${token}`);
  };

  return (
    <div className="ln-login">
      <StaffAside />
      <div className="ln-login-main">
        <div className="ln-login-form">
          <div className="ln-seg" role="tablist" style={{ padding: 4, background: 'var(--color-surface-2)', borderRadius: 12 }}>
            <button type="button" role="tab" aria-selected={tab === 'signin'} aria-pressed={tab === 'signin'} onClick={() => setTab('signin')}>Sign in</button>
            <button type="button" role="tab" aria-selected={tab === 'invite'} aria-pressed={tab === 'invite'} onClick={() => setTab('invite')}>I have an invite</button>
          </div>

          {tab === 'signin' ? (
            <form className="ln-col" style={{ gap: 18 }} onSubmit={signIn}>
              <div className="ln-col" style={{ gap: 6 }}><h2 style={{ fontSize: 32 }}>Staff sign in</h2><p className="ln-muted">For professors and institution admins.</p></div>
              {error && <div className="ln-error" role="alert">{error}</div>}
              <div className="ln-field"><label className="ln-label" htmlFor="em">Work email</label>
                <input id="em" className="ln-input" style={{ minHeight: 48 }} type="email" autoComplete="username" placeholder="you@college.edu.in" value={email} onChange={e => setEmail(e.target.value)} required /></div>
              <div className="ln-field">
                <div className="ln-between"><label className="ln-label" htmlFor="pw">Password</label>
                  <button type="button" className="ln-link" style={{ fontSize: 13 }} onClick={() => setForgot(v => !v)} aria-expanded={forgot}>Forgot password?</button></div>
                <input id="pw" className="ln-input" style={{ minHeight: 48 }} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
                {forgot && <div className="ln-note">Ask your institution admin to send you a new link from Team &amp; roles. It lets you set a new password.</div>}
              </div>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 16 }} disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
              <p className="ln-small ln-muted" style={{ textAlign: 'center' }}>Student? <Link to="/learner-login" className="ln-link" style={{ fontSize: 13 }}>Learner login</Link></p>
            </form>
          ) : (
            <form className="ln-col" style={{ gap: 18 }} onSubmit={openInvite}>
              <div className="ln-col" style={{ gap: 6 }}><h2 style={{ fontSize: 32 }}>Set up your account</h2><p className="ln-muted">Open the link in your invite email, or paste it here.</p></div>
              <div className="ln-field"><label className="ln-label" htmlFor="inv">Invite link</label>
                <input id="inv" className="ln-input" style={{ minHeight: 48 }} placeholder="https://…/institution/invite/…" value={invite} onChange={e => setInvite(e.target.value)} required /></div>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 16 }}>Continue →</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
