// src/pages/LearnerLogin.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import NavBar from '../components/NavBar';
import Reveal from '../components/Reveal';

export default function LearnerLogin() {
  const [ref, setRef] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/learner/login', { learner_ref: ref, engagement_id: engagementId, pin });
      login(res.data.token, res.data.learner, 'learner');
      navigate('/learn/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your learner reference, engagement ID, and PIN.');
    }
    setLoading(false);
  };

  return (
    <>
      <NavBar />
      <main style={{ position: 'relative', overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12) var(--gutter)' }}>
        <div className="hero-wash" style={{ opacity: 0.6 }} />
        <Reveal className="card" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: 'var(--space-10) var(--space-8)' }}>
          <div className="caption accent-text" style={{ marginBottom: 'var(--space-2)' }}>QUBIREX</div>
          <h2 style={{ marginBottom: 'var(--space-1)' }}>Learner Login</h2>
          <p className="small text-muted" style={{ marginBottom: 'var(--space-6)' }}>Enter your learner reference and engagement code</p>
          {error && <div className="badge badge-danger" style={{ display: 'block', marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">Learner Reference Number</label>
              <input className="input" value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. LRNR-001" required />
            </div>
            <div className="field">
              <label className="label">Engagement ID</label>
              <input className="input" value={engagementId} onChange={e => setEngagementId(e.target.value)} placeholder="Provided by your institution" required />
            </div>
            <div className="field">
              <label className="label">PIN</label>
              <input className="input" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="6-digit PIN from your institution" required />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 'var(--space-8)' }}>
              {loading ? 'Entering…' : 'Enter Learning Space'}
            </button>
          </form>
          <div className="row gap-2" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
            <span className="badge badge-accent">हिंदी</span>
            <span className="badge badge-accent">తెలుగు</span>
          </div>
          <p className="small text-muted" style={{ textAlign: 'center', marginTop: 'var(--space-5)' }}>
            <a href="/login" className="accent-text" style={{ fontWeight: 600 }}>← Institution Login</a>
          </p>
        </Reveal>
      </main>
    </>
  );
}
