// src/pages/employer/Insights.js — /employer/sponsor and /employer/colleges
// (v4.3 canvas E7, E10). Sponsor a cohort at a college with an interview
// promise; see which colleges have students ready for your roles. College
// groups under 5 students are never shown.
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { Bar } from '../../components/learn/ui';
import EmptyState, { LoadingRows } from '../../components/shared/EmptyState';
import { HowCounted } from '../../components/shared/Popover';
import { SmallSample } from '../../components/shared/SampleSize';
import { Select } from '../../components/shared/ui';

import { useUiLang } from '../../context/UiLangContext';
const STATUS = { proposed: ['emp.insights.status.waitingForTheCollege', 'ln-tag-warning'], accepted: ['emp.insights.status.accepted', 'ln-tag-success'], declined: ['emp.insights.status.declined', 'ln-tag-neutral'], running: ['emp.insights.status.running', 'ln-tag-info'], done: ['emp.insights.status.done', 'ln-tag-neutral'] };

export function SponsorPage() {
  const { t, fmtDate } = useUiLang();
  const [params] = useSearchParams();
  const { data: colleges } = useCachedGet('/employer/colleges');
  const { data: roles } = useCachedGet('/employer/roles');
  const { data: list, reload } = useCachedGet('/employer/sponsorships');
  const [f, setF] = useState({ institution_id: '', role_id: params.get('role') || '', seats: 20, interview_promise: true, message: '' });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const send = async (e) => {
    e.preventDefault(); setMsg('');
    try { await api.post('/employer/sponsorships', f); setMsg(t('emp.insights.sentCollegeDecidesWill')); dropCached('/employer/sponsorships'); reload(); } catch (err) { setMsg(errMsg(err)); }
  };
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('emp.insights.sponsorCohort')}</h1>
        <span className="ln-sub">{t('emp.insights.payCollegeCohortPractise')}</span></div></header>
      <form className="ln-card" style={{ gap: 12 }} onSubmit={send}>
        <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
          <div className="ln-field"><label className="ln-label" htmlFor="sp-c">{t('emp.insights.college')}</label>
            <Select id="sp-c" value={f.institution_id} onChange={set('institution_id')} required><option value="">{t('emp.insights.choose')}</option>{(colleges?.colleges || []).map(c => <option key={c.institution_id} value={c.institution_id}>{c.college}{c.city ? ` · ${c.city}` : ''}</option>)}</Select></div>
          <div className="ln-field"><label className="ln-label" htmlFor="sp-r">{t('emp.insights.forRole')}</label>
            <Select id="sp-r" value={f.role_id} onChange={set('role_id')}><option value="">{t('emp.insights.anyRole')}</option>{(roles || []).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</Select></div>
          <div className="ln-field"><label className="ln-label" htmlFor="sp-s">{t('emp.insights.seats')}</label><input id="sp-s" type="number" min="1" max="500" className="ln-input" value={f.seats} onChange={set('seats')} /></div>
          <label className="ln-check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.interview_promise} onChange={set('interview_promise')} />{t('emp.insights.interviewEveryoneWhoReaches')}</label>
        </div>
        <div className="ln-field"><label className="ln-label" htmlFor="sp-m">{t('emp.insights.messageCollegeOptional')}</label><textarea id="sp-m" className="ln-input" rows={3} value={f.message} onChange={set('message')} /></div>
        <span className="ln-xs ln-muted">{t('emp.insights.pricePerSeatPrice')}</span>
        {msg && <div className="ln-note" role="status">{msg}</div>}
        <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>{t('emp.insights.sendProposal')}</button>
      </form>
      <section className="ln-col" style={{ gap: 10 }}>
        <h2 className="ln-h2">{t('emp.insights.yourSponsorships')}</h2>
        {!list ? <LoadingRows /> : list.length === 0 ? <EmptyState title={t('emp.insights.noneYet')} /> : (
          <div className="ln-tablewrap"><table className="ln-table"><thead><tr><th>{t('emp.insights.college')}</th><th>{t('emp.insights.role')}</th><th>{t('emp.insights.seats')}</th><th>{t('emp.insights.status')}</th><th>{t('emp.insights.sent')}</th></tr></thead>
            <tbody>{list.map(s => <tr key={s.id}><td>{s.college}</td><td className="ln-small">{s.role_title || t('emp.insights.any')}</td><td>{s.seats}</td><td><span className={`ln-tag ${STATUS[s.status][1]}`}>{t(STATUS[s.status][0])}</span></td><td className="ln-small">{fmtDate(s.created_at)}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </>
  );
}

export function CollegesPage() {
  const { t } = useUiLang();
  const { data, error } = useCachedGet('/employer/colleges');
  if (error && !data) return <div className="ln-error">{errMsg(error, t('emp.insights.couldnTLoadColleges'))}</div>;
  if (!data) return <LoadingRows rows={5} />;
  const top = Math.max(1, ...data.skills.map(s => s.verified));
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('emp.insights.collegesInsights')}</h1>
        <span className="ln-sub">{t('emp.insights.whereStudentsReady')}{' '} {data.roles_used.length ? data.roles_used.join(', ') : t('emp.insights.yourRoles')} {' '}{t('emp.insights.whichSkillsScarce')}</span></div>
        <SmallSample n={data.total} /></header>
      {data.colleges.length === 0 ? <EmptyState title={t('emp.insights.noStudentsOpenEmployers')} text={t('emp.insights.collegesAppearHereAs')} /> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>{t('emp.insights.college')}</th><th>{t('emp.insights.students')}</th><th>{t('emp.insights.ready')}</th><th>{t('emp.insights.nearlyReady')}</th><th>{t('emp.insights.building')}</th><th>{t('emp.insights.mostMissing')}</th></tr></thead>
          <tbody>{data.colleges.map(g => (
            <tr key={g.institution_id}><td><b style={{ fontWeight: 600 }}>{g.college}</b><span className="ln-xs ln-muted" style={{ display: 'block' }}>{g.city || ''}</span></td>
              {g.too_few ? <td colSpan={5}><span className="sk-toofew-inline">{t('emp.insights.tooFewShow')}</span></td> : <>
                <td>{g.n}{g.small && <span className="ln-xs ln-muted"> {' '}{t('emp.insights.smallGroup')}</span>}</td><td>{g.ready}</td><td>{g.nearly}</td><td>{g.building}</td><td className="ln-small">{g.top_gap || '—'}</td></>}
            </tr>
          ))}</tbody></table></div>
      )}
      {data.skills.length > 0 && (
        <section className="ln-card" style={{ gap: 8 }}>
          <h2 className="ln-h2">{t('emp.insights.skillSupplyVsDemand')}</h2>
          {data.skills.map(s => (
            <div key={s.name} className="ln-row" style={{ gap: 10 }}><span className="ln-small" style={{ width: 180 }}>{s.name}</span>
              <div style={{ flex: 1 }}><Bar pct={(s.verified / top) * 100} label={t('emp.insights.verifiedVerified', { verified: s.verified })} /></div>
              <span className="ln-xs ln-muted" style={{ width: 190 }}>{t('emp.insights.verifiedVerified2', { verified: s.verified })}{' '} {s.market_share != null ? t('emp.insights.postsAsk', { pct: s.market_share }) : t('emp.insights.demandNotKnown')}</span></div>
          ))}
        </section>
      )}
      <HowCounted>{t('emp.insights.countsOnlyStudentsWho')}</HowCounted>
    </>
  );
}
