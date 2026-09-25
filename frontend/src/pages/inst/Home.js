// src/pages/inst/Home.js — /institution/home
// Replaces the old dashboard (whose "Manage Learners" opened Upload Target
// and whose "View Mastery Logs" did nothing). Every card links somewhere real.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, KeyRound, Plus } from 'lucide-react';
import api from '../../utils/api';
import { Bar, SampleBadge } from '../../components/learn/ui';
import { useStaff } from '../../components/inst/InstitutionLayout';

const ALERT_ICON = { never_signed_in: [AlertTriangle, 'ln-tag-warning'], stuck: [RotateCcw, 'ln-tag-accent'], pin_reset: [KeyRound, 'ln-tag-info'] };
const COVERAGE = { covered: ['✓ In curriculum', 'ln-tag-success'], partly: ['◐ Partly covered', 'ln-tag-info'], missing: ['+ Not covered', 'ln-tag-accent'] };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function InstHome() {
  const { role } = useStaff();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/institution/overview').then(r => setData(r.data)).catch(e => setError(e.response?.data?.error || 'Couldn’t load your overview. Is the backend running?')); }, []);

  if (error) return <div className="ln-error">{error}</div>;
  if (!data) return <p className="ln-muted">Loading…</p>;
  const { me, kpis, cohorts, alerts, pulse, standing } = data;
  // "Dr. Rao" when there's a title, otherwise the first name.
  const parts = (me?.name || '').trim().split(/\s+/).filter(Boolean);
  const who = me?.title && parts.length ? `${me.title} ${parts[parts.length - 1]}` : parts[0];
  const canManage = role !== 'viewer';

  return (
    <>
      <header className="ln-pagehead" style={{ alignItems: 'center' }}>
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{greeting()}{who ? `, ${who}` : ''}</h1>
          <span className="ln-sub">{cohorts.length} cohort{cohorts.length === 1 ? '' : 's'} · {kpis.students} students{me?.department ? ` · ${me.department}` : ''}</span>
        </div>
        {canManage && (
          <div className="ln-row ln-wrap" style={{ gap: 10 }}>
            <Link to="/institution/students/add" className="ln-btn" style={{ fontWeight: 600 }}><Plus size={16} aria-hidden="true" />Add students</Link>
            {role === 'admin' && <Link to="/institution/cohorts/new" className="ln-btn ln-btn-primary"><Plus size={16} aria-hidden="true" />New cohort</Link>}
          </div>
        )}
      </header>

      {alerts.length > 0 && (
        <section className="ln-col" style={{ gap: 12 }}>
          <h2 className="ln-h2">Needs your attention</h2>
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
        <div className="ln-grid ln-g-2">
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
          {standing && (
            <section className="ln-card" style={{ gap: 12 }}>
              <div className="ln-between"><h2 className="ln-h2">Where we stand</h2><Link to="/institution/benchmark" className="ln-link">Open →</Link></div>
              <span className="ln-stat">{standing.ready} of {standing.total}</span>
              <span className="ln-small">students already match 70%+ of the skills in current JDs for their target roles (verified skills only).</span>
              {[['70%+ match', standing.ready, 'ln-bar-good'], ['50–69%', standing.mid, ''], ['Under 50%', standing.low, '']].map(([label, n, v]) => (
                <div key={label} className="ln-row" style={{ gap: 10 }}>
                  <span className="ln-small" style={{ width: 90 }}>{label}</span>
                  <div style={{ flex: 1 }}><Bar pct={standing.total ? (n / standing.total) * 100 : 0} variant={v} label={`${label}: ${n}`} /></div>
                  <b style={{ width: 28, textAlign: 'right' }}>{n}</b>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
