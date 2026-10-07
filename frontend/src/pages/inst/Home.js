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

const ALERT_ICON = { never_signed_in: [AlertTriangle, 'ln-tag-warning'], stuck: [RotateCcw, 'ln-tag-accent'], pin_reset: [KeyRound, 'ln-tag-info'] };
const COVERAGE = { covered: ['✓ In curriculum', 'ln-tag-success'], partly: ['◐ Partly covered', 'ln-tag-info'], missing: ['+ Not covered', 'ln-tag-accent'] };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function InstHome() {
  const { role } = useStaff();
  // Cached: a revisit renders at once and refreshes quietly (no flicker).
  const { data, error: loadError } = useCachedGet('/institution/overview');
  const error = loadError && !data ? errMsg(loadError, 'Couldn’t load your overview. Is the backend running?') : '';
  // The greeting is fixed when the page opens, so it never changes under the reader.
  const [hello] = useState(greeting);

  if (error) return <div className="ln-error">{error}</div>;
  if (!data) return <p className="ln-muted" style={{ minHeight: '60vh' }}>Loading…</p>;
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
          <span className="ln-sub">{cohorts.length} cohort{cohorts.length === 1 ? '' : 's'} · {kpis.students} students{me?.department ? ` · ${me.department}` : ''}</span>
        </div>
        {canManage && (
          <div className="ln-row ln-wrap" style={{ gap: 10 }}>
            <Link to="/institution/students/add" className="ln-btn" style={{ fontWeight: 600 }}><Plus size={16} aria-hidden="true" />Add students</Link>
            {role === 'admin' && <Link to="/institution/cohorts/new" className="ln-btn ln-btn-primary"><Plus size={16} aria-hidden="true" />New cohort</Link>}
          </div>
        )}
      </header>

      <CommandCentre role={role} />

      {alerts.length > 0 && (
        <section className="ln-col" style={{ gap: 12 }}>
          <h2 className="ln-h2">Access and sign-in</h2>
          <div className="ln-grid ln-g-3" style={{ gap: 14 }}>
            {alerts.map(a => {
              const [Icon, cls] = ALERT_ICON[a.kind] || [AlertTriangle, 'ln-tag-warning'];
              return (
                <div key={a.kind} className="ln-card" style={{ padding: 18, borderRadius: 'var(--radius-lg)', gap: 10 }}>
                  <div className="ln-row" style={{ gap: 10 }}><span className={`ln-tag ${cls}`} style={{ width: 30, height: 30, padding: 0, justifyContent: 'center' }}><Icon size={15} aria-hidden="true" /></span><span style={{ fontSize: 15, fontWeight: 600 }}>{a.title}</span></div>
                  <span className="ln-small">{a.body}</span>
                  <Link to={a.href} className="ln-link" style={{ fontSize: 13 }}>{a.cta} →</Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Active students</span><span className="ln-stat">{kpis.active_students}</span><span className="ln-xs ln-muted">of {kpis.students} signed in at least once</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Average progress</span><span className="ln-stat">{kpis.avg_progress}%</span><span className="ln-xs ln-muted">Skill nodes mastered, across cohorts</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Mastery logs ready</span><span className="ln-stat">{kpis.logs_ready}</span><span className="ln-xs ln-muted">Students who finished a cluster</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Curriculum–market fit</span><span className="ln-stat">{kpis.curriculum_fit != null ? `${kpis.curriculum_fit}%` : '—'}</span><span className="ln-xs ln-muted">Top JD skills your pathway covers</span></div>
      </div>

      <section className="ln-col" style={{ gap: 14 }}>
        <div className="ln-between"><h2 className="ln-h2" style={{ fontSize: 20 }}>{role === 'professor' ? 'My cohorts' : 'Cohorts'}</h2><Link to="/institution/cohorts" className="ln-link">All cohorts →</Link></div>
        {cohorts.length === 0 && <div className="ln-card ln-muted">{role === 'professor' ? 'No cohorts are assigned to you yet. Your admin assigns them from Team & roles.' : 'No cohorts yet. Create one to start.'}</div>}
        <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
          {cohorts.map(c => (
            <Link key={c.id} to={`/institution/cohorts/${c.id}`} className="ln-card ln-card-link" style={{ gap: 14 }}>
              <div className="ln-between" style={{ alignItems: 'flex-start' }}>
                <div className="ln-col" style={{ gap: 2 }}><span style={{ fontSize: 17, fontWeight: 600 }}>{c.title}</span><span className="ln-small ln-muted">{c.learner_count} students · {c.language === 'hindi' ? 'Hindi' : 'Telugu'} · <span className="in-code">{c.join_code}</span></span></div>
                <span className={`ln-tag ln-tag-lg ${c.status === 'active' ? 'ln-tag-success' : 'ln-tag-warning'}`}>{c.status === 'active' ? 'Active' : c.status === 'completed' ? 'Completed' : 'Setting up'}</span>
              </div>
              <div className="ln-col" style={{ gap: 6 }}>
                <div className="ln-between ln-small"><span className="ln-muted">Average progress</span><b>{c.avg_progress}%</b></div>
                <Bar pct={c.avg_progress} variant="ln-bar-vivid" label={`Average progress ${c.avg_progress}%`} />
              </div>
              <div className="ln-grid ln-g-3" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div className="ln-tile"><b style={{ fontSize: 20 }}>{c.active_week}</b><span className="ln-xs ln-muted">active this week</span></div>
                <div className="ln-tile"><b style={{ fontSize: 20 }}>{c.stuck}</b><span className="ln-xs ln-muted">stuck 3+ loops</span></div>
                <div className="ln-tile"><b style={{ fontSize: 20 }}>{c.not_signed_in}</b><span className="ln-xs ln-muted">not signed in</span></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {pulse.length > 0 && (
        <div className="ln-grid">
          <section className="ln-card" style={{ gap: 12 }}>
            <div className="ln-between ln-wrap"><div className="ln-row"><h2 className="ln-h2">Market pulse for your targets</h2><SampleBadge /></div><Link to="/institution/curriculum" className="ln-link">Compare curriculum →</Link></div>
            <div className="ln-divided ln-col">
              {pulse.map(p => (
                <div key={p.name} className="ln-row" style={{ padding: '10px 0', gap: 12 }}>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                  <span className="ln-small ln-muted">{p.share}% of JDs</span>
                  <span className={`ln-tag ${COVERAGE[p.coverage][1]}`}>{COVERAGE[p.coverage][0]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
