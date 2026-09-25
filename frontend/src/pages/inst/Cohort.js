// src/pages/inst/Cohort.js — /institution/cohorts/:id
// Cohort detail: join code, KPIs, where students are in the pathway, the
// hardest nodes (counts and loops only — conversations stay private), the
// students, the pathway, mastery logs (produce, view, export) and settings.
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Download, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import { Bar } from '../../components/learn/ui';
import { useStaff } from '../../components/inst/InstitutionLayout';
import CopyLink from '../../components/inst/CopyLink';
import { AccessTag } from './Students';
import { COHORT_STATUS } from './Cohorts';

const TABS = ['Overview', 'Students', 'Pathway', 'Mastery logs', 'Settings'];
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
                  <td><Link className="ln-btn ln-btn-sm" to={`/institution/students?engagement_id=${c.id}&node_id=${h.node_id}`}>See students</Link></td></tr>
              ))}</tbody></table>
          )}
          <span className="ln-xs ln-muted">Only counts and loops are shown. Session conversations stay private to each student.</span>
        </section>
      </div>
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

function Pathway({ c }) {
  return (
    <div className="ln-col" style={{ gap: 14 }}>
      {c.clusters.map((cl, i) => (
        <section key={cl.id} className="ln-card" style={{ gap: 10 }}>
          <div className="ln-between"><h2 className="ln-h2">{i + 1}. {cl.label}</h2><span className="ln-small ln-muted">{cl.nodes.length} nodes · {Math.round(cl.nodes.reduce((a, n) => a + (n.estimated_minutes || 20), 0) / 6) / 10} h</span></div>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            {cl.nodes.map(n => <span key={n.id} className="ln-chip" title={`${n.mastered_by} of ${c.kpis.students} mastered`}>{n.node_label}<span className="ln-xs ln-muted">· {n.mastered_by}/{c.kpis.students}</span></span>)}
          </div>
        </section>
      ))}
      <span className="ln-xs ln-muted">The numbers after each node are students who have mastered it. The pathway is built in {c.language === 'hindi' ? 'Hindi' : 'Telugu'}.</span>
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
    try { const r = await api.post(`/institution/engagements/${c.id}/produce-mastery-logs`, { complete }); setMsg(r.data.message); load(); } catch (e) { setMsg(e.response?.data?.error || 'Couldn’t produce logs.'); }
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
    } catch (e) { setMsg(e.response?.data?.error || 'Couldn’t save.'); }
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
  const [params] = useSearchParams();
  const { role } = useStaff();
  const [c, setC] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => api.get(`/institution/engagements/${id}`).then(r => setC(r.data)).catch(e => setError(e.response?.status === 404 ? 'This cohort doesn’t exist or isn’t assigned to you.' : 'Couldn’t load the cohort.')), [id]);
  useEffect(() => { load(); api.get(`/institution/engagements/${id}/skill-requests`).then(r => setRequests(r.data)).catch(() => {}); }, [id, load]);

  const rotate = async () => {
    if (!window.confirm('Create a new join code? The current one stops working for new sign-ins.')) return;
    try { await api.post(`/institution/engagements/${id}/join-code`); load(); } catch (e) { setError(e.response?.data?.error || 'Couldn’t change the code.'); }
  };

  if (error) return <div className="ln-error">{error}</div>;
  if (!c) return <p className="ln-muted">Loading…</p>;
  const st = COHORT_STATUS[c.status] || COHORT_STATUS.setup;
  const loginUrl = `${window.location.origin}/learner-login`;

  return (
    <>
      <header className="ln-pagehead" style={{ alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 6, minWidth: 0 }}>
          <Link to="/institution/cohorts" className="ln-link" style={{ fontSize: 13 }}>← Cohorts</Link>
          <div className="ln-row ln-wrap" style={{ gap: 12 }}><h1 className="ln-title" style={{ fontSize: 34 }}>{c.title}</h1><span className={`ln-tag ln-tag-lg ${st[1]}`}>{st[0]}</span></div>
          <span className="ln-small ln-muted">
            Target: {c.ct_title} v{c.ct_version} · {c.language === 'hindi' ? 'Hindi' : 'Telugu'} · {c.total_nodes} skill nodes · Started {date(c.started_at)}
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
      {tab === 'Students' && (
        <section className="ln-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ln-between ln-wrap" style={{ padding: '16px 18px 0' }}>
            <h2 className="ln-h2">{c.learners.length} students</h2>
            <div className="ln-row" style={{ gap: 8 }}>
              <Link to={`/institution/students?engagement_id=${c.id}`} className="ln-btn ln-btn-sm">Manage access</Link>
              {role !== 'viewer' && <Link to={`/institution/students/add?cohort=${c.id}`} className="ln-btn ln-btn-sm ln-btn-primary"><Plus size={14} aria-hidden="true" />Add students</Link>}
            </div>
          </div>
          <div className="ln-tablewrap"><table className="ln-table" style={{ margin: '0 18px', width: 'calc(100% - 36px)' }}>
            <thead><tr><th>Student</th><th>Current node</th><th>Mastered</th><th>Access</th></tr></thead>
            <tbody>{c.learners.map(l => (
              <tr key={l.el_id}><td><b style={{ fontWeight: 600 }}>{l.name}</b> <span className="ln-xs ln-muted">{l.learner_ref}</span></td>
                <td className="ln-small">{l.overall_status === 'completed' ? 'Completed' : l.current_node_label || '—'}</td>
                <td>{l.nodes_mastered} / {c.total_nodes}</td><td><AccessTag state={l.access} /></td></tr>
            ))}</tbody></table></div>
          <CopyLinkHint code={c.join_code} url={loginUrl} />
        </section>
      )}
      {tab === 'Pathway' && <Pathway c={c} />}
      {tab === 'Mastery logs' && <Logs c={c} canProduce={role !== 'viewer'} />}
      {tab === 'Settings' && role === 'admin' && <Settings c={c} onChanged={load} />}
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
