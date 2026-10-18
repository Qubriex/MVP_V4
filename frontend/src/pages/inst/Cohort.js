// src/pages/inst/Cohort.js — /institution/cohorts/:id
// Cohort detail: join code, KPIs, where students are in the pathway, the
// hardest nodes (counts and loops only — conversations stay private), the
// students, the pathway, mastery logs (produce, view, export) and settings.
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Download, RefreshCw, Radio } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import Crumbs from '../../components/inst/Crumbs';
import ActivityYear from '../../components/inst/ActivityYear';
import DownloadDialog from '../../components/inst/DownloadDialog';
import { Bar } from '../../components/learn/ui';
import { useStaff } from '../../components/inst/InstitutionLayout';
import CopyLink from '../../components/inst/CopyLink';
import { AccessTag } from './Students';
import { COHORT_STATUS } from './Cohorts';
import { errMsg } from '../../utils/errors';
import CohortGrid from '../../components/inst/CohortGrid';
import { Select } from '../../components/shared/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
// Tab ids (also used in ?tab=) and their translated labels.
const TABS = ['Overview', 'Readiness', 'Students', 'Pathway', 'Mastery logs', 'Settings'];
const TAB_KEY = { Overview: 'inst.cohort.tabs.overview', Readiness: 'inst.cohort.tabs.readiness', Students: 'inst.cohort.tabs.students', Pathway: 'inst.cohort.tabs.pathway', 'Mastery logs': 'inst.cohort.tabs.masteryLogs', Settings: 'inst.cohort.tabs.settings' };
const date = (t) => (t ? new Date(t.replace(' ', 'T') + (/[Z+]/.test(t) ? '' : 'Z')).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Overview({ c, requests }) {
  const { t } = useUiLang();
  const max = Math.max(1, ...c.clusters.map(x => x.students_here));
  return (
    <>
      <div className="ln-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[[t('inst.cohort.tabs.students'), c.kpis.students], [t('inst.cohort.signedIn'), c.kpis.signed_in], [t('inst.cohort.avgProgress'), `${c.kpis.avg_progress}%`],
          [t('inst.cohort.avgMastery'), c.kpis.avg_mastery != null ? `${c.kpis.avg_mastery}%` : '—'], [t('inst.cohort.activeMinStudentWeek'), c.kpis.active_minutes_per_student_week]].map(([k, v]) => (
          <div key={k} className="ln-card ln-card-sm"><span className="ln-small ln-muted">{k}</span><span className="ln-stat">{v}</span></div>
        ))}
      </div>
      <div className="ln-grid ln-g-2">
        <section className="ln-card">
          <h2 className="ln-h2">{t('inst.cohort.whereStudentsNow')}</h2>
          {c.clusters.map(cl => (
            <div key={cl.id} className="ln-row" style={{ gap: 12 }}>
              <span className="ln-small" style={{ width: 170, flexShrink: 0 }}>{cl.label}</span>
              <div style={{ flex: 1 }}><Bar pct={(cl.students_here / max) * 100} label={t('inst.cohort.studentsHereStudentsLabel', { students_here: cl.students_here, label: cl.label })} /></div>
              <span className="ln-small" style={{ width: 90, textAlign: 'right' }}><b>{cl.students_here}</b> {' '}{t('inst.cohort.students')}</span>
            </div>
          ))}
          <span className="ln-xs ln-muted">{t('inst.cohort.studentsCurrentlyWorkingInside', { finished_a_cluster: c.kpis.finished_a_cluster })}</span>
        </section>
        <section className="ln-card">
          <h2 className="ln-h2">{t('inst.cohort.hardestNodes')}</h2>
          {c.hardest.length === 0 ? <span className="ln-small ln-muted">{t('inst.cohort.noLoopsRecordedYet')}</span> : (
            <table className="ln-table"><thead><tr><th>{t('inst.cohort.node')}</th><th>{t('inst.cohort.avgLoops')}</th><th>{t('inst.cohort.stuckNow')}</th><th /></tr></thead>
              <tbody>{c.hardest.map(h => (
                <tr key={h.node_id}><td style={{ fontWeight: 600 }}>{h.node_label}</td><td>{h.avg_loops}</td><td>{h.stuck}</td>
                  <td><Link className="ln-btn ln-btn-sm" to={`/institution/students?engagement_id=${c.id}&node_id=${h.node_id}&node_label=${encodeURIComponent(h.node_label)}`}>{t('inst.cohort.seeStudents')}</Link></td></tr>
              ))}</tbody></table>
          )}
          <span className="ln-xs ln-muted">{t('inst.cohort.onlyCountsLoopsShown')}</span>
        </section>
      </div>
      <ActivityYear cohortId={c.id} />
      {requests.length > 0 && (
        <section className="ln-card">
          <h2 className="ln-h2">{t('inst.cohort.skillsStudentsAskedAdd')}</h2>
          <span className="ln-small ln-muted">{t('inst.cohort.requestedFromJobMarket')}</span>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>{requests.map(r => <span key={r.skill_name} className="ln-chip">{r.skill_name} <b>· {r.learner_count}</b></span>)}</div>
        </section>
      )}
    </>
  );
}

