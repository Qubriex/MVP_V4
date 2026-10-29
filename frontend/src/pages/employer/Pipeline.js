// src/pages/employer/Pipeline.js — /employer/pipeline and
// /employer/candidates/:id (v4.3 canvas E4, E6). The funnel, everyone in
// it with Nudge / Hold / CSV, and one candidate's evidence per skill with
// Interview · Hold · Not now. Names and evidence appear only after a yes.
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, BellRing, ExternalLink, Lock } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { Bar } from '../../components/learn/ui';
import Crumbs from '../../components/inst/Crumbs';
import EmptyState, { LoadingRows } from '../../components/shared/EmptyState';
import { HowCounted, Term } from '../../components/shared/Popover';
import { BandPill } from '../../components/shared/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const BAND_OF = { Ready: 'ready', 'Nearly ready': 'nearly', Building: 'building' };
const STAGE_TAG = { watching: 'ln-tag-neutral', requested: 'ln-tag-warning', access_granted: 'ln-tag-success', applied: 'ln-tag-success', interview: 'ln-tag-info', dayone: 'ln-tag-info', offer: 'ln-tag-success', hired: 'ln-tag-success', hold: 'ln-tag-neutral', not_now: 'ln-tag-neutral', declined: 'ln-tag-neutral', withdrawn: 'ln-tag-neutral' };
const FILTERS = [['', 'emp.pipeline.filters.everyone'], ['decide', 'emp.pipeline.filters.waitingForYou'], ['requested', 'emp.pipeline.filters.asked'], ['interview', 'emp.pipeline.filters.interview'], ['offer', 'emp.pipeline.filters.offer'], ['hold', 'emp.pipeline.filters.onHold']];
const day = (s) => (s ? new Date(s).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function PipelinePage() {
  const { t } = useUiLang();
  const { data, error, reload } = useCachedGet('/employer/pipeline');
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState('');
  if (error && !data) return <div className="ln-error">{errMsg(error, t('emp.pipeline.couldnTLoadPipeline'))}</div>;
  if (!data) return <LoadingRows rows={5} />;
  const act = async (fn, ok) => { setMsg(''); try { await fn(); setMsg(ok); dropCached('/employer/'); reload(); } catch (e) { setMsg(errMsg(e)); } };
  const csv = async () => {
    const r = await api.get('/employer/pipeline.csv', { responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'pipeline.csv'; a.click();
  };
  const rows = data.rows.filter(r => !filter || (filter === 'decide' ? ['access_granted', 'applied'].includes(r.stage) : r.stage === filter));
  const top = Math.max(1, ...data.funnel.map(f => f.n));
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('emp.pipeline.pipeline')}</h1><span className="ln-sub">{t('emp.pipeline.everyoneWatchAskedInterviewed')}</span></div>
        <button type="button" className="ln-btn" onClick={csv} disabled={!data.rows.length}><Download size={16} aria-hidden="true" />CSV</button>
      </header>
      <section className="ln-card" style={{ gap: 8 }}>
        <div className="ln-between"><h2 className="ln-h2">{t('emp.pipeline.funnel')}</h2><span className="ln-small ln-muted">{data.weeks_to_decide != null ? t('emp.pipeline.avgWeeksToDecide', { n: data.weeks_to_decide }) : t('emp.pipeline.noDecisionsYet')}</span></div>
        {data.funnel.map(f => (
          <div key={f.label} className="ln-row" style={{ gap: 10 }}><span className="ln-small" style={{ width: 150 }}>{f.label}</span><div style={{ flex: 1 }}><Bar pct={(f.n / top) * 100} label={`${f.label}: ${f.n}`} /></div><b style={{ width: 28, textAlign: 'right' }}>{f.n}</b></div>
        ))}
        <HowCounted>{t('emp.pipeline.weeksDecideAverageTime')}</HowCounted>
      </section>
      {msg && <div className="ln-note" role="status">{msg}</div>}
      <div className="ln-pilltabs" role="tablist">
        {FILTERS.map(([k, label]) => <button key={k} type="button" role="tab" className="ln-pilltab" aria-selected={filter === k} onClick={() => setFilter(k)}>{t(label)}</button>)}
      </div>
      {rows.length === 0 ? <EmptyState title={t('emp.pipeline.nobodyHereYet')} text={t('emp.pipeline.findCandidatesFromRole')} action={<Link to="/employer/roles" className="ln-btn ln-btn-sm">{t('emp.pipeline.roles')}</Link>} /> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>{t('emp.pipeline.candidate')}</th><th>{t('emp.pipeline.role')}</th><th>{t('emp.pipeline.readiness')}</th><th>{t('emp.pipeline.stage')}</th><th>{t('emp.pipeline.since')}</th><th /></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id}>
              <td>{r.name ? <Link to={`/employer/candidates/${r.id}`} className="ln-link">{r.name}</Link> : <Link to={`/employer/candidates/${r.id}`} className="ln-link in-code">{r.code}</Link>}<span className="ln-xs ln-muted" style={{ display: 'block' }}>{r.college}</span></td>
              <td className="ln-small">{r.role_title}{r.interview_promised && <span className="ln-xs ln-muted" style={{ display: 'block' }}>{t('emp.pipeline.interviewPromised')}</span>}</td>
              <td><BandPill band={BAND_OF[r.band_label] || 'none'} score={r.readiness} /></td>
              <td><span className={`ln-tag ${STAGE_TAG[r.stage]}`}>{r.stage_label}</span></td>
              <td className="ln-small">{r.waiting_days ? (r.waiting_days === 1 ? t('emp.common.oneDay') : t('emp.common.nDays', { n: r.waiting_days })) : t('emp.pipeline.today')}</td>
              <td><div className="ln-row" style={{ gap: 6 }}>
                {r.stage === 'requested' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(() => api.post(`/employer/pipeline/${r.id}/nudge`), t('emp.pipeline.reminderSent'))}><BellRing size={13} aria-hidden="true" />{t('emp.pipeline.nudge')}</button>}
                {['access_granted', 'applied', 'interview'].includes(r.stage) && <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(() => api.post(`/employer/pipeline/${r.id}/stage`, { stage: 'hold' }), t('emp.pipeline.putOnHold'))}>{t('emp.pipeline.hold')}</button>}
              </div></td>
            </tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}

