// src/pages/InstitutionDashboard.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { MOCK_ENGAGEMENTS } from '../utils/mockData';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

const STATUS_BADGE = { active: 'badge-success', completed: 'badge-info', setup: 'badge-warning', on_hold: 'badge-neutral' };

export default function InstitutionDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/institution/engagements')
      .then(r => {
        // dev fallback — an unreachable backend can resolve with a 200 HTML
        // page (SPA host rewrite) instead of erroring, so validate the shape too
        if (!Array.isArray(r.data)) throw new Error('unexpected response shape');
        setEngagements(r.data); setLoading(false);
      })
      .catch(() => { setEngagements(MOCK_ENGAGEMENTS); setLoading(false); });
  }, []);

  return (
    <>
      <NavBar
        right={
          <>
            <span className="small text-muted">{user?.name}</span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/institution/upload-target')}>+ New Engagement</button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </>
        }
      />

      <main className="container" style={{ padding: 'var(--space-12) var(--gutter) var(--space-20)', flex: 1, width: '100%' }}>
        <Reveal><h1>Institution Dashboard</h1></Reveal>
        <Reveal delay={60}><p className="text-muted" style={{ marginBottom: 'var(--space-10)' }}>Manage capability builds for your learners</p></Reveal>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 'var(--space-12)' }}>
          <ActionCard delay={0} icon="📋" title="Upload Capability Target" desc="Submit a new brief — any format" onClick={() => navigate('/institution/upload-target')} />
          <ActionCard delay={80} icon="👥" title="Manage Learners" desc="Add or import your learner cohort" onClick={() => navigate('/institution/upload-target')} />
          <ActionCard delay={160} icon="📊" title="View Mastery Logs" desc="Download structured capability evidence" onClick={() => {}} />
        </div>

        <h2 style={{ marginBottom: 'var(--space-5)' }}>Active Engagements</h2>
        {loading ? <p className="text-muted">Loading…</p> : (
          engagements.length === 0
            ? <EmptyState onStart={() => navigate('/institution/upload-target')} />
            : <div className="stack gap-3">
                {engagements.map((e, i) => (
                  <Reveal key={e.id} delay={i * 60} as="div" className="card card-hover card-interactive" onClick={() => navigate(`/institution/engagement/${e.id}`)}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>{e.title}</div>
                        <div className="small text-muted">{e.ct_title} · {e.language === 'hindi' ? 'हिंदी' : 'తెలుగు'}</div>
                      </div>
                      <span className={`badge ${STATUS_BADGE[e.status] || 'badge-neutral'}`}>{e.status}</span>
                    </div>
                    <div className="row gap-8" style={{ gap: 'var(--space-8)' }}>
                      <Stat label="Learners" val={e.learner_count} />
                      <Stat label="Completed" val={e.completed_count} />
                      <Stat label="Started" val={new Date(e.created_at).toLocaleDateString('en-IN')} />
                    </div>
                  </Reveal>
                ))}
              </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function ActionCard({ icon, title, desc, onClick, delay }) {
  return (
    <Reveal delay={delay} as="div" className="card card-hover card-interactive" onClick={onClick} style={{ borderTop: '3px solid var(--accent-ink)' }}>
      <div style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 'var(--space-1)' }}>{title}</div>
      <div className="small text-muted">{desc}</div>
    </Reveal>
  );
}

function Stat({ label, val }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{val}</div>
      <div className="small text-faint">{label}</div>
    </div>
  );
}

function EmptyState({ onStart }) {
  return (
    <div className="card" style={{ border: '1px dashed var(--color-border-strong)', padding: 'var(--space-16)', textAlign: 'center', boxShadow: 'none' }}>
      <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📋</div>
      <p className="text-muted" style={{ marginBottom: 'var(--space-5)' }}>No engagements yet. Upload a capability target to begin.</p>
      <button className="btn btn-primary" onClick={onStart}>Start First Engagement</button>
    </div>
  );
}
