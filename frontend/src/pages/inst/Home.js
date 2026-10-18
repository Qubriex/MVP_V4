// src/pages/inst/Home.js — /institution/home
// Replaces the old dashboard (whose "Manage Learners" opened Upload Target
// and whose "View Mastery Logs" did nothing). Every card links somewhere real.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, KeyRound, Plus } from 'lucide-react';
import { useCachedGet } from '../../utils/cachedGet';
import { Bar, SampleBadge } from '../../components/learn/ui';
import { useStaff } from '../../components/inst/InstitutionLayout';
import { errMsg } from '../../utils/errors';
import CommandCentre from '../../components/inst/CommandCentre';

import { useUiLang } from '../../context/UiLangContext';
const ALERT_ICON = { never_signed_in: [AlertTriangle, 'ln-tag-warning'], stuck: [RotateCcw, 'ln-tag-accent'], pin_reset: [KeyRound, 'ln-tag-info'] };
const COVERAGE = { covered: ['inst.home.coverage.inCurriculum', 'ln-tag-success'], partly: ['inst.home.coverage.partlyCovered', 'ln-tag-info'], missing: ['inst.home.coverage.notCovered', 'ln-tag-accent'] };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function InstHome() {
  const { t } = useUiLang();
  const { role } = useStaff();
  // Cached: a revisit renders at once and refreshes quietly (no flicker).
  const { data, error: loadError } = useCachedGet('/institution/overview');
  const error = loadError && !data ? errMsg(loadError, t('inst.home.couldnTLoadOverview')) : '';
  // The greeting is fixed when the page opens, so it never changes under the reader.
  const [hello] = useState(greeting);

  if (error) return <div className="ln-error">{error}</div>;
  if (!data) return <p className="ln-muted" style={{ minHeight: '60vh' }}>{t('inst.home.loading')}</p>;
  const { me, kpis, cohorts, alerts, pulse } = data;
  // "Dr. Rao" when there's a title, otherwise the first name.
  const parts = (me?.name || '').trim().split(/\s+/).filter(Boolean);
  const who = me?.title && parts.length ? `${me.title} ${parts[parts.length - 1]}` : parts[0];
  const canManage = role !== 'viewer';

  return (
    <>
      <header className="ln-pagehead" style={{ alignItems: 'center' }}>
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{hello}{who ? `, ${who}` : ''}</h1>
          <span className="ln-sub">{t('inst.home.cohortsStudents', { cohorts: cohorts.length, students: kpis.students })}{me?.department ? ` · ${me.department}` : ''}</span>
        </div>
        {canManage && (
          <div className="ln-row ln-wrap" style={{ gap: 10 }}>
            <Link to="/institution/students/add" className="ln-btn" style={{ fontWeight: 600 }}><Plus size={16} aria-hidden="true" />{t('inst.home.addStudents')}</Link>
            {role === 'admin' && <Link to="/institution/cohorts/new" className="ln-btn ln-btn-primary"><Plus size={16} aria-hidden="true" />{t('inst.home.newCohort')}</Link>}
          </div>
        )}
      </header>

      <CommandCentre role={role} />

      {alerts.length > 0 && (
        <section className="ln-col" style={{ gap: 12 }}>
          <h2 className="ln-h2">{t('inst.home.accessSign')}</h2>
          <div className="ln-grid ln-g-3" style={{ gap: 14 }}>
            {alerts.map(a => {
              const [Icon, cls] = ALERT_ICON[a.kind] || [AlertTriangle, 'ln-tag-warning'];
              return (
                <div key={a.kind} className="ln-card" style={{ padding: 18, borderRadius: 'var(--radius-lg)', gap: 10 }}>
                  <div className="ln-row" style={{ gap: 10 }}><span className={`ln-tag ${cls}`} style={{ width: 30, height: 30, padding: 0, justifyContent: 'center' }}><Icon size={15} aria-hidden="true" /></span><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{a.title}</span></div>
                  <span className="ln-small">{a.body}</span>
                  <Link to={a.href} className="ln-link" style={{ fontSize: 'var(--fs-small)' }}>{a.cta} →</Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('inst.home.activeStudents')}</span><span className="ln-stat">{kpis.active_students}</span><span className="ln-xs ln-muted">{t('inst.home.studentsSignedAtLeast', { students: kpis.students })}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('inst.home.averageProgress')}</span><span className="ln-stat">{kpis.avg_progress}%</span><span className="ln-xs ln-muted">{t('inst.home.skillNodesMasteredAcross')}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('inst.home.masteryLogsReady')}</span><span className="ln-stat">{kpis.logs_ready}</span><span className="ln-xs ln-muted">{t('inst.home.studentsWhoFinishedCluster')}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('inst.home.curriculumMarketFit')}</span><span className="ln-stat">{kpis.curriculum_fit != null ? `${kpis.curriculum_fit}%` : '—'}</span><span className="ln-xs ln-muted">{t('inst.home.topJdSkillsPathway')}</span></div>
      </div>

      <section className="ln-col" style={{ gap: 14 }}>
        <div className="ln-between"><h2 className="ln-h2" style={{ fontSize: 'var(--fs-h2)' }}>{role === 'professor' ? t('inst.home.myCohorts') : t('inst.home.cohorts')}</h2><Link to="/institution/cohorts" className="ln-link">{t('inst.home.allCohorts')}</Link></div>
        {cohorts.length === 0 && <div className="ln-card ln-muted">{role === 'professor' ? t('inst.home.noCohortsAssignedYet') : t('inst.home.noCohortsYetCreate')}</div>}
        <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
          {cohorts.map(c => (
            <Link key={c.id} to={`/institution/cohorts/${c.id}`} className="ln-card ln-card-link" style={{ gap: 14 }}>
              <div className="ln-between" style={{ alignItems: 'flex-start' }}>
                <div className="ln-col" style={{ gap: 2 }}><span style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{c.title}</span><span className="ln-small ln-muted">{t('inst.home.learnerCountStudents', { learner_count: c.learner_count })}{' '} {c.language === 'hindi' ? t('inst.home.hindi') : t('inst.home.telugu')} · <span className="in-code">{c.join_code}</span></span></div>
                <span className={`ln-tag ln-tag-lg ${c.status === 'active' ? 'ln-tag-success' : 'ln-tag-warning'}`}>{c.status === 'active' ? t('inst.home.active') : c.status === 'completed' ? t('inst.home.completed') : t('inst.home.settingUp')}</span>
              </div>
              <div className="ln-col" style={{ gap: 6 }}>
                <div className="ln-between ln-small"><span className="ln-muted">{t('inst.home.averageProgress')}</span><b>{c.avg_progress}%</b></div>
                <Bar pct={c.avg_progress} variant="ln-bar-vivid" label={t('inst.home.averageProgressAvgProgress', { avg_progress: c.avg_progress })} />
              </div>
              <div className="ln-grid ln-g-3" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{c.active_week}</b><span className="ln-xs ln-muted">{t('inst.home.activeWeek')}</span></div>
                <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{c.stuck}</b><span className="ln-xs ln-muted">{t('inst.home.stuck3Loops')}</span></div>
                <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{c.not_signed_in}</b><span className="ln-xs ln-muted">{t('inst.home.notSigned')}</span></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {pulse.length > 0 && (
        <div className="ln-grid">
          <section className="ln-card" style={{ gap: 12 }}>
            <div className="ln-between ln-wrap"><div className="ln-row"><h2 className="ln-h2">{t('inst.home.marketPulseTargets')}</h2><SampleBadge /></div><Link to="/institution/curriculum" className="ln-link">{t('inst.home.compareCurriculum')}</Link></div>
            <div className="ln-divided ln-col">
              {pulse.map(p => (
                <div key={p.name} className="ln-row" style={{ padding: '10px 0', gap: 12 }}>
                  <span style={{ flex: 1, fontSize: 'var(--fs-body)', fontWeight: 600 }}>{p.name}</span>
                  <span className="ln-small ln-muted">{t('inst.home.shareJds', { share: p.share })}</span>
                  <span className={`ln-tag ${COVERAGE[p.coverage][1]}`}>{t(COVERAGE[p.coverage][0])}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
