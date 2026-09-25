// src/pages/inst/Standing.js — /institution/benchmark
// Job-match index for a cohort (verified skills only), compared with a
// regional benchmark, last year's batch (both sample) or another of your
// cohorts (live). Fit by target role, where you trail, and the students
// closest to job-ready — only those who opted in to share their record.
import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import api from '../../utils/api';
import { SampleBadge } from '../../components/learn/ui';

export default function Standing() {
  const [cohortId, setCohortId] = useState('');
  const [compare, setCompare] = useState('regional');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const p = new URLSearchParams({ compare });
    if (cohortId) p.set('engagement_id', cohortId);
    api.get(`/institution/insights/standing?${p}`)
      .then(r => { setData(r.data); if (!cohortId && r.data.cohort) setCohortId(r.data.cohort.id); })
      .catch(e => setError(e.response?.data?.error || 'Couldn’t load the comparison.'));
  }, [cohortId, compare]); // eslint-disable-line

  const exportTop = () => {
    const csv = ['name,learner_ref,best_role,match_pct', ...data.top.map(t => [t.name, t.learner_ref, t.role, t.match].join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'closest-to-job-ready.csv'; a.click();
  };

  if (error) return <div className="ln-error">{error}</div>;
  if (!data) return <p className="ln-muted">Loading…</p>;
  if (data.empty) return <><h1 className="ln-title">Where we stand</h1><div className="ln-card ln-muted">No cohorts in your scope yet.</div></>;
  const cmpLabel = data.comparison.label;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">Where we stand</h1>
          <span className="ln-sub">Your students’ verified skills, measured against job descriptions and a comparison group.</span>
        </div>
        <SampleBadge />
      </header>

      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>Cohort</span>
          <select value={cohortId} onChange={e => { setCohortId(e.target.value); if (e.target.value === compare) setCompare('regional'); }}>{data.cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <span className="ln-small ln-muted">compared with</span>
        <div className="ln-pilltabs" role="tablist">
          {data.compare_options.map(o => <button key={o.id} type="button" role="tab" className="ln-pilltab" aria-selected={compare === o.id} onClick={() => setCompare(o.id)}>{o.label}{o.sample ? '' : ' (live)'}</button>)}
        </div>
      </div>

      <div className="ln-grid ln-g-2" style={{ gap: 20 }}>
        <section className="ln-card ln-card-dark" style={{ gap: 12 }}>
          <span className="ln-kicker" style={{ color: 'var(--accent-400)' }}>Job-match index</span>
          <div className="ln-row" style={{ alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 72, fontWeight: 600, lineHeight: 1 }}>{data.index}</span>
            <span style={{ color: 'var(--stage-muted)' }}>vs <b style={{ color: 'var(--stage-text)' }}>{data.comparison.score}</b> {cmpLabel.toLowerCase()}</span>
          </div>
          <span className="ln-small" style={{ color: 'var(--stage-muted)', lineHeight: 1.6 }}>Average share of target-role JD skills your students have verified through mastery checks. Self-declared skills don’t count.</span>
          <span className="ln-small" style={{ color: data.change_30d >= 0 ? 'var(--stage-listen)' : '#F5C8BD' }}>{data.change_30d >= 0 ? '▲' : '▼'} {Math.abs(data.change_30d)} points since last month</span>
          <span className="ln-xs" style={{ color: 'var(--stage-muted)' }}>{data.students} students · target roles: {data.target_roles.join(', ') || '—'}</span>
        </section>
        <section className="ln-card">
          <div className="ln-between ln-wrap"><h2 className="ln-h2">Students by job-match band</h2>
            <div className="ln-row ln-xs" style={{ gap: 12 }}><span className="ln-row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent-700)' }} />{data.cohort.title}</span><span className="ln-row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-border-strong)' }} />{cmpLabel}</span></div></div>
          {data.bands.map(b => (
            <div key={b.label} className="ln-row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span className="ln-small" style={{ width: 90, flexShrink: 0 }}>{b.label}</span>
              <div className="ln-col" style={{ flex: 1, gap: 4 }}>
                <div className="ln-row" style={{ gap: 8 }}><div className="ln-bar" style={{ flex: 1, height: 12 }}><span style={{ width: `${b.ours}%` }} /></div><span className="ln-xs" style={{ width: 70 }}>{b.ours}% ({b.ours_count})</span></div>
                <div className="ln-row" style={{ gap: 8 }}><div className="ln-bar" style={{ flex: 1, height: 12 }}><span style={{ width: `${b.theirs}%`, background: 'var(--color-border-strong)' }} /></div><span className="ln-xs" style={{ width: 70 }}>{b.theirs}%</span></div>
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="ln-col" style={{ gap: 12 }}>
        <h2 className="ln-h2">Fit by target role</h2>
        <div className="ln-grid ln-g-3" style={{ gap: 14 }}>
          {data.roles.map(r => (
            <div key={r.role} className="ln-card" style={{ gap: 10, padding: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{r.role}</span>
              <div className="ln-row" style={{ gap: 20 }}>
                <div className="ln-col"><b style={{ fontSize: 24 }}>{r.ready}</b><span className="ln-xs ln-muted">students 70%+ match</span></div>
                <div className="ln-col"><b style={{ fontSize: 24 }}>{r.open ? r.open.toLocaleString('en-IN') : '—'}</b><span className="ln-xs ln-muted">open roles in region (sample)</span></div>
              </div>
              {r.gap && <span className="ln-small">Biggest gap: <b>{r.gap}</b></span>}
            </div>
          ))}
        </div>
      </section>

      <div className="ln-grid ln-g-2">
        <section className="ln-card">
          <h2 className="ln-h2">Where we trail {data.compare_options.find(o => o.id === compare)?.sample ? 'the benchmark' : cmpLabel}</h2>
          {data.trail.length === 0 ? <span className="ln-small ln-muted">You’re level with or ahead of the comparison on every skill we track.</span> : (
            <table className="ln-table"><thead><tr><th>Skill</th><th>Ours</th><th>{cmpLabel}</th><th>Gap</th></tr></thead>
              <tbody>{data.trail.map(t => <tr key={t.skill}><td style={{ fontWeight: 600 }}>{t.skill}</td><td>{t.ours}%</td><td>{t.bench}%</td><td style={{ color: 'var(--status-danger)', fontWeight: 600 }}>{t.gap}</td></tr>)}</tbody></table>
          )}
          <span className="ln-xs ln-muted">Share of students with the skill verified.</span>
        </section>
        <section className="ln-card">
          <div className="ln-between ln-wrap"><h2 className="ln-h2">Closest to job-ready</h2>{data.top.length > 0 && <button type="button" className="ln-btn ln-btn-sm" onClick={exportTop}><Download size={14} aria-hidden="true" />Share with placement cell</button>}</div>
          {data.top.length === 0 && <span className="ln-small ln-muted">No students in this cohort have opted in to share their capability record yet.</span>}
          {data.top.map(s => (
            <div key={s.learner_ref} className="ln-between" style={{ padding: '6px 0', borderTop: '1px solid var(--color-surface-2)' }}>
              <div className="ln-col"><b style={{ fontWeight: 600 }}>{s.name}</b><span className="ln-xs ln-muted">{s.role}</span></div>
              <span className={`ln-tag ln-tag-lg ${s.match >= 70 ? 'ln-tag-success' : 'ln-tag-neutral'}`}>{s.match}%</span>
            </div>
          ))}
          <span className="ln-xs ln-muted">Only students who opted in to share their capability record appear here ({data.opted_in} of {data.students}). Students choose this in their profile.</span>
        </section>
      </div>
    </>
  );
}
