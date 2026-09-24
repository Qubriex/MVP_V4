// src/pages/LearnerDashboard.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { MOCK_LEARNER_DASHBOARD, MOCK_MASTERY_RECORD } from '../utils/mockData';
import NavBar from '../components/NavBar';
import Reveal from '../components/Reveal';

export default function LearnerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [mastery, setMastery] = useState([]);

  useEffect(() => {
    // dev fallback — an unreachable backend can resolve with a 200 HTML page
    // (SPA host rewrite) instead of erroring, so validate the shape too
    api.get('/learner/dashboard')
      .then(r => { if (!r.data || typeof r.data.progress_pct === 'undefined') throw new Error('unexpected response shape'); setData(r.data); })
      .catch(() => setData(MOCK_LEARNER_DASHBOARD));
    api.get('/learner/mastery-record')
      .then(r => { if (!Array.isArray(r.data)) throw new Error('unexpected response shape'); setMastery(r.data); })
      .catch(() => setMastery(MOCK_MASTERY_RECORD));
  }, []);

  const langName = { hindi: 'हिंदी', telugu: 'తెలుగు' };

  return (
    <>
      <NavBar
        right={
          <>
            <span className="badge badge-accent">{langName[user?.language] || user?.language}</span>
            <span className="small text-muted">{user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </>
        }
      />

      <main className="container" style={{ padding: 'var(--space-12) var(--gutter) var(--space-20)', flex: 1, width: '100%' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Reveal><h1>{user?.language === 'hindi' ? 'नमस्ते' : 'నమస్కారం'}, {user?.name}</h1></Reveal>

          {data && (
            <>
              <Reveal delay={40}><p className="text-muted" style={{ marginBottom: 'var(--space-8)' }}>{data.engagement_title}</p></Reveal>

              <Reveal delay={80} className="card" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontWeight: 700 }}>Overall Progress</span>
                  <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--status-success)' }}>{data.progress_pct}%</span>
                </div>
                <div style={{ height: 10, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                  <div style={{ height: '100%', width: `${data.progress_pct}%`, background: 'var(--gradient-accent-vivid)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
                </div>
                <div className="small text-muted">{data.nodes_mastered} of {data.total_nodes} skill nodes mastered</div>
              </Reveal>

              {data.current_node_label && (
                <Reveal delay={140} className="card" style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--accent-300)', background: 'var(--gradient-accent-wash)' }}>
                  <div className="caption" style={{ marginBottom: 'var(--space-1)' }}>Current Skill</div>
                  <div style={{ fontSize: 'var(--text-h4)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>{data.current_node_label}</div>
                  {data.current_cluster_label && <div className="small accent-text">Cluster: {data.current_cluster_label}</div>}
                  <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => navigate('/learn/session')}>
                    {user?.language === 'hindi' ? 'पढ़ाई शुरू करें →' : 'చదువు మొదలుపెట్టండి →'}
                  </button>
                </Reveal>
              )}

              {data.overall_status === 'completed' && (
                <Reveal delay={140} className="card" style={{ textAlign: 'center', padding: 'var(--space-10)', marginBottom: 'var(--space-8)' }}>
                  <div style={{ fontSize: 48, marginBottom: 'var(--space-2)' }}>🎓</div>
                  <div style={{ color: 'var(--status-success)', fontSize: 'var(--text-h2)', fontWeight: 800 }}>
                    {user?.language === 'hindi' ? 'बधाई हो!' : 'అభినందనలు!'}
                  </div>
                  <div className="text-muted" style={{ marginTop: 'var(--space-2)' }}>
                    You have completed all skill nodes. Your Mastery Log is ready.
                  </div>
                </Reveal>
              )}
            </>
          )}

          {mastery.length > 0 && (
            <>
              <h2 style={{ margin: 'var(--space-10) 0 var(--space-4)' }}>Skills I've Mastered</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {mastery.map((m, i) => (
                  <Reveal key={i} delay={i * 60} as="div" className="card">
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-small)', marginBottom: 'var(--space-1)' }}>{m.node_label}</div>
                    <div className="small text-faint" style={{ marginBottom: 'var(--space-3)' }}>{m.cluster_label}</div>
                    <div className="row gap-4">
                      <span className="small"><strong style={{ color: 'var(--status-success)' }}>{Math.round((m.mastery_attainment || 0) * 100)}%</strong> <span className="text-faint">mastery</span></span>
                      <span className="small"><strong>{m.attempt_count}</strong> <span className="text-faint">attempts</span></span>
                      <span className="small" style={{ color: 'var(--status-success)' }}>✓ mastered</span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
