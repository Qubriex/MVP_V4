// Cohort × skill-group heat-map for college Home: each cell is the average
// share of that skill group's lessons the cohort's students have mastered.
// The number is always printed (colour is never the only signal); cohorts
// with fewer than 5 students say "Too few to show". Each cell opens the
// cohort's readiness grid.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { Skeleton } from '../shared/ui';
import { useUiLang } from '../../context/UiLangContext';

const MIN_GROUP = 5;
const shade = (pct) => `color-mix(in srgb, var(--ok) ${Math.round(8 + pct * 0.6)}%, var(--color-surface))`;

export default function SkillHeatMap() {
  const { t } = useUiLang();
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const cohorts = (await api.get('/institution/engagements')).data || [];
      const grids = await Promise.all(cohorts.map(c => api.get(`/institution/engagements/${c.id}/grid`).then(r => ({ cohort: c, grid: r.data })).catch(() => null)));
      const rows = grids.filter(Boolean);
      const groups = [...new Set(rows.flatMap(r => r.grid.clusters.map(c => c.label)))].slice(0, 10);
      if (live) setData({ groups, rows: rows.map(({ cohort, grid }) => {
        const n = grid.students.length;
        const cells = groups.map(label => {
          const i = grid.clusters.findIndex(c => c.label === label);
          if (i < 0 || n < MIN_GROUP) return null;
          return Math.round(grid.students.reduce((sum, s) => sum + (s.cells[i] || 0), 0) / n);
        });
        return { cohort, n, cells };
      }) });
    })().catch(() => live && setData({ groups: [], rows: [] }));
    return () => { live = false; };
  }, []);
  if (!data) return <section className="ln-card"><Skeleton lines={4} /></section>;
  if (!data.rows.length || !data.groups.length) return null;
  return (
    <section className="ln-card" style={{ gap: 10 }} aria-labelledby="heatmap-h">
      <div className="ln-col" style={{ gap: 2 }}>
        <h2 id="heatmap-h" className="ln-h2">{t('inst.heat.title')}</h2>
        <span className="ln-small ln-muted">{t('inst.heat.sub')}</span>
      </div>
      <div className="ln-tablewrap">
        <table className="ln-table in-heat">
          <thead><tr><th scope="col">{t('inst.heat.cohort')}</th>{data.groups.map(g => <th key={g} scope="col">{g}</th>)}</tr></thead>
          <tbody>{data.rows.map(({ cohort, n, cells }) => (
            <tr key={cohort.id}>
              <th scope="row"><Link className="ln-link" to={`/institution/cohorts/${cohort.id}?tab=Readiness`}>{cohort.title}</Link><span className="ln-xs ln-muted" style={{ display: 'block' }}>{t('inst.heat.students', { n })}</span></th>
              {n < MIN_GROUP ? <td colSpan={data.groups.length}><span className="sk-toofew-inline">{t('inst.heat.tooFew')}</span></td>
                : cells.map((v, i) => (
                  <td key={data.groups[i]} className="in-heat-cell" style={v == null ? undefined : { background: shade(v) }}>
                    {v == null ? <span className="ln-muted" aria-label={t('inst.heat.notInProgramme')}>—</span>
                      : <Link to={`/institution/cohorts/${cohort.id}?tab=Readiness`} aria-label={t('inst.heat.cellLabel', { cohort: cohort.title, group: data.groups[i], pct: v })}>{v}%</Link>}
                  </td>
                ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