// Pathway: each student's own progress (default) or the cohort overview.
// A student's skill is 100% only when they mastered it, otherwise 0% — their
// current skill is marked "learning now" without credit.
function Pathway({ c, studentId, setStudentId }) {
  const { t } = useUiLang();
  const [view, setView] = useState('student');
  const students = c.learners.filter(l => l.access !== 'removed');
  const sel = studentId || students[0]?.el_id || '';
  const { data: p, error } = useCachedGet(view === 'student' && sel ? `/institution/engagements/${c.id}/students/${sel}/pathway` : null);
  return (
    <div className="ln-col" style={{ gap: 14 }}>
      <div className="ln-row ln-wrap" style={{ gap: 12 }}>
        <div className="ln-pilltabs" role="tablist" aria-label={t('inst.cohort.pathwayView')}>
          <button type="button" role="tab" className="ln-pilltab" aria-selected={view === 'student'} onClick={() => setView('student')}>{t('inst.cohort.eachStudent')}</button>
          <button type="button" role="tab" className="ln-pilltab" aria-selected={view === 'cohort'} onClick={() => setView('cohort')}>{t('inst.cohort.cohortOverview')}</button>
        </div>
        {view === 'student' && students.length > 0 && (
          <label className="ln-selectwrap"><span>{t('inst.cohort.student')}</span>
            <Select value={sel} onChange={e => setStudentId(e.target.value)}>{students.map(l => <option key={l.el_id} value={l.el_id}>{l.name} · {l.learner_ref}</option>)}</Select>
          </label>
        )}
      </div>
      {view === 'student' ? (
        students.length === 0 ? <div className="ln-card ln-muted">{t('inst.cohort.noStudentsCohortYet')}</div>
          : error ? <div className="ln-error">{t('inst.cohort.couldnTLoadStudent')}</div>
            : !p ? <p className="ln-muted">{t('inst.cohort.loading')}</p> : (
              <>
                <div className="ln-card ln-card-sm" style={{ gap: 6 }}>
                  <div className="ln-between ln-wrap"><b>{p.student.name}</b><span className="ln-small">{t('inst.cohort.masteredTotalSkillsMastered', { mastered: p.mastered, total: p.total })}{' '} <b>{p.pct}%</b></span></div>
                  <Bar pct={p.pct} label={t('inst.cohort.pctPathwayMastered', { pct: p.pct })} />
                </div>
                {p.clusters.map((cl, i) => (
                  <section key={cl.id} className="ln-card" style={{ gap: 10 }}>
                    <div className="ln-between"><h2 className="ln-h2">{i + 1}. {cl.label}</h2><span className="ln-small"><b>{cl.pct}%</b> <span className="ln-muted">{t('inst.cohort.mastered')}</span></span></div>
                    <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                      {cl.nodes.map(n => (
                        <span key={n.id} className={`in-node is-${n.status}`} title={n.mastered_at ? t('inst.cohort.masteredOn', { date: date(n.mastered_at) }) : n.status === 'learning' ? t('inst.cohort.learningNow') : t('inst.cohort.notStarted')}>
                          {n.status === 'mastered' ? '✓' : n.status === 'learning' ? '◐' : '○'} {n.label}
                          <span className="ln-xs ln-muted">· {n.status === 'mastered' ? `100% · ${date(n.mastered_at)}` : n.status === 'learning' ? `0% · ${t('inst.cohort.learningNow')}${n.loops ? ` · ${t('inst.cohort.triesN', { n: n.loops })}` : ''}` : '0%'}</span>
                        </span>
                      ))}
                    </div>
                  </section>
                ))}
                <span className="ln-xs ln-muted">{t('inst.cohort.onlySkillsStudentHas')}</span>
              </>
            )
      ) : (
        <>
          {c.clusters.map((cl, i) => (
            <section key={cl.id} className="ln-card" style={{ gap: 10 }}>
              <div className="ln-between"><h2 className="ln-h2">{i + 1}. {cl.label}</h2><span className="ln-small ln-muted">{t('inst.cohort.lengthNodesValueH', { length: cl.nodes.length, value: Math.round(cl.nodes.reduce((a, n) => a + (n.estimated_minutes || 20), 0) / 6) / 10 })}</span></div>
              <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                {cl.nodes.map(n => <span key={n.id} className="ln-chip" title={t('inst.cohort.masteredByStudentsMastered', { mastered_by: n.mastered_by, students: c.kpis.students })}>{n.node_label}<span className="ln-xs ln-muted">· {n.mastered_by}/{c.kpis.students} · {n.mastered_pct ?? 0}%</span></span>)}
              </div>
            </section>
          ))}
          <span className="ln-xs ln-muted">{t('inst.cohort.cohortOverviewAfterEach')}</span>
        </>
      )}
    </div>
  );
}

