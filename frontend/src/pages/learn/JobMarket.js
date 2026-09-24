// src/pages/learn/JobMarket.js — /learn/market
// Filters, headline numbers, monthly demand, the skills JDs ask for most
// (tagged mastered / in your path / not in path), and job cards with match %
// and skill chips. All market figures are sample data for now.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Bookmark, BookmarkCheck } from 'lucide-react';
import api, { getOr } from '../../utils/api';
import { MOCK_JOBS, MOCK_TRENDS } from '../../utils/learnerMockData';
import { MatchRing, SampleBadge, SkillChip, StatusTag, salary, posted } from '../../components/learn/ui';

const SALARY_STEPS = [0, 3, 4, 5, 6];

export default function JobMarket() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [city, setCity] = useState(params.get('city') || 'Hyderabad');
  const [mode, setMode] = useState('');
  const [minSalary, setMinSalary] = useState(3);
  const [onlyGood, setOnlyGood] = useState(true);
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('match');
  const [jobs, setJobs] = useState(null);
  const [trends, setTrends] = useState(null);
  const [tableView, setTableView] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams({ tab, sort, min_salary: minSalary, min_match: onlyGood ? 60 : 0 });
    if (q.trim()) p.set('q', q.trim());
    if (city) p.set('city', city);
    if (mode) p.set('mode', mode);
    return p.toString();
  }, [q, city, mode, minSalary, onlyGood, tab, sort]);

  useEffect(() => {
    const id = setTimeout(() => getOr(`/market/jobs?${query}`, MOCK_JOBS, d => d && Array.isArray(d.jobs)).then(setJobs), 200);
    return () => clearTimeout(id);
  }, [query]);
  useEffect(() => {
    getOr(`/market/trends${city ? `?city=${encodeURIComponent(city)}` : ''}`, MOCK_TRENDS, d => d && Array.isArray(d.months)).then(setTrends);
  }, [city]);
  useEffect(() => { setParams(q.trim() ? { q: q.trim(), city } : { city }, { replace: true }); }, [q, city, setParams]);

  const toggleSave = async (job) => {
    const saved = !!job.saved_status;
    try {
      await (saved ? api.delete(`/market/jobs/${job.id}/save`) : api.post(`/market/jobs/${job.id}/save`));
      setJobs(prev => ({ ...prev, jobs: prev.jobs.map(j => (j.id === job.id ? { ...j, saved_status: saved ? null : 'saved' } : j)) }));
    } catch (e) { /* offline — leave as is */ }
  };

  const max = Math.max(1500, ...(trends?.months || []).map(m => m.count));
  const axisTop = Math.ceil(max / 500) * 500;
  const k = trends?.kpis;
  const cities = jobs?.filters?.cities || MOCK_JOBS.filters.cities;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">Job market</h1>
          <span className="ln-sub">Roles hiring now, read against the skills you have mastered.</span>
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 10 }}>
          <SampleBadge />
          <span className="ln-small ln-muted">Source: {jobs?.source || 'Sample feed'}</span>
        </div>
      </header>

      <div role="search" className="ln-filterbar">
        <label className="ln-search">
          <Search size={18} aria-hidden="true" />
          <input aria-label="Role or skill" placeholder="Role or skill, e.g. React developer" value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <label className="ln-selectwrap"><span>City</span>
          <select value={city} onChange={e => setCity(e.target.value)}><option value="">Any</option>{cities.map(c => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="ln-selectwrap"><span>Mode</span>
          <select value={mode} onChange={e => setMode(e.target.value)}><option value="">Any</option>{['On-site', 'Hybrid', 'Remote'].map(m => <option key={m}>{m}</option>)}</select>
        </label>
        <label className="ln-selectwrap"><span>Salary</span>
          <select value={minSalary} onChange={e => setMinSalary(Number(e.target.value))}>{SALARY_STEPS.map(v => <option key={v} value={v}>{v ? `₹${v} LPA+` : 'Any'}</option>)}</select>
        </label>
        <label className="ln-check" style={{ minHeight: 44, padding: '0 8px' }}><input type="checkbox" checked={onlyGood} onChange={e => setOnlyGood(e.target.checked)} />Only 60%+ match</label>
      </div>

      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Open fresher roles{city ? ` · ${city}` : ''}</span><span className="ln-stat">{k ? k.open_roles.toLocaleString('en-IN') : '—'}</span><span className="ln-xs ln-muted">{k && k.open_roles_change >= 0 ? `Up ${k.open_roles_change.toLocaleString('en-IN')} on last month` : 'Down on last month'}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Median fresher salary</span><span className="ln-stat">{k ? `₹${k.median_salary_lpa} LPA` : '—'}</span><span className="ln-xs ln-muted">Across listed ranges</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Fastest-growing role</span><span className="ln-stat" style={{ fontSize: 24 }}>{k?.fastest_growing_role || '—'}</span><Link to="/learn/topics" className="ln-xs ln-link" style={{ fontSize: 12 }}>See emerging topics</Link></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Your best match</span><span className="ln-stat">{k?.best_match ? `${k.best_match.match}%` : '—'}</span><span className="ln-xs ln-muted">{k?.best_match?.title}</span></div>
      </div>

      <div className="ln-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        <section className="ln-card">
          <div className="ln-between" style={{ alignItems: 'baseline' }}>
            <h2 className="ln-h2" style={{ fontSize: 17 }}>Open fresher roles{city ? ` in ${city}` : ''}, by month</h2>
            <button type="button" className="ln-btn ln-btn-sm" aria-pressed={tableView} onClick={() => setTableView(v => !v)}>{tableView ? 'Chart view' : 'Table view'}</button>
          </div>
          {tableView ? (
            <table className="ln-table"><thead><tr><th>Month</th><th>Open roles</th></tr></thead>
              <tbody>{(trends?.months || []).map(m => <tr key={m.label}><td>{m.label}</td><td>{m.count.toLocaleString('en-IN')}</td></tr>)}</tbody></table>
          ) : (
            <div className="ln-chart" role="img" aria-label={`Open roles by month: ${(trends?.months || []).map(m => `${m.label} ${m.count}`).join(', ')}`}>
              <div className="ln-chart-axis">{[axisTop, axisTop * (2 / 3), axisTop / 3, 0].map(v => <span key={v}>{Math.round(v).toLocaleString('en-IN')}</span>)}</div>
              <div className="ln-chart-plot">
                <div className="ln-chart-bars">
                  {(trends?.months || []).map(m => (
                    <div key={m.label} className="ln-chart-col">
                      <span className="ln-xs" style={{ fontWeight: 600, fontSize: 11 }}>{m.count.toLocaleString('en-IN')}</span>
                      <i style={{ height: `${(m.count / axisTop) * 88}%` }} />
                    </div>
                  ))}
                </div>
                <div className="ln-chart-x">{(trends?.months || []).map(m => <span key={m.label}>{m.label}</span>)}</div>
              </div>
            </div>
          )}
        </section>

        <section className="ln-card" style={{ gap: 12 }}>
          <h2 className="ln-h2" style={{ fontSize: 17 }}>Skills JDs ask for most</h2>
          {(trends?.skills || []).map(a => (
            <div key={a.name} className="ln-askrow">
              <span style={{ fontWeight: 500 }}>{a.name}</span>
              <div className="ln-bar"><span style={{ width: `${a.pct}%` }} /></div>
              <span style={{ fontWeight: 600, textAlign: 'right' }}>{a.pct}%</span>
              <StatusTag status={a.status} />
            </div>
          ))}
          <span className="ln-xs ln-muted">Share of open JDs in your filter that name the skill.</span>
        </section>
      </div>

      <section className="ln-col" style={{ gap: 14 }}>
        <div className="ln-between ln-wrap">
          <div className="ln-tabs" role="tablist">
            {[['all', 'All matches'], ['saved', 'Saved'], ['applied', 'Applied']].map(([id, label]) => (
              <button key={id} type="button" role="tab" className="ln-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label} · {jobs?.counts?.[id] ?? 0}</button>
            ))}
          </div>
          <label className="ln-selectwrap"><span>Sort</span>
            <select value={sort} onChange={e => setSort(e.target.value)}><option value="match">Best match</option><option value="recent">Most recent</option><option value="salary">Highest salary</option></select>
          </label>
        </div>

        {jobs && jobs.jobs.length === 0 && <div className="ln-card ln-muted" style={{ alignItems: 'center', textAlign: 'center' }}>No roles match these filters. Try another city or turn off “Only 60%+ match”.</div>}
        {(jobs?.jobs || []).map(j => (
          <article key={j.id} className="ln-jobcard">
            <MatchRing pct={j.match} />
            <div className="ln-col" style={{ gap: 8, minWidth: 0 }}>
              <div className="ln-row ln-wrap" style={{ gap: 10, alignItems: 'baseline' }}>
                <Link to={`/learn/market/${j.id}`} style={{ fontSize: 17, fontWeight: 600 }}>{j.title}</Link>
                <span className="ln-small ln-muted">{j.company || j.company_type}</span>
              </div>
              <span className="ln-small">{[j.city, j.mode, salary(j.salary_min, j.salary_max), posted(j.posted_days_ago)].filter(Boolean).join(' · ')}</span>
              <div className="ln-row ln-wrap" style={{ gap: 6 }}>{j.skills.map(s => <SkillChip key={s.name} name={s.name} status={s.status} />)}</div>
            </div>
            <div className="ln-col" style={{ gap: 8 }}>
              <Link to={`/learn/market/${j.id}`} className="ln-btn ln-btn-primary">View JD &amp; gap</Link>
              <button type="button" className="ln-btn" onClick={() => toggleSave(j)} aria-pressed={!!j.saved_status}>
                {j.saved_status ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
                {j.saved_status === 'applied' ? 'Applied' : j.saved_status ? 'Saved' : 'Save'}
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
