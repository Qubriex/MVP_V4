// src/pages/InstitutionLogin.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import NavBar from '../components/NavBar';
import Reveal from '../components/Reveal';

export default function InstitutionLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/institution/login', { email, password });
      login(res.data.token, res.data.institution, 'institution');
      navigate('/institution/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <>
      <NavBar />
      <main style={{ position: 'relative', overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12) var(--gutter)' }}>
        <div className="hero-wash" style={{ opacity: 0.6 }} />
        <Reveal className="card" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: 'var(--space-10) var(--space-8)' }}>
          <div className="caption accent-text" style={{ marginBottom: 'var(--space-2)' }}>QUBIREX</div>
          <h2 style={{ marginBottom: 'var(--space-1)' }}>Institution Login</h2>
          <p className="small text-muted" style={{ marginBottom: 'var(--space-6)' }}>Commission capability builds for your learners</p>
          {error && <div className="badge badge-danger" style={{ display: 'block', marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 'var(--space-8)' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p className="small text-muted" style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
            Learner? <a href="/learner-login" className="accent-text" style={{ fontWeight: 600 }}>Learner Login →</a>
          </p>
        </Reveal>
      </main>
    </>
  );
}
