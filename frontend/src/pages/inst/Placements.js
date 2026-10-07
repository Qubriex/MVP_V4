// src/pages/inst/Placements.js — /institution/placements (v4.3 canvas I9):
// offers and placements, salary bands, 90-day ratings, sponsored cohorts.
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { useStaff } from '../../components/inst/InstitutionLayout';
import { Bar } from '../../components/learn/ui';
import EmptyState from '../../components/shared/EmptyState';
import { HowCounted } from '../../components/shared/Popover';
import { SmallSample, TooFew } from '../../components/shared/SampleSize';

const STATUS = { offer: ['Offer', 'ln-tag-info'], placed: ['Placed', 'ln-tag-success'], declined: ['Declined', 'ln-tag-warning'] };

function AddPlacement({ onDone }) {
  const { data: cohorts } = useCachedGet('/institution/engagements');
  const [cohortId, setCohortId] = useState('');
  const [learners, setLearners] = useState([]);
  const [f, setF] = useState({ el_id: '', employer_name: '', role_title: '', status: 'offer', salary_lpa: '', offer_date: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id); }, [cohorts, cohortId]);
  useEffect(() => {
    if (!cohortId) return;
    api.get(`/institution/engagements/${cohortId}`).then(r => setLearners(r.data.learners.filter(l => l.access !== 'removed'))).catch(() => {});
  }, [cohortId]);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/institution/placements', f); onDone(); } catch (err) { setMsg(errMsg(err, 'Couldn’t save.')); }
  };
  return (
    <form className="ln-card" style={{ gap: 12, maxWidth: 860 }} onSubmit={save}>
      <h2 className="ln-h2">Record an offer or placement</h2>
      <div className="ln-grid ln-g-3" style={{ gap: 12 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-c">Cohort</label><select id="pl-c" className="ln-select" value={cohortId} onChange={e => { setCohortId(e.target.value); setF(x => ({ ...x, el_id: '' })); }}>{(cohorts || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-s">Student</label><select id="pl-s" className="ln-select" value={f.el_id} onChange={set('el_id')} required><option value="">Choose…</option>{learners.map(l => <option key={l.el_id} value={l.el_id}>{l.name} · {l.learner_ref}</option>)}</select></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-st">Status</label><select id="pl-st" className="ln-select" value={f.status} onChange={set('status')}><option value="offer">Offer</option><option value="placed">Placed (joined)</option><option value="declined">Declined</option></select></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-e">Employer</label><input id="pl-e" className="ln-input" value={f.employer_name} onChange={set('employer_name')} required /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-r">Role</label><input id="pl-r" className="ln-input" value={f.role_title} onChange={set('role_title')} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-sal">Salary (LPA)</label><input id="pl-sal" type="number" step="0.1" min="0" className="ln-input" value={f.salary_lpa} onChange={set('salary_lpa')} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-d">Offer date</label><input id="pl-d" type="date" className="ln-input" value={f.offer_date} onChange={set('offer_date')} /></div>
      </div>
      {msg && <div className="ln-error" role="alert">{msg}</div>}
      <div className="ln-row" style={{ gap: 8 }}><button type="submit" className="ln-btn ln-btn-primary">Save</button><button type="button" className="ln-btn" onClick={() => onDone(false)}>Cancel</button></div>
    </form>
  );
}

function Rate({ p, onDone }) {
  const [n, setN] = useState(p.rating_90d || 0);
  const save = async (v) => { setN(v); await api.put(`/institution/placements/${p.id}`, { rating_90d: v }).catch(() => {}); onDone(); };
  return (
    <span className="ln-row" style={{ gap: 2 }} role="radiogroup" aria-label={`90-day rating for ${p.name}`}>
      {[1, 2, 3, 4, 5].map(v => (
        <button key={v} type="button" role="radio" aria-checked={n === v} aria-label={`${v} of 5`} onClick={() => save(v)} style={{ background: 'none', border: 0, padding: 2, cursor: 'pointer', color: v <= n ? 'var(--accent-500, #f4a93a)' : 'var(--color-text-muted)' }}>
          <Star size={15} fill={v <= n ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}

export default function Placements() {
  const { role } = useStaff();
  const { data, error, reload } = useCachedGet('/institution/placements');
  const [adding, setAdding] = useState(false);
  const refresh = () => { dropCached('/institution/placements'); dropCached('/institution/command-centre'); reload(); };
  if (error && !data) return <div className="ln-error">{errMsg(error, 'Couldn’t load placements.')}</div>;
  if (!data) return <p className="ln-muted">Loading…</p>;
  const { rows, summary: s } = data;
  const canEdit = role !== 'viewer';
  const maxBand = Math.max(1, ...s.salary_bands.map(b => b.count));
  const remove = async (id) => { if (window.confirm('Delete this record?')) { await api.delete(`/institution/placements/${id}`).catch(() => {}); refresh(); } };
  const setStatus = async (id, status) => { await api.put(`/institution/placements/${id}`, { status }).catch(() => {}); refresh(); };
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Placements</h1><span className="ln-sub">Offers, joinings and how students are doing 90 days in.</span></div>
        {canEdit && !adding && <button type="button" className="ln-btn ln-btn-primary" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />Record an offer</button>}
      </header>
      {adding && <AddPlacement onDone={(ok = true) => { setAdding(false); if (ok) refresh(); }} />}
      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Placed</span><span className="ln-stat">{s.placed}</span><span className="ln-xs ln-muted">students who joined</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Offers</span><span className="ln-stat">{s.offers}</span><span className="ln-xs ln-muted">not declined</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Median salary</span><span className="ln-stat">{s.median_salary_lpa != null ? `${s.median_salary_lpa} LPA` : '—'}</span><TooFew n={s.offers} compact><SmallSample n={s.offers} /></TooFew></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">90-day rating</span><span className="ln-stat">{s.avg_rating_90d != null ? `${s.avg_rating_90d} / 5` : '—'}</span><span className="ln-xs ln-muted">{s.rated_90d} rated · {s.sponsored_cohorts} sponsored cohort{s.sponsored_cohorts === 1 ? '' : 's'}</span></div>
      </div>
      <section className="ln-card" style={{ gap: 10 }}>
        <div className="ln-between"><h2 className="ln-h2">Salary bands</h2><SmallSample n={s.offers} /></div>
        <TooFew n={s.offers}>
          {s.salary_bands.map(b => (
            <div key={b.label} className="ln-row" style={{ gap: 10 }}>
              <span className="ln-small" style={{ width: 130 }}>{b.label}</span>
              <div style={{ flex: 1 }}><Bar pct={(b.count / maxBand) * 100} label={`${b.label}: ${b.count}`} /></div>
              <b style={{ width: 28, textAlign: 'right' }}>{b.count}</b>
            </div>
          ))}
        </TooFew>
        <HowCounted>Offers that were not declined, by yearly salary in lakhs. The 90-day rating is how the employer says the student is doing after three months, from 1 to 5.</HowCounted>
      </section>
      {rows.length === 0 ? <EmptyState title="No offers recorded yet" text="Record each offer here; employers on Qubirex add theirs automatically." /> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>Student</th><th>Employer · role</th><th>Status</th><th>Salary</th><th>90-day rating</th><th /></tr></thead>
          <tbody>{rows.map(p => (
            <tr key={p.id}>
              <td><b style={{ fontWeight: 600 }}>{p.name || '—'}</b> <span className="ln-xs ln-muted">{p.cohort}</span></td>
              <td className="ln-small">{p.employer_name}{p.role_title ? ` · ${p.role_title}` : ''}{p.source === 'employer' ? <span className="ln-tag ln-tag-info" style={{ marginLeft: 6 }}>from employer</span> : null}</td>
              <td>{canEdit ? (
                <select className="ln-select" style={{ minHeight: 32, width: 120 }} aria-label="Status" value={p.status} onChange={e => setStatus(p.id, e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
              ) : <span className={`ln-tag ${STATUS[p.status][1]}`}>{STATUS[p.status][0]}</span>}</td>
              <td>{p.salary_lpa ? `${p.salary_lpa} LPA` : '—'}</td>
              <td>{p.status === 'placed' && canEdit ? <Rate p={p} onDone={refresh} /> : p.rating_90d ? `${p.rating_90d} / 5` : '—'}</td>
              <td>{role === 'admin' && <button type="button" className="in-iconbtn" onClick={() => remove(p.id)} aria-label="Delete record"><Trash2 size={15} aria-hidden="true" /></button>}</td>
            </tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}
