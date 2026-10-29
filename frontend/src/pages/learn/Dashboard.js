// src/pages/learn/Dashboard.js — /learn/dashboard
// Home: continue learning (voice first), progress and streak, jobs that fit,
// skills worth learning next, topics creating jobs, recently mastered, and a
// nudge to finish the profile.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Keyboard, Check, Flame, CheckCircle2, Circle, Route as RouteIcon, Building2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang } from '../../context/UiLangContext';
import api, { getOr } from '../../utils/api';
import { MOCK_LEARNER_DASHBOARD, MOCK_MARKET_SNAPSHOT, MOCK_PROFILE_BASICS } from '../../utils/learnerMockData';
import { Bar, SampleBadge, StatusTag, salary, minutes, RequestButton, useSkillRequests } from '../../components/learn/ui';
import { useLowBandwidth, slowConnection, cacheOutlines, cachedOutlines } from '../../utils/lowBandwidth';
import CommandBox from '../../components/shared/CommandBox';
import { ProgressRing } from '../../components/shared/ui';

// "Start here" for a new student, and "Today": practice from the college,
// employer requests and reviews due, each one tap away (v4.3 canvas L1).
function StartHere({ s }) {
  const { t } = useUiLang();
  const steps = [
    [t('learn.dashboard.tellUsAboutYourself'), s.profile, '/learn/welcome'],
    [t('learn.dashboard.doYourFirstLesson'), s.first_lesson, '/learn/session?mode=voice'],
    [t('learn.dashboard.letEmployersFindYou'), s.discoverable, '/learn/settings#privacy']
  ];
  if (steps.every(x => x[1])) return null;
  return (
    <section className="ln-card ln-card-warm" style={{ gap: 10 }} aria-label={t('learn.dashboard.startHere')}>
      <div className="ln-between"><h2 className="ln-h2">{t('learn.dashboard.startHere')}</h2><span className="ln-small ln-muted">{t('learn.dashboard.length3Done', { length: steps.filter(x => x[1]).length })}</span></div>
      {steps.map(([label, done, href]) => (
        <div key={label} className="ln-row" style={{ gap: 10 }}>
          {done ? <CheckCircle2 size={18} style={{ color: 'var(--status-success)' }} aria-label={t('learn.dashboard.done')} /> : <Circle size={18} aria-label={t('learn.dashboard.notDone')} />}
          {done ? <span className="ln-small ln-muted" style={{ textDecoration: 'line-through' }}>{label}</span> : <Link to={href} className="ln-link ln-small">{label} →</Link>}
        </div>
      ))}
    </section>
  );
}

function Today({ today }) {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const start = async (nodeId) => { try { await api.post('/learner/path/node', { node_id: nodeId }); } catch { /* the session opens on the current node */ } navigate('/learn/session?mode=voice'); };
  const items = [];
  today.bridges.forEach(b => {
    const next = b.skills.find(x => !x.mastered);
    items.push({ key: b.id, icon: RouteIcon, title: t('learn.dashboard.practiceFromCollegeJoin', { join: b.skills.filter(x => !x.mastered).map(x => x.label).join(', ') }), body: [b.note, t('learn.dashboard.retestBy', { date: fmtDay(b.retest_at) })].filter(Boolean).join(' · '), action: <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => start(next.id)}>{t('learn.dashboard.start')}</button> });
  });
  if (today.requests_waiting) items.push({ key: 'req', icon: Building2, title: t('learn.dashboard.employersAsked', { n: today.requests_waiting }), body: t('learn.dashboard.decideWhatShare'), action: <Link to="/learn/jobs" className="ln-btn ln-btn-sm ln-btn-primary">{t('learn.dashboard.answer')}</Link> });
  if (today.reviews_due) items.push({ key: 'rev', icon: RotateCcw, title: t('learn.dashboard.reviewsDue', { n: today.reviews_due }), body: t('learn.dashboard.shortQuestionsKeepSkills'), action: <Link to="/learn/reviews" className="ln-btn ln-btn-sm ln-btn-primary">{t('learn.dashboard.reviewNow')}</Link> });
  if (!items.length) return null;
  return (
    <section className="ln-card" style={{ gap: 4 }} aria-label={t('learn.dashboard.today')}>
      <h2 className="ln-h2">{t('learn.dashboard.today')}</h2>
      <div className="ln-divided ln-col">
        {items.map(({ key, icon: Icon, title, body, action }) => (
          <div key={key} className="ln-row ln-wrap" style={{ gap: 12, padding: '10px 0' }}>
            <Icon size={18} aria-hidden="true" />
            <span className="ln-col" style={{ flex: 1, gap: 2, minWidth: 200 }}><b style={{ fontSize: 'var(--fs-body)' }}>{title}</b><span className="ln-xs ln-muted">{body}</span></span>
            {action}
          </div>
        ))}
      </div>
    </section>
  );
}

