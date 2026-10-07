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

const ITEMS = { skills: ['Skills and evidence', 'Your verified skills, when you last showed each one, and your Evidence ID.'], resume: ['Résumé', 'Your headline and summary.'], contact: ['Contact details', 'Your email and phone number.'] };
const STAGE_TAG = { requested: 'ln-tag-warning', access_granted: 'ln-tag-success', applied: 'ln-tag-info', interview: 'ln-tag-success', dayone: 'ln-tag-success', offer: 'ln-tag-success', hired: 'ln-tag-success', hold: 'ln-tag-neutral', not_now: 'ln-tag-neutral', declined: 'ln-tag-neutral', withdrawn: 'ln-tag-neutral' };
const day = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

function RequestCard({ r, onDone }) {
  const [items, setItems] = useState(() => new Set(r.asked));
  const [msg, setMsg] = useState('');
  const answer = async (yes) => {
    try { await api.post(`/learner/requests/${r.id}/respond`, { yes, items: [...items] }); onDone(); } catch (e) { setMsg(errMsg(e, 'Couldn’t send your answer.')); }
  };
  const withdraw = async () => {
    if (!window.confirm(`Stop sharing with ${r.employer}? They will no longer see anything about you.`)) return;
    try { await api.post(`/learner/requests/${r.id}/withdraw`); onDone(); } catch (e) { setMsg(errMsg(e, 'Couldn’t withdraw.')); }
  };
  return (
    <div className="ln-card" style={{ gap: 10 }}>
      <div className="ln-between ln-wrap" style={{ gap: 8 }}>
        <div className="ln-col" style={{ gap: 2 }}>
          <b style={{ fontSize: 16 }}><Building2 size={15} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 6 }} />{r.employer}</b>
          <span className="ln-small ln-muted">{r.role_title}{r.city ? ` · ${r.city}` : ''} · {day(r.created_at)}</span>
        </div>
        <div className="ln-row" style={{ gap: 6 }}>
          {r.interview_promised && <span className="ln-tag ln-tag-success"><Handshake size={13} aria-hidden="true" />Interview promised</span>}
          <span className={`ln-tag ${STAGE_TAG[r.stage] || 'ln-tag-neutral'}`}>{r.stage === 'requested' ? 'Waiting for you' : r.stage_label}</span>
        </div>
      </div>
      {r.stage === 'requested' ? (
        <>
          <span className="ln-small">They would like to see the items below. Tick what you are happy to share — you can stop sharing at any time.</span>
          {r.asked.map(k => (
            <label key={k} className="ln-check" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={items.has(k)} onChange={e => setItems(s => { const n = new Set(s); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
              <span className="ln-col" style={{ gap: 0 }}><span>{ITEMS[k][0]}</span><span className="ln-xs ln-muted">{ITEMS[k][1]}</span></span>
            </label>
          ))}
          {r.interview_promised && <span className="ln-xs ln-muted">If you say yes and meet their bar, they have promised you an interview.</span>}
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <button type="button" className="ln-btn ln-btn-primary" disabled={!items.size} onClick={() => answer(true)}>Yes, share {items.size} item{items.size === 1 ? '' : 's'}</button>
            <button type="button" className="ln-btn" onClick={() => answer(false)}>No thanks</button>
          </div>
        </>
      ) : !['declined', 'withdrawn', 'not_now'].includes(r.stage) && (
        <div className="ln-between ln-wrap" style={{ gap: 8 }}>
          <span className="ln-xs ln-muted">{r.shared.length ? `Sharing: ${r.shared.map(k => ITEMS[k][0].toLowerCase()).join(', ')}` : ''}</span>
          <button type="button" className="ln-btn ln-btn-sm" onClick={withdraw}>Withdraw</button>
        </div>
      )}
      {msg && <span className="ln-small ln-error" role="alert">{msg}</span>}
    </div>
  );
}

export default function Jobs() {
  const [city, setCity] = useState('');
  const url = `/learner/jobs-hub${city ? `?city=${encodeURIComponent(city)}` : ''}`;
  const { data, error, reload } = useCachedGet(url);
  const [msg, setMsg] = useState('');
  const refresh = () => { dropCached('/learner/jobs-hub'); reload(); };
  const act = async (fn, ok) => { setMsg(''); try { await fn(); setMsg(ok); refresh(); } catch (e) { setMsg(errMsg(e, 'Couldn’t do that.')); } };
  if (error && !data) return <div className="ln-error">{errMsg(error, 'Couldn’t load your jobs.')}</div>;
  const pending = data?.requests.filter(r => r.stage === 'requested').length || 0;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Jobs &amp; applications</h1>
          <span className="ln-sub">Employers who asked about you, jobs that fit, and where each application stands.</span></div>
        <label className="ln-selectwrap"><span><MapPin size={14} aria-hidden="true" /> City</span>
          <select value={city} onChange={e => setCity(e.target.value)}><option value="">All cities</option>{(data?.cities || []).map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      </header>
      {msg && <div className="ln-note" role="status">{msg}</div>}
      {!data ? <LoadingRows rows={4} /> : (
        <>
          {!data.discoverable && (
            <div className="ln-card ln-card-warm ln-between ln-wrap" style={{ gap: 10 }}>
              <span className="ln-small"><b>Employers can’t find you yet.</b> Turn this on and verified employers can see your verified skills, college and city — never your name until you say yes.</span>
              <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" onClick={() => act(() => api.put('/learner/discoverable', { on: true }), 'Employers can now find you by your verified skills.')}>Let employers find me</button>
            </div>
          )}

          <section className="ln-col" style={{ gap: 12 }}>
            <h2 className="ln-h2">Employer requests{pending ? ` · ${pending} waiting for you` : ''}</h2>
            {data.requests.length === 0 ? <EmptyState title="No requests yet" text="When an employer asks to see your Passport, it appears here and you decide what to share." />
              : data.requests.map(r => <RequestCard key={r.id} r={r} onDone={refresh} />)}
          </section>

          <section className="ln-col" style={{ gap: 12 }}>
            <div className="ln-row" style={{ gap: 8 }}><h2 className="ln-h2">Employers hiring on Qubirex</h2>
              <WhyThis title="Points short">Readiness is how much of what the role asks for you have verified, from 0 to 100. Points short is the gap to the employer’s bar. Practise the missing skills to close it.</WhyThis></div>
            {data.roles.length === 0 ? <EmptyState title="No open roles in this city yet" text="Employers post roles here as they join. Job posts below are from the wider market." /> : (
              <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
                {data.roles.map(r => (
                  <div key={r.id} className="ln-card" style={{ gap: 8 }}>
                    <div className="ln-between" style={{ alignItems: 'flex-start', gap: 8 }}>
                      <div className="ln-col" style={{ gap: 2 }}><b>{r.title}</b><span className="ln-small ln-muted">{r.employer}{r.city ? ` · ${r.city}` : ''}</span></div>
                      {r.interview_promise && <span className="ln-tag ln-tag-success"><Handshake size={13} aria-hidden="true" />Interview promised</span>}
                    </div>
                    <span className="ln-small">{r.points_short === 0 ? <><CheckCircle2 size={14} aria-hidden="true" style={{ color: 'var(--status-success)', verticalAlign: -2 }} /> You meet their bar ({r.bar}).</> : <><b>{r.points_short} points short</b> of their bar ({r.readiness} of {r.bar}).</>}</span>
                    {r.missing.length > 0 && <span className="ln-xs ln-muted">Still to verify: {r.missing.join(', ')}</span>}
                    {r.stage ? <span className={`ln-tag ${STAGE_TAG[r.stage] || 'ln-tag-neutral'}`} style={{ alignSelf: 'flex-start' }}>{r.stage === 'requested' ? 'They asked about you' : r.stage === 'applied' ? 'Applied' : r.stage}</span>
                      : <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => { if (window.confirm(`Apply to ${r.title} at ${r.employer}? They will see your name, verified skills, résumé and contact details.`)) act(() => api.post(`/learner/roles/${r.id}/apply`), 'Applied. You can withdraw any time.'); }}>Apply</button>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="ln-col" style={{ gap: 12 }}>
            <div className="ln-row" style={{ gap: 8 }}><h2 className="ln-h2">Job posts that fit</h2><SampleBadge /></div>
            <div className="ln-tablewrap"><table className="ln-table">
              <thead><tr><th>Job</th><th>City</th><th>Salary</th><th>Your readiness</th><th /></tr></thead>
              <tbody>{data.posts.map(p => (
                <tr key={p.id}>
                  <td><Link to={`/learn/market/${p.id}`} className="ln-link">{p.title}</Link><span className="ln-xs ln-muted" style={{ display: 'block' }}>{p.company_type}</span></td>
                  <td className="ln-small">{p.city}</td><td className="ln-small">{p.salary_min}–{p.salary_max} LPA</td>
                  <td className="ln-small">{p.readiness}{p.points_short ? ` · ${p.points_short} points short of Ready` : ' · Ready'}</td>
                  <td>{data.applications.some(a => a.id === p.id && a.status === 'applied') ? <span className="ln-tag ln-tag-info">Applied</span>
                    : <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(() => api.post(`/learner/posts/${p.id}/apply`), 'Marked as applied.')}>I applied</button>}</td>
                </tr>
              ))}</tbody></table></div>
          </section>

          <section className="ln-col" style={{ gap: 12 }}>
            <h2 className="ln-h2">My applications</h2>
            {data.applications.length === 0 ? <EmptyState title="No applications yet" text="Mark a job post as applied to keep track of it here." /> : (
              <div className="ln-tablewrap"><table className="ln-table">
                <thead><tr><th>Job</th><th>City</th><th>Status</th><th /></tr></thead>
                <tbody>{data.applications.map(a => (
                  <tr key={a.id}><td>{a.title}</td><td className="ln-small">{a.city}</td>
                    <td><span className={`ln-tag ${a.status === 'applied' ? 'ln-tag-info' : 'ln-tag-neutral'}`}>{a.status === 'applied' ? `Applied ${day(a.applied_at)}` : `Withdrawn ${day(a.withdrawn_at)}`}</span></td>
                    <td>{a.status === 'applied' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(() => api.post(`/learner/posts/${a.id}/withdraw`), 'Application withdrawn.')}>Withdraw</button>}</td></tr>
                ))}</tbody></table></div>
            )}
          </section>
        </>
      )}
    </>
  );
}
