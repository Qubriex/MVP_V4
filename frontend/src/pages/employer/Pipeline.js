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

const STAGE_TAG = { watching: 'ln-tag-neutral', requested: 'ln-tag-warning', access_granted: 'ln-tag-success', applied: 'ln-tag-success', interview: 'ln-tag-info', dayone: 'ln-tag-info', offer: 'ln-tag-success', hired: 'ln-tag-success', hold: 'ln-tag-neutral', not_now: 'ln-tag-neutral', declined: 'ln-tag-neutral', withdrawn: 'ln-tag-neutral' };
const FILTERS = [['', 'Everyone'], ['decide', 'Waiting for you'], ['requested', 'Asked'], ['interview', 'Interview'], ['offer', 'Offer'], ['hold', 'On hold']];
const day = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function PipelinePage() {
  const { data, error, reload } = useCachedGet('/employer/pipeline');
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState('');
  if (error && !data) return <div className="ln-error">{errMsg(error, 'Couldn’t load the pipeline.')}</div>;
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
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Pipeline</h1><span className="ln-sub">Everyone you watch, asked or interviewed, and how long decisions take.</span></div>
        <button type="button" className="ln-btn" onClick={csv} disabled={!data.rows.length}><Download size={16} aria-hidden="true" />CSV</button>
      </header>
      <section className="ln-card" style={{ gap: 8 }}>
        <div className="ln-between"><h2 className="ln-h2">Funnel</h2><span className="ln-small ln-muted">{data.weeks_to_decide != null ? `${data.weeks_to_decide} weeks to decide on average` : 'No decisions yet'}</span></div>
        {data.funnel.map(f => (
          <div key={f.label} className="ln-row" style={{ gap: 10 }}><span className="ln-small" style={{ width: 150 }}>{f.label}</span><div style={{ flex: 1 }}><Bar pct={(f.n / top) * 100} label={`${f.label}: ${f.n}`} /></div><b style={{ width: 28, textAlign: 'right' }}>{f.n}</b></div>
        ))}
        <HowCounted>Weeks to decide = average time from first asking to interview, offer or “not now”.</HowCounted>
      </section>
      {msg && <div className="ln-note" role="status">{msg}</div>}
      <div className="ln-pilltabs" role="tablist">
        {FILTERS.map(([k, label]) => <button key={k} type="button" role="tab" className="ln-pilltab" aria-selected={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
      </div>
      {rows.length === 0 ? <EmptyState title="Nobody here yet" text="Find candidates from a role, then watch or request them." action={<Link to="/employer/roles" className="ln-btn ln-btn-sm">Roles</Link>} /> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>Candidate</th><th>Role</th><th>Readiness</th><th>Stage</th><th>Since</th><th /></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id}>
              <td>{r.name ? <Link to={`/employer/candidates/${r.id}`} className="ln-link">{r.name}</Link> : <Link to={`/employer/candidates/${r.id}`} className="ln-link in-code">{r.code}</Link>}<span className="ln-xs ln-muted" style={{ display: 'block' }}>{r.college}</span></td>
              <td className="ln-small">{r.role_title}{r.interview_promised && <span className="ln-xs ln-muted" style={{ display: 'block' }}>Interview promised</span>}</td>
              <td>{r.readiness} <span className="ln-xs ln-muted">{r.band_label}</span></td>
              <td><span className={`ln-tag ${STAGE_TAG[r.stage]}`}>{r.stage_label}</span></td>
              <td className="ln-small">{r.waiting_days ? `${r.waiting_days} day${r.waiting_days === 1 ? '' : 's'}` : 'Today'}</td>
              <td><div className="ln-row" style={{ gap: 6 }}>
                {r.stage === 'requested' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(() => api.post(`/employer/pipeline/${r.id}/nudge`), 'Reminder sent.')}><BellRing size={13} aria-hidden="true" />Nudge</button>}
                {['access_granted', 'applied', 'interview'].includes(r.stage) && <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(() => api.post(`/employer/pipeline/${r.id}/stage`, { stage: 'hold' }), 'Put on hold.')}>Hold</button>}
              </div></td>
            </tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}

export function CandidatePage() {
  const { id } = useParams();
  const { data: c, error, reload } = useCachedGet(`/employer/candidates/${id}`);
  const [msg, setMsg] = useState('');
  if (error && !c) return <div className="ln-error">{errMsg(error, 'Couldn’t load this candidate.')}</div>;
  if (!c) return <LoadingRows rows={5} />;
  const stage = async (s, ok) => { setMsg(''); try { await api.post(`/employer/pipeline/${id}/stage`, { stage: s }); setMsg(ok); dropCached('/employer/'); reload(); } catch (e) { setMsg(errMsg(e)); } };
  return (
    <>
      <Crumbs items={[{ label: 'Pipeline', to: '/employer/pipeline' }, { label: c.name || c.code }]} />
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title" style={{ fontSize: 30 }}>{c.name || <span className="in-code">{c.code}</span>}</h1>
          <span className="ln-sub">{c.role.title} · {c.college} · {c.city || '—'} · <span className="ln-tag ln-tag-info">{c.stage_label}</span></span>
        </div>
        {c.open && (
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => stage('interview', 'Interview invitation sent.')}>Interview</button>
            <button type="button" className="ln-btn" onClick={() => stage('hold', 'On hold.')}>Hold</button>
            <button type="button" className="ln-btn" onClick={() => { if (window.confirm('Tell the student you are not going ahead for now?')) stage('not_now', 'The student has been told, kindly.'); }}>Not now</button>
          </div>
        )}
      </header>
      {msg && <div className="ln-note" role="status">{msg}</div>}
      <div className="ln-grid ln-g-3" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Readiness for this role</span><span className="ln-stat">{c.readiness}</span><span className="ln-xs ln-muted">{c.band_label} · your bar {c.role.bar}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Day-One practice run</span><span className="ln-stat" style={{ fontSize: 20 }}>{c.dayone?.status === 'invited' ? 'Invited' : 'Not scheduled'}</span>
          {c.open && c.dayone?.status !== 'invited' && <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => stage('dayone', 'Day-One practice run invitation sent.')}>Invite to Day-One</button>}</div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Evidence ID</span>
          {c.evidence_id ? <Link to={`/verify/${c.evidence_id}`} className="ln-link in-code" target="_blank" rel="noopener">{c.evidence_id} <ExternalLink size={12} aria-hidden="true" /></Link> : <span className="ln-small ln-muted">{c.open ? 'Not shared' : 'Shown after a yes'}</span>}
          <span className="ln-xs ln-muted">Check the signed chain on the public verify page.</span></div>
      </div>
      <section className="ln-card" style={{ gap: 10 }}>
        <h2 className="ln-h2">Skills this role asks for</h2>
        <div className="ln-row ln-wrap" style={{ gap: 6 }}>{c.skills.map(s => <span key={s.name} className={`ln-tag ${s.verified ? 'ln-tag-success' : 'ln-tag-neutral'}`}>{s.verified ? '✓ ' : ''}{s.name}{s.required ? '' : ' (optional)'}</span>)}</div>
      </section>
      {!c.open ? (
        <div className="sk-toofew" role="note"><Lock size={18} aria-hidden="true" /><b>Hidden until the student says yes</b><span>{c.stage === 'requested' ? 'You asked; they have not answered yet.' : c.stage === 'watching' ? 'You are watching. Request to ask them.' : 'They said no or withdrew.'}</span></div>
      ) : (
        <>
          <section className="ln-card" style={{ gap: 10 }}>
            <div className="ln-between"><h2 className="ln-h2">Evidence per skill</h2><span className="ln-xs ln-muted">Shared: {c.shared.join(', ') || 'nothing'}</span></div>
            {c.evidence.length === 0 ? <span className="ln-small ln-muted">{c.shared.includes('skills') ? 'No verified skills yet.' : 'The student did not share skills and evidence.'}</span> : (
              <div className="ln-tablewrap"><table className="ln-table">
                <thead><tr><th>Skill</th><th>Label</th><th>Evidence</th><th>Last shown</th><th>Fresh</th></tr></thead>
                <tbody>{c.evidence.map(s => (
                  <tr key={s.skill_id}><td><b style={{ fontWeight: 600 }}>{s.name}</b><span className="ln-xs ln-muted" style={{ display: 'block' }}>{s.nodes.map(n => n.node).join(', ')}</span></td>
                    <td className="ln-small">{s.label}</td><td className="ln-small"><Term k={s.evidence}>{s.evidence}</Term>{s.assurance ? <> · <Term k={s.assurance}>{s.assurance}</Term></> : null}</td>
                    <td className="ln-small">{day(s.last_demonstrated)}</td><td><Bar pct={Math.round((s.freshness || 0) * 100)} label={`Fresh ${Math.round((s.freshness || 0) * 100)}%`} /></td></tr>
                ))}</tbody></table></div>
            )}
          </section>
          <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
            <section className="ln-card" style={{ gap: 6 }}><h2 className="ln-h2" style={{ fontSize: 17 }}>Résumé</h2>
              {c.resume ? <><b>{c.resume.headline}</b><span className="ln-small">{c.resume.summary}</span></> : <span className="ln-small ln-muted">{c.shared.includes('resume') ? 'Not filled in yet.' : 'Not shared.'}</span>}</section>
            <section className="ln-card" style={{ gap: 6 }}><h2 className="ln-h2" style={{ fontSize: 17 }}>Contact</h2>
              {c.contact ? <span className="ln-small">{[c.contact.email, c.contact.phone].filter(Boolean).join(' · ') || 'No contact details on file.'}</span> : <span className="ln-small ln-muted">Not shared. Use Interview to invite them through Qubirex.</span>}</section>
          </div>
          {['interview', 'dayone'].includes(c.stage) && (
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <button type="button" className="ln-btn ln-btn-primary" onClick={() => stage('offer', 'Offer recorded. Their college sees it on Placements.')}>Record an offer</button>
            </div>
          )}
          {c.stage === 'offer' && <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => stage('hired', 'Marked as hired.')}>Mark as hired</button>}
        </>
      )}
    </>
  );
}
