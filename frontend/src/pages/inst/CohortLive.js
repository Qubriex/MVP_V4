// src/pages/inst/CohortLive.js — /institution/cohorts/:id/live
// Who is learning right now. A pulsing light per student, always with a text
// label: green = learning now; yellow = idle, or looping on a skill; red =
// inactive for 3+ days, never started, or stuck (3+ loops on the current
// skill). Last-active time per student. Refreshes every 15 seconds.
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import Crumbs from '../../components/inst/Crumbs';
import DownloadDialog from '../../components/inst/DownloadDialog';
import { useCachedGet } from '../../utils/cachedGet';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const LABEL = { green: 'inst.cohortLive.label.activeNow', yellow: 'inst.cohortLive.label.idleOrLooping', red: 'inst.cohortLive.label.inactiveOrStuck' };
export function Light({ light, label }) {
  return <span className={`in-light is-${light}`}><i aria-hidden="true" />{label || t(LABEL[light])}</span>;
}
function ago(t, now) {
  if (!t) return 'Never';
  const m = Math.round((now - Date.parse(t)) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} days ago`;
}
const stamp = (t) => (t ? new Date(t).toLocaleString(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

export default function CohortLive() {
  const { t, fmtDate } = useUiLang();
  const { id } = useParams();
  const cohort = useCachedGet(`/institution/engagements/${id}`).data;
  const { data, error } = useCachedGet(`/institution/engagements/${id}/live`, { refreshMs: 15000 });
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [download, setDownload] = useState(false);
  const now = data ? Date.parse(data.generated_at) : Date.now();

  const rows = useMemo(() => (data?.students || [])
    .filter(s => filter === 'all' || s.light === filter)
    .filter(s => !q.trim() || `${s.name} ${s.learner_ref}`.toLowerCase().includes(q.trim().toLowerCase())), [data, filter, q]);

  return (
    <>
      <Crumbs items={[{ label: 'Cohorts', to: '/institution/cohorts' }, { label: cohort?.title || 'Cohort', to: `/institution/cohorts/${id}?tab=Students` }, { label: 'Live' }]} />
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{t('inst.cohortLive.live2')}{' '} {cohort?.title || '…'}</h1>
          <span className="ln-sub">{t('inst.cohortLive.whoLearningRightNow')}{data ? ` · ${t('inst.cohortLive.lastUpdate', { time: fmtDate(data.generated_at, { hour: 'numeric', minute: '2-digit', second: '2-digit' }) })}` : ''}.</span>
        </div>
        {cohort && <button type="button" className="ln-btn" onClick={() => setDownload(true)}><Download size={16} aria-hidden="true" />{t('inst.cohortLive.downloadData')}</button>}
      </header>
      {error && !data && <div className="ln-error">{t('inst.cohortLive.couldnTLoadLive')}</div>}

      {data && (
        <div className="in-livecount" role="group" aria-label={t('inst.cohortLive.filterByStatus')}>
          {['green', 'yellow', 'red'].map(l => (
            <button key={l} type="button" className="ln-btn" aria-pressed={filter === l} onClick={() => setFilter(f => (f === l ? 'all' : l))} style={filter === l ? { outline: '2px solid var(--accent-600)' } : undefined}>
              <Light light={l} /> <b style={{ fontSize: 'var(--fs-h3)' }}>{data.counts[l]}</b>
            </button>
          ))}
          <label className="ln-search" style={{ flex: 1, minWidth: 200 }}><Search size={18} aria-hidden="true" /><input aria-label={t('inst.cohortLive.searchStudents')} placeholder={t('inst.cohortLive.nameRef')} value={q} onChange={e => setQ(e.target.value)} /></label>
        </div>
      )}

      <section className="ln-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ln-tablewrap">
          <table className="ln-table">
            <thead><tr><th style={{ paddingLeft: 16 }}>{t('inst.cohortLive.status')}</th><th>{t('inst.cohortLive.student')}</th><th>{t('inst.cohortLive.currentSkill')}</th><th>{t('inst.cohortLive.lastActive')}</th><th>{t('inst.cohortLive.activeToday')}</th><th>{t('inst.cohortLive.why')}</th></tr></thead>
            <tbody>
              {!data && !error && <tr><td colSpan={6} style={{ paddingLeft: 16 }} className="ln-muted">{t('inst.cohortLive.loading')}</td></tr>}
              {data && rows.length === 0 && <tr><td colSpan={6} style={{ paddingLeft: 16 }} className="ln-muted">{t('inst.cohortLive.noStudentsHere')}</td></tr>}
              {rows.map(s => (
                <tr key={s.el_id}>
                  <td style={{ paddingLeft: 16 }}><Light light={s.light} /></td>
                  <td><b style={{ fontWeight: 600 }}>{s.name}</b> <span className="ln-xs ln-muted">{s.learner_ref}</span></td>
                  <td className="ln-small">{s.current_node || '—'}</td>
                  <td className="ln-small"><span title={stamp(s.last_active_at)}>{ago(s.last_active_at, now)}</span><br /><span className="ln-xs ln-muted">{stamp(s.last_active_at)}</span></td>
                  <td className="ln-small">{t('inst.cohortLive.activeMinutesTodayMin', { active_minutes_today: s.active_minutes_today })}</td>
                  <td className="ln-small">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {data && (
        <span className="ln-xs ln-muted">
          {t('inst.cohortLive.greenActiveLastActiveminutes', { activeMinutes: data.thresholds.activeMinutes, inactiveDays: data.thresholds.inactiveDays, stuckLoops: data.thresholds.stuckLoops })}
        </span>
      )}
      {download && cohort && <DownloadDialog cohort={cohort} students={cohort.learners.filter(l => l.access !== 'removed')} onClose={() => setDownload(false)} />}
    </>
  );
}
