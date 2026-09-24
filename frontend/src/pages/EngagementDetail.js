// src/pages/EngagementDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { MOCK_ENGAGEMENT_DETAIL, MOCK_MASTERY_LOGS } from '../utils/mockData';
import NavBar from '../components/NavBar';
import Reveal from '../components/Reveal';

const STATUS_BADGE = { active: 'badge-success', completed: 'badge-info', in_progress: 'badge-warning', paused: 'badge-neutral' };

export default function EngagementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [producing, setProducing] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // dev fallback — an unreachable backend can resolve with a 200 HTML page
    // (SPA host rewrite) instead of erroring, so validate the shape too
    api.get(`/institution/engagements/${id}`)
      .then(r => {
        if (!r.data || typeof r.data !== 'object' || !r.data.id) throw new Error('unexpected response shape');
        setData(r.data); setLoading(false);
      })
      .catch(() => { setData({ ...MOCK_ENGAGEMENT_DETAIL, id }); setLoading(false); });
    api.get(`/institution/engagements/${id}/mastery-logs`)
      .then(r => { if (!Array.isArray(r.data)) throw new Error('unexpected response shape'); setLogs(r.data); })
      .catch(() => setLogs(MOCK_MASTERY_LOGS));
  }, [id]);

  const produceLogs = async () => {
    setProducing(true);
    try {
      await api.post(`/institution/engagements/${id}/produce-mastery-logs`);
      const res = await api.get(`/institution/engagements/${id}/mastery-logs`);
      if (!Array.isArray(res.data)) throw new Error('unexpected response shape');
      setLogs(res.data);
    } catch {
      setLogs(MOCK_MASTERY_LOGS); // dev fallback — no backend reachable
    }
    setProducing(false);
  };

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="container" style={{ padding: 'var(--space-16) var(--gutter)', flex: 1 }}>
          <p className="text-muted">Loading…</p>
        </main>
      </>
    );
  }

  const completedCount = data.learners?.filter(l => l.overall_status === 'completed').length || 0;

  return (
    <>
      <NavBar />
      <main className="container" style={{ padding: 'var(--space-12) var(--gutter) var(--space-20)', flex: 1, width: '100%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="small accent-text" style={{ cursor: 'pointer', marginBottom: 'var(--space-6)', fontWeight: 600 }} onClick={() => navigate('/institution/dashboard')}>← Dashboard</div>

          <Reveal className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
            <div>
              <h1>{data.title}</h1>
              <p className="text-muted">{data.ct_title} · {data.language === 'hindi' ? 'हिंदी' : 'తెలుగు'}</p>
            </div>
            <span className={`badge ${STATUS_BADGE[data.status] || 'badge-neutral'}`}>{data.status}</span>
          </Reveal>

          <Reveal delay={60} className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 'var(--space-6)' }}>
            <StatBox val={data.learners?.length || 0} label="Total Learners" />
            <StatBox val={completedCount} label="Completed" accent />
            <StatBox val={`${data.learners?.length ? Math.round(completedCount / data.learners.length * 100) : 0}%`} label="Completion Rate" />
            <StatBox val={logs.length} label="Mastery Logs Produced" accent />
          </Reveal>

          <Reveal delay={100} className="badge-accent" style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-10)' }}>
            <div className="small" style={{ fontWeight: 400, marginBottom: 'var(--space-1)' }}>Engagement ID (share with learners for login)</div>
            <div style={{ fontFamily: 'monospace', fontSize: 'var(--text-body-lg)', fontWeight: 700 }}>{data.id}</div>
          </Reveal>

          <h2 style={{ marginBottom: 'var(--space-4)' }}>Learner Progress</h2>
          <div className="table-wrap" style={{ marginBottom: 'var(--space-10)', overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Learner</th><th>Ref</th><th>Current Node</th><th>Nodes Mastered</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.learners?.map((l, i) => (
                  <tr key={i}>
                    <td>{l.name}</td>
                    <td className="text-faint" style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.learner_ref}</td>
                    <td className="accent-text">{l.current_node_label || '—'}</td>
                    <td>{l.nodes_mastered}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[l.overall_status] || 'badge-neutral'}`}>{l.overall_status?.replace('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 'var(--space-10)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0 }}>Mastery Logs</h2>
              <button className="btn btn-primary btn-sm" onClick={produceLogs} disabled={producing}>
                {producing ? 'Producing…' : 'Produce Mastery Logs'}
              </button>
            </div>
            {logs.length === 0 ? (
              <div className="card" style={{ border: '1px dashed var(--color-border-strong)', textAlign: 'center', boxShadow: 'none' }}>
                <p className="text-muted" style={{ margin: 0 }}>No Mastery Logs produced yet. Complete the instruction cycle, then produce logs.</p>
              </div>
            ) : (
              <div className="stack gap-2">
                {logs.map((log, i) => (
                  <Reveal key={log.id} delay={i * 60} as="div" className="card card-hover card-interactive" onClick={() => navigate(`/institution/mastery-log/${log.id}`)}>
                    <div style={{ fontWeight: 600 }}>{log.learner_name}</div>
                    <div className="small text-faint">{log.learner_ref}</div>
                    <div className="small" style={{ color: 'var(--status-success)', marginTop: 'var(--space-1)' }}>
                      {log.log_data?.overall_completion || 0}% complete · View Log →
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function StatBox({ val, label, accent }) {
  return (
    <div className="card" style={{ padding: 'var(--space-5) var(--space-6)' }}>
      <div style={{ fontSize: 'var(--text-h2)', fontWeight: 800, marginBottom: 'var(--space-1)', color: accent ? 'var(--accent-ink)' : 'var(--color-text)' }}>{val}</div>
      <div className="small text-muted">{label}</div>
    </div>
  );
}
