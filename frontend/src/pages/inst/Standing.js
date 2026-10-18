// src/pages/inst/Standing.js — /institution/benchmark
// Job-match index for a cohort (verified skills only), compared with a
// regional benchmark, last year's batch (both sample) or another of your
// cohorts (live). Fit by target role, where you trail, and the students
// closest to job-ready — only those who opted in to share their record.
import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useCachedGet } from '../../utils/cachedGet';
import { SampleBadge } from '../../components/learn/ui';
import { errMsg } from '../../utils/errors';
import { Select } from '../../components/shared/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
export default function Standing() {
  const { t } = useUiLang();
  const [cohortId, setCohortId] = useState('');
  const [compare, setCompare] = useState('regional');
  // Cached per cohort and comparison: returning to this page, or switching
  // back to a comparison already seen, shows at once and refreshes quietly.
  const qs = new URLSearchParams({ compare });
  if (cohortId) qs.set('engagement_id', cohortId);
  const { data: fresh, error: loadError } = useCachedGet(`/institution/insights/standing?${qs}`);
  const [shown, setShown] = useState(null);
  useEffect(() => { if (fresh) setShown(fresh); }, [fresh]);
  const data = fresh || shown; // keep the last result on screen while the next loads
  // The first load picks the cohort on the server; it is shown without asking again.
  const activeCohort = cohortId || data?.cohort?.id || '';
  const error = loadError && !data ? errMsg(loadError, t('inst.standing.couldnTLoadComparison')) : '';
  const bench = useCachedGet(activeCohort ? `/institution/insights/benchmarks?engagement_id=${activeCohort}` : null).data || null;

  const exportTop = () => {
    const csv = ['name,learner_ref,best_role,match_pct', ...data.top.map(t => [t.name, t.learner_ref, t.role, t.match].join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'closest-to-job-ready.csv'; a.click();
  };

  if (error) return <div className="ln-error">{error}</div>;
  if (!data) return <p className="ln-muted">{t('inst.standing.loading')}</p>;
  if (data.empty) return <><h1 className="ln-title">{t('inst.standing.whereWeStand')}</h1><div className="ln-card ln-muted">{t('inst.standing.noCohortsScopeYet')}</div></>;
  const cmpLabel = data.comparison.label;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{t('inst.standing.whereWeStand')}</h1>
          <span className="ln-sub">{t('inst.standing.studentsVerifiedSkillsMeasured')}</span>
        </div>
        <SampleBadge />
      </header>

      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>{t('inst.standing.cohort')}</span>
          <Select value={activeCohort} onChange={e => { setCohortId(e.target.value); if (e.target.value === compare) setCompare('regional'); }}>{data.cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></label>
        <span className="ln-small ln-muted">{t('inst.standing.comparedWith')}</span>
        <div className="ln-pilltabs" role="tablist">
          {data.compare_options.map(o => <button key={o.id} type="button" role="tab" className="ln-pilltab" aria-selected={compare === o.id} onClick={() => setCompare(o.id)}>{o.label}{o.sample ? '' : t('inst.standing.live')}</button>)}
        </div>
      </div>

      {bench && (
        <section className="ln-card" style={{ gap: 12 }} aria-label={t('inst.standing.benchmarks')}>
          <div className="ln-between ln-wrap" style={{ gap: 8 }}>
            <div className="ln-col" style={{ gap: 2 }}><h2 className="ln-h2">{t('inst.standing.benchmarksLive')}</h2>
              <span className="ln-small ln-muted">{t('inst.standing.sameMeasuresCohortOther')}{' '} {bench.regional.region || t('inst.standing.yourRegion')}.</span></div>
            <span className={`ln-tag ${bench.regional.published ? 'ln-tag-success' : 'ln-tag-neutral'}`}>{bench.regional.published ? t('inst.standing.regionalMedianN', { n: bench.regional.institutions }) : t('inst.standing.regionalMedianNotPublished')}</span>
          </div>
          <div className="ln-tablewrap">
            <table className="ln-table">
              <thead><tr><th>{t('inst.standing.measure')}</th><th>{bench.cohort.title}</th>{bench.cohorts.slice(0, 3).map(c => <th key={c.id}>{c.title}</th>)}<th>{t('inst.standing.regionalMedian')}</th></tr></thead>
              <tbody>
                {bench.metrics.map(m => {
                  const f = (v) => (v == null ? '—' : `${v}${m.unit === '%' ? '%' : m.unit ? ` ${m.unit}` : ''}`);
                  return (
                    <tr key={m.key}>
                      <td>{m.label}<span className="ln-xs ln-muted" style={{ display: 'block' }}>{m.higher ? t('inst.standing.higherBetter') : t('inst.standing.lowerBetter')}</span></td>
                      <td><b>{f(bench.ours[m.key])}</b></td>
                      {bench.cohorts.slice(0, 3).map(c => <td key={c.id}>{f(c[m.key])}</td>)}
                      <td>{bench.regional.published ? f(bench.regional.values[m.key]) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <span className="ln-xs ln-muted">{bench.regional.note}</span>
        </section>
      )}

      <div className="ln-grid ln-g-2" style={{ gap: 20 }}>
        <section className="ln-card ln-card-dark" style={{ gap: 12 }}>
          <span className="ln-kicker" style={{ color: 'var(--accent-400)' }}>{t('inst.standing.jobMatchIndex')}</span>
          <div className="ln-row" style={{ alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-display)', fontWeight: 600, lineHeight: 1 }}>{data.index}</span>
            <span style={{ color: 'var(--stage-muted)' }}>{t('inst.standing.vs')}{' '} <b style={{ color: 'var(--stage-text)' }}>{data.comparison.score}</b> {cmpLabel.toLowerCase()}</span>
          </div>
          <span className="ln-small" style={{ color: 'var(--stage-muted)', lineHeight: 1.6 }}>{t('inst.standing.averageShareTargetRole')}</span>
          <span className="ln-small" style={{ color: data.change_30d >= 0 ? 'var(--stage-listen)' : 'var(--danger-on-ink)' }}>{data.change_30d >= 0 ? '▲' : '▼'} {t('inst.standing.absPointsSinceLast', { abs: Math.abs(data.change_30d) })}</span>
          <span className="ln-xs" style={{ color: 'var(--stage-muted)' }}>{t('inst.standing.studentsStudentsTargetRoles', { students: data.students })}{' '} {data.target_roles.join(', ') || '—'}</span>
        </section>
        <section className="ln-card">
          <div className="ln-between ln-wrap"><h2 className="ln-h2">{t('inst.standing.studentsByJobMatch')}</h2>
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
        <h2 className="ln-h2">{t('inst.standing.fitByTargetRole')}</h2>
        <div className="ln-grid ln-g-3" style={{ gap: 14 }}>
          {data.roles.map(r => (
            <div key={r.role} className="ln-card" style={{ gap: 10, padding: 20 }}>
              <span style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{r.role}</span>
              <div className="ln-row" style={{ gap: 20 }}>
                <div className="ln-col"><b style={{ fontSize: 'var(--fs-h2)' }}>{r.ready}</b><span className="ln-xs ln-muted">{t('inst.standing.studentsReady80')}</span></div>
                <div className="ln-col"><b style={{ fontSize: 'var(--fs-h2)' }}>{r.open ? r.open.toLocaleString(uiLocale()) : '—'}</b><span className="ln-xs ln-muted">{t('inst.standing.openRolesRegionSample')}</span></div>
              </div>
              {r.gap && <span className="ln-small">{t('inst.standing.biggestGap')}{' '} <b>{r.gap}</b></span>}
            </div>
          ))}
        </div>
      </section>

      <div className="ln-grid ln-g-2">
        <section className="ln-card">
          <h2 className="ln-h2">{t('inst.standing.whereWeTrail')}{' '} {data.compare_options.find(o => o.id === compare)?.sample ? t('inst.standing.theBenchmark') : cmpLabel}</h2>
          {data.trail.length === 0 ? <span className="ln-small ln-muted">{t('inst.standing.reLevelAheadComparison')}</span> : (
            <table className="ln-table"><thead><tr><th>{t('inst.standing.skill')}</th><th>{t('inst.standing.ours')}</th><th>{cmpLabel}</th><th>{t('inst.standing.gap')}</th></tr></thead>
              <tbody>{data.trail.map(t => <tr key={t.skill}><td style={{ fontWeight: 600 }}>{t.skill}</td><td>{t.ours}%</td><td>{t.bench}%</td><td style={{ color: 'var(--status-danger)', fontWeight: 600 }}>{t.gap}</td></tr>)}</tbody></table>
          )}
          <span className="ln-xs ln-muted">{t('inst.standing.shareStudentsSkillVerified')}</span>
        </section>
        <section className="ln-card">
          <div className="ln-between ln-wrap"><h2 className="ln-h2">{t('inst.standing.closestJobReady')}</h2>{data.top.length > 0 && <button type="button" className="ln-btn ln-btn-sm" onClick={exportTop}><Download size={14} aria-hidden="true" />{t('inst.standing.sharePlacementCell')}</button>}</div>
          {data.top.length === 0 && <span className="ln-small ln-muted">{t('inst.standing.noStudentsCohortHave')}</span>}
          {data.top.map(s => (
            <div key={s.learner_ref} className="ln-between" style={{ padding: '6px 0', borderTop: '1px solid var(--color-surface-2)' }}>
              <div className="ln-col"><b style={{ fontWeight: 600 }}>{s.name}</b><span className="ln-xs ln-muted">{s.role}</span></div>
              <span className={`ln-tag ln-tag-lg ${s.match >= 70 ? 'ln-tag-success' : 'ln-tag-neutral'}`}>{s.match}%</span>
            </div>
          ))}
          <span className="ln-xs ln-muted">{t('inst.standing.onlyStudentsWhoOpted', { opted_in: data.opted_in, students: data.students })}</span>
        </section>
      </div>
    </>
  );
}
