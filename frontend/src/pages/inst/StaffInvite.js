// src/pages/inst/StaffInvite.js — /institution/invite/:token
// A professor (or admin/viewer) opens the invite link, sees who invited them
// and to what, sets a password, and continues to profile setup.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { StaffAside } from './StaffLogin';
import { errMsg } from '../../utils/errors';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
import SignInBar from '../../components/shared/SignInBar';
const ROLE = { admin: 'inst.staffInvite.role.admin', professor: 'inst.staffInvite.role.professor', viewer: 'inst.staffInvite.role.viewer' };

export default function StaffInvite() {
  const { t } = useUiLang();
  const { token } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/auth/staff/invite/${token}`).then(r => setInvite(r.data)).catch(e => setError(errMsg(e, t('inst.staffInvite.inviteLinkInvalidHas'))));
  }, [token]);

  const accept = async (e) => {
    e.preventDefault();
    setError('');
    if (pw.length < 10) return setError(t('inst.staffInvite.useAtLeast10'));
    if (pw !== pw2) return setError(t('inst.staffInvite.twoPasswordsDonT'));
    setBusy(true);
    try {
      const res = await api.post(`/auth/staff/invite/${token}/accept`, { password: pw });
      login(res.data.token, { ...res.data.staff, institution_name: res.data.institution?.name }, 'institution');
      navigate('/institution/welcome');
    } catch (err) {
      setError(errMsg(err, t('inst.staffInvite.couldnTSetUp')));
    }
    setBusy(false);
  };

  return (
    <div className="ln-login">
      <StaffAside />
      <div className="ln-login-main">
        <SignInBar />
        <form className="ln-login-form" onSubmit={accept}>
          <div className="ln-col" style={{ gap: 6 }}>
            <h2 style={{ fontSize: 'var(--fs-h1)' }}>{t('inst.staffInvite.setUpAccount')}</h2>
            {invite && <p className="ln-muted">{t('inst.staffInvite.invited')}{invite.invited_by ? ` by ${invite.invited_by}` : ''} {' '}{t('inst.staffInvite.institutionName', { institution_name: invite.institution_name })}{invite.department ? ` · ${invite.department}` : ''}</p>}
          </div>
          {error && <div className="ln-error" role="alert">{error}</div>}
          {!invite && !error && <p className="ln-muted">{t('inst.staffInvite.checkingInvite')}</p>}
          {!invite && error && <Link to="/login" className="ln-link">{t('inst.staffInvite.backSign')}</Link>}
          {invite && (
            <>
              <div className="ln-field"><label className="ln-label" htmlFor="iem">{t('inst.staffInvite.workEmail')}</label><input id="iem" className="ln-input" style={{ minHeight: 48 }} value={invite.email} readOnly autoComplete="username" /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="np">{t('inst.staffInvite.createPassword')}</label><input id="np" className="ln-input" style={{ minHeight: 48 }} type="password" autoComplete="new-password" placeholder={t('inst.staffInvite.atLeast10Characters')} value={pw} onChange={e => setPw(e.target.value)} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="cp">{t('inst.staffInvite.confirmPassword')}</label><input id="cp" className="ln-input" style={{ minHeight: 48 }} type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} required /></div>
              <span className="ln-small ln-muted">
                {t('inst.staffInvite.linkExpiresTolocaledatestringRole', { toLocaleDateString: new Date(invite.expires_at).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' }) })}{' '} <b style={{ color: 'var(--color-text)' }}>{t(ROLE[invite.role])}</b>
                {invite.cohorts.length > 0 && ` · ${t('inst.staffInvite.cohortsAssigned', { n: invite.cohorts.length })}`}
              </span>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 'var(--fs-h3)' }} disabled={busy}>{busy ? t('inst.staffInvite.settingUp') : t('inst.staffInvite.continueProfileSetup')}</button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
