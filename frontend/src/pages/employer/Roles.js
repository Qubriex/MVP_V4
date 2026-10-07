// src/pages/employer/Roles.js — /employer/roles and /employer/roles/:id
// (v4.3 canvas E2, E3). A role is made from a pasted job description: the
// skills are picked out and shown against how often the market asks for
// them. Search ranks students who opted in, anonymously; Watch is private,
// Request asks the student, near-misses lead to sponsoring a cohort.
import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Eye, Send, Handshake, X } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { Bar } from '../../components/learn/ui';
import Crumbs from '../../components/inst/Crumbs';
import EmptyState, { LoadingRows } from '../../components/shared/EmptyState';
import { WhyThis, HowCounted } from '../../components/shared/Popover';
import { useEmployer } from './Layout';

const BAND_TAG = { ready: 'ln-tag-success', nearly: 'ln-tag-info', building: 'ln-tag-warning' };

function NewRole({ onDone }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ title: '', city: '', jd_text: '', bar: 80, published: true, interview_promise: false });
  const [skills, setSkills] = useState(null);
  const [all, setAll] = useState([]);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const parse = async () => {
    setMsg('');
    try { const r = await api.post('/employer/roles/parse', { jd_text: f.jd_text }); setSkills(r.data.skills); setAll(r.data.all_skills); if (!r.data.skills.length) setMsg('No skills found in that text. Add them below.'); } catch (e) { setMsg(errMsg(e)); }
  };
  const save = async (e) => {
    e.preventDefault();
    try { const r = await api.post('/employer/roles', { ...f, skills }); dropCached('/employer/'); navigate(`/employer/roles/${r.data.id}`); } catch (err) { setMsg(errMsg(err, 'Couldn’t save the role.')); }
  };
  const add = (key) => { const s = all.find(x => x.key === key); if (s && !skills.some(x => x.key === key)) setSkills([...skills, { ...s, required: true, market_share: null }]); };
  return (
    <form className="ln-card" style={{ gap: 14, maxWidth: 900 }} onSubmit={save}>
      <h2 className="ln-h2">New role</h2>
      <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="r-title">Role title</label><input id="r-title" className="ln-input" value={f.title} onChange={set('title')} required placeholder="Data analyst (fresher)" /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="r-city">City</label><input id="r-city" className="ln-input" value={f.city} onChange={set('city')} placeholder="Hyderabad" /></div>
      </div>
      <div className="ln-field"><label className="ln-label" htmlFor="r-jd">Job description</label>
        <textarea id="r-jd" className="ln-input" rows={7} value={f.jd_text} onChange={set('jd_text')} placeholder={'Paste the job description. Lines with “nice to have” mark skills as optional.'} /></div>
      <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={parse} disabled={f.jd_text.trim().length < 20}>Pick out the skills</button>
      {skills && (
        <section className="ln-col" style={{ gap: 8 }}>
          <div className="ln-row" style={{ gap: 8 }}><span className="ln-label">Skills · your bar vs the market</span>
            <WhyThis title="Market share">How many current fresher job posts ask for this skill. A skill few posts ask for may shrink your pool of candidates.</WhyThis></div>
          {skills.map((s, i) => (
            <div key={s.key} className="ln-row ln-wrap" style={{ gap: 10 }}>
              <span style={{ width: 180, fontWeight: 600 }}>{s.name}</span>
              <div style={{ flex: 1, minWidth: 120 }}>{s.market_share != null ? <Bar pct={s.market_share} label={`${s.market_share}% of posts`} /> : <span className="ln-xs ln-muted">Market share not known</span>}</div>
              <span className="ln-xs ln-muted" style={{ width: 70 }}>{s.market_share != null ? `${s.market_share}% of posts` : ''}</span>
              <label className="ln-check ln-small"><input type="checkbox" checked={s.required} onChange={e => setSkills(skills.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />Required</label>
              <button type="button" className="in-iconbtn" aria-label={`Remove ${s.name}`} onClick={() => setSkills(skills.filter((_, j) => j !== i))}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
          <select className="ln-select" style={{ maxWidth: 260 }} aria-label="Add a skill" value="" onChange={e => add(e.target.value)}>
            <option value="">+ Add a skill</option>{all.filter(a => !skills.some(s => s.key === a.key)).map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
          </select>
          <div className="ln-grid ln-g-3" style={{ gap: 12, alignItems: 'end' }}>
            <div className="ln-field"><label className="ln-label" htmlFor="r-bar">Your bar: {f.bar}</label><input id="r-bar" type="range" min="50" max="100" step="5" value={f.bar} onChange={set('bar')} /></div>
            <label className="ln-check"><input type="checkbox" checked={f.published} onChange={set('published')} />Publish as a target for colleges</label>
            <label className="ln-check"><input type="checkbox" checked={f.interview_promise} onChange={set('interview_promise')} />Promise an interview to anyone at the bar</label>
          </div>
        </section>
      )}
      {msg && <div className="ln-note" role="status">{msg}</div>}
      <div className="ln-row" style={{ gap: 8 }}><button type="submit" className="ln-btn ln-btn-primary" disabled={!skills?.length || !f.title}>Save role</button><button type="button" className="ln-btn" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

export function RoleList() {
  const [params, setParams] = useSearchParams();
  const { data } = useCachedGet('/employer/roles');
  const creating = params.get('new') === '1';
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Roles</h1><span className="ln-sub">What you hire for, the bar you set, and how it compares with the market.</span></div>
        {!creating && <button type="button" className="ln-btn ln-btn-primary" onClick={() => setParams({ new: '1' })}><Plus size={16} aria-hidden="true" />New role</button>}
      </header>
      {creating && <NewRole onDone={() => setParams({})} />}
      {!data ? <LoadingRows /> : data.length === 0 && !creating ? <EmptyState title="No roles yet" text="Paste a job description to create one." /> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>Role</th><th>City</th><th>Bar</th><th>Skills</th><th>In pipeline</th><th /></tr></thead>
          <tbody>{data.map(r => (
            <tr key={r.id}><td><Link to={`/employer/roles/${r.id}`} className="ln-link">{r.title}</Link>{r.interview_promise && <span className="ln-tag ln-tag-success" style={{ marginLeft: 6 }}>Interview promise</span>}</td>
              <td className="ln-small">{r.city || 'Any'}</td><td>{r.bar}</td><td className="ln-small">{r.skills.map(s => s.name).join(', ')}</td><td>{r.in_pipeline}</td>
              <td><span className={`ln-tag ${r.status === 'open' ? 'ln-tag-info' : 'ln-tag-neutral'}`}>{r.status === 'open' ? (r.published ? 'Open · published' : 'Open') : 'Closed'}</span></td></tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}

export function RoleSearch() {
  const { id } = useParams();
  const { me } = useEmployer();
  const [city, setCity] = useState('');
  const [band, setBand] = useState('');
  const url = `/employer/roles/${id}/candidates?city=${encodeURIComponent(city)}&band=${band}`;
  const { data, error, reload } = useCachedGet(url);
  const [msg, setMsg] = useState('');
  const verified = me?.employer?.kyb_status === 'verified';
  const act = async (ref, kind) => {
    setMsg('');
    try { await api.post(`/employer/roles/${id}/candidates/${ref}/${kind}`, {}); setMsg(kind === 'request' ? 'Request sent. The student decides what to share; you will be notified.' : 'Added to your watch list. The student is not told.'); dropCached(`/employer/roles/${id}`); reload(); } catch (e) { setMsg(errMsg(e)); }
  };
  if (error && !data) return <div className="ln-error">{errMsg(error, 'Couldn’t load candidates.')}</div>;
  if (!data) return <LoadingRows rows={5} />;
  const { role } = data;
  const near = data.candidates.filter(c => !c.meets_bar && c.points_short <= 20);
  return (
    <>
      <Crumbs items={[{ label: 'Roles', to: '/employer/roles' }, { label: role.title }]} />
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title" style={{ fontSize: 30 }}>{role.title}</h1>
          <span className="ln-sub">{role.city || 'Any city'} · bar {role.bar} · {role.skills.map(s => `${s.name}${s.required ? '' : ' (optional)'}`).join(', ')}</span></div>
      </header>
      {!verified && <div className="ln-note">You can watch candidates now. Requests open once your company is verified.</div>}
      {msg && <div className="ln-note" role="status">{msg}</div>}
      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>City</span><select value={city} onChange={e => setCity(e.target.value)}><option value="">Any</option>{['Hyderabad', 'Bengaluru', 'Visakhapatnam', 'Vijayawada', 'Remote'].map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="ln-selectwrap"><span>Readiness</span><select value={band} onChange={e => setBand(e.target.value)}><option value="">All</option><option value="ready">Ready</option><option value="nearly">Nearly ready</option><option value="building">Building</option></select></label>
        <span className="ln-small ln-muted">{data.total} student{data.total === 1 ? '' : 's'} open to employers</span>
      </div>
      <div className="ln-grid" style={{ gridTemplateColumns: 'minmax(0, 2.2fr) minmax(260px, 1fr)', gap: 16 }}>
        <section className="ln-col" style={{ gap: 10, minWidth: 0 }}>
          {data.candidates.length === 0 ? <EmptyState title="No candidates match yet" text="Only students who turned on “Let employers find me” appear. Try another city, or publish the role so colleges can prepare students for it." /> : (
            <div className="ln-tablewrap"><table className="ln-table">
              <thead><tr><th>Candidate</th><th>Readiness</th><th>Verified</th><th>Still missing</th><th /></tr></thead>
              <tbody>{data.candidates.map(c => (
                <tr key={c.ref}>
                  <td><b className="in-code">{c.code}</b><span className="ln-xs ln-muted" style={{ display: 'block' }}>{c.college} · {c.city || '—'}</span></td>
                  <td><span className={`ln-tag ${BAND_TAG[c.band]}`}>{c.readiness} · {c.band_label}</span>{!c.meets_bar && <span className="ln-xs ln-muted" style={{ display: 'block' }}>{c.points_short} short of your bar</span>}</td>
                  <td className="ln-small">{c.verified.join(', ') || '—'}</td>
                  <td className="ln-small">{c.missing.join(', ') || '—'}</td>
                  <td>{c.stage ? <span className="ln-tag ln-tag-neutral">{c.stage === 'watching' ? 'Watching' : c.stage === 'requested' ? 'Asked' : 'In pipeline'}</span> : (
                    <div className="ln-row" style={{ gap: 6 }}>
                      <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(c.ref, 'watch')}><Eye size={13} aria-hidden="true" />Watch</button>
                      <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" disabled={!verified} onClick={() => act(c.ref, 'request')}><Send size={13} aria-hidden="true" />Request</button>
                    </div>
                  )}{c.stage === 'watching' && <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" style={{ marginLeft: 6 }} disabled={!verified} onClick={() => act(c.ref, 'request')}>Request</button>}</td>
                </tr>
              ))}</tbody></table></div>
          )}
          <HowCounted>Readiness = how much of this role’s skills the student has verified in checks (not self-declared), weighted so required skills count double. Names stay hidden until the student says yes.</HowCounted>
        </section>
        <aside className="ln-col" style={{ gap: 12 }}>
          <section className="ln-card" style={{ gap: 8 }}>
            <h2 className="ln-h2" style={{ fontSize: 17 }}>Best colleges for this role</h2>
            {data.colleges.length === 0 && <span className="ln-small ln-muted">None yet.</span>}
            {data.colleges.map(g => (
              <div key={g.institution_id} className="ln-between ln-small" style={{ gap: 8 }}>
                <span>{g.college}<span className="ln-xs ln-muted"> · {g.city || ''}</span></span>
                {g.too_few ? <span className="sk-toofew-inline">Too few to show</span> : <span>{g.at_bar} at bar · {g.near} near</span>}
              </div>
            ))}
          </section>
          {near.length > 0 && (
            <section className="ln-card ln-card-warm" style={{ gap: 8 }}>
              <b>{near.length} near-miss{near.length === 1 ? '' : 'es'}</b>
              <span className="ln-small">Within 20 points of your bar. Sponsoring a cohort at their college pays for focused practice, with your interview promise.</span>
              <Link to={`/employer/sponsor?role=${role.id}`} className="ln-btn ln-btn-sm ln-btn-primary" style={{ alignSelf: 'flex-start' }}><Handshake size={14} aria-hidden="true" />Sponsor a cohort</Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
