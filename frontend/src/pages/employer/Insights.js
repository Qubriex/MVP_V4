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

const STATUS = { proposed: ['Waiting for the college', 'ln-tag-warning'], accepted: ['Accepted', 'ln-tag-success'], declined: ['Declined', 'ln-tag-neutral'], running: ['Running', 'ln-tag-info'], done: ['Done', 'ln-tag-neutral'] };

export function SponsorPage() {
  const [params] = useSearchParams();
  const { data: colleges } = useCachedGet('/employer/colleges');
  const { data: roles } = useCachedGet('/employer/roles');
  const { data: list, reload } = useCachedGet('/employer/sponsorships');
  const [f, setF] = useState({ institution_id: '', role_id: params.get('role') || '', seats: 20, interview_promise: true, message: '' });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const send = async (e) => {
    e.preventDefault(); setMsg('');
    try { await api.post('/employer/sponsorships', f); setMsg('Sent. The college decides and you will be notified.'); dropCached('/employer/sponsorships'); reload(); } catch (err) { setMsg(errMsg(err)); }
  };
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Sponsor a cohort</h1>
        <span className="ln-sub">Pay for a college cohort to practise what your role needs. Each student who reaches your bar gets an interview.</span></div></header>
      <form className="ln-card" style={{ gap: 12, maxWidth: 820 }} onSubmit={send}>
        <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
          <div className="ln-field"><label className="ln-label" htmlFor="sp-c">College</label>
            <select id="sp-c" className="ln-select" value={f.institution_id} onChange={set('institution_id')} required><option value="">Choose…</option>{(colleges?.colleges || []).map(c => <option key={c.institution_id} value={c.institution_id}>{c.college}{c.city ? ` · ${c.city}` : ''}</option>)}</select></div>
          <div className="ln-field"><label className="ln-label" htmlFor="sp-r">For role</label>
            <select id="sp-r" className="ln-select" value={f.role_id} onChange={set('role_id')}><option value="">Any role</option>{(roles || []).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></div>
          <div className="ln-field"><label className="ln-label" htmlFor="sp-s">Seats</label><input id="sp-s" type="number" min="1" max="500" className="ln-input" value={f.seats} onChange={set('seats')} /></div>
          <label className="ln-check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.interview_promise} onChange={set('interview_promise')} />Interview everyone who reaches the bar</label>
        </div>
        <div className="ln-field"><label className="ln-label" htmlFor="sp-m">Message to the college (optional)</label><textarea id="sp-m" className="ln-input" rows={3} value={f.message} onChange={set('message')} /></div>
        <span className="ln-xs ln-muted">Price per seat: [PRICE] + GST. You are invoiced only when the college accepts.</span>
        {msg && <div className="ln-note" role="status">{msg}</div>}
        <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>Send proposal</button>
      </form>
      <section className="ln-col" style={{ gap: 10 }}>
        <h2 className="ln-h2">Your sponsorships</h2>
        {!list ? <LoadingRows /> : list.length === 0 ? <EmptyState title="None yet" /> : (
          <div className="ln-tablewrap"><table className="ln-table"><thead><tr><th>College</th><th>Role</th><th>Seats</th><th>Status</th><th>Sent</th></tr></thead>
            <tbody>{list.map(s => <tr key={s.id}><td>{s.college}</td><td className="ln-small">{s.role_title || 'Any'}</td><td>{s.seats}</td><td><span className={`ln-tag ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span></td><td className="ln-small">{new Date(s.created_at).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </>
  );
}

export function CollegesPage() {
  const { data, error } = useCachedGet('/employer/colleges');
  if (error && !data) return <div className="ln-error">{errMsg(error, 'Couldn’t load colleges.')}</div>;
  if (!data) return <LoadingRows rows={5} />;
  const top = Math.max(1, ...data.skills.map(s => s.verified));
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Colleges &amp; insights</h1>
        <span className="ln-sub">Where students ready for {data.roles_used.length ? data.roles_used.join(', ') : 'your roles'} are, and which skills are scarce.</span></div>
        <SmallSample n={data.total} /></header>
      {data.colleges.length === 0 ? <EmptyState title="No students open to employers yet" text="Colleges appear here as their students turn on “Let employers find me”." /> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>College</th><th>Students</th><th>Ready</th><th>Nearly ready</th><th>Building</th><th>Most missing</th></tr></thead>
          <tbody>{data.colleges.map(g => (
            <tr key={g.institution_id}><td><b style={{ fontWeight: 600 }}>{g.college}</b><span className="ln-xs ln-muted" style={{ display: 'block' }}>{g.city || ''}</span></td>
              {g.too_few ? <td colSpan={5}><span className="sk-toofew-inline">Too few to show</span></td> : <>
                <td>{g.n}{g.small && <span className="ln-xs ln-muted"> · small group</span>}</td><td>{g.ready}</td><td>{g.nearly}</td><td>{g.building}</td><td className="ln-small">{g.top_gap || '—'}</td></>}
            </tr>
          ))}</tbody></table></div>
      )}
      {data.skills.length > 0 && (
        <section className="ln-card" style={{ gap: 8 }}>
          <h2 className="ln-h2">Skill supply vs demand</h2>
          {data.skills.map(s => (
            <div key={s.name} className="ln-row" style={{ gap: 10 }}><span className="ln-small" style={{ width: 180 }}>{s.name}</span>
              <div style={{ flex: 1 }}><Bar pct={(s.verified / top) * 100} label={`${s.verified} verified`} /></div>
              <span className="ln-xs ln-muted" style={{ width: 190 }}>{s.verified} verified · {s.market_share != null ? `${s.market_share}% of posts ask` : 'demand not known'}</span></div>
          ))}
        </section>
      )}
      <HowCounted>Counts only students who chose to be found. Colleges with fewer than 5 such students are hidden to protect privacy; groups under 20 are marked small.</HowCounted>
    </>
  );
}