const fmtDay = (iso) => new Date(iso).toLocaleDateString(document.documentElement.lang ? `${document.documentElement.lang}-IN` : 'en-IN', { day: 'numeric', month: 'short' });
const APPROACH_NAMES = { native_concept: 'learn.dashboard.approachNames.nativeConcept', analogy: 'learn.dashboard.approachNames.analogy', worked_example: 'learn.dashboard.approachNames.workedExample', decomposition: 'learn.dashboard.approachNames.buildingBlocks', socratic: 'learn.dashboard.approachNames.socratic' };
const SECTION_NAMES = { personal: 'learn.dashboard.sectionNames.yourDetails', education: 'learn.dashboard.sectionNames.education', projects: 'learn.dashboard.sectionNames.yourProjects', skills: 'learn.dashboard.sectionNames.skills', goals: 'learn.dashboard.sectionNames.careerGoals' };

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useUiLang();
  const [data, setData] = useState(null);
  const [market, setMarket] = useState(null);
  const [profile, setProfile] = useState(null);
  const [professors, setProfessors] = useState([]);
  const requests = useSkillRequests();
  const [today, setToday] = useState(null);
  const [lowBw, setLowBw] = useLowBandwidth();
  const suggestLowBw = !lowBw && slowConnection();

  useEffect(() => {
    getOr('/learner/dashboard', MOCK_LEARNER_DASHBOARD, d => d && typeof d.progress_pct !== 'undefined').then(setData);
    getOr('/market/snapshot', MOCK_MARKET_SNAPSHOT, d => d && Array.isArray(d.jobs)).then(setMarket);
    getOr('/learner/profile', MOCK_PROFILE_BASICS, d => d && d.completeness).then(setProfile);
    getOr('/learner/professors', [], Array.isArray).then(setProfessors);
    api.get('/learner/today').then(r => setToday(r.data)).catch(() => {});
    // Low-bandwidth mode (v4.3 §19): keep the next two lessons' outlines on the device.
    api.get('/learner/path').then(r => {
      const nodes = (r.data.clusters || []).flatMap(c => c.nodes.map(n => ({ ...n, cluster: c.label })));
      const i = nodes.findIndex(n => n.status === 'current');
      if (i >= 0) cacheOutlines(nodes.slice(i, i + 2).map(n => ({ label: n.label, cluster: n.cluster, minutes: n.estimated_minutes })));
    }).catch(() => {});
  }, []);

  const firstName = (user?.name || '').split(' ')[0];
  const done = data?.overall_status === 'completed';
  const missing = (profile?.completeness?.missing || []).filter(k => SECTION_NAMES[k]);

  return (
    <>
      <header className="ln-pagehead" style={{ alignItems: 'center' }}>
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title ln-indic">{t('greet')}, {firstName}</h1>
          <span className="ln-sub">{data?.engagement_title}{profile?.institution_name ? ` · ${profile.institution_name}` : ''}</span>
        </div>
      </header>

      {suggestLowBw && (
        <div className="ln-note ln-between ln-wrap" role="status" style={{ gap: 10 }}>
          <span>{t('learn.dashboard.connectionLooksSlowLow')}</span>
          <button type="button" className="ln-btn ln-btn-sm" onClick={() => setLowBw(true)}>{t('learn.dashboard.turnOn')}</button>
        </div>
      )}
      {!navigator.onLine && cachedOutlines()?.outlines?.length > 0 && (
        <section className="ln-card" style={{ gap: 8 }} aria-label={t('learn.dashboard.savedOffline')}>
          <strong>{t('learn.dashboard.offlineComingUpNext')}</strong>
          {cachedOutlines().outlines.map(o => <span key={o.label}>{o.label} <span className="ln-small ln-muted">{t('learn.dashboard.clusterAbout', { cluster: o.cluster })}{' '} {o.minutes || 20} {' '}{t('learn.dashboard.min')}</span></span>)}
          <span className="ln-xs ln-muted">{t('learn.dashboard.lessonsChecksNeedConnection')}</span>
        </section>
      )}
      <CommandBox side="learner" placeholder={t('learn.dashboard.askOrSearch')} searchHref="/learn/market" />
      {today && <StartHere s={today.start_here} />}
      {today && <Today today={today} />}

      <div className="ln-grid ln-g-hero">
        <section className="ln-card ln-card-dark" style={{ gap: 18, padding: 28 }}>
          <div className="ln-between ln-wrap">
            <span className="ln-kicker ln-indic" style={{ color: 'var(--accent-400)' }}>{t('dash.continue')}</span>
            {data?.current_node_index && (
              <span className="ln-small" style={{ color: 'var(--stage-muted)' }}>
                {t('learn.dashboard.about')}{' '} {data.current_node_minutes || 20} {' '}{t('learn.dashboard.minNodeCurrentNode', { current_node_index: data.current_node_index, total_nodes: data.total_nodes })}
              </span>
            )}
          </div>
          {done ? (
            <h2 className="ln-indic" style={{ fontSize: 'var(--fs-h1)' }}>{t('dash.done')}</h2>
          ) : (
            <div className="ln-col" style={{ gap: 6 }}>
              <h2 style={{ fontSize: 'var(--fs-h1)' }}>{data?.current_node_label || '…'}</h2>
              <span style={{ fontSize: 'var(--fs-body)', color: 'var(--stage-muted)' }}>
                {t('learn.dashboard.clusterCurrentClusterLabel', { current_cluster_label: data?.current_cluster_label })}
                {data?.last_approach && ` · ${t('learn.dashboard.lastTime', { approach: APPROACH_NAMES[data.last_approach] ? t(APPROACH_NAMES[data.last_approach]) : data.last_approach })}${data.last_loop_count ? ` · ${t('learn.dashboard.tries', { n: data.last_loop_count })}` : ''}`}
              </span>
            </div>
          )}
          <div className="ln-row ln-wrap" style={{ paddingTop: 6 }}>
            {done ? (
              <Link to="/learn/record" className="ln-btn ln-btn-primary ln-btn-lg">{t('learn.dashboard.seeCapabilityRecord')}</Link>
            ) : (
              <>
                <Link to="/learn/session?mode=voice" data-demo="lesson" className="ln-btn ln-btn-primary ln-btn-lg ln-indic"><Mic size={20} aria-hidden="true" />{t('dash.startVoice')}</Link>
                <Link to="/learn/session?mode=type" className="ln-btn ln-btn-ghost-dark ln-indic"><Keyboard size={20} aria-hidden="true" />{t('dash.typeInstead')}</Link>
              </>
            )}
          </div>
        </section>

        <section className="ln-card">
          <div className="ln-row" style={{ gap: 16 }}>
            <ProgressRing pct={data?.progress_pct} size={104} label={t('learn.dashboard.ringLabel', { pct: data?.progress_pct ?? 0 })} />
            <div className="ln-col" style={{ gap: 4 }}>
              <span className="ln-indic" style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{t('dash.progress')}</span>
              <span className="ln-small ln-muted">{t('learn.dashboard.skillsDone', { n: data?.nodes_mastered ?? 0, total: data?.total_nodes ?? 0 })}</span>
            </div>
          </div>
          <div className="ln-grid ln-g-3" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="ln-tile"><span style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Flame size={20} aria-hidden="true" style={{ color: data?.streak?.current_streak ? 'var(--brand-accent)' : 'var(--color-text-muted)' }} />{data?.streak?.current_streak ?? 0}</span><span className="ln-xs ln-muted">{t('learn.dashboard.dayStreak')}</span></div>
            <div className="ln-tile"><span style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>{minutes(data?.week_minutes)}</span><span className="ln-xs ln-muted">{t('learn.dashboard.thisWeek')}</span></div>
            <div className="ln-tile"><span style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>{data?.clusters_done ?? 0}</span><span className="ln-xs ln-muted">{t('learn.dashboard.clustersDone')}</span></div>
          </div>
        </section>
      </div>

      <section className="ln-col" style={{ gap: 14 }}>
        <div className="ln-between ln-wrap">
          <div className="ln-row"><h2 className="ln-h2 ln-indic" style={{ fontSize: 'var(--fs-h2)' }}>{t('dash.jobs')}</h2>{market?.sample && <SampleBadge />}</div>
          <Link to="/learn/market" className="ln-link">{t('learn.dashboard.openJobMarket')}</Link>
        </div>
        <div className="ln-grid ln-g-3" style={{ gap: 16 }}>
          {(market?.jobs || []).map(job => (
            <Link key={job.id} to={`/learn/market/${job.id}`} className="ln-card ln-card-link" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 12 }}>
              <div className="ln-col" style={{ gap: 4 }}>
                <span style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{job.title}</span>
                <span className="ln-small ln-muted">{job.company_type} · {job.city} · {salary(job.salary_min, job.salary_max)}</span>
              </div>
              <div className="ln-col" style={{ gap: 6 }}>
                <div className="ln-between ln-small"><span className="ln-muted">{t('learn.dashboard.skillMatch')}</span><b>{job.match}%</b></div>
                <Bar pct={job.match} variant={job.match >= 70 ? 'ln-bar-good' : ''} label={t('learn.dashboard.matchSkillMatch', { match: job.match })} />
              </div>
              <span className="ln-small">{job.match < 100 && (job.to_learn || job.missing || []).length ? <>{t('learn.dashboard.stillToLearn')}{' '} <b>{(job.to_learn || job.missing).join(', ')}</b></> : t('learn.dashboard.haveEverySkill')}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="ln-grid ln-g-2">
        <section className="ln-card" style={{ gap: 12 }}>
          <div className="ln-between ln-wrap"><h2 className="ln-h2 ln-indic">{t('dash.skillsNext')}</h2><span className="ln-xs ln-muted">{t('learn.dashboard.shareMatchingJdsAsk')}</span></div>
          <div className="ln-divided ln-col">
            {(market?.skills || []).map(s => (
              <div key={s.name} className="ln-row" style={{ padding: '10px 0', gap: 14 }}>
                <div className="ln-col" style={{ flex: 1, gap: 2 }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{s.name}</span>
                  <span className="ln-xs ln-muted">{t('learn.dashboard.pctJds', { pct: s.pct })}</span>
                </div>
                {s.status === 'not_in_path'
                  ? <RequestButton name={s.name} source="dashboard" requests={requests} />
                  : <StatusTag status={s.status} large />}
              </div>
            ))}
          </div>
          {requests.sent && <div className="ln-note" role="status">{requests.sent}.</div>}
          {requests.error && <div className="ln-error">{requests.error}</div>}
        </section>

        <section className="ln-card" style={{ gap: 12 }}>
          <div className="ln-between"><h2 className="ln-h2 ln-indic">{t('dash.topics')}</h2><Link to="/learn/topics" className="ln-link">{t('learn.dashboard.seeAll')}</Link></div>
          {(market?.topics || []).map(tp => (
            <Link key={tp.id} to={`/learn/topics?topic=${tp.id}`} className="ln-tile ln-card-link" style={{ padding: 14, gap: 6 }}>
              <div className="ln-between"><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{tp.name}</span><span className="ln-xs" style={{ fontWeight: 600, color: 'var(--status-success)' }}>{tp.growth}</span></div>
              <span className="ln-small ln-muted">{t('learn.dashboard.newRolesJoin', { join: tp.roles.join(', ') })}</span>
            </Link>
          ))}
        </section>
      </div>

      <div className="ln-grid ln-g-hero">
        <section className="ln-card">
          <div className="ln-between"><h2 className="ln-h2 ln-indic">{t('dash.recent')}</h2><Link to="/learn/record" className="ln-link">{t('learn.dashboard.fullRecord')}</Link></div>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            {(data?.recently_mastered || []).length === 0 && <span className="ln-small ln-muted">{t('learn.dashboard.passFirstMasteryCheck')}</span>}
            {(data?.recently_mastered || []).map(m => (
              <span key={m} className="ln-tag ln-tag-success" style={{ fontSize: 'var(--fs-small)', fontWeight: 500, minHeight: 34, padding: '0 12px' }}><Check size={14} aria-hidden="true" />{m}</span>
            ))}
          </div>
        </section>
        {professors.length > 0 && (
          <section className="ln-card" style={{ gap: 12 }}>
            <h2 className="ln-h2">{t('learn.dashboard.yourProfessors')}</h2>
            {professors.map(p => (
              <div key={p.name} className="ln-row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div className="ln-avatar" style={{ overflow: 'hidden' }}>{p.photo_data_url ? <img src={p.photo_data_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
                <div className="ln-col" style={{ gap: 2 }}>
                  <b>{[p.title, p.name].filter(Boolean).join(' ')}{p.cohort_role === 'lead' && <span className="ln-tag ln-tag-neutral" style={{ marginLeft: 6 }}>{t('learn.dashboard.lead')}</span>}</b>
                  {(p.designation || p.department) && <span className="ln-small">{[p.designation, p.department].filter(Boolean).join(' · ')}</span>}
                  {p.office_hours && <span className="ln-xs ln-muted">{t('learn.dashboard.officeHoursOfficeHours', { office_hours: p.office_hours })}</span>}
                </div>
              </div>
            ))}
          </section>
        )}
        {profile?.completeness && profile.completeness.pct < 100 && (
          <section className="ln-card ln-card-warm" style={{ gap: 12 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{t('learn.dashboard.profilePctComplete', { pct: profile.completeness.pct })}</span>
            <span style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55 }}>
              {missing.length ? t('learn.dashboard.addSections', { sections: missing.map(k => t(SECTION_NAMES[k])).join(', ') }) : t('learn.dashboard.finishProfileDraftFirst')}
            </span>
            <Link to="/learn/profile" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>{t('learn.dashboard.completeProfile')}</Link>
          </section>
        )}
      </div>
    </>
  );
}

