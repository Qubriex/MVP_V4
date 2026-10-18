// src/pages/LearnerLogin.js
// Learner sign-in: learner reference + engagement ID + PIN (unchanged auth),
// with the shared language switch in the header. The choice is stored locally
// right away and written to the learner's profile after sign-in.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUiLang } from '../context/UiLangContext';
import api from '../utils/api';
import BrandLogo from '../components/BrandLogo';
import { errMsg } from '../utils/errors';
import SignInBar from '../components/shared/SignInBar';

const COPY = Object.fromEntries(['title', 'sub', 'ref', 'eng', 'pin', 'keep', 'go'].map(k => [k, `page.learnerLogin.copy.${k}`]));

export default function LearnerLogin() {
  const { t } = useUiLang();
  const [ref, setRef] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [pin, setPin] = useState('');
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState('');
  // Shown once after the account was used on another device (one device at a time).
  const [signedOutReason] = useState(() => { try { const r = sessionStorage.getItem('qubirex_signout_reason'); sessionStorage.removeItem('qubirex_signout_reason'); return r || ''; } catch { return ''; } });
  const [showPinHelp, setShowPinHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { lang } = useUiLang();
  const navigate = useNavigate();
  const c = Object.fromEntries(Object.entries(COPY).map(([k, key]) => [k, t(key)]));

  const [mustChange, setMustChange] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [resetSent, setResetSent] = useState('');

  // After sign-in (and any PIN change): first-run welcome or the dashboard.
  const enter = async () => {
    // First sign-in (no profile saved yet) goes through the short welcome
    // flow, which saves the interface language with the rest. Otherwise
    // remember the language choice, best effort.
    const profile = await api.get('/learner/profile').then(r => r.data).catch(() => null);
    if (profile && profile.has_profile === false) { navigate('/learn/welcome'); return; }
    api.put('/learner/profile', { ui_language: lang }).catch(() => {});
    navigate('/learn/dashboard');
  };

  // "Forgot PIN?" asks staff to reset it; the reply never says whether the
  // details matched, so it can't be used to probe the roster.
  const requestReset = async () => {
    setResetSent('');
    if (!ref.trim() || !engagementId.trim()) { setResetSent(t('page.learnerLogin.enterYourLearnerReference')); return; }
    try {
      const res = await api.post('/auth/learner/pin-reset-request', { learner_ref: ref.trim(), join_code: engagementId.trim() });
      setResetSent(res.data.message);
    } catch (e) { setResetSent(t('page.learnerLogin.couldnTSendThe')); }
  };

  const changePin = async (e) => {
    e.preventDefault(); setError('');
    if (!/^\d{6}$/.test(newPin)) return setError(t('page.learnerLogin.pinMustExactly6'));
    if (newPin !== newPin2) return setError(t('page.learnerLogin.twoPinsDonT'));
    setLoading(true);
    try { await api.put('/learner/pin', { new_pin: newPin }); await enter(); } catch (err) { setError(errMsg(err, t('page.learnerLogin.couldnTChangePin'))); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/learner/login', { learner_ref: ref.trim(), join_code: engagementId.trim(), pin });
      login(res.data.token, res.data.learner, 'learner', { persist: keep });
      if (res.data.must_change_pin) { setMustChange(true); setLoading(false); return; }
      await enter();
    } catch (err) {
      setError(errMsg(err, t('page.learnerLogin.loginFailedCheckLearner')));
    }
    setLoading(false);
  };

  return (
    <div className="ln-login">
      <aside className="ln-login-aside">
        <a href="/" className="brand-home" aria-label={t('page.learnerLogin.qubirexHome')}><BrandLogo height={48} tone="onDark" /></a>
        <div className="ln-col ln-hide-phone" style={{ gap: 24 }}>
          <h1 style={{ fontSize: 'var(--fs-display)' }}>{t('page.learnerLogin.learnLanguage')}<br />{t('page.learnerLogin.speakListenBuild')}</h1>
          <p style={{ fontSize: 'var(--fs-h3)', lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 460 }}>
            {t('page.learnerLogin.institutionHasSetPath')}
          </p>
          <ul className="ln-col" style={{ gap: 12, paddingTop: 8 }}>
            {[t('page.learnerLogin.voiceSessionsInAnd'), t('page.learnerLogin.jobMarketMatchedTo'), t('page.learnerLogin.aResumeBuiltFrom')].map((text, i) => (
              <li key={text} className="ln-row" style={{ gap: 14 }}><span className="ln-login-num">0{i + 1}</span><span className="ln-indic" style={{ fontSize: 'var(--fs-body)' }}>{text}</span></li>
            ))}
          </ul>
        </div>
        <span className="ln-small ln-hide-phone" style={{ color: 'var(--stage-muted)' }}>{t('brand.tagline')}</span>
      </aside>

      <div className="ln-login-main">
        <SignInBar />
        {mustChange ? (
          <form className="ln-login-form" onSubmit={changePin}>
            <div className="ln-col" style={{ gap: 8 }}>
              <h2 style={{ fontSize: 'var(--fs-h1)', fontFamily: 'var(--font-display)' }}>{t('page.learnerLogin.chooseOwnPin')}</h2>
              <p className="ln-muted">{t('page.learnerLogin.signedOneTimePin')}</p>
            </div>
            {error && <div className="ln-error" role="alert">{error}</div>}
            <div className="ln-field"><label className="ln-label" htmlFor="np1">{t('page.learnerLogin.newPin')}</label>
              <input id="np1" className="ln-input" style={{ minHeight: 48, fontSize: 'var(--fs-h3)', letterSpacing: '0.3em' }} type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} required /></div>
            <div className="ln-field"><label className="ln-label" htmlFor="np2">{t('page.learnerLogin.typeAgain')}</label>
              <input id="np2" className="ln-input" style={{ minHeight: 48, fontSize: 'var(--fs-h3)', letterSpacing: '0.3em' }} type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={newPin2} onChange={e => setNewPin2(e.target.value.replace(/\D/g, ''))} required /></div>
            <button className="ln-btn ln-btn-primary ln-btn-block" type="submit" disabled={loading} style={{ minHeight: 52, fontSize: 'var(--fs-h3)' }}>{loading ? '…' : t('page.learnerLogin.savePinContinue')}</button>
          </form>
        ) : (
        <form className="ln-login-form ln-indic" onSubmit={handleSubmit}>
          <div className="ln-col" style={{ gap: 8 }}>
            <h2 style={{ fontSize: 'var(--fs-h1)', fontFamily: 'var(--font-display), var(--font-indic)' }}>{c.title}</h2>
            <p className="ln-muted" style={{ fontSize: 'var(--fs-body)' }}>{c.sub}</p>
          </div>

          {signedOutReason && !error && <div className="ln-note" role="status">{t('page.learnerLogin.signedoutreasonIfWasnT', { signedOutReason })}</div>}
          {error && <div className="ln-error" role="alert">{error}</div>}

          <div className="ln-field">
            <label className="ln-label" htmlFor="lref">{c.ref}</label>
            <input id="lref" className="ln-input" style={{ minHeight: 48, fontSize: 'var(--fs-body)' }} value={ref} onChange={e => setRef(e.target.value)} placeholder="LRNR-001" autoComplete="username" required />
          </div>
          <div className="ln-field">
            <label className="ln-label" htmlFor="leng">{c.eng}</label>
            <input id="leng" className="ln-input" style={{ minHeight: 48, fontSize: 'var(--fs-body)' }} value={engagementId} onChange={e => setEngagementId(e.target.value)} placeholder="e.g. QX-FSA-7K2" autoCapitalize="characters" required />
          </div>
          <div className="ln-field">
            <div className="ln-between">
              <label className="ln-label" htmlFor="lpin">{c.pin}</label>
              <button type="button" className="ln-link" style={{ fontSize: 'var(--fs-small)' }} onClick={() => setShowPinHelp(v => !v)} aria-expanded={showPinHelp}>{t('page.learnerLogin.forgotPin')}</button>
            </div>
            <input id="lpin" className="ln-input" style={{ minHeight: 48, fontSize: 'var(--fs-h3)', letterSpacing: '0.3em' }} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" autoComplete="current-password" required />
            {showPinHelp && (
              <div className="ln-note ln-col" style={{ gap: 8 }}>
                <span>{t('page.learnerLogin.weLlAskProfessor')}</span>
                <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={requestReset}>{t('page.learnerLogin.askPinReset')}</button>
                {resetSent && <span role="status">{resetSent}</span>}
              </div>
            )}
          </div>

          <label className="ln-check"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />{c.keep}</label>

          <button className="ln-btn ln-btn-primary ln-btn-block" type="submit" disabled={loading} style={{ minHeight: 52, fontSize: 'var(--fs-h3)' }}>
            {loading ? '…' : c.go}<ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="ln-small ln-muted" style={{ textAlign: 'center' }}>{t('page.learnerLogin.institution')}{' '} <Link to="/login" className="ln-link" style={{ fontSize: 'var(--fs-small)' }}>{t('page.learnerLogin.institutionLogin')}</Link></p>
        </form>
        )}
      </div>
    </div>
  );
}
