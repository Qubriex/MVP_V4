// src/components/inst/ActivityYear.js
// "How many students practised": headline numbers for the last 365 days, then
// one bar per week (distinct students who practised that week) — the last 12
// weeks by default, all 52 on "Show all" — with a hover / focus tooltip and a
// table view. Practice = a session started or a message
// sent that day (India time).
import React, { useState } from 'react';
import { useCachedGet } from '../../utils/cachedGet';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const fmt = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
const month = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString(uiLocale(), { month: 'short', timeZone: 'UTC' });

export default function ActivityYear({ cohortId }) {
  const { t } = useUiLang();
  const { data, error } = useCachedGet(`/institution/engagements/${cohortId}/activity-days?days=365`);
  const [tip, setTip] = useState(null);
  const [table, setTable] = useState(false);
  const [all, setAll] = useState(false);
  if (error) return <section className="ln-card"><h2 className="ln-h2">{t('inst.activityYear.studentsPractisingLast365')}</h2><span className="ln-small ln-muted">{t('inst.activityYear.couldnTLoadActivity')}</span></section>;
  if (!data) return <section className="ln-card" style={{ minHeight: 250 }}><h2 className="ln-h2">{t('inst.activityYear.studentsPractisingLast365')}</h2><span className="ln-small ln-muted">{t('inst.activityYear.loading')}</span></section>;
  const max = Math.max(1, ...data.weeks.map(w => w.students));
  const busiest = data.weeks.reduce((b, w) => (w.students > (b?.students ?? -1) ? w : b), null);
  const last30 = data.series.slice(-30);
  const recent = new Set(); // distinct days ≠ distinct students; show active days instead
  last30.forEach(d => { if (d.students) recent.add(d.date); });
  const weeks = all ? data.weeks : data.weeks.slice(-12);
  // Month ticks for the full year; a date every other week for 12 weeks.
  const ticks = all ? weeks.filter((w, i) => i === 0 || month(w.week) !== month(weeks[i - 1].week)).filter((_, i) => i % 2 === 0)
    : weeks.filter((_, i) => i % 2 === 0);

  return (
    <section className="ln-card" style={{ gap: 14 }}>
      <div className="ln-between ln-wrap">
        <h2 className="ln-h2">{t('inst.activityYear.studentsPractisingLast365')}</h2>
        <div className="ln-row ln-wrap" style={{ gap: 12 }}>
          <button type="button" className="ln-link" aria-pressed={all} onClick={() => setAll(v => !v)}>{all ? t('inst.activityYear.last12Weeks') : t('inst.activityYear.showAll')}</button>
          <button type="button" className="ln-link" onClick={() => setTable(v => !v)}>{table ? t('inst.activityYear.showChart') : t('inst.activityYear.showAsTable')}</button>
        </div>
      </div>
      <div className="ln-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div className="ln-tile" style={{ padding: 12 }}><span className="ln-xs ln-muted">{t('inst.activityYear.practisedAtLeastOnce')}</span><span className="ln-stat">{data.unique_active} <span className="ln-small ln-muted">{t('inst.activityYear.ofEnrolled', { enrolled: data.enrolled })}</span></span></div>
        <div className="ln-tile" style={{ padding: 12 }}><span className="ln-xs ln-muted">{t('inst.activityYear.daysAnyPractice')}</span><span className="ln-stat">{data.days_with_practice}</span></div>
        <div className="ln-tile" style={{ padding: 12 }}><span className="ln-xs ln-muted">{t('inst.activityYear.busiestWeek')}</span><span className="ln-stat">{busiest?.students || 0} <span className="ln-small ln-muted">{busiest?.students ? t('inst.activityYear.weekOf', { date: fmt(busiest.week) }) : ''}</span></span></div>
        <div className="ln-tile" style={{ padding: 12 }}><span className="ln-xs ln-muted">{t('inst.activityYear.activeDaysLast30')}</span><span className="ln-stat">{recent.size}</span></div>
      </div>
      {table ? (
        <div className="ln-tablewrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table className="ln-table"><thead><tr><th>{t('inst.activityYear.weekStarting')}</th><th>{t('inst.activityYear.studentsWhoPractised')}</th></tr></thead>
            <tbody>{[...weeks].reverse().map(w => <tr key={w.week}><td>{fmt(w.week)} {w.week.slice(0, 4)}</td><td>{w.students}</td></tr>)}</tbody></table>
        </div>
      ) : (
        <div className="ln-col" style={{ gap: 6 }}>
          <div className="in-actchart" role="img" aria-label={t('inst.activityYear.chartLabel', { from: fmt(weeks[0]?.week || data.from), to: fmt(data.to), n: busiest?.students || 0 })} onMouseLeave={() => setTip(null)}>
            {weeks.map((w, i) => (
              <button key={w.week} type="button" aria-label={t('inst.activityYear.weekFmtStudentsStudents', { fmt: fmt(w.week), students: w.students })}
                onMouseEnter={() => setTip({ i, w })} onFocus={() => setTip({ i, w })} onBlur={() => setTip(null)}>
                <span style={{ height: `${(w.students / max) * 100}%` }} />
              </button>
            ))}
            {tip && (
              <div className="in-actchart-tip" style={{ left: `${((tip.i + 0.5) / weeks.length) * 100}%` }}>
                <b>{tip.w.students}</b> {' '}{tip.w.students === 1 ? t('inst.activityYear.studentOne') : t('inst.activityYear.student')} {' '}{t('inst.activityYear.weekFmt', { fmt: fmt(tip.w.week) })}
              </div>
            )}
          </div>
          <div className="in-actaxis" aria-hidden="true">{ticks.map(w => <span key={w.week}>{all ? month(w.week) : fmt(w.week)}</span>)}</div>
          <span className="ln-xs ln-muted">{t('inst.activityYear.eachBarOneWeek')}</span>
        </div>
      )}
    </section>
  );
}
