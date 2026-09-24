// src/pages/EngagementSetup.js
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import NavBar from '../components/NavBar';
import Reveal from '../components/Reveal';

export default function EngagementSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { capabilityTargetId, title: initTitle } = location.state || {};
  const [title, setTitle] = useState(initTitle || '');
  const [language, setLanguage] = useState('telugu');
  const [learners, setLearners] = useState([{ name: '', learner_ref: '', email: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null); // [{learner_ref, pin}] shown once, then the engagement is created
  const [pendingEngagement, setPendingEngagement] = useState(null);

  const addLearner = () => setLearners([...learners, { name: '', learner_ref: '', email: '' }]);
  const updateLearner = (i, field, val) => {
    const next = [...learners]; next[i][field] = val; setLearners(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      // Register learners first — each response entry carries a one-time PIN
      // (the secret login factor) that must be shown to the institution now,
      // since it is never retrievable again after this response.
      const bulkRes = await api.post('/institution/learners/bulk', {
        learners: learners.filter(l => l.name && l.learner_ref).map(l => ({ ...l, language }))
      });
      setCredentials(bulkRes.data.learners || []);
      setPendingEngagement({ title, language });
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed');
    }
    setLoading(false);
  };

  const finishSetup = async () => {
    setLoading(true); setError('');
    try {
      const allLearners = await api.get('/institution/learners');
      const refSet = new Set(learners.map(l => l.learner_ref));
      const learnerIds = allLearners.data.filter(l => refSet.has(l.learner_ref)).map(l => l.id);

      const engRes = await api.post('/institution/engagements', {
        capability_target_id: capabilityTargetId,
        title: pendingEngagement.title, language: pendingEngagement.language, learner_ids: learnerIds
      });
      navigate(`/institution/engagement/${engRes.data.engagement_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed');
    }
    setLoading(false);
  };

  if (credentials) {
    return (
      <>
        <NavBar />
        <main className="container" style={{ padding: 'var(--space-12) var(--gutter) var(--space-20)', flex: 1, width: '100%' }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <Reveal><h1 style={{ marginBottom: 'var(--space-2)' }}>Learner Credentials</h1></Reveal>
            <p className="small text-muted" style={{ marginBottom: 'var(--space-6)' }}>
              Each learner needs their reference, the engagement ID, and this PIN to log in. Share these securely now —
              PINs cannot be retrieved again after you leave this page (an institution admin can only reset them, not view them).
            </p>
            <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
              {credentials.map(c => (
                <div key={c.learner_ref} className="row gap-3" style={{ justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>{c.learner_ref}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{c.skipped ? 'already exists — PIN unchanged' : c.pin}</span>
                </div>
              ))}
            </div>
            {error && <div className="badge badge-danger" style={{ display: 'block', padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>{error}</div>}
            <button className="btn btn-primary btn-block" onClick={finishSetup} disabled={loading}>
              {loading ? 'Starting…' : 'I’ve saved these — Start Engagement →'}
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="container" style={{ padding: 'var(--space-12) var(--gutter) var(--space-20)', flex: 1, width: '100%' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div className="small accent-text" style={{ cursor: 'pointer', marginBottom: 'var(--space-6)', fontWeight: 600 }} onClick={() => navigate('/institution/dashboard')}>← Dashboard</div>
          <Reveal><h1 style={{ marginBottom: 'var(--space-6)' }}>Setup Engagement</h1></Reveal>
          {error && <div className="badge badge-danger" style={{ display: 'block', padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>{error}</div>}
          <Reveal delay={80} as="form" onSubmit={handleSubmit}>
            <div className="field" style={{ marginTop: 0 }}>
              <label className="label">Engagement Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>

            <div className="field">
              <label className="label">Language of Instruction</label>
              <div className="row gap-3">
                {['telugu', 'hindi'].map(lang => (
                  <button
                    key={lang}
                    type="button"
                    className="card"
                    style={{
                      flex: 1, textAlign: 'center', cursor: 'pointer', padding: 'var(--space-4)',
                      ...(language === lang ? { borderColor: 'var(--accent-ink)', background: 'var(--accent-50)', color: 'var(--accent-ink)', fontWeight: 700 } : { color: 'var(--color-text-muted)' })
                    }}
                    onClick={() => setLanguage(lang)}
                  >
                    {lang === 'hindi' ? 'हिंदी Hindi' : 'తెలుగు Telugu'}
                  </button>
                ))}
              </div>
            </div>

            <h3 style={{ margin: 'var(--space-8) 0 var(--space-3)' }}>Add Learners</h3>
            <div className="stack gap-2" style={{ marginBottom: 'var(--space-4)' }}>
              {learners.map((l, i) => (
                <div key={i} className="row gap-2">
                  <input className="input" placeholder="Name" value={l.name} onChange={e => updateLearner(i, 'name', e.target.value)} />
                  <input className="input" placeholder="Ref No (e.g. LRNR-001)" value={l.learner_ref} onChange={e => updateLearner(i, 'learner_ref', e.target.value)} />
                  <input className="input" placeholder="Email (optional)" value={l.email} onChange={e => updateLearner(i, 'email', e.target.value)} />
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ borderStyle: 'dashed', marginBottom: 'var(--space-8)' }} onClick={addLearner}>+ Add Learner</button>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Starting…' : 'Start Engagement →'}
            </button>
          </Reveal>
        </div>
      </main>
    </>
  );
}
