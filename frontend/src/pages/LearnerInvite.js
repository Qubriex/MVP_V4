// src/pages/LearnerInvite.js — /learner-invite/:token
// A student opens the invite link from their institution, sees their cohort
// and join code, and sets their own 6-digit PIN. Nobody else ever sees it.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import BrandLogo from '../components/BrandLogo';
import { errMsg } from '../utils/errors';

import { useUiLang } from '../context/UiLangContext';
import SignInBar from '../components/shared/SignInBar';
export default function LearnerInvite() {
  const { t } = useUiLang();
  const { token } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/auth/learner/invite/${token}`).then(r => setInvite(r.data)).catch(e => setError(errMsg(e, t('page.learnerInvite.inviteLinkInvalidHas'))));
  }, [token]);

  const accept = async (e) => {
    e.preventDefault(); setError('');
    if (!/^\d{6}$/.test(pin)) return setError(t('page.learnerInvite.pinMustExactly6'));
    if (pin !== pin2) return setError(t('page.learnerInvite.twoPinsDonT'));
    setBusy(true);
    try {
      const res = await api.post(`/auth/learner/invite/${token}/accept`, { pin });
      login(res.data.token, res.data.learner, 'learner');
      navigate('/learn/welcome');
    } catch (err) { setError(errMsg(err, t('page.learnerInvite.couldnTSetPin'))); }
    setBusy(false);
  };

  return (
    <div className="ln-login">
      <aside className="ln-login-aside">
        <a href="/" className="brand-home" aria-label={t('page.learnerInvite.qubirexHome')}><BrandLogo height={48} tone="onDark" /></a>
        <div className="ln-col ln-hide-phone" style={{ gap: 20 }}>
          <h1 style={{ fontSize: 'var(--fs-display)' }}>{t('page.learnerInvite.welcomeLetSSet')}</h1>
          <p style={{ fontSize: 'var(--fs-h3)', lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 460 }}>{t('page.learnerInvite.choosePinOnlyKnow')}</p>
        </div>
        <span className="ln-small ln-hide-phone" style={{ color: 'var(--stage-muted)' }}>{t('brand.tagline')}</span>
      </aside>
      <div className="ln-login-main">
        <SignInBar />
        <form className="ln-login-form" onSubmit={accept}>
          <h2 style={{ fontSize: 'var(--fs-h1)', fontFamily: 'var(--font-display)' }}>{t('page.learnerInvite.setPin')}</h2>
          {error && <div className="ln-error" role="alert">{error}</div>}
          {!invite && !error && <p className="ln-muted">{t('page.learnerInvite.checkingInvite')}</p>}
          {!invite && error && <Link to="/learner-login" className="ln-link">{t('page.learnerInvite.goLearnerSign')}</Link>}
          {invite && (
            <>
              <div className="ln-card" style={{ padding: 16, gap: 6, borderRadius: 'var(--radius-lg)' }}>
                <b>{invite.name}</b>
                <span className="ln-small ln-muted">{invite.cohort_title} · {invite.institution_name}</span>
                <span className="ln-small">{t('page.learnerInvite.learnerReference')}{' '} <b className="in-code">{invite.learner_ref}</b></span>
                <span className="ln-small">{t('page.learnerInvite.joinCode')}{' '} <b className="in-code">{invite.join_code}</b></span>
                <span className="ln-xs ln-muted">{t('page.learnerInvite.writeTheseDownLl')}</span>
              </div>
              <div className="ln-field"><label className="ln-label" htmlFor="p1">{t('page.learnerInvite.new6DigitPin')}</label>
                <input id="p1" className="ln-input" style={{ minHeight: 48, fontSize: 'var(--fs-h3)', letterSpacing: '0.3em' }} type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="p2">{t('page.learnerInvite.typeAgain')}</label>
                <input id="p2" className="ln-input" style={{ minHeight: 48, fontSize: 'var(--fs-h3)', letterSpacing: '0.3em' }} type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} required /></div>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 'var(--fs-h3)' }} disabled={busy}>{busy ? t('page.learnerInvite.saving') : t('page.learnerInvite.setPinStart')}</button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
