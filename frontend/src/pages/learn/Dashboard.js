// src/pages/learn/Dashboard.js — /learn/dashboard
// Home: one "Start here" driven by the learner's journey stage (GET
// /learner/journey: the one next real step, and why), "Today", continue
// learning (voice first), progress in plain measures ("Skills done 8 of 20",
// "How well you know them"), jobs that fit, skills worth learning next,
// topics creating jobs and recently mastered.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Keyboard, Check, Flame, Route as RouteIcon, Building2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang } from '../../context/UiLangContext';
import { useFeatures } from '../../utils/features';
import api, { getOr } from '../../utils/api';
import { MOCK_LEARNER_DASHBOARD, MOCK_MARKET_SNAPSHOT, MOCK_PROFILE_BASICS } from '../../utils/learnerMockData';
import { Bar, SampleBadge, StatusTag, salary, minutes, RequestButton, useSkillRequests } from '../../components/learn/ui';
import { useLowBandwidth, slowConnection, cacheOutlines, cachedOutlines } from '../../utils/lowBandwidth';
import CommandBox from '../../components/shared/CommandBox';
import { ProgressRing } from '../../components/shared/ui';
import { WhyThis } from '../../components/shared/Popover';

// "Start here": the one next real step for this learner's journey stage,
// and "Today": practice from the college, employer requests and reviews due,
// each one tap away (v4.3 canvas L1).
function StartHere({ j }) {
  const { t } = useUiLang();
  if (!j) return null;
  const k = j.next.key;
  return (
    <section className="ln-card ln-card-warm lj-start" style={{ gap: 8 }} aria-label={t('lj.startHere')} data-stage={j.stage}>
      <div className="ln-between ln-wrap" style={{ gap: 8 }}>
        <span className="ln-kicker">{t('lj.startHere')}</span>
        <span className="ln-small ln-muted">{t(`devx.stage.${j.stage}`)}</span>
      </div>
      <b style={{ fontSize: 'var(--fs-h3)' }}>{t(`lj.home.next.${k}`, { skill: j.next.label || '', group: j.facts?.group_done?.label || '' })}</b>
      <span className="ln-small">{t(`lj.home.nextWhy.${k}`)}</span>
      <div className="ln-row ln-wrap" style={{ gap: 10 }}>
        <Link to={j.next.href} className="ln-btn ln-btn-primary" data-start-here>{t(`lj.home.nextGo.${k}`)}</Link>
        <WhyThis title={t('lj.home.whyTitle')}>{t('lj.home.why')}</WhyThis>
      </div>
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
    items.push({ key: b.id, icon: RouteIcon, title: t('lj.today.practise', { skills: b.skills.filter(x => !x.mastered).map(x => x.label).join(', '), date: fmtDay(b.retest_at) }), body: [b.note, <Link key="a" className="ln-link" to="/learn/assigned">{t('lj.today.seeAssigned')}</Link>], action: <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => start(next.id)}>{t('learn.dashboard.start')}</button> });
  });
  if (today.requests_waiting) items.push({ key: 'req', icon: Building2, title: t('learn.dashboard.employersAsked', { n: today.requests_waiting }), body: t('learn.dashboard.decideWhatShare'), action: <Link to="/learn/jobs" className="ln-btn ln-btn-sm ln-btn-primary">{t('learn.dashboard.answer')}</Link> });
  if (today.reviews_due) items.push({ key: 'rev', icon: RotateCcw, title: t('learn.dashboard.reviewsDue', { n: today.reviews_due }), body: [t('lj.today.reviewTime'), <WhyThis key="w" title={t('lj.today.reviewWhyTitle')}>{t('lj.today.reviewWhy')}</WhyThis>], action: <Link to="/learn/reviews" className="ln-btn ln-btn-sm ln-btn-primary">{t('learn.dashboard.reviewNow')}</Link> });
  if (!items.length) return null;
  return (
    <section className="ln-card" style={{ gap: 4 }} aria-label={t('learn.dashboard.today')}>
      <h2 className="ln-h2">{t('learn.dashboard.today')}</h2>
      <div className="ln-divided ln-col">
        {items.map(({ key, icon: Icon, title, body, action }) => (
          <div key={key} className="ln-row ln-wrap" style={{ gap: 12, padding: '10px 0' }}>
            <Icon size={18} aria-hidden="true" />
            <span className="ln-col" style={{ flex: 1, gap: 2, minWidth: 200 }}><b style={{ fontSize: 'var(--fs-body)' }}>{title}</b><span className="ln-xs ln-muted">{Array.isArray(body) ? body.filter(Boolean).map((x, i) => <React.Fragment key={i}>{i ? ' · ' : ''}{x}</React.Fragment>) : body}</span></span>
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

// Continue learning in the topics this learner picked: the last course they
// were on first, each with its progress and next lesson.
function MyTopics({ topics }) {
  const { t } = useUiLang();
  if (!topics) return null;
  if (!topics.length) {
    return (
      <section className="ln-card ln-between ln-wrap" style={{ gap: 10 }} aria-label={t('lj.home.topicsTitle')} data-home-topics="empty">
        <span className="ln-col" style={{ gap: 2 }}><b>{t('lj.home.topicsTitle')}</b><span className="ln-small">{t('lj.home.topicsEmpty')}</span></span>
        <Link className="ln-btn ln-btn-sm" to="/learn/courses">{t('lj.home.topicsExplore')}</Link>
      </section>
    );
  }
  const [last, ...rest] = topics;
  return (
    <section className="ln-card" style={{ gap: 10 }} aria-label={t('lj.home.topicsTitle')} data-home-topics>
      <div className="ln-between ln-wrap"><b>{t('lj.home.topicsTitle')}</b><Link className="ln-link ln-small" to="/learn/courses">{t('lj.home.topicsAll')}</Link></div>
      <div className="ln-col" style={{ gap: 8 }}>
        {[last, ...rest.slice(0, 2)].map((c, i) => (
          <div key={c.course_id} className="ln-row ln-wrap" style={{ gap: 12 }}>
            <span className="ln-col" style={{ gap: 4, flex: '1 1 200px', minWidth: 0 }}>
              <span className="ln-small"><b>{c.title}</b> · {t('lj.course.done', { n: c.done, total: c.total })}</span>
              <span className="ln-bar" role="progressbar" aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100} aria-label={c.course_id}><span style={{ width: `${c.pct}%` }} /></span>
            </span>
            {c.next_lesson_id && <Link className={`ln-btn ln-btn-sm ${i === 0 ? 'ln-btn-primary' : ''}`} to={`/learn/lesson/${c.next_lesson_id}`} state={{ from: '/learn/dashboard' }} data-continue-topic={c.course_id}>{t('lj.home.topicsContinue')}</Link>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useUiLang();
  const [data, setData] = useState(null);
  const [market, setMarket] = useState(null);
  const [profile, setProfile] = useState(null);
  const [professors, setProfessors] = useState([]);
  const requests = useSkillRequests();
  const [today, setToday] = useState(null);
  const [journey, setJourney] = useState(null);
  const [topics, setTopics] = useState(null);
  const features = useFeatures();
  useEffect(() => { if (features.learner_jobs) getOr('/market/snapshot', MOCK_MARKET_SNAPSHOT, d => d && Array.isArray(d.jobs)).then(setMarket); }, [features.learner_jobs]);
  const [lowBw, setLowBw] = useLowBandwidth();
  const suggestLowBw = !lowBw && slowConnection();

  useEffect(() => {
    getOr('/learner/dashboard', MOCK_LEARNER_DASHBOARD, d => d && typeof d.progress_pct !== 'undefined').then(setData);
    api.get('/learner/courses/mine').then(r => setTopics(r.data.courses)).catch(() => setTopics([]));
    getOr('/learner/profile', MOCK_PROFILE_BASICS, d => d && d.completeness).then(setProfile);
    getOr('/learner/professors', [], Array.isArray).then(setProfessors);
    api.get('/learner/today').then(r => setToday(r.data)).catch(() => {});
    api.get('/learner/journey').then(r => setJourney(r.data)).catch(() => {});
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
      <CommandBox side="learner" placeholder={t('learn.dashboard.askOrSearch')} searchHref={features.learner_jobs ? '/learn/market' : '/learn/courses'} />
      <StartHere j={journey} />
      {today && <Today today={today} />}
      <MyTopics topics={topics} />

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
            <ProgressRing pct={data?.progress_pct} size={104} label={t('lj.home.skillsDone', { n: data?.nodes_mastered ?? 0, total: data?.total_nodes ?? 0 })} />
            <div className="ln-col" style={{ gap: 6 }}>
              <span className="ln-indic" style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }} data-measure="done">{t('lj.home.skillsDone', { n: data?.nodes_mastered ?? 0, total: data?.total_nodes ?? 0 })}</span>
              <span className="ln-small" data-measure="how-well">{t('lj.home.howWell', { pct: data?.avg_mastery ?? 0 })}</span>
              <WhyThis title={t('lj.home.measuresTitle')}>{t('lj.home.measures')}</WhyThis>
            </div>
          </div>
          <div className="ln-grid ln-g-3" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="ln-tile"><span style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Flame size={20} aria-hidden="true" style={{ color: data?.streak?.current_streak ? 'var(--brand-accent)' : 'var(--color-text-muted)' }} />{data?.streak?.current_streak ?? 0}</span><span className="ln-xs ln-muted">{t('learn.dashboard.dayStreak')}</span></div>
            <div className="ln-tile"><span style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>{minutes(data?.week_minutes)}</span><span className="ln-xs ln-muted">{t('learn.dashboard.thisWeek')}</span></div>
            <div className="ln-tile"><span style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>{data?.clusters_done ?? 0}</span><span className="ln-xs ln-muted">{t('learn.dashboard.clustersDone')}</span></div>
          </div>
        </section>
      </div>

      {/* Jobs, skills worth learning and emerging topics: only with FEATURE_LEARNER_JOBS. */}
      {features.learner_jobs && (<>
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

      </>)}

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
        {profile?.completeness && profile.completeness.pct < 100 && journey && !['S0', 'S1'].includes(journey.stage) && (
          <section className="ln-card ln-card-warm" style={{ gap: 12 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{t('learn.dashboard.profilePctComplete', { pct: profile.completeness.pct })}</span>
            <span style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55 }}>
              {missing.length ? t('learn.dashboard.addSections', { sections: missing.map(k => t(SECTION_NAMES[k])).join(', ') }) : t('learn.dashboard.finishProfileDraftFirst')}
            </span>
            <Link to="/learn/welcome" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>{t('learn.dashboard.completeProfile')}</Link>
          </section>
        )}
      </div>
    </>
  );
}

