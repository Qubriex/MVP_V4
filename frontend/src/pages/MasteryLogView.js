// src/pages/MasteryLogView.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { MOCK_MASTERY_LOG } from '../utils/mockData';
import NavBar from '../components/NavBar';
import Reveal from '../components/Reveal';

export default function MasteryLogView() {
  const { logId } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get from admin route. dev fallback — an unreachable backend can
    // resolve with a 200 HTML page (SPA host rewrite) instead of erroring,
    // so validate the shape too.
    api.get(`/admin/mastery-logs/${logId}`).then(r => {
      if (!r.data || !r.data.log_data || !Array.isArray(r.data.log_data.clusters)) throw new Error('unexpected response shape');
      setLog(r.data.log_data);
      setLoading(false);
    }).catch(() => { setLog(MOCK_MASTERY_LOG); setLoading(false); });
  }, [logId]);

  if (loading || !log) {
    return (
      <>
        <NavBar />
        <main className="container" style={{ padding: 'var(--space-16) var(--gutter)', flex: 1 }}>
          <p className={loading ? 'text-muted' : ''} style={!loading ? { color: 'var(--status-danger)' } : undefined}>
            {loading ? 'Loading…' : 'Log not found'}
          </p>
        </main>
      </>
    );
  }

  const clustersCompleted = (log.clusters || []).filter(c => c.nodes.length > 0 && c.nodes.every(n => n.advanced)).length;
  const overallCompletion = log.clusters?.length ? Math.round((clustersCompleted / log.clusters.length) * 100) : 0;

  return (
    <>
      <NavBar />
      <main className="container" style={{ padding: 'var(--space-12) var(--gutter) var(--space-20)', flex: 1, width: '100%' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="small accent-text" style={{ cursor: 'pointer', marginBottom: 'var(--space-6)', fontWeight: 600 }} onClick={() => navigate(-1)}>← Back</div>

          {/* Header — the one place a full accent-gradient wash is used, since this is the evidence document itself */}
          <Reveal
            className="row"
            style={{
              justifyContent: 'space-between', alignItems: 'flex-start',
              background: 'var(--gradient-accent-wash)', border: '1px solid var(--accent-200)',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-6) var(--space-8)', marginBottom: 'var(--space-3)'
            }}
          >
            <div>
              <div className="caption accent-text" style={{ marginBottom: 'var(--space-1)' }}>QUBIREX MASTERY LOG</div>
              <h1 style={{ marginBottom: 'var(--space-1)' }}>{log.learner_name}</h1>
              <div className="small text-muted">
                {log.capability_target_reference} ·{' '}
                {log.language_of_instruction === 'hindi' ? 'हिंदी' : 'తెలుగు'} ·{' '}
                Produced {new Date(log.produced_at).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4) var(--space-6)', boxShadow: 'none' }}>
              <div style={{ color: 'var(--status-success)', fontSize: '2.25rem', fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-display)' }}>{overallCompletion}%</div>
              <div className="small text-faint" style={{ marginTop: 'var(--space-1)' }}>Programme Complete</div>
            </div>
          </Reveal>

          <div className="small text-muted" style={{ marginBottom: 'var(--space-1)' }}>Engagement: {log.engagement_title}</div>
          <div className="small" style={{ marginBottom: 'var(--space-10)' }}>
            <span className="text-muted" style={{ fontWeight: 600 }}>Learner Ref:</span> {log.learner_reference}
          </div>

          {log.clusters?.map((cluster, ci) => (
            <Reveal key={ci} delay={ci * 70} className="card" style={{ marginBottom: 'var(--space-5)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h3>{cluster.cluster}</h3>
                  {cluster.cluster_ref && <div className="small text-faint">Ref: {cluster.cluster_ref}</div>}
                </div>
                <div className="row gap-6">
                  <MetaItem label="Nodes Mastered" val={`${cluster.nodes.filter(n => n.advanced).length}/${cluster.nodes.length}`} />
                  <MetaItem label="Avg Mastery" val={`${cluster.cluster_mastery_average ?? '—'}%`} />
                  <MetaItem label="Sim. Readiness" val={cluster.simulation_readiness_flag ? 'Ready' : 'Not Yet'} color={cluster.simulation_readiness_flag ? 'var(--status-success)' : 'var(--status-warning)'} />
                </div>
              </div>

              {/* BLANK FIELDS — intentionally present */}
              <div className="row gap-3" style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ flex: 1, background: 'var(--color-bg-alt)', border: '1px dashed var(--color-border-strong)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)' }}>
                  <div className="caption" style={{ marginBottom: 2 }}>Readiness Classification</div>
                  <div className="small text-faint" style={{ fontStyle: 'italic' }}>— [OWNED BY INSTITUTION]</div>
                </div>
                <div style={{ flex: 1, background: 'var(--color-bg-alt)', border: '1px dashed var(--color-border-strong)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)' }}>
                  <div className="caption" style={{ marginBottom: 2 }}>External Score</div>
                  <div className="small text-faint" style={{ fontStyle: 'italic' }}>— [OWNED BY ASSESSMENT PLATFORM]</div>
                </div>
              </div>

              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr><th>Skill Node</th><th>Mastery</th><th>Time (min)</th><th>Attempts</th><th>Confidence</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {cluster.nodes?.map((node, ni) => (
                      <tr key={ni}>
                        <td>{node.skill_node}</td>
                        <td>
                          <div className="row gap-2">
                            <div style={{ width: 50, height: 6, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${node.mastery_attainment ?? 0}%`, background: 'var(--gradient-accent-vivid)', borderRadius: 'var(--radius-full)' }} />
                            </div>
                            <span>{node.mastery_attainment ?? '—'}%</span>
                          </div>
                        </td>
                        <td>{node.time_to_mastery_minutes ?? '—'}</td>
                        <td>{node.attempt_count}</td>
                        <td style={{ textTransform: 'capitalize' }}>{node.confidence_indicator}</td>
                        <td>
                          <span className={`badge ${node.advanced ? 'badge-success' : 'badge-warning'}`}>{node.advanced ? 'mastered' : 'in progress'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          ))}

          <Reveal className="small text-faint" style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4) var(--space-5)', lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
            {log.qubirex_note}
          </Reveal>
          <div className="small text-faint" style={{ textAlign: 'center', paddingBottom: 'var(--space-10)' }}>
            Produced by Qubirex · Inferexaa Private Limited · Receive. Build. Return.
          </div>
        </div>
      </main>
    </>
  );
}

function MetaItem({ label, val, color }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div className="caption" style={{ marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-h4)', fontWeight: 700, color: color || 'var(--color-text)' }}>{val}</div>
    </div>
  );
}
