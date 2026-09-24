// src/pages/CapabilityTargetUpload.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import NavBar from '../components/NavBar';
import Reveal from '../components/Reveal';

export default function CapabilityTargetUpload() {
  const navigate = useNavigate();
  const [path, setPath] = useState('B');
  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/institution/capability-targets', {
        title, path, raw_input: rawInput, time_window_weeks: parseInt(timeWindow) || null
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    try {
      await api.post(`/institution/capability-targets/${result.id}/confirm`);
      setConfirmed(true);
    } catch (err) {
      setError('Confirmation failed');
    }
  };

  const handleBuildPathway = async () => {
    setLoading(true);
    try {
      await api.post(`/institution/capability-targets/${result.id}/build-pathway`, { language: 'telugu' });
      navigate('/institution/engagement/new', { state: { capabilityTargetId: result.id, title } });
    } catch (err) {
      setError('Pathway build failed: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  return (
    <>
      <NavBar />
      <main className="container" style={{ padding: 'var(--space-12) var(--gutter) var(--space-20)', flex: 1, width: '100%' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="small accent-text" style={{ cursor: 'pointer', marginBottom: 'var(--space-6)', fontWeight: 600 }} onClick={() => navigate('/institution/dashboard')}>← Back to Dashboard</div>
          <Reveal><h1>Upload Capability Target</h1></Reveal>
          <Reveal delay={60}><p className="text-muted" style={{ marginBottom: 'var(--space-8)' }}>Tell Professor Qubirex what to build. Any format accepted.</p></Reveal>

          <Reveal delay={100} className="row gap-3" style={{ marginBottom: 'var(--space-8)', alignItems: 'stretch' }}>
            <button
              className="card"
              style={{ flex: 1, textAlign: 'left', cursor: 'pointer', ...(path === 'B' ? { borderColor: 'var(--accent-ink)', background: 'var(--accent-50)' } : {}) }}
              onClick={() => setPath('B')}
            >
              <div style={{ fontWeight: 700, marginBottom: 'var(--space-1)', color: path === 'B' ? 'var(--accent-800)' : 'var(--color-text)' }}>Path B — Any Format</div>
              <div className="small text-muted">Curriculum, JD, skills list, plain text</div>
            </button>
            <button
              className="card"
              style={{ flex: 1, textAlign: 'left', cursor: 'pointer', ...(path === 'A' ? { borderColor: 'var(--accent-ink)', background: 'var(--accent-50)' } : {}) }}
              onClick={() => setPath('A')}
            >
              <div style={{ fontWeight: 700, marginBottom: 'var(--space-1)', color: path === 'A' ? 'var(--accent-800)' : 'var(--color-text)' }}>Path A — Structured</div>
              <div className="small text-muted">Standard capability target document</div>
            </button>
          </Reveal>

          {!result ? (
            <Reveal delay={160} as="form" onSubmit={handleSubmit}>
              {error && <div className="badge badge-danger" style={{ display: 'block', padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>{error}</div>}
              <div className="field" style={{ marginTop: 0 }}>
                <label className="label">Engagement Title</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Python Fundamentals — Batch 1" required />
              </div>

              <div className="field">
                <label className="label">{path === 'B' ? 'Paste your document, curriculum, or brief here' : 'Paste structured capability target document'}</label>
                {path === 'B' && (
                  <div className="badge-accent" style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-small)', fontWeight: 400, marginBottom: 'var(--space-1)' }}>
                    🤖 Professor Qubirex's AI will extract the capability targets and return a structured summary for your confirmation before instruction begins.
                  </div>
                )}
                <textarea
                  className="textarea input"
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  rows={14}
                  placeholder={path === 'B'
                    ? 'Example:\nWe need our bootcamp students to be able to write basic Python programs including variables, loops, functions, and file handling. Students are Telugu speakers with limited English. 4-week programme, 25 students.'
                    : 'Paste structured document here...'}
                  required
                />
              </div>

              <div className="field">
                <label className="label">Time Window (weeks) — optional</label>
                <input className="input" style={{ width: 140 }} type="number" value={timeWindow} onChange={e => setTimeWindow(e.target.value)} placeholder="e.g. 4" min="1" max="52" />
              </div>

              <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 'var(--space-8)' }}>
                {loading ? 'Processing…' : path === 'B' ? 'Extract Capability Targets →' : 'Submit Target →'}
              </button>
            </Reveal>
          ) : (
            <Reveal className="card">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <div style={{ color: 'var(--status-success)', fontWeight: 700, fontSize: '1.1rem' }}>
                  {path === 'B' ? '✅ Targets Extracted' : '✅ Target Received'}
                </div>
                {path === 'B' && (
                  <span className="badge badge-success">Confidence: {Math.round((result.extraction?.extraction_confidence || 0) * 100)}%</span>
                )}
              </div>

              {path === 'B' && result.extraction && (
                <>
                  <p className="small text-muted" style={{ marginBottom: 'var(--space-4)' }}>Review the extracted targets below. Confirm to begin instruction.</p>
                  <div className="small" style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--space-4)' }}>
                    {result.extraction.confirmation_summary}
                  </div>

                  {result.extraction.ambiguities?.length > 0 && (
                    <div className="badge-warning" style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                      <strong className="small">⚠️ Clarification needed:</strong>
                      <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 20 }}>
                        {result.extraction.ambiguities.map((a, i) => <li key={i} className="small" style={{ marginBottom: 'var(--space-1)' }}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  <h3 style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>Extracted Clusters</h3>
                  <div className="stack gap-2" style={{ marginBottom: 'var(--space-6)' }}>
                    {result.extraction.clusters?.map((c, i) => (
                      <div key={i} style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-small)', marginBottom: 'var(--space-1)' }}>{c.label}</div>
                        <div className="small accent-text" style={{ textTransform: 'capitalize', marginBottom: 'var(--space-1)' }}>{c.required_proficiency} · {c.priority} priority</div>
                        {c.description && <div className="small text-muted">{c.description}</div>}
                      </div>
                    ))}
                  </div>

                  {!confirmed ? (
                    <button className="btn btn-primary btn-block" onClick={handleConfirm}>✓ Confirm — These targets are correct. Begin instruction setup.</button>
                  ) : (
                    <button className="btn btn-primary btn-block" onClick={handleBuildPathway} disabled={loading}>
                      {loading ? 'Building pathway…' : 'Build Learning Pathway & Start Engagement →'}
                    </button>
                  )}
                </>
              )}

              {path === 'A' && (
                <button className="btn btn-primary btn-block" onClick={handleBuildPathway} disabled={loading}>
                  {loading ? 'Building pathway…' : 'Build Learning Pathway & Start Engagement →'}
                </button>
              )}
            </Reveal>
          )}
        </div>
      </main>
    </>
  );
}