export function CandidatePage() {
  const { t } = useUiLang();
  const { id } = useParams();
  const { data: c, error, reload } = useCachedGet(`/employer/candidates/${id}`);
  const [msg, setMsg] = useState('');
  if (error && !c) return <div className="ln-error">{errMsg(error, t('emp.pipeline.couldnTLoadCandidate'))}</div>;
  if (!c) return <LoadingRows rows={5} />;
  const stage = async (s, ok) => { setMsg(''); try { await api.post(`/employer/pipeline/${id}/stage`, { stage: s }); setMsg(ok); dropCached('/employer/'); reload(); } catch (e) { setMsg(errMsg(e)); } };
  return (
    <>
      <Crumbs items={[{ label: 'Pipeline', to: '/employer/pipeline' }, { label: c.name || c.code }]} />
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{c.name || <span className="in-code">{c.code}</span>}</h1>
          <span className="ln-sub">{c.role.title} · {c.college} · {c.city || '—'} · <span className="ln-tag ln-tag-info">{c.stage_label}</span></span>
        </div>
        {c.open && (
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => stage('interview', t('emp.pipeline.interviewInvitationSent'))}>{t('emp.pipeline.interview')}</button>
            <button type="button" className="ln-btn" onClick={() => stage('hold', t('emp.pipeline.onHold'))}>{t('emp.pipeline.hold')}</button>
            <button type="button" className="ln-btn" onClick={() => { if (window.confirm(t('emp.pipeline.tellTheStudentYou'))) stage('not_now', t('emp.pipeline.theStudentHasBeen')); }}>{t('emp.pipeline.notNow')}</button>
          </div>
        )}
      </header>
      {msg && <div className="ln-note" role="status">{msg}</div>}
      <div className="ln-grid ln-g-3" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('emp.pipeline.readinessRole')}</span><span className="ln-stat">{c.readiness}</span><span className="ln-row ln-wrap" style={{ gap: 6 }}><BandPill band={BAND_OF[c.band_label] || 'none'} /><span className="ln-xs ln-muted">{t('emp.pipeline.barBar', { bar: c.role.bar })}</span></span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('emp.pipeline.dayOnePracticeRun')}</span><span className="ln-stat" style={{ fontSize: 'var(--fs-h2)' }}>{c.dayone?.status === 'invited' ? t('emp.pipeline.invited') : t('emp.pipeline.notScheduled')}</span>
          {c.open && c.dayone?.status !== 'invited' && <button type="button" data-demo="dayone" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => stage('dayone', t('emp.pipeline.dayOnePracticeRun2'))}>{t('emp.pipeline.inviteDayOne')}</button>}</div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('emp.pipeline.evidenceId')}</span>
          {c.evidence_id ? <Link to={`/verify/${c.evidence_id}`} className="ln-link in-code" target="_blank" rel="noopener">{c.evidence_id} <ExternalLink size={12} aria-hidden="true" /></Link> : <span className="ln-small ln-muted">{c.open ? t('emp.pipeline.notShared') : t('emp.pipeline.shownAfterYes')}</span>}
          <span className="ln-xs ln-muted">{t('emp.pipeline.checkSignedChainPublic')}</span></div>
      </div>
      <section className="ln-card" style={{ gap: 10 }}>
        <h2 className="ln-h2">{t('emp.pipeline.skillsRoleAsks')}</h2>
        <div className="ln-row ln-wrap" style={{ gap: 6 }}>{c.skills.map(s => <span key={s.name} className={`ln-tag ${s.verified ? 'ln-tag-success' : 'ln-tag-neutral'}`}>{s.verified ? '✓ ' : ''}{s.name}{s.required ? '' : t('emp.pipeline.optional')}</span>)}</div>
      </section>
      {!c.open ? (
        <div className="sk-toofew" role="note"><Lock size={18} aria-hidden="true" /><b>{t('emp.pipeline.hiddenUntilStudentSays')}</b><span>{c.stage === 'requested' ? t('emp.pipeline.askedTheyHaveNot') : c.stage === 'watching' ? t('emp.pipeline.youAreWatchingRequest') : t('emp.pipeline.theySaidNoOr')}</span></div>
      ) : (
        <>
          <section className="ln-card" style={{ gap: 10 }}>
            <div className="ln-between"><h2 className="ln-h2">{t('emp.pipeline.evidencePerSkill')}</h2><span className="ln-xs ln-muted">{t('emp.pipeline.shared')}{' '} {c.shared.join(', ') || t('emp.pipeline.nothing')}</span></div>
            {c.evidence.length === 0 ? <span className="ln-small ln-muted">{c.shared.includes('skills') ? t('emp.pipeline.noVerifiedSkillsYet') : t('emp.pipeline.studentDidNotShare')}</span> : (
              <div className="ln-tablewrap"><table className="ln-table">
                <thead><tr><th>{t('emp.pipeline.skill')}</th><th>{t('emp.pipeline.label')}</th><th>{t('emp.pipeline.evidence')}</th><th>{t('emp.pipeline.lastShown')}</th><th>{t('emp.pipeline.fresh')}</th></tr></thead>
                <tbody>{c.evidence.map(s => (
                  <tr key={s.skill_id}><td><b style={{ fontWeight: 600 }}>{s.name}</b><span className="ln-xs ln-muted" style={{ display: 'block' }}>{s.nodes.map(n => n.node).join(', ')}</span></td>
                    <td className="ln-small">{s.label}</td><td className="ln-small"><Term k={s.evidence}>{s.evidence}</Term>{s.assurance ? <> · <Term k={s.assurance}>{s.assurance}</Term></> : null}</td>
                    <td className="ln-small">{day(s.last_demonstrated)}</td><td><Bar pct={Math.round((s.freshness || 0) * 100)} label={t('emp.pipeline.freshRound', { round: Math.round((s.freshness || 0) * 100) })} /></td></tr>
                ))}</tbody></table></div>
            )}
          </section>
          <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
            <section className="ln-card" style={{ gap: 6 }}><h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('emp.pipeline.rSum')}</h2>
              {c.resume ? <><b>{c.resume.headline}</b><span className="ln-small">{c.resume.summary}</span></> : <span className="ln-small ln-muted">{c.shared.includes('resume') ? t('emp.pipeline.notFilledYet') : t('emp.pipeline.notShared2')}</span>}</section>
            <section className="ln-card" style={{ gap: 6 }}><h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('emp.pipeline.contact')}</h2>
              {c.contact ? <span className="ln-small">{[c.contact.email, c.contact.phone].filter(Boolean).join(' · ') || t('emp.pipeline.noContactDetailsFile')}</span> : <span className="ln-small ln-muted">{t('emp.pipeline.notSharedUseInterview')}</span>}</section>
          </div>
          {['interview', 'dayone'].includes(c.stage) && (
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <button type="button" className="ln-btn ln-btn-primary" onClick={() => stage('offer', t('emp.pipeline.offerRecordedTheirCollege'))}>{t('emp.pipeline.recordOffer')}</button>
            </div>
          )}
          {c.stage === 'offer' && <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => stage('hired', t('emp.pipeline.markedAsHired'))}>{t('emp.pipeline.markAsHired')}</button>}
        </>
      )}
    </>
  );
}
