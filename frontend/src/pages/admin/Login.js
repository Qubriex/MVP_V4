// src/pages/admin/Login.js — /admin/login — Qubirex platform staff only.
// Admin accounts are created from the server shell (scripts/seed-admin.js).
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import BrandLogo from '../../components/BrandLogo';

import { useUiLang } from '../../context/UiLangContext';
import SignInBar from '../../components/shared/SignInBar';
export default function AdminLogin() {
  const { t } = useUiLang();
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
    } catch (err) { setError(errMsg(err, t('adm.login.signFailed'))); }
    setBusy(false);
  };
  return (
    <div className="ln-login">
      <aside className="ln-login-aside">
        <span className="ln-col" style={{ gap: 6 }}><a href="/" className="brand-home" aria-label={t('adm.login.qubirexHome')}><BrandLogo height={48} tone="onDark" /></a><span className="ln-xs" style={{ color: 'var(--stage-muted)', letterSpacing: '0.08em' }}>{t('signin.platformAdmin')}</span></span>
        <p className="ln-hide-phone" style={{ fontSize: 'var(--fs-h3)', lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 470 }}>{t('adm.login.employerVerificationSkillsOntology')}</p>
        <span />
      </aside>
      <div className="ln-login-main">
        <SignInBar />
        <form className="ln-login-form ln-col" style={{ gap: 16 }} onSubmit={submit}>
          <h2 style={{ fontSize: 'var(--fs-h1)' }}>{t('adm.login.adminSign')}</h2>
          {error && <div className="ln-error" role="alert">{error}</div>}
          <div className="ln-field"><label className="ln-label" htmlFor="em">{t('adm.login.email')}</label><input id="em" className="ln-input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="pw">{t('adm.login.password')}</label><input id="pw" className="ln-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52 }} disabled={busy}>{busy ? t('adm.login.signingIn') : t('adm.login.signIn')}</button>
        </form>
      </div>
    </div>
  );
}