function Logs({ c, canProduce }) {
  const { t } = useUiLang();
  const [logs, setLogs] = useState(null);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.get(`/institution/engagements/${c.id}/mastery-logs`).then(r => setLogs(r.data)).catch(() => setLogs([])), [c.id]);
  useEffect(() => { load(); }, [load]);
  const produce = async (complete) => {
    if (complete && !window.confirm(t('inst.cohort.produceFinalLogsMark'))) return;
    try { const r = await api.post(`/institution/engagements/${c.id}/produce-mastery-logs`, { complete }); setMsg(r.data.message); load(); } catch (e) { setMsg(errMsg(e, t('inst.cohort.couldnTProduceLogs'))); }
  };
  const sendAll = async () => {
    try { const r = await api.post(`/institution/engagements/${c.id}/mastery-logs/send`); setMsg(t('inst.cohort.logsSent', { n: r.data.sent })); } catch (e) { setMsg(errMsg(e, t('inst.cohort.couldnTSend'))); }
  };
  const exportCsv = async () => {
    const r = await api.get(`/institution/engagements/${c.id}/mastery-logs.csv`, { responseType: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(r.data); a.download = `mastery-logs-${c.join_code}.csv`; a.click();
  };
  return (
    <section className="ln-card">
      <div className="ln-between ln-wrap" style={{ alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 4 }}><h2 className="ln-h2">{t('inst.cohort.masteryLogs')}</h2>
          <span className="ln-small ln-muted" style={{ maxWidth: 560 }}>{t('inst.cohort.produceThemWheneverNeed')}</span></div>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <button type="button" className="ln-btn" onClick={exportCsv} disabled={!logs?.length}><Download size={16} aria-hidden="true" />{t('inst.cohort.exportAllCsv')}</button>
          {canProduce && logs?.length > 0 && <button type="button" className="ln-btn" onClick={sendAll}>{t('inst.cohort.sendStudents')}</button>}
          {canProduce && <button type="button" className="ln-btn" onClick={() => produce(false)}>{t('inst.cohort.produceCurrentLogs')}</button>}
          {canProduce && c.status !== 'completed' && <button type="button" className="ln-btn ln-btn-primary" onClick={() => produce(true)}>{t('inst.cohort.produceFinalLogs')}</button>}
        </div>
      </div>
      {msg && <div className="ln-note" role="status">{msg}</div>}
      {logs && logs.length === 0 && <span className="ln-small ln-muted">{t('inst.cohort.noLogsProducedYet')}</span>}
      <div className="ln-grid ln-g-3" style={{ gap: 10 }}>
        {(logs || []).map(l => (
          <Link key={l.id} to={`/institution/mastery-log/${l.id}`} className="ln-tile ln-card-link" style={{ padding: 14 }}>
            <b>{l.learner_name}</b><span className="ln-xs ln-muted">{l.clusters_complete.length ? l.clusters_complete.join(', ') : t('inst.cohort.noClusterCompleteYet')} · {date(l.produced_at)}</span>
            <span className="ln-link" style={{ fontSize: 'var(--fs-small)' }}>{t('inst.cohort.view')}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Settings({ c, onChanged }) {
  const { t } = useUiLang();
  const [title, setTitle] = useState(c.title);
  const [status, setStatus] = useState(c.status);
  const [team, setTeam] = useState([]);
  const [profs, setProfs] = useState(Object.fromEntries(c.professors.map(p => [p.id, p.cohort_role])));
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/institution/team').then(r => setTeam(r.data.filter(m => m.role === 'professor' && m.status !== 'disabled'))).catch(() => {}); }, []);
  const save = async () => {
    try {
      await api.put(`/institution/engagements/${c.id}`, { title, status, professors: Object.entries(profs).map(([id, cohort_role]) => ({ id, cohort_role })) });
      setMsg(t('inst.cohort.saved')); onChanged();
    } catch (e) { setMsg(errMsg(e, t('inst.cohort.couldnTSave'))); }
  };
  return (
    <section className="ui-narrow ln-card">
      <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="st-title">{t('inst.cohort.cohortName')}</label><input id="st-title" className="ln-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="st-status">{t('inst.cohort.status')}</label>
          <Select id="st-status" value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(COHORT_STATUS).map(([k, v]) => <option key={k} value={k}>{t(v[0])}</option>)}</Select></div>
      </div>
      <div className="ln-col" style={{ gap: 8 }}><span className="ln-label">{t('inst.cohort.professors')}</span>
        {team.map(m => (
          <div key={m.id} className="ln-row ln-wrap" style={{ gap: 12 }}>
            <label className="ln-check" style={{ flex: 1 }}><input type="checkbox" checked={!!profs[m.id]} onChange={e => setProfs(p => { const n = { ...p }; if (e.target.checked) n[m.id] = 'co'; else delete n[m.id]; return n; })} />{[m.title, m.name].filter(Boolean).join(' ') || m.email}</label>
            {profs[m.id] && <Select style={{ width: 170, minHeight: 36 }} aria-label={t('inst.cohort.roleCohort')} value={profs[m.id]} onChange={e => setProfs(p => ({ ...p, [m.id]: e.target.value }))}><option value="lead">{t('inst.cohort.leadProfessor')}</option><option value="co">{t('inst.cohort.coProfessor')}</option></Select>}
          </div>
        ))}
        {team.length === 0 && <span className="ln-small ln-muted">{t('inst.cohort.noProfessorsYetInvite')}</span>}
      </div>
      {msg && <span className="ln-small" role="status">{msg}</span>}
      <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={save}>{t('inst.cohort.saveSettings')}</button>
    </section>
  );
}

export default function Cohort() {
  const { t } = useUiLang();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { role } = useStaff();
  const { data: c, error: loadError, reload } = useCachedGet(`/institution/engagements/${id}`);
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : t('inst.cohort.tabs.overview');
  const setTab = (t) => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };
  const studentId = params.get('student') || '';
  const setStudentId = (s) => { const p = new URLSearchParams(params); p.set('student', s); setParams(p, { replace: true }); };
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [download, setDownload] = useState(null);
  const load = useCallback(() => { dropCached(`/institution/engagements/${id}`); return reload(); }, [id, reload]);
  useEffect(() => { api.get(`/institution/engagements/${id}/skill-requests`).then(r => setRequests(r.data)).catch(() => {}); }, [id]);
  useEffect(() => {
    if (loadError) setError(loadError.response?.status === 404 ? t('inst.cohort.thisCohortDoesnT') : t('inst.cohort.couldnTLoadThe'));
  }, [loadError]);

  const rotate = async () => {
    if (!window.confirm(t('inst.cohort.createNewJoinCode'))) return;
    try { await api.post(`/institution/engagements/${id}/join-code`); load(); } catch (e) { setError(errMsg(e, t('inst.cohort.couldnTChangeCode'))); }
  };

  if (error) return <div className="ln-error">{error}</div>;
  if (!c) return <p className="ln-muted">{t('inst.cohort.loading')}</p>;
  const st = COHORT_STATUS[c.status] || COHORT_STATUS.setup;
  const loginUrl = `${window.location.origin}/learner-login`;

  return (
    <>
      <Crumbs items={[{ label: 'Cohorts', to: '/institution/cohorts' }, { label: c.title }]} />
      <header className="ln-pagehead" style={{ alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 6, minWidth: 0 }}>
          <div className="ln-row ln-wrap" style={{ gap: 12 }}><h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{c.title}</h1><span className={`ln-tag ln-tag-lg ${st[1]}`}>{t(st[0])}</span></div>
          <span className="ln-small ln-muted">
            {t('inst.cohort.targetCtTitleV', { ct_title: c.ct_title, ct_version: c.ct_version, total_nodes: c.total_nodes, date: date(c.started_at) })}
            {c.professors.length > 0 && ` · ${t('inst.cohort.professorsList', { list: c.professors.map(p => [p.title, p.name].filter(Boolean).join(' ') + (p.cohort_role === 'lead' ? ' ' + t('inst.cohort.lead') : '')).join(', ') })}`}
          </span>
        </div>
        <div className="ln-card" style={{ padding: '14px 16px', gap: 6, borderRadius: 'var(--radius-lg)', minWidth: 260 }}>
          <span className="ln-kicker">{t('inst.cohort.studentJoinCode')}</span>
          <div className="ln-row" style={{ gap: 10 }}>
            <b className="in-code" style={{ fontSize: 'var(--fs-h2)' }}>{c.join_code}</b>
            {role !== 'viewer' && <button type="button" className="ln-btn ln-btn-sm" onClick={rotate} title={t('inst.cohort.newJoinCode')}><RefreshCw size={14} aria-hidden="true" />{t('inst.cohort.newCode')}</button>}
          </div>
          <span className="ln-xs ln-muted">{t('inst.cohort.studentsSignAtLoginurl', { loginUrl })}</span>
        </div>
      </header>

      {params.get('created') && (
        <div className="ln-card ln-card-warm" style={{ gap: 10 }}>
          <b>{t('inst.cohort.cohortCreated')}</b>
          <span className="ln-small">{t('inst.cohort.nextGiveStudentsAccess')}{' '} <b className="in-code">{c.join_code}</b>.</span>
          <Link to={`/institution/students/add?cohort=${c.id}`} className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}><Plus size={16} aria-hidden="true" />{t('inst.cohort.addStudents')}</Link>
        </div>
      )}

      <div className="ln-tabs" role="tablist">
        {TABS.filter(tb => tb !== 'Settings' || role === 'admin').map(tb => <button key={tb} type="button" role="tab" className="ln-tab" aria-selected={tab === tb} onClick={() => setTab(tb)}>{t(TAB_KEY[tb])}</button>)}
      </div>

      {tab === 'Overview' && <Overview c={c} requests={requests} />}
      {tab === 'Readiness' && <CohortGrid c={c} canBridge={role !== 'viewer'} />}
      {tab === 'Students' && (
        <section className="ln-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ln-between ln-wrap" style={{ padding: '16px 18px 0' }}>
            <h2 className="ln-h2">{t('inst.cohort.lengthStudents', { length: c.learners.length })}</h2>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <Link to={`/institution/cohorts/${c.id}/live`} className="ln-btn ln-btn-sm"><Radio size={14} aria-hidden="true" />{t('inst.cohort.live')}</Link>
              <button type="button" className="ln-btn ln-btn-sm" onClick={() => setDownload([])}><Download size={14} aria-hidden="true" />{t('inst.cohort.downloadData')}</button>
              <Link to={`/institution/students?engagement_id=${c.id}`} className="ln-btn ln-btn-sm">{t('inst.cohort.manageAccess')}</Link>
              {role !== 'viewer' && <Link to={`/institution/students/add?cohort=${c.id}`} className="ln-btn ln-btn-sm ln-btn-primary"><Plus size={14} aria-hidden="true" />{t('inst.cohort.addStudents')}</Link>}
            </div>
          </div>
          <div className="ln-tablewrap"><table className="ln-table" style={{ margin: '0 18px', width: 'calc(100% - 36px)' }}>
            <thead><tr><th>{t('inst.cohort.student')}</th><th>{t('inst.cohort.language')}</th><th>{t('inst.cohort.currentNode')}</th><th>{t('inst.cohort.mastered2')}</th><th>{t('inst.cohort.access')}</th><th /></tr></thead>
            <tbody>{c.learners.map(l => (
              <tr key={l.el_id}><td><b style={{ fontWeight: 600 }}>{l.name}</b> <span className="ln-xs ln-muted">{l.learner_ref}</span></td>
                <td className="ln-small ln-indic">{l.language === 'hindi' ? 'हिंदी' : 'తెలుగు'}</td>
                <td className="ln-small">{l.overall_status === 'completed' ? t('inst.cohort.completed') : l.current_node_label || '—'}</td>
                <td>{l.nodes_mastered} / {c.total_nodes}</td><td><AccessTag state={l.access} /></td>
                <td><div className="ln-row" style={{ gap: 6 }}>
                  <button type="button" className="ln-btn ln-btn-sm" onClick={() => { const p = new URLSearchParams(params); p.set('tab', 'Pathway'); p.set('student', l.el_id); setParams(p); }}>{t('inst.cohort.pathway')}</button>
                  <button type="button" className="ln-btn ln-btn-sm" onClick={() => setDownload([l.el_id])} aria-label={t('inst.cohort.downloadDataName', { name: l.name })}><Download size={14} aria-hidden="true" /></button>
                </div></td></tr>
            ))}</tbody></table></div>
          <CopyLinkHint code={c.join_code} url={loginUrl} />
        </section>
      )}
      {tab === 'Pathway' && <Pathway c={c} studentId={studentId} setStudentId={setStudentId} />}
      {tab === 'Mastery logs' && <Logs c={c} canProduce={role !== 'viewer'} />}
      {tab === 'Settings' && role === 'admin' && <Settings c={c} onChanged={load} />}
      {download && <DownloadDialog cohort={c} students={c.learners.filter(l => l.access !== 'removed')} initial={download} onClose={() => setDownload(null)} />}
    </>
  );
}

function CopyLinkHint({ code, url }) {
  const { t } = useUiLang();
  return (
    <div className="ln-col" style={{ gap: 6, padding: '8px 18px 18px' }}>
      <span className="ln-xs ln-muted">{t('inst.cohort.signPageStudentsThey', { code })}</span>
      <CopyLink url={url} />
    </div>
  );
}
