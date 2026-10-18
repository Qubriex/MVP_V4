// src/pages/inst/StaffLogin.js — /login
// Staff sign in (admins, professors, viewers — each with their own email and
// password). "I have an invite" takes the invite link or code from the email
// and continues to /institution/invite/:token to set a password.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import BrandLogo from '../../components/BrandLogo';
import { errMsg } from '../../utils/errors';

import { useUiLang } from '../../context/UiLangContext';
import SignInBar from '../../components/shared/SignInBar';
export function StaffAside() {
  const { t } = useUiLang();
  return (
    <aside className="ln-login-aside">
      <span className="ln-col" style={{ gap: 6 }}><a href="/" className="brand-home" aria-label={t('inst.staffLogin.qubirexHome')}><BrandLogo height={48} tone="onDark" /></a><span className="ln-xs" style={{ color: 'var(--stage-muted)', letterSpacing: '0.08em', fontFamily: 'var(--font-body)' }}>{t('signin.forColleges')}</span></span>
      <div className="ln-col ln-hide-phone" style={{ gap: 22 }}>
        <h1 style={{ fontSize: 'var(--fs-display)' }}>{t('inst.staffLogin.seeHowStudentsBuilding')}</h1>
        <p style={{ fontSize: 'var(--fs-h3)', lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 470 }}>{t('inst.staffLogin.facultyAccountsCreatedBy')}</p>
      </div>
      <span className="ln-small ln-hide-phone" style={{ color: 'var(--stage-muted)' }}>{t('brand.tagline')}</span>
    </aside>
  );
}

export default function StaffLogin() {
  const { t } = useUiLang();
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
      setError(errMsg(err, t('inst.staffLogin.signFailed')));
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
        <SignInBar />
        <div className="ln-login-form">
          <div className="ln-seg" role="tablist" style={{ padding: 4, background: 'var(--color-surface-2)', borderRadius: 12 }}>
            <button type="button" role="tab" aria-selected={tab === 'signin'} aria-pressed={tab === 'signin'} onClick={() => setTab('signin')}>{t('inst.staffLogin.signIn')}</button>
            <button type="button" role="tab" aria-selected={tab === 'invite'} aria-pressed={tab === 'invite'} onClick={() => setTab('invite')}>{t('inst.staffLogin.iHaveInvite')}</button>
          </div>

          {tab === 'signin' ? (
            <form className="ln-col" style={{ gap: 18 }} onSubmit={signIn}>
              <div className="ln-col" style={{ gap: 6 }}><h2 style={{ fontSize: 'var(--fs-h1)' }}>{t('inst.staffLogin.staffSign')}</h2><p className="ln-muted">{t('inst.staffLogin.professorsInstitutionAdmins')}</p></div>
              {error && <div className="ln-error" role="alert">{error}</div>}
              <div className="ln-field"><label className="ln-label" htmlFor="em">{t('inst.staffLogin.workEmail')}</label>
                <input id="em" className="ln-input" style={{ minHeight: 48 }} type="email" autoComplete="username" placeholder="you@college.edu.in" value={email} onChange={e => setEmail(e.target.value)} required /></div>
              <div className="ln-field">
                <div className="ln-between"><label className="ln-label" htmlFor="pw">{t('inst.staffLogin.password')}</label>
                  <button type="button" className="ln-link" style={{ fontSize: 'var(--fs-small)' }} onClick={() => setForgot(v => !v)} aria-expanded={forgot}>{t('inst.staffLogin.forgotPassword')}</button></div>
                <input id="pw" className="ln-input" style={{ minHeight: 48 }} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
                {forgot && <div className="ln-note">{t('inst.staffLogin.askInstitutionAdminSend')}</div>}
              </div>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 'var(--fs-h3)' }} disabled={loading}>{loading ? t('inst.staffLogin.signingIn') : t('inst.staffLogin.signIn')}</button>
              <p className="ln-small ln-muted" style={{ textAlign: 'center' }}>{t('inst.staffLogin.student')}{' '} <Link to="/learner-login" className="ln-link" style={{ fontSize: 'var(--fs-small)' }}>{t('inst.staffLogin.learnerLogin')}</Link></p>
            </form>
          ) : (
            <form className="ln-col" style={{ gap: 18 }} onSubmit={openInvite}>
              <div className="ln-col" style={{ gap: 6 }}><h2 style={{ fontSize: 'var(--fs-h1)' }}>{t('inst.staffLogin.setUpAccount')}</h2><p className="ln-muted">{t('inst.staffLogin.openLinkInviteEmail')}</p></div>
              <div className="ln-field"><label className="ln-label" htmlFor="inv">{t('inst.staffLogin.inviteLink')}</label>
                <input id="inv" className="ln-input" style={{ minHeight: 48 }} placeholder="https://…/institution/invite/…" value={invite} onChange={e => setInvite(e.target.value)} required /></div>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 'var(--fs-h3)' }}>{t('inst.staffLogin.continue')}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
