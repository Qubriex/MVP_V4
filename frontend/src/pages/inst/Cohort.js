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

const TABS = ['Overview', 'Readiness', 'Students', 'Pathway', 'Mastery logs', 'Settings'];
const date = (t) => (t ? new Date(t.replace(' ', 'T') + (/[Z+]/.test(t) ? '' : 'Z')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Overview({ c, requests }) {
  const max = Math.max(1, ...c.clusters.map(x => x.students_here));
  return (
    <>
      <div className="ln-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[['Students', c.kpis.students], ['Signed in', c.kpis.signed_in], ['Avg progress', `${c.kpis.avg_progress}%`],
          ['Avg mastery', c.kpis.avg_mastery != null ? `${c.kpis.avg_mastery}%` : '—'], ['Active min / student / week', c.kpis.active_minutes_per_student_week]].map(([k, v]) => (
          <div key={k} className="ln-card ln-card-sm"><span className="ln-small ln-muted">{k}</span><span className="ln-stat">{v}</span></div>
        ))}
      </div>
      <div className="ln-grid ln-g-2">
        <section className="ln-card">
          <h2 className="ln-h2">Where students are now</h2>
          {c.clusters.map(cl => (
            <div key={cl.id} className="ln-row" style={{ gap: 12 }}>
              <span className="ln-small" style={{ width: 170, flexShrink: 0 }}>{cl.label}</span>
              <div style={{ flex: 1 }}><Bar pct={(cl.students_here / max) * 100} label={`${cl.students_here} students in ${cl.label}`} /></div>
              <span className="ln-small" style={{ width: 90, textAlign: 'right' }}><b>{cl.students_here}</b> students</span>
            </div>
          ))}
          <span className="ln-xs ln-muted">Students currently working inside each cluster. {c.kpis.finished_a_cluster} have finished at least one cluster.</span>
        </section>
        <section className="ln-card">
          <h2 className="ln-h2">Hardest nodes</h2>
          {c.hardest.length === 0 ? <span className="ln-small ln-muted">No loops recorded yet.</span> : (
            <table className="ln-table"><thead><tr><th>Node</th><th>Avg loops</th><th>Stuck now</th><th /></tr></thead>
              <tbody>{c.hardest.map(h => (
                <tr key={h.node_id}><td style={{ fontWeight: 600 }}>{h.node_label}</td><td>{h.avg_loops}</td><td>{h.stuck}</td>
                  <td><Link className="ln-btn ln-btn-sm" to={`/institution/students?engagement_id=${c.id}&node_id=${h.node_id}&node_label=${encodeURIComponent(h.node_label)}`}>See students</Link></td></tr>
              ))}</tbody></table>
          )}
          <span className="ln-xs ln-muted">Only counts and loops are shown. Session conversations stay private to each student.</span>
        </section>
      </div>
      <ActivityYear cohortId={c.id} />
      {requests.length > 0 && (
        <section className="ln-card">
          <h2 className="ln-h2">Skills students asked you to add</h2>
          <span className="ln-small ln-muted">Requested from the job market and emerging topics pages. Your institution decides the pathway.</span>
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
  const [view, setView] = useState('student');
  const students = c.learners.filter(l => l.access !== 'removed');
  const sel = studentId || students[0]?.el_id || '';
  const { data: p, error } = useCachedGet(view === 'student' && sel ? `/institution/engagements/${c.id}/students/${sel}/pathway` : null);
  return (
    <div className="ln-col" style={{ gap: 14 }}>
      <div className="ln-row ln-wrap" style={{ gap: 12 }}>
        <div className="ln-pilltabs" role="tablist" aria-label="Pathway view">
          <button type="button" role="tab" className="ln-pilltab" aria-selected={view === 'student'} onClick={() => setView('student')}>Each student</button>
          <button type="button" role="tab" className="ln-pilltab" aria-selected={view === 'cohort'} onClick={() => setView('cohort')}>Cohort overview</button>
        </div>
        {view === 'student' && students.length > 0 && (
          <label className="ln-selectwrap"><span>Student</span>
            <select value={sel} onChange={e => setStudentId(e.target.value)}>{students.map(l => <option key={l.el_id} value={l.el_id}>{l.name} · {l.learner_ref}</option>)}</select>
          </label>
        )}
      </div>
      {view === 'student' ? (
        students.length === 0 ? <div className="ln-card ln-muted">No students in this cohort yet.</div>
          : error ? <div className="ln-error">Couldn’t load this student’s pathway.</div>
            : !p ? <p className="ln-muted">Loading…</p> : (
              <>
                <div className="ln-card ln-card-sm" style={{ gap: 6 }}>
                  <div className="ln-between ln-wrap"><b>{p.student.name}</b><span className="ln-small">{p.mastered} of {p.total} skills mastered · <b>{p.pct}%</b></span></div>
                  <Bar pct={p.pct} label={`${p.pct}% of the pathway mastered`} />
                </div>
                {p.clusters.map((cl, i) => (
                  <section key={cl.id} className="ln-card" style={{ gap: 10 }}>
                    <div className="ln-between"><h2 className="ln-h2">{i + 1}. {cl.label}</h2><span className="ln-small"><b>{cl.pct}%</b> <span className="ln-muted">mastered</span></span></div>
                    <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                      {cl.nodes.map(n => (
                        <span key={n.id} className={`in-node is-${n.status}`} title={n.mastered_at ? `Mastered ${date(n.mastered_at)}` : n.status === 'learning' ? 'Learning now' : 'Not started'}>
                          {n.status === 'mastered' ? '✓' : n.status === 'learning' ? '◐' : '○'} {n.label}
                          <span className="ln-xs ln-muted">· {n.status === 'mastered' ? `100% · ${date(n.mastered_at)}` : n.status === 'learning' ? `0% · learning now${n.loops ? ` · ${n.loops} loops` : ''}` : '0%'}</span>
                        </span>
                      ))}
                    </div>
                  </section>
                ))}
                <span className="ln-xs ln-muted">Only skills this student has mastered count. Everything else shows 0% until they master it — no projected or cohort figures.</span>
              </>
            )
      ) : (
        <>
          {c.clusters.map((cl, i) => (
            <section key={cl.id} className="ln-card" style={{ gap: 10 }}>
              <div className="ln-between"><h2 className="ln-h2">{i + 1}. {cl.label}</h2><span className="ln-small ln-muted">{cl.nodes.length} nodes · {Math.round(cl.nodes.reduce((a, n) => a + (n.estimated_minutes || 20), 0) / 6) / 10} h</span></div>
              <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                {cl.nodes.map(n => <span key={n.id} className="ln-chip" title={`${n.mastered_by} of ${c.kpis.students} mastered`}>{n.node_label}<span className="ln-xs ln-muted">· {n.mastered_by}/{c.kpis.students} · {n.mastered_pct ?? 0}%</span></span>)}
              </div>
            </section>
          ))}
          <span className="ln-xs ln-muted">Cohort overview: after each skill, how many current students have mastered it, and the share of the cohort. For one student’s progress, use “Each student”.</span>
        </>
      )}
    </div>
  );
}

function Logs({ c, canProduce }) {
  const [logs, setLogs] = useState(null);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.get(`/institution/engagements/${c.id}/mastery-logs`).then(r => setLogs(r.data)).catch(() => setLogs([])), [c.id]);
  useEffect(() => { load(); }, [load]);
  const produce = async (complete) => {
    if (complete && !window.confirm('Produce final logs and mark this cohort completed?')) return;
    try { const r = await api.post(`/institution/engagements/${c.id}/produce-mastery-logs`, { complete }); setMsg(r.data.message); load(); } catch (e) { setMsg(errMsg(e, 'Couldn’t produce logs.')); }
  };
  const sendAll = async () => {
    try { const r = await api.post(`/institution/engagements/${c.id}/mastery-logs/send`); setMsg(`Sent to ${r.data.sent} student${r.data.sent === 1 ? '' : 's'}. They see it in their notifications.`); } catch (e) { setMsg(errMsg(e, 'Couldn’t send.')); }
  };
  const exportCsv = async () => {
    const r = await api.get(`/institution/engagements/${c.id}/mastery-logs.csv`, { responseType: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(r.data); a.download = `mastery-logs-${c.join_code}.csv`; a.click();
  };
  return (
    <section className="ln-card">
      <div className="ln-between ln-wrap" style={{ alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 4 }}><h2 className="ln-h2">Mastery logs</h2>
          <span className="ln-small ln-muted" style={{ maxWidth: 560 }}>Produce them whenever you need a current record (producing again replaces each student’s log), or as final logs at the end. Readiness classification and external scores stay yours to fill in.</span></div>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <button type="button" className="ln-btn" onClick={exportCsv} disabled={!logs?.length}><Download size={16} aria-hidden="true" />Export all (CSV)</button>
          {canProduce && logs?.length > 0 && <button type="button" className="ln-btn" onClick={sendAll}>Send to students</button>}
          {canProduce && <button type="button" className="ln-btn" onClick={() => produce(false)}>Produce current logs</button>}
          {canProduce && c.status !== 'completed' && <button type="button" className="ln-btn ln-btn-primary" onClick={() => produce(true)}>Produce final logs</button>}
        </div>
      </div>
      {msg && <div className="ln-note" role="status">{msg}</div>}
      {logs && logs.length === 0 && <span className="ln-small ln-muted">No logs produced yet.</span>}
      <div className="ln-grid ln-g-3" style={{ gap: 10 }}>
        {(logs || []).map(l => (
          <Link key={l.id} to={`/institution/mastery-log/${l.id}`} className="ln-tile ln-card-link" style={{ padding: 14 }}>
            <b>{l.learner_name}</b><span className="ln-xs ln-muted">{l.clusters_complete.length ? l.clusters_complete.join(', ') : 'No cluster complete yet'} · {date(l.produced_at)}</span>
            <span className="ln-link" style={{ fontSize: 13 }}>View →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Settings({ c, onChanged }) {
  const [title, setTitle] = useState(c.title);
  const [status, setStatus] = useState(c.status);
  const [team, setTeam] = useState([]);
  const [profs, setProfs] = useState(Object.fromEntries(c.professors.map(p => [p.id, p.cohort_role])));
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/institution/team').then(r => setTeam(r.data.filter(m => m.role === 'professor' && m.status !== 'disabled'))).catch(() => {}); }, []);
  const save = async () => {
    try {
      await api.put(`/institution/engagements/${c.id}`, { title, status, professors: Object.entries(profs).map(([id, cohort_role]) => ({ id, cohort_role })) });
      setMsg('Saved.'); onChanged();
    } catch (e) { setMsg(errMsg(e, 'Couldn’t save.')); }
  };
  return (
    <section className="ln-card" style={{ maxWidth: 760 }}>
      <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="st-title">Cohort name</label><input id="st-title" className="ln-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="st-status">Status</label>
          <select id="st-status" className="ln-select" value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(COHORT_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
      </div>
      <div className="ln-col" style={{ gap: 8 }}><span className="ln-label">Professors</span>
        {team.map(m => (
          <div key={m.id} className="ln-row ln-wrap" style={{ gap: 12 }}>
            <label className="ln-check" style={{ flex: 1 }}><input type="checkbox" checked={!!profs[m.id]} onChange={e => setProfs(p => { const n = { ...p }; if (e.target.checked) n[m.id] = 'co'; else delete n[m.id]; return n; })} />{[m.title, m.name].filter(Boolean).join(' ') || m.email}</label>
            {profs[m.id] && <select className="ln-select" style={{ width: 170, minHeight: 36 }} aria-label="Role in this cohort" value={profs[m.id]} onChange={e => setProfs(p => ({ ...p, [m.id]: e.target.value }))}><option value="lead">Lead professor</option><option value="co">Co-professor</option></select>}
          </div>
        ))}
        {team.length === 0 && <span className="ln-small ln-muted">No professors yet — invite them from Team &amp; roles.</span>}
      </div>
      {msg && <span className="ln-small" role="status">{msg}</span>}
      <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={save}>Save settings</button>
    </section>
  );
}

export default function Cohort() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { role } = useStaff();
  const { data: c, error: loadError, reload } = useCachedGet(`/institution/engagements/${id}`);
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'Overview';
  const setTab = (t) => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };
  const studentId = params.get('student') || '';
  const setStudentId = (s) => { const p = new URLSearchParams(params); p.set('student', s); setParams(p, { replace: true }); };
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [download, setDownload] = useState(null);
  const load = useCallback(() => { dropCached(`/institution/engagements/${id}`); return reload(); }, [id, reload]);
  useEffect(() => { api.get(`/institution/engagements/${id}/skill-requests`).then(r => setRequests(r.data)).catch(() => {}); }, [id]);
  useEffect(() => {
    if (loadError) setError(loadError.response?.status === 404 ? 'This cohort doesn’t exist or isn’t assigned to you.' : 'Couldn’t load the cohort.');
  }, [loadError]);

  const rotate = async () => {
    if (!window.confirm('Create a new join code? The current one stops working for new sign-ins.')) return;
    try { await api.post(`/institution/engagements/${id}/join-code`); load(); } catch (e) { setError(errMsg(e, 'Couldn’t change the code.')); }
  };

  if (error) return <div className="ln-error">{error}</div>;
  if (!c) return <p className="ln-muted">Loading…</p>;
  const st = COHORT_STATUS[c.status] || COHORT_STATUS.setup;
  const loginUrl = `${window.location.origin}/learner-login`;

  return (
    <>
      <Crumbs items={[{ label: 'Cohorts', to: '/institution/cohorts' }, { label: c.title }]} />
      <header className="ln-pagehead" style={{ alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 6, minWidth: 0 }}>
          <div className="ln-row ln-wrap" style={{ gap: 12 }}><h1 className="ln-title" style={{ fontSize: 34 }}>{c.title}</h1><span className={`ln-tag ln-tag-lg ${st[1]}`}>{st[0]}</span></div>
          <span className="ln-small ln-muted">
            Target: {c.ct_title} v{c.ct_version} · {c.total_nodes} skill nodes · Started {date(c.started_at)}
            {c.professors.length > 0 && ` · Professors: ${c.professors.map(p => [p.title, p.name].filter(Boolean).join(' ') + (p.cohort_role === 'lead' ? ' (lead)' : '')).join(', ')}`}
          </span>
        </div>
        <div className="ln-card" style={{ padding: '14px 16px', gap: 6, borderRadius: 'var(--radius-lg)', minWidth: 260 }}>
          <span className="ln-kicker">Student join code</span>
          <div className="ln-row" style={{ gap: 10 }}>
            <b className="in-code" style={{ fontSize: 22 }}>{c.join_code}</b>
            {role !== 'viewer' && <button type="button" className="ln-btn ln-btn-sm" onClick={rotate} title="New join code"><RefreshCw size={14} aria-hidden="true" />New code</button>}
          </div>
          <span className="ln-xs ln-muted">Students sign in at {loginUrl} with their ref, this code and their PIN.</span>
        </div>
      </header>

      {params.get('created') && (
        <div className="ln-card ln-card-warm" style={{ gap: 10 }}>
          <b>Cohort created.</b>
          <span className="ln-small">Next, give students access — they’ll sign in with join code <b className="in-code">{c.join_code}</b>.</span>
          <Link to={`/institution/students/add?cohort=${c.id}`} className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}><Plus size={16} aria-hidden="true" />Add students</Link>
        </div>
      )}

      <div className="ln-tabs" role="tablist">
        {TABS.filter(t => t !== 'Settings' || role === 'admin').map(t => <button key={t} type="button" role="tab" className="ln-tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Overview' && <Overview c={c} requests={requests} />}
      {tab === 'Readiness' && <CohortGrid c={c} canBridge={role !== 'viewer'} />}
      {tab === 'Students' && (
        <section className="ln-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ln-between ln-wrap" style={{ padding: '16px 18px 0' }}>
            <h2 className="ln-h2">{c.learners.length} students</h2>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <Link to={`/institution/cohorts/${c.id}/live`} className="ln-btn ln-btn-sm"><Radio size={14} aria-hidden="true" />Live</Link>
              <button type="button" className="ln-btn ln-btn-sm" onClick={() => setDownload([])}><Download size={14} aria-hidden="true" />Download data</button>
              <Link to={`/institution/students?engagement_id=${c.id}`} className="ln-btn ln-btn-sm">Manage access</Link>
              {role !== 'viewer' && <Link to={`/institution/students/add?cohort=${c.id}`} className="ln-btn ln-btn-sm ln-btn-primary"><Plus size={14} aria-hidden="true" />Add students</Link>}
            </div>
          </div>
          <div className="ln-tablewrap"><table className="ln-table" style={{ margin: '0 18px', width: 'calc(100% - 36px)' }}>
            <thead><tr><th>Student</th><th>Language</th><th>Current node</th><th>Mastered</th><th>Access</th><th /></tr></thead>
            <tbody>{c.learners.map(l => (
              <tr key={l.el_id}><td><b style={{ fontWeight: 600 }}>{l.name}</b> <span className="ln-xs ln-muted">{l.learner_ref}</span></td>
                <td className="ln-small ln-indic">{l.language === 'hindi' ? 'हिंदी' : 'తెలుగు'}</td>
                <td className="ln-small">{l.overall_status === 'completed' ? 'Completed' : l.current_node_label || '—'}</td>
                <td>{l.nodes_mastered} / {c.total_nodes}</td><td><AccessTag state={l.access} /></td>
                <td><div className="ln-row" style={{ gap: 6 }}>
                  <button type="button" className="ln-btn ln-btn-sm" onClick={() => { const p = new URLSearchParams(params); p.set('tab', 'Pathway'); p.set('student', l.el_id); setParams(p); }}>Pathway</button>
                  <button type="button" className="ln-btn ln-btn-sm" onClick={() => setDownload([l.el_id])} aria-label={`Download data for ${l.name}`}><Download size={14} aria-hidden="true" /></button>
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
  return (
    <div className="ln-col" style={{ gap: 6, padding: '8px 18px 18px' }}>
      <span className="ln-xs ln-muted">Sign-in page for students (they also need join code {code} and their PIN):</span>
      <CopyLink url={url} />
    </div>
  );
}
