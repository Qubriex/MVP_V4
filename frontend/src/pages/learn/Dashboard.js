// src/pages/learn/Dashboard.js — /learn/dashboard
// Home: continue learning (voice first), progress and streak, jobs that fit,
// skills worth learning next, topics creating jobs, recently mastered, and a
// nudge to finish the profile.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Keyboard, Check, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang } from '../../context/UiLangContext';
import { getOr } from '../../utils/api';
import { MOCK_LEARNER_DASHBOARD, MOCK_MARKET_SNAPSHOT, MOCK_PROFILE_BASICS } from '../../utils/learnerMockData';
import { Bar, SampleBadge, StatusTag, salary, minutes, RequestButton, useSkillRequests } from '../../components/learn/ui';

const APPROACH_NAMES = { native_concept: 'Native concept', analogy: 'Analogy', worked_example: 'Worked example', decomposition: 'Building blocks', socratic: 'Socratic' };
const SECTION_NAMES = { personal: 'your details', education: 'education', projects: 'your projects', skills: 'skills', goals: 'career goals' };

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useUiLang();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [market, setMarket] = useState(null);
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState('');
  const requests = useSkillRequests();

  useEffect(() => {
    getOr('/learner/dashboard', MOCK_LEARNER_DASHBOARD, d => d && typeof d.progress_pct !== 'undefined').then(setData);
    getOr('/market/snapshot', MOCK_MARKET_SNAPSHOT, d => d && Array.isArray(d.jobs)).then(setMarket);
    getOr('/learner/profile', MOCK_PROFILE_BASICS, d => d && d.completeness).then(setProfile);
  }, []);

  const firstName = (user?.name || '').split(' ')[0];
  const search = (e) => { e.preventDefault(); if (query.trim()) navigate(`/learn/market?q=${encodeURIComponent(query.trim())}`); };
  const done = data?.overall_status === 'completed';
  const missing = (profile?.completeness?.missing || []).filter(k => SECTION_NAMES[k]);

  return (
    <>
      <header className="ln-pagehead" style={{ alignItems: 'center' }}>
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title ln-indic">{t('greet')}, {firstName}</h1>
          <span className="ln-sub">{data?.engagement_title}{profile?.institution_name ? ` · ${profile.institution_name}` : ''}</span>
        </div>
        <form role="search" onSubmit={search} className="ln-search" style={{ flex: '0 1 320px' }}>
          <Search size={18} aria-hidden="true" />
          <input aria-label="Search jobs and skills" placeholder="Search jobs and skills" value={query} onChange={e => setQuery(e.target.value)} />
        </form>
      </header>

      <div className="ln-grid ln-g-hero">
        <section className="ln-card ln-card-dark" style={{ gap: 18, padding: 28 }}>
          <div className="ln-between ln-wrap">
            <span className="ln-kicker ln-indic" style={{ color: 'var(--accent-400)' }}>{t('dash.continue')}</span>
            {data?.current_node_index && (
              <span className="ln-small" style={{ color: 'var(--stage-muted)' }}>
                About {data.current_node_minutes || 20} min · Node {data.current_node_index} of {data.total_nodes}
              </span>
            )}
          </div>
          {done ? (
            <h2 className="ln-indic" style={{ fontSize: 28 }}>{t('dash.done')}</h2>
          ) : (
            <div className="ln-col" style={{ gap: 6 }}>
              <h2 style={{ fontSize: 32 }}>{data?.current_node_label || '…'}</h2>
              <span style={{ fontSize: 15, color: 'var(--stage-muted)' }}>
                Cluster: {data?.current_cluster_label}
                {data?.last_approach && ` · Last time: ${APPROACH_NAMES[data.last_approach] || data.last_approach}${data.last_loop_count ? `, ${data.last_loop_count} loop${data.last_loop_count > 1 ? 's' : ''}` : ''}`}
              </span>
            </div>
          )}
          <div className="ln-row ln-wrap" style={{ paddingTop: 6 }}>
            {done ? (
              <Link to="/learn/record" className="ln-btn ln-btn-amber">See your capability record</Link>
            ) : (
              <>
                <Link to="/learn/session?mode=voice" className="ln-btn ln-btn-amber ln-indic"><Mic size={20} aria-hidden="true" />{t('dash.startVoice')}</Link>
                <Link to="/learn/session?mode=type" className="ln-btn ln-btn-ghost-dark ln-indic"><Keyboard size={20} aria-hidden="true" />{t('dash.typeInstead')}</Link>
              </>
            )}
          </div>
        </section>

        <section className="ln-card">
          <div className="ln-between" style={{ alignItems: 'baseline' }}>
            <span className="ln-indic" style={{ fontSize: 15, fontWeight: 600 }}>{t('dash.progress')}</span>
            <span className="ln-stat" style={{ color: 'var(--status-success)', fontSize: 32 }}>{data?.progress_pct ?? 0}%</span>
          </div>
          <Bar pct={data?.progress_pct} variant="ln-bar-vivid" label="Overall progress" />
          <span className="ln-small ln-muted">{data?.nodes_mastered ?? 0} of {data?.total_nodes ?? 0} skill nodes mastered</span>
          <div className="ln-grid ln-g-3" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="ln-tile"><span style={{ fontSize: 22, fontWeight: 700 }}>{data?.streak?.current_streak ?? 0}</span><span className="ln-xs ln-muted">day streak</span></div>
            <div className="ln-tile"><span style={{ fontSize: 22, fontWeight: 700 }}>{minutes(data?.week_minutes)}</span><span className="ln-xs ln-muted">this week</span></div>
            <div className="ln-tile"><span style={{ fontSize: 22, fontWeight: 700 }}>{data?.clusters_done ?? 0}</span><span className="ln-xs ln-muted">clusters done</span></div>
          </div>
        </section>
      </div>

      <section className="ln-col" style={{ gap: 14 }}>
        <div className="ln-between ln-wrap">
          <div className="ln-row"><h2 className="ln-h2 ln-indic" style={{ fontSize: 20 }}>{t('dash.jobs')}</h2>{market?.sample && <SampleBadge />}</div>
          <Link to="/learn/market" className="ln-link">Open job market →</Link>
        </div>
        <div className="ln-grid ln-g-3" style={{ gap: 16 }}>
          {(market?.jobs || []).map(job => (
            <Link key={job.id} to={`/learn/market/${job.id}`} className="ln-card ln-card-link" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 12 }}>
              <div className="ln-col" style={{ gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{job.title}</span>
                <span className="ln-small ln-muted">{job.company_type} · {job.city} · {salary(job.salary_min, job.salary_max)}</span>
              </div>
              <div className="ln-col" style={{ gap: 6 }}>
                <div className="ln-between ln-small"><span className="ln-muted">Skill match</span><b>{job.match}%</b></div>
                <Bar pct={job.match} variant={job.match >= 70 ? 'ln-bar-good' : ''} label={`${job.match}% skill match`} />
              </div>
              <span className="ln-small">{job.missing?.length ? <>Missing: <b>{job.missing.join(', ')}</b></> : 'No required skills missing'}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="ln-grid ln-g-2">
        <section className="ln-card" style={{ gap: 12 }}>
          <div className="ln-between ln-wrap"><h2 className="ln-h2 ln-indic">{t('dash.skillsNext')}</h2><span className="ln-xs ln-muted">Share of matching JDs that ask for it</span></div>
          <div className="ln-divided ln-col">
            {(market?.skills || []).map(s => (
              <div key={s.name} className="ln-row" style={{ padding: '10px 0', gap: 14 }}>
                <div className="ln-col" style={{ flex: 1, gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                  <span className="ln-xs ln-muted">In {s.pct}% of JDs</span>
                </div>
                {s.status === 'not_in_path'
                  ? <RequestButton name={s.name} source="dashboard" requests={requests} />
                  : <StatusTag status={s.status} large />}
              </div>
            ))}
          </div>
          {requests.error && <div className="ln-error">{requests.error}</div>}
        </section>

        <section className="ln-card" style={{ gap: 12 }}>
          <div className="ln-between"><h2 className="ln-h2 ln-indic">{t('dash.topics')}</h2><Link to="/learn/topics" className="ln-link">See all →</Link></div>
          {(market?.topics || []).map(tp => (
            <Link key={tp.id} to={`/learn/topics?topic=${tp.id}`} className="ln-tile ln-card-link" style={{ padding: 14, gap: 6 }}>
              <div className="ln-between"><span style={{ fontSize: 15, fontWeight: 600 }}>{tp.name}</span><span className="ln-xs" style={{ fontWeight: 600, color: 'var(--status-success)' }}>{tp.growth}</span></div>
              <span className="ln-small ln-muted">New roles: {tp.roles.join(', ')}</span>
            </Link>
          ))}
        </section>
      </div>

      <div className="ln-grid ln-g-hero">
        <section className="ln-card">
          <div className="ln-between"><h2 className="ln-h2 ln-indic">{t('dash.recent')}</h2><Link to="/learn/record" className="ln-link">Full record →</Link></div>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            {(data?.recently_mastered || []).length === 0 && <span className="ln-small ln-muted">Pass your first mastery check and it shows up here.</span>}
            {(data?.recently_mastered || []).map(m => (
              <span key={m} className="ln-tag ln-tag-success" style={{ fontSize: 13, fontWeight: 500, minHeight: 34, padding: '0 12px' }}><Check size={14} aria-hidden="true" />{m}</span>
            ))}
          </div>
        </section>
        {profile?.completeness && profile.completeness.pct < 100 && (
          <section className="ln-card ln-card-warm" style={{ gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Profile {profile.completeness.pct}% complete</span>
            <span style={{ fontSize: 14, lineHeight: 1.55 }}>
              {missing.length ? `Add ${missing.map(k => SECTION_NAMES[k]).join(' and ')} to draft a stronger resume.` : 'Finish your profile to draft your first resume.'}
            </span>
            <Link to="/learn/profile" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>Complete profile</Link>
          </section>
        )}
      </div>
    </>
  );
}

