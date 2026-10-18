// src/pages/employer/Home.js — /employer/home — KYB progress (§14.1):
// 1 company details, 2 domain email code, 3 Qubirex approval. Until approved
// the company can search but cannot request access to learner evidence.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Plus, Users } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useCachedGet } from '../../utils/cachedGet';
import { useEmployer, KYB_TEXT } from './Layout';
import CommandBox from '../../components/shared/CommandBox';
import { HowCounted } from '../../components/shared/Popover';
import { Bar } from '../../components/learn/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
import { LoadingRows } from '../../components/shared/EmptyState';
// The hiring side of Home (v4.3 canvas E1): who is waiting for a decision,
// open roles and the funnel. Verification steps follow until approved.
function Hiring() {
  const { t } = useUiLang();
  const { data } = useCachedGet('/employer/home');
  if (!data) return <CommandBox side="employer" placeholder={t('emp.home.askAboutHiringExample')} />;
  const top = Math.max(1, ...data.funnel.map(f => f.n));
  return (
    <>
      <CommandBox side="employer" placeholder={t('emp.home.askAboutHiringExample')} />
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <section className="ln-card" style={{ gap: 10 }}>
          <div className="ln-between"><h2 className="ln-h2">{t('emp.home.waitingWaitingDecision', { waiting: data.waiting })}</h2><Link to="/employer/pipeline" className="ln-link">{t('emp.home.pipeline')}</Link></div>
          {data.waiting_rows.length === 0 ? <span className="ln-small ln-muted">{t('emp.home.nobodyWaitingCandidatesWho')}</span>
            : data.waiting_rows.map(r => (
              <Link key={r.id} to={`/employer/candidates/${r.id}`} className="ln-tile ln-card-link ln-between" style={{ flexDirection: 'row', padding: '10px 12px', alignItems: 'center' }}>
                <span className="ln-col" style={{ gap: 2 }}><b style={{ fontSize: 'var(--fs-body)' }}>{r.name || r.code}</b><span className="ln-xs ln-muted">{r.role_title} · {r.college} · {r.stage_label}{r.waiting_days ? ` · ${r.waiting_days === 1 ? t('emp.common.oneDay') : t('emp.common.nDays', { n: r.waiting_days })}` : ''}</span></span>
                <span className="ln-tag ln-tag-info">{r.readiness}</span>
              </Link>
            ))}
          {data.unanswered > 0 && <span className="ln-xs ln-muted">{t('emp.home.unansweredRequests', { n: data.unanswered })}</span>}
        </section>
        <section className="ln-card" style={{ gap: 10 }}>
          <div className="ln-between"><h2 className="ln-h2">{t('emp.home.funnel')}</h2>{data.weeks_to_decide != null && <span className="ln-small ln-muted">{t('emp.home.weeksDecideWeeksDecide', { weeks_to_decide: data.weeks_to_decide })}</span>}</div>
          {data.funnel.map(f => (
            <div key={f.label} className="ln-row" style={{ gap: 10 }}><span className="ln-small" style={{ width: 140 }}>{f.label}</span><div style={{ flex: 1 }}><Bar pct={(f.n / top) * 100} label={`${f.label}: ${f.n}`} /></div><b style={{ width: 28, textAlign: 'right' }}>{f.n}</b></div>
          ))}
          <HowCounted>{t('emp.home.askedCandidatesRequestedWho')}</HowCounted>
        </section>
      </div>
      <section className="ln-col" style={{ gap: 12 }}>
        <div className="ln-between"><h2 className="ln-h2">{t('emp.home.openRoles')}</h2><Link to="/employer/roles?new=1" className="ln-btn ln-btn-sm ln-btn-primary"><Plus size={14} aria-hidden="true" />{t('emp.home.newRole')}</Link></div>
        {data.roles.length === 0 ? <div className="ln-card ln-small ln-muted">{t('emp.home.pasteJobDescriptionCreate')}</div> : (
          <div className="ln-grid ln-g-3" style={{ gap: 12 }}>
            {data.roles.map(r => (
              <Link key={r.id} to={`/employer/roles/${r.id}`} className="ln-card ln-card-link" style={{ gap: 6 }}>
                <b>{r.title}</b><span className="ln-xs ln-muted">{r.city || t('emp.home.anyCity')} {' '}{t('emp.home.barBarLengthSkills', { bar: r.bar, length: r.skills.length })}{r.published ? t('emp.home.sharedColleges') : ''}</span>
                <span className="ln-link ln-small"><Users size={13} aria-hidden="true" /> {' '}{t('emp.home.findCandidates')}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Step({ n, done, title, children }) {
  const { t } = useUiLang();
  return (
    <article className="ln-card" style={{ gap: 10 }}>
      <div className="ln-row" style={{ gap: 10, alignItems: 'center' }}>
        {done ? <CheckCircle2 size={22} color="var(--status-success)" aria-hidden="true" /> : <Circle size={22} aria-hidden="true" />}
        <h2 className="ln-h2" style={{ margin: 0, fontSize: 'var(--fs-h3)' }}>{n}. {title}</h2>
        {done && <span className="ln-tag ln-tag-success">{t('emp.home.done')}</span>}
      </div>
      {children}
    </article>
  );
}

export default function EmployerHome() {
  const { t } = useUiLang();
  const { me, refresh, isOwner } = useEmployer();
  const [otp, setOtp] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!me) return <LoadingRows rows={5} />;
  const e = me.employer;
  const s = e.kyb_steps;
  const [kybLabel, kybClass] = KYB_TEXT[e.kyb_status] || KYB_TEXT.pending;

  const request = async () => {
    setBusy(true); setError('');
    try { const r = await api.post('/employer/verify-domain/request'); setOtp(r.data); if (r.data.already_verified) refresh(); }
    catch (err) { setError(errMsg(err)); }
    setBusy(false);
  };
  const confirm = async (ev) => {
    ev.preventDefault();
    setBusy(true); setError('');
    try { await api.post('/employer/verify-domain/confirm', { code }); setOtp(null); setCode(''); refresh(); }
    catch (err) { setError(errMsg(err)); }
    setBusy(false);
  };

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{e.name}</h1>
          <span className="ln-sub">@{e.domain} · <span className={`ln-tag ${kybClass}`}>{t(kybLabel)}</span></span>
        </div>
      </header>
      <Hiring />
      {e.kyb_status === 'verified' ? null : (
        <div className="ln-note" role="status">{t('emp.home.untilCompanyVerifiedCan')}</div>
      )}
      {error && <div className="ln-error" role="alert">{error}</div>}
      {e.kyb_status !== 'verified' && <div className="ln-col" style={{ gap: 14, marginTop: 16 }}>
        <Step n={1} done={s.details} title={t('emp.home.companyDetails')}>
          <p className="ln-small ln-muted" style={{ margin: 0 }}>{t('emp.home.contactPersonPhoneCity')}</p>
          <Link to="/employer/company" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }}>{s.details ? t('emp.home.editDetails') : t('emp.home.addDetails')}</Link>
        </Step>
        <Step n={2} done={s.domain_verified} title={t('emp.home.verifyDomainEmail', { domain: e.domain })}>
          {s.domain_verified ? <p className="ln-small ln-muted" style={{ margin: 0 }}>{t('emp.home.verifiedTolocaledatestring', { toLocaleDateString: new Date(e.domain_verified_at).toLocaleDateString(uiLocale()) })}</p>
            : !isOwner ? <p className="ln-small ln-muted" style={{ margin: 0 }}>{t('emp.home.ownerAccountNeedsDo')}</p>
            : otp && !otp.already_verified ? (
              <form className="ln-col" style={{ gap: 10 }} onSubmit={confirm}>
                <p className="ln-small" style={{ margin: 0 }}>{t('emp.home.weSent6Digit')}{' '} <b>{otp.sent_to}</b>{t('emp.home.expiresExpiresMinutesMinutes', { expires_minutes: otp.expires_minutes })}</p>
                {otp.dev_code && <div className="ln-note ln-xs">{t('emp.home.noEmailSentTest')}{' '} <b>{otp.dev_code}</b>.</div>}
                <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                  <input className="ln-input" style={{ maxWidth: 160, letterSpacing: '0.2em' }} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label={t('emp.home.verificationCode')} value={code} onChange={ev => setCode(ev.target.value.replace(/\D/g, ''))} required />
                  <button type="submit" className="ln-btn ln-btn-primary" disabled={busy || code.length !== 6}>{t('emp.home.verify')}</button>
                  <button type="button" className="ln-btn" onClick={request} disabled={busy}>{t('emp.home.sendNewCode')}</button>
                </div>
              </form>
            ) : (
              <><p className="ln-small ln-muted" style={{ margin: 0 }}>{t('emp.home.weEmailOneTime', { email: me.user?.email })}</p>
                <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={request} disabled={busy}>{busy ? t('emp.home.sending') : t('emp.home.emailMeCode')}</button></>
            )}
        </Step>
        <Step n={3} done={s.approved} title={t('emp.home.qubirexApproval')}>
          <p className="ln-small ln-muted" style={{ margin: 0 }}>
            {s.approved ? t('emp.home.approved') : e.kyb_status === 'rejected' ? (e.kyb_note ? t('emp.home.notApprovedNote', { note: e.kyb_note }) : t('emp.home.notApproved')) : s.domain_verified ? t('emp.home.weReviewNewCompanies') : t('emp.home.startsOnceYourDomain')}
          </p>
        </Step>
      </div>}
    </>
  );
}
