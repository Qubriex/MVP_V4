// src/pages/employer/Login.js — /employer/login (sign in) and
// /employer/register (create a company account). A new account starts with
// KYB pending: verify the company domain email, then Qubirex approves (§14.1).
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import BrandLogo from '../../components/BrandLogo';

import { useUiLang } from '../../context/UiLangContext';
import SignInBar from '../../components/shared/SignInBar';
export function EmployerAside() {
  const { t } = useUiLang();
  return (
    <aside className="ln-login-aside">
      <span className="ln-col" style={{ gap: 6 }}><a href="/" className="brand-home" aria-label={t('emp.login.qubirexHome')}><BrandLogo height={48} tone="onDark" /></a><span className="ln-xs" style={{ color: 'var(--stage-muted)', letterSpacing: '0.08em', fontFamily: 'var(--font-body)' }}>{t('signin.forEmployers')}</span></span>
      <div className="ln-col ln-hide-phone" style={{ gap: 22 }}>
        <h1 style={{ fontSize: 'var(--fs-display)' }}>{t('emp.login.hireEvidenceNotClaims')}</h1>
        <p style={{ fontSize: 'var(--fs-h3)', lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 470 }}>{t('emp.login.everyQubirexSkillBacked')}</p>
      </div>
      <span className="ln-small ln-hide-phone" style={{ color: 'var(--stage-muted)' }}>{t('brand.tagline')}</span>
    </aside>
  );
}

export default function EmployerLogin() {
  const { t } = useUiLang();
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
    } catch (err) { setError(errMsg(err, t('emp.login.signFailed'))); }
    setLoading(false);
  };

  return (
    <div className="ln-login">
      <EmployerAside />
      <div className="ln-login-main">
        <SignInBar />
        <div className="ln-login-form">
          <div className="ln-seg" role="tablist" style={{ padding: 4, background: 'var(--color-surface-2)', borderRadius: 12 }}>
            <button type="button" role="tab" aria-selected={tab === 'signin'} aria-pressed={tab === 'signin'} onClick={() => navigate('/employer/login')}>{t('emp.login.signIn')}</button>
            <button type="button" role="tab" aria-selected={tab === 'register'} aria-pressed={tab === 'register'} onClick={() => navigate('/employer/register')}>{t('emp.login.createAccount')}</button>
          </div>
          <form className="ln-col" style={{ gap: 16 }} onSubmit={submit}>
            <div className="ln-col" style={{ gap: 6 }}>
              <h2 style={{ fontSize: 'var(--fs-h1)' }}>{tab === 'register' ? t('emp.login.createEmployerAccount') : t('emp.login.employerSign')}</h2>
              <p className="ln-muted">{tab === 'register' ? t('emp.login.useWorkEmailIts') : t('emp.login.recruitersHiringTeams')}</p>
            </div>
            {error && <div className="ln-error" role="alert">{error}</div>}
            {tab === 'register' && <>
              <div className="ln-field"><label className="ln-label" htmlFor="co">{t('emp.login.companyName')}</label><input id="co" className="ln-input" value={f.company_name} onChange={set('company_name')} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="nm">{t('emp.login.yourName')}</label><input id="nm" className="ln-input" autoComplete="name" value={f.name} onChange={set('name')} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="ws">{t('emp.login.websiteOptional')}</label><input id="ws" className="ln-input" placeholder={t('emp.login.https')} value={f.website} onChange={set('website')} /></div>
            </>}
            <div className="ln-field"><label className="ln-label" htmlFor="em">{t('emp.login.workEmail')}</label><input id="em" className="ln-input" type="email" autoComplete="username" placeholder="you@company.com" value={f.email} onChange={set('email')} required /></div>
            <div className="ln-field"><label className="ln-label" htmlFor="pw">{t('emp.login.password')}</label><input id="pw" className="ln-input" type="password" autoComplete={tab === 'register' ? 'new-password' : 'current-password'} minLength={tab === 'register' ? 10 : undefined} value={f.password} onChange={set('password')} required />
              {tab === 'register' && <span className="ln-xs ln-muted">{t('emp.login.atLeast10Characters')}</span>}</div>
            <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 'var(--fs-h3)' }} disabled={loading}>{loading ? t('emp.login.pleaseWait') : tab === 'register' ? t('emp.login.createAccount') : t('emp.login.signIn')}</button>
            <p className="ln-small ln-muted" style={{ textAlign: 'center' }}>{t('emp.login.onlyCheckingOneCredential')}{' '} <Link to="/verify" className="ln-link" style={{ fontSize: 'var(--fs-small)' }}>{t('emp.login.verifyEvidenceId')}</Link> {' '}{t('emp.login.noAccountNeeded')}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
