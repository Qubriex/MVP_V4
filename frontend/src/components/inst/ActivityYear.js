// src/components/inst/ActivityYear.js
// "How many students practised" over the last 365 days: headline numbers, then
// one bar per week (distinct students who practised that week), with a hover /
// focus tooltip and a table view. Practice = a session started or a message
// sent that day (India time).
import React, { useState } from 'react';
import { useCachedGet } from '../../utils/cachedGet';

const fmt = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const month = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });

export default function ActivityYear({ cohortId }) {
  const { data, error } = useCachedGet(`/institution/engagements/${cohortId}/activity-days?days=365`);
  const [tip, setTip] = useState(null);
  const [table, setTable] = useState(false);
  if (error) return <section className="ln-card"><h2 className="ln-h2">Students practising, last 365 days</h2><span className="ln-small ln-muted">Couldn’t load activity.</span></section>;
  if (!data) return <section className="ln-card" style={{ minHeight: 250 }}><h2 className="ln-h2">Students practising, last 365 days</h2><span className="ln-small ln-muted">Loading…</span></section>;
  const max = Math.max(1, ...data.weeks.map(w => w.students));
  const busiest = data.weeks.reduce((b, w) => (w.students > (b?.students ?? -1) ? w : b), null);
  const last30 = data.series.slice(-30);
  const recent = new Set(); // distinct days ≠ distinct students; show active days instead
  last30.forEach(d => { if (d.students) recent.add(d.date); });
  const ticks = data.weeks.filter((w, i) => i === 0 || month(w.week) !== month(data.weeks[i - 1].week));

  return (
    <section className="ln-card" style={{ gap: 14 }}>
      <div className="ln-between ln-wrap">
        <h2 className="ln-h2">Students practising, last 365 days</h2>
        <button type="button" className="ln-link" onClick={() => setTable(t => !t)}>{table ? 'Show chart' : 'Show as table'}</button>
      </div>
      <div className="ln-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div className="ln-tile" style={{ padding: 12 }}><span className="ln-xs ln-muted">Practised at least once</span><span className="ln-stat">{data.unique_active} <span className="ln-small ln-muted">of {data.enrolled}</span></span></div>
        <div className="ln-tile" style={{ padding: 12 }}><span className="ln-xs ln-muted">Days with any practice</span><span className="ln-stat">{data.days_with_practice}</span></div>
        <div className="ln-tile" style={{ padding: 12 }}><span className="ln-xs ln-muted">Busiest week</span><span className="ln-stat">{busiest?.students || 0} <span className="ln-small ln-muted">{busiest?.students ? `wk of ${fmt(busiest.week)}` : ''}</span></span></div>
        <div className="ln-tile" style={{ padding: 12 }}><span className="ln-xs ln-muted">Active days, last 30</span><span className="ln-stat">{recent.size}</span></div>
      </div>
      {table ? (
        <div className="ln-tablewrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table className="ln-table"><thead><tr><th>Week starting</th><th>Students who practised</th></tr></thead>
            <tbody>{[...data.weeks].reverse().map(w => <tr key={w.week}><td>{fmt(w.week)} {w.week.slice(0, 4)}</td><td>{w.students}</td></tr>)}</tbody></table>
        </div>
      ) : (
        <div className="ln-col" style={{ gap: 6 }}>
          <div className="in-actchart" role="img" aria-label={`Weekly students practising from ${fmt(data.from)} to ${fmt(data.to)}; busiest week ${busiest?.students || 0} students.`} onMouseLeave={() => setTip(null)}>
            {data.weeks.map((w, i) => (
              <button key={w.week} type="button" aria-label={`Week of ${fmt(w.week)}: ${w.students} students`}
                onMouseEnter={() => setTip({ i, w })} onFocus={() => setTip({ i, w })} onBlur={() => setTip(null)}>
                <span style={{ height: `${(w.students / max) * 100}%` }} />
              </button>
            ))}
            {tip && (
              <div className="in-actchart-tip" style={{ left: `${((tip.i + 0.5) / data.weeks.length) * 100}%` }}>
                <b>{tip.w.students}</b> student{tip.w.students === 1 ? '' : 's'} · week of {fmt(tip.w.week)}
              </div>
            )}
          </div>
          <div className="in-actaxis" aria-hidden="true">{ticks.filter((_, i) => i % 2 === 0).map(t => <span key={t.week}>{month(t.week)}</span>)}</div>
          <span className="ln-xs ln-muted">Each bar is one week: students who started a session or answered at least once that week (India time).</span>
        </div>
      )}
    </section>
  );
}
