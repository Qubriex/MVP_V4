// src/pages/learn/Jobs.js — /learn/jobs: Jobs & applications (v4.3 canvas
// L5, L8). Employer requests answered yes or no per item, employers' roles
// with points short of their bar and the interview promise, job posts that
// fit (city filter), and every application with its status and Withdraw.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, CheckCircle2, Handshake } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { SampleBadge } from '../../components/learn/ui';
import EmptyState, { LoadingRows } from '../../components/shared/EmptyState';
import { WhyThis } from '../../components/shared/Popover';
import { Select } from '../../components/shared/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const ITEMS = { skills: ['learn.jobs.items.skillsAndEvidence', 'learn.jobs.items.yourVerifiedSkillsWhen'], resume: ['learn.jobs.items.rSum', 'learn.jobs.items.yourHeadlineAndSummary'], contact: ['learn.jobs.items.contactDetails', 'learn.jobs.items.yourEmailAndPhone'] };
const STAGE_TAG = { requested: 'ln-tag-warning', access_granted: 'ln-tag-success', applied: 'ln-tag-info', interview: 'ln-tag-success', dayone: 'ln-tag-success', offer: 'ln-tag-success', hired: 'ln-tag-success', hold: 'ln-tag-neutral', not_now: 'ln-tag-neutral', declined: 'ln-tag-neutral', withdrawn: 'ln-tag-neutral' };
const day = (s) => (s ? new Date(s).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' }) : '');

function RequestCard({ r, onDone }) {
  const { t } = useUiLang();
  const [items, setItems] = useState(() => new Set(r.asked));
  const [msg, setMsg] = useState('');
  const answer = async (yes) => {
    try { await api.post(`/learner/requests/${r.id}/respond`, { yes, items: [...items] }); onDone(); } catch (e) { setMsg(errMsg(e, t('learn.jobs.couldnTSendAnswer'))); }
  };
  const withdraw = async () => {
    if (!window.confirm(t('learn.jobs.stopSharingEmployerThey', { employer: r.employer }))) return;
    try { await api.post(`/learner/requests/${r.id}/withdraw`); onDone(); } catch (e) { setMsg(errMsg(e, t('learn.jobs.couldnTWithdraw'))); }
  };
  return (
    <div className="ln-card" style={{ gap: 10 }}>
      <div className="ln-between ln-wrap" style={{ gap: 8 }}>
        <div className="ln-col" style={{ gap: 2 }}>
          <b style={{ fontSize: 'var(--fs-h3)' }}><Building2 size={15} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 6 }} />{r.employer}</b>
          <span className="ln-small ln-muted">{r.role_title}{r.city ? ` · ${r.city}` : ''} · {day(r.created_at)}</span>
        </div>
        <div className="ln-row" style={{ gap: 6 }}>
          {r.interview_promised && <span className="ln-tag ln-tag-success"><Handshake size={13} aria-hidden="true" />{t('learn.jobs.interviewPromised')}</span>}
          <span className={`ln-tag ${STAGE_TAG[r.stage] || 'ln-tag-neutral'}`}>{r.stage === 'requested' ? t('learn.jobs.waiting') : r.stage_label}</span>
        </div>
      </div>
      {r.stage === 'requested' ? (
        <>
          <span className="ln-small">{t('learn.jobs.theyWouldLikeSee')}</span>
          {r.asked.map(k => (
            <label key={k} className="ln-check" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={items.has(k)} onChange={e => setItems(s => { const n = new Set(s); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
              <span className="ln-col" style={{ gap: 0 }}><span>{t(ITEMS[k][0])}</span><span className="ln-xs ln-muted">{t(ITEMS[k][1])}</span></span>
            </label>
          ))}
          {r.interview_promised && <span className="ln-xs ln-muted">{t('learn.jobs.ifSayYesMeet')}</span>}
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <button type="button" className="ln-btn ln-btn-primary" disabled={!items.size} onClick={() => answer(true)}>{t('learn.jobs.yesShareSizeItem', { size: items.size })}</button>
            <button type="button" className="ln-btn" onClick={() => answer(false)}>{t('learn.jobs.noThanks')}</button>
          </div>
        </>
      ) : !['declined', 'withdrawn', 'not_now'].includes(r.stage) && (
        <div className="ln-between ln-wrap" style={{ gap: 8 }}>
          <span className="ln-xs ln-muted">{r.shared.length ? t('learn.jobs.sharingList', { list: r.shared.map(k => t(ITEMS[k][0])).join(', ') }) : ''}</span>
          <button type="button" className="ln-btn ln-btn-sm" onClick={withdraw}>{t('learn.jobs.withdraw')}</button>
        </div>
      )}
      {msg && <span className="ln-small ln-error" role="alert">{msg}</span>}
    </div>
  );
}

export default function Jobs() {
  const { t } = useUiLang();
  const [city, setCity] = useState('');
  const url = `/learner/jobs-hub${city ? `?city=${encodeURIComponent(city)}` : ''}`;
  const { data, error, reload } = useCachedGet(url);
  const [msg, setMsg] = useState('');
  const refresh = () => { dropCached('/learner/jobs-hub'); reload(); };
  const act = async (fn, ok) => { setMsg(''); try { await fn(); setMsg(ok); refresh(); } catch (e) { setMsg(errMsg(e, t('learn.jobs.couldnTDo'))); } };
  if (error && !data) return <div className="ln-error">{errMsg(error, t('learn.jobs.couldnTLoadJobs'))}</div>;
  const pending = data?.requests.filter(r => r.stage === 'requested').length || 0;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('learn.jobs.jobsApplications')}</h1>
          <span className="ln-sub">{t('learn.jobs.employersWhoAskedAbout')}</span></div>
        <label className="ln-selectwrap"><span><MapPin size={14} aria-hidden="true" /> {' '}{t('learn.jobs.city')}</span>
          <Select value={city} onChange={e => setCity(e.target.value)}><option value="">{t('learn.jobs.allCities')}</option>{(data?.cities || []).map(c => <option key={c} value={c}>{c}</option>)}</Select></label>
      </header>
      {msg && <div className="ln-note" role="status">{msg}</div>}
      {!data ? <LoadingRows rows={4} /> : (
        <>
          {!data.discoverable && (
            <div className="ln-card ln-card-warm ln-between ln-wrap" style={{ gap: 10 }}>
              <span className="ln-small"><b>{t('learn.jobs.employersCanTFind')}</b> {' '}{t('learn.jobs.turnVerifiedEmployersCan')}</span>
              <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" onClick={() => act(() => api.put('/learner/discoverable', { on: true }), t('learn.jobs.employersCanNowFind'))}>{t('learn.jobs.letEmployersFindMe')}</button>
            </div>
          )}

          <section className="ln-col" style={{ gap: 12 }}>
            <h2 className="ln-h2">{t('learn.jobs.employerRequests')}{pending ? ` · ${t('learn.jobs.waitingForYou', { n: pending })}` : ''}</h2>
            {data.requests.length === 0 ? <EmptyState title={t('learn.jobs.noRequestsYet')} text={t('learn.jobs.whenEmployerAsksSee')} />
              : data.requests.map(r => <RequestCard key={r.id} r={r} onDone={refresh} />)}
          </section>

          <section className="ln-col" style={{ gap: 12 }}>
            <div className="ln-row" style={{ gap: 8 }}><h2 className="ln-h2">{t('learn.jobs.employersHiringQubirex')}</h2>
              <WhyThis title={t('learn.jobs.pointsShort')}>{t('learn.jobs.readinessHowMuchWhat')}</WhyThis></div>
            {data.roles.length === 0 ? <EmptyState title={t('learn.jobs.noOpenRolesCity')} text={t('learn.jobs.employersPostRolesHere')} /> : (
              <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
                {data.roles.map(r => (
                  <div key={r.id} className="ln-card" style={{ gap: 8 }}>
                    <div className="ln-between" style={{ alignItems: 'flex-start', gap: 8 }}>
                      <div className="ln-col" style={{ gap: 2 }}><b>{r.title}</b><span className="ln-small ln-muted">{r.employer}{r.city ? ` · ${r.city}` : ''}</span></div>
                      {r.interview_promise && <span className="ln-tag ln-tag-success"><Handshake size={13} aria-hidden="true" />{t('learn.jobs.interviewPromised')}</span>}
                    </div>
                    <span className="ln-small">{r.points_short === 0 ? <><CheckCircle2 size={14} aria-hidden="true" style={{ color: 'var(--status-success)', verticalAlign: -2 }} /> {' '}{t('learn.jobs.meetTheirBarBar', { bar: r.bar })}</> : <><b>{t('learn.jobs.pointsShortPointsShort', { points_short: r.points_short })}</b> {' '}{t('learn.jobs.theirBarReadinessBar', { readiness: r.readiness, bar: r.bar })}</>}</span>
                    {r.missing.length > 0 && <span className="ln-xs ln-muted">{t('learn.jobs.stillVerifyJoin', { join: r.missing.join(', ') })}</span>}
                    {r.stage ? <span className={`ln-tag ${STAGE_TAG[r.stage] || 'ln-tag-neutral'}`} style={{ alignSelf: 'flex-start' }}>{r.stage === 'requested' ? t('learn.jobs.theyAskedAbout') : r.stage === 'applied' ? t('learn.jobs.applied') : r.stage}</span>
                      : <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => { if (window.confirm('Apply to {title} at {employer}? They will see your name, verified skills, résumé and contact details.')) act(() => api.post(`/learner/roles/${r.id}/apply`), t('learn.jobs.appliedYouCanWithdraw')); }}>{t('learn.jobs.apply')}</button>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="ln-col" style={{ gap: 12 }}>
            <div className="ln-row" style={{ gap: 8 }}><h2 className="ln-h2">{t('learn.jobs.jobPostsFit')}</h2><SampleBadge /></div>
            <div className="ln-tablewrap"><table className="ln-table">
              <thead><tr><th>{t('learn.jobs.job')}</th><th>{t('learn.jobs.city')}</th><th>{t('learn.jobs.salary')}</th><th>{t('learn.jobs.yourReadiness')}</th><th /></tr></thead>
              <tbody>{data.posts.map(p => (
                <tr key={p.id}>
                  <td><Link to={`/learn/market/${p.id}`} className="ln-link">{p.title}</Link><span className="ln-xs ln-muted" style={{ display: 'block' }}>{p.company_type}</span></td>
                  <td className="ln-small">{p.city}</td><td className="ln-small">{p.salary_min}–{p.salary_max} LPA</td>
                  <td className="ln-small">{p.readiness}{p.points_short ? ` · ${t('learn.jobs.pointsShort', { n: p.points_short })}` : t('learn.jobs.ready')}</td>
                  <td>{data.applications.some(a => a.id === p.id && a.status === 'applied') ? <span className="ln-tag ln-tag-info">{t('learn.jobs.applied')}</span>
                    : <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(() => api.post(`/learner/posts/${p.id}/apply`), t('learn.jobs.markedAsApplied'))}>{t('learn.jobs.iApplied')}</button>}</td>
                </tr>
              ))}</tbody></table></div>
          </section>

          <section className="ln-col" style={{ gap: 12 }}>
            <h2 className="ln-h2">{t('learn.jobs.myApplications')}</h2>
            {data.applications.length === 0 ? <EmptyState title={t('learn.jobs.noApplicationsYet')} text={t('learn.jobs.markJobPostAs')} /> : (
              <div className="ln-tablewrap"><table className="ln-table">
                <thead><tr><th>{t('learn.jobs.job')}</th><th>{t('learn.jobs.city')}</th><th>{t('learn.jobs.status')}</th><th /></tr></thead>
                <tbody>{data.applications.map(a => (
                  <tr key={a.id}><td>{a.title}</td><td className="ln-small">{a.city}</td>
                    <td><span className={`ln-tag ${a.status === 'applied' ? 'ln-tag-info' : 'ln-tag-neutral'}`}>{a.status === 'applied' ? t('learn.jobs.appliedOn', { date: day(a.applied_at) }) : t('learn.jobs.withdrawnOn', { date: day(a.withdrawn_at) })}</span></td>
                    <td>{a.status === 'applied' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(() => api.post(`/learner/posts/${a.id}/withdraw`), t('learn.jobs.applicationWithdrawn'))}>{t('learn.jobs.withdraw')}</button>}</td></tr>
                ))}</tbody></table></div>
            )}
          </section>
        </>
      )}
    </>
  );
}
