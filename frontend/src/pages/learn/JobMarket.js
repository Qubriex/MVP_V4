// src/pages/learn/JobMarket.js — /learn/market
// Filters, headline numbers, monthly demand, the skills JDs ask for most
// (tagged mastered / in your path / not in path), and job cards with match %
// and skill chips. All market figures are sample data for now.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';
import api, { getOr } from '../../utils/api';
import { dropCached } from '../../utils/cachedGet';
import { MOCK_JOBS, MOCK_TRENDS } from '../../utils/learnerMockData';
import { MatchRing, SampleBadge, SkillChip, StatusTag, salary, posted } from '../../components/learn/ui';
import { Select } from '../../components/shared/ui';
import { SourceLine, AddToPlan } from '../../components/learn/journey';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const SALARY_STEPS = [0, 3, 4, 5, 6];

// Under a search: related roles (when few matched), topics to add to "My
// topics", and plain search links on job sites (role and city only).
function SearchHelp({ jobs, onPick }) {
  const { t } = useUiLang();
  const [added, setAdded] = useState({});
  const add = (id) => api.post(`/learner/courses/${id}/add`).then(() => { dropCached('/learner/courses'); setAdded(a => ({ ...a, [id]: true })); }).catch(() => {});
  const related = jobs.related_roles || [];
  const topics = jobs.topics || [];
  const outbound = jobs.outbound || [];
  if (!related.length && !topics.length && !outbound.length) return null;
  return (
    <section className="ln-card ln-col" style={{ gap: 10 }} aria-label={t('lj.market.searchHelp')} data-search-help>
      {related.length > 0 && (
        <div className="ln-row ln-wrap" style={{ gap: 6 }} data-related-roles>
          <span className="ln-small ln-muted">{t('lj.market.related')}</span>
          {related.map(r => <button key={r.title} type="button" className="ln-btn ln-btn-sm" onClick={() => onPick(r.q)}>{r.title}</button>)}
        </div>
      )}
      {topics.length > 0 && (
        <div className="ln-row ln-wrap" style={{ gap: 6 }} data-search-topics>
          <span className="ln-small ln-muted">{t('lj.market.learnFor')}</span>
          {topics.map(c => (
            <span key={c.id} className="ln-row" style={{ gap: 4 }}>
              <Link to={`/learn/courses/${c.id}`} state={{ from: '/learn/market' }} className="ln-link ln-small">{c.title}</Link>
              <button type="button" className="ln-btn ln-btn-sm" disabled={!!added[c.id]} onClick={() => add(c.id)} data-add-topic={c.id}>{added[c.id] ? t('lj.market.added') : t('lj.market.addTopic')}</button>
            </span>
          ))}
        </div>
      )}
      {outbound.length > 0 && (
        <div className="ln-row ln-wrap" style={{ gap: 6 }} data-outbound>
          <span className="ln-small ln-muted">{t('lj.market.alsoOn')}</span>
          {outbound.map(o => <a key={o.site} href={o.url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="ln-btn ln-btn-sm" data-site={o.site}>{o.site} <ExternalLink size={12} aria-hidden="true" /></a>)}
          <span className="ln-xs ln-muted" style={{ flexBasis: '100%' }}>{t('lj.market.outboundNote')}</span>
        </div>
      )}
    </section>
  );
}

// The topics a role needs, each with "Add to my topics".
function RoleTopics({ topics }) {
  const { t } = useUiLang();
  const [added, setAdded] = useState({});
  const add = (id) => api.post(`/learner/courses/${id}/add`).then(() => { dropCached('/learner/courses'); setAdded(a => ({ ...a, [id]: true })); }).catch(() => {});
  return (
    <div className="ln-row ln-wrap" style={{ gap: 6 }} data-role-topics>
      <span className="ln-xs ln-muted">{t('lj.market.needsTopics')}</span>
      {topics.map(c => (
        <span key={c.id} className="ln-row" style={{ gap: 4 }}>
          <Link to={`/learn/courses/${c.id}`} state={{ from: '/learn/market' }} className="ln-link ln-small">{c.title}</Link>
          <button type="button" className="ln-btn ln-btn-sm" disabled={!!added[c.id]} onClick={() => add(c.id)} data-add-topic={c.id}>{added[c.id] ? t('lj.market.added') : t('lj.market.addTopic')}</button>
        </span>
      ))}
    </div>
  );
}

export default function JobMarket() {
  const { t, fmtNum } = useUiLang();
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
          <h1 className="ln-title">{t('learn.jobMarket.jobMarket')}</h1>
          <span className="ln-sub">{t('learn.jobMarket.rolesHiringNowRead')}</span>
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 10 }}>
          <SampleBadge />
          <SourceLine source={jobs?.source} date={jobs?.updated_at} />
        </div>
      </header>

      <div role="search" className="ln-filterbar">
        <label className="ln-search">
          <Search size={18} aria-hidden="true" />
          <input aria-label={t('learn.jobMarket.roleSkill')} placeholder={t('learn.jobMarket.roleSkillEG')} value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <label className="ln-selectwrap"><span>{t('learn.jobMarket.city')}</span>
          <Select value={city} onChange={e => setCity(e.target.value)}><option value="">{t('learn.jobMarket.any')}</option>{cities.map(c => <option key={c}>{c}</option>)}</Select>
        </label>
        <label className="ln-selectwrap"><span>{t('learn.jobMarket.mode')}</span>
          <Select value={mode} onChange={e => setMode(e.target.value)}><option value="">{t('learn.jobMarket.any')}</option>{['On-site', 'Hybrid', 'Remote'].map(m => <option key={m}>{m}</option>)}</Select>
        </label>
        <label className="ln-selectwrap"><span>{t('learn.jobMarket.salary')}</span>
          <Select value={minSalary} onChange={e => setMinSalary(Number(e.target.value))}>{SALARY_STEPS.map(v => <option key={v} value={v}>{v ? t('learn.jobMarket.salaryPlus', { n: v }) : t('learn.jobMarket.any')}</option>)}</Select>
        </label>
        <label className="ln-check" style={{ minHeight: 44, padding: '0 8px' }}><input type="checkbox" checked={onlyGood} onChange={e => setOnlyGood(e.target.checked)} />{t('learn.jobMarket.only60Match')}</label>
      </div>

      {q.trim() && jobs && <SearchHelp jobs={jobs} onPick={setQ} />}

      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('learn.jobMarket.openFresherRoles')}{city ? ` · ${city}` : ''}</span><span className="ln-stat">{k ? fmtNum(k.open_roles) : '—'}</span><span className="ln-xs ln-muted">{k && k.open_roles_change >= 0 ? t('learn.jobMarket.upOnLastMonth', { n: fmtNum(k.open_roles_change) }) : t('learn.jobMarket.downLastMonth')}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('learn.jobMarket.medianFresherSalary')}</span><span className="ln-stat">{k ? t('learn.jobMarket.salaryLpa', { n: k.median_salary_lpa }) : '—'}</span><span className="ln-xs ln-muted">{t('learn.jobMarket.acrossListedRanges')}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('learn.jobMarket.fastestGrowingRole')}</span><span className="ln-stat" style={{ fontSize: 'var(--fs-h2)' }}>{k?.fastest_growing_role || '—'}</span><Link to="/learn/topics" className="ln-xs ln-link" style={{ fontSize: 'var(--fs-caption)' }}>{t('learn.jobMarket.seeEmergingTopics')}</Link></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('learn.jobMarket.bestMatch')}</span><span className="ln-stat">{k?.best_match ? `${k.best_match.match}%` : '—'}</span><span className="ln-xs ln-muted">{k?.best_match?.title}</span></div>
      </div>

      <div className="ln-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        <section className="ln-card">
          <div className="ln-between" style={{ alignItems: 'baseline' }}>
            <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('learn.jobMarket.openFresherRoles')}{city ? ` in ${city}` : ''}{t('learn.jobMarket.byMonth')}</h2>
            <button type="button" className="ln-btn ln-btn-sm" aria-pressed={tableView} onClick={() => setTableView(v => !v)}>{tableView ? t('learn.jobMarket.chartView') : t('learn.jobMarket.tableView')}</button>
          </div>
          {tableView ? (
            <table className="ln-table"><thead><tr><th>{t('learn.jobMarket.month')}</th><th>{t('learn.jobMarket.openRoles')}</th></tr></thead>
              <tbody>{(trends?.months || []).map(m => <tr key={m.label}><td>{m.label}</td><td>{m.count.toLocaleString(uiLocale())}</td></tr>)}</tbody></table>
          ) : (
            <div className="ln-chart" role="img" aria-label={t('learn.jobMarket.openRolesByMonth', { join: (trends?.months || []).map(m => `${m.label} ${m.count}`).join(', ') })}>
              <div className="ln-chart-axis">{[axisTop, axisTop * (2 / 3), axisTop / 3, 0].map(v => <span key={v}>{Math.round(v).toLocaleString(uiLocale())}</span>)}</div>
              <div className="ln-chart-plot">
                <div className="ln-chart-bars">
                  {(trends?.months || []).map(m => (
                    <div key={m.label} className="ln-chart-col">
                      <span className="ln-xs" style={{ fontWeight: 600, fontSize: 'var(--fs-caption)' }}>{m.count.toLocaleString(uiLocale())}</span>
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
          <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('learn.jobMarket.skillsJdsAskMost')}</h2>
          {(trends?.skills || []).map(a => (
            <div key={a.name} className="ln-askrow">
              <span style={{ fontWeight: 500 }}>{a.name}</span>
              <div className="ln-bar"><span style={{ width: `${a.pct}%` }} /></div>
              <span style={{ fontWeight: 600, textAlign: 'right' }}>{a.pct}%</span>
              <StatusTag status={a.status} />
              {a.status !== 'mastered' && <span style={{ gridColumn: '1 / -1' }}><AddToPlan skill={a.name} source="market" /></span>}
            </div>
          ))}
          <span className="ln-xs ln-muted">{t('learn.jobMarket.shareOpenJdsFilter')}</span>
          <SourceLine source={trends?.source} date={trends?.updated_at} />
        </section>
      </div>

      <section className="ln-col" style={{ gap: 14 }}>
        <div className="ln-between ln-wrap">
          <div className="ln-tabs" role="tablist">
            {[['all', t('learn.jobMarket.allMatches')], ['saved', t('learn.jobMarket.saved')], ['applied', t('learn.jobMarket.applied')]].map(([id, label]) => (
              <button key={id} type="button" role="tab" className="ln-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label} · {jobs?.counts?.[id] ?? 0}</button>
            ))}
          </div>
          <label className="ln-selectwrap"><span>{t('learn.jobMarket.sort')}</span>
            <Select value={sort} onChange={e => setSort(e.target.value)}><option value="match">{t('learn.jobMarket.bestMatch2')}</option><option value="recent">{t('learn.jobMarket.mostRecent')}</option><option value="salary">{t('learn.jobMarket.highestSalary')}</option></Select>
          </label>
        </div>

        {jobs && jobs.jobs.length === 0 && <div className="ln-card ln-muted" style={{ alignItems: 'center', textAlign: 'center' }}>{t('learn.jobMarket.noRolesMatchThese')}</div>}
        {(jobs?.jobs || []).map(j => (
          <article key={j.id} className="ln-jobcard">
            <MatchRing pct={j.match} />
            <div className="ln-col" style={{ gap: 8, minWidth: 0 }}>
              <div className="ln-row ln-wrap" style={{ gap: 10, alignItems: 'baseline' }}>
                <Link to={`/learn/market/${j.id}`} style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{j.title}</Link>
                <span className="ln-small ln-muted">{j.company || j.company_type}</span>
              </div>
              <span className="ln-small">{[j.city, j.mode, salary(j.salary_min, j.salary_max), posted(j.posted_days_ago, t)].filter(Boolean).join(' · ')}</span>
              <div className="ln-row ln-wrap" style={{ gap: 6 }}>{j.skills.map(s => <SkillChip key={s.name} name={s.name} status={s.status} />)}</div>
              {j.topics?.length > 0 && <RoleTopics topics={j.topics} />}
            </div>
            <div className="ln-col" style={{ gap: 8 }}>
              <Link to={`/learn/market/${j.id}`} className="ln-btn ln-btn-primary">{t('learn.jobMarket.viewJdGap')}</Link>
              <button type="button" className="ln-btn" onClick={() => toggleSave(j)} aria-pressed={!!j.saved_status}>
                {j.saved_status ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
                {j.saved_status === 'applied' ? t('learn.jobMarket.applied') : j.saved_status ? t('learn.jobMarket.saved') : t('learn.jobMarket.save')}
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
