// src/pages/Verify.js — /verify and /verify/:id — the public verifier (v4.3 §10).
// Anyone can check that a Capability Passport is authentic; nobody can fish
// for data. The holder's name and contact are never shown. Three truths stay
// separate: the proof (authentic and unaltered), the evidence level L (how
// strongly each skill was assessed) and the assurance level A (how sure
// Qubirex is the learner produced the answer). Labels are computed now.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Search } from 'lucide-react';
import api from '../utils/api';
import PhoenixMark from '../components/PhoenixMark';
import ThemeToggle from '../components/ThemeToggle';
import { LABEL, LEVEL, ASSURANCE, fmtDate } from '../components/learn/evidenceText';

const STATUS_TEXT = {
  malformed: ['That is not a valid Evidence ID', 'Check for a typo. IDs look like QBX- followed by 12 letters and digits.'],
  not_found: ['No passport with this ID', 'Check the ID with the person who shared it.'],
  revoked: ['This passport has been revoked', 'It is no longer valid.'],
  expired: ['This passport has expired', 'Ask the holder for a renewed passport.'],
  signature_invalid: ['The signature does not check out', 'This record cannot be trusted. It may have been altered, or its key was withdrawn.'],
  rate_limited: ['Too many checks from this network', 'Please try again in an hour.']
};

export default function Verify() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(id || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) { setResult(null); return; }
    setLoading(true);
    api.get(`/verify/${encodeURIComponent(id)}`)
      .then(r => setResult(r.data))
      .catch(e => setResult(e.response?.status === 429 ? { status: 'rate_limited' } : e.response?.data?.status ? e.response.data : { status: e.response ? 'not_found' : 'offline' }))
      .finally(() => setLoading(false));
  }, [id]);

  const submit = (e) => { e.preventDefault(); if (input.trim()) navigate(`/verify/${input.trim().toUpperCase()}`); };
  const bad = result && result.status !== 'valid';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header className="ln-between" style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
        <Link to="/" className="ln-brand" style={{ fontSize: 18, textDecoration: 'none' }}><PhoenixMark size={26} />Qubirex</Link>
        <ThemeToggle />
      </header>
      <main className="ln-col" style={{ gap: 20, maxWidth: 820, margin: '0 auto', padding: '32px 16px 64px' }}>
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">Verify a Capability Passport</h1>
          <span className="ln-sub">Enter the Evidence ID the holder gave you. You will see whether the passport is authentic, and the skill details if the holder has chosen to share them.</span>
        </div>
        <form className="ln-row" style={{ gap: 10 }} onSubmit={submit}>
          <label className="ln-sr" htmlFor="eid">Evidence ID</label>
          <input id="eid" className="ln-input" style={{ flex: 1, minHeight: 48, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }} placeholder="QBX-XXXXXXXXXXXX" value={input} onChange={e => setInput(e.target.value)} />
          <button type="submit" className="ln-btn ln-btn-primary" style={{ minHeight: 48 }}><Search size={16} aria-hidden="true" />Check</button>
        </form>

        {loading && <div className="ln-card ln-muted">Checking…</div>}
        {!loading && bad && (
          <div className="ln-card" role="alert" style={{ gap: 6, borderColor: 'var(--status-danger)' }}>
            <strong className="ln-row" style={{ gap: 8 }}><ShieldAlert size={18} aria-hidden="true" />{(STATUS_TEXT[result.status] || ['Could not check', 'Check your connection and try again.'])[0]}</strong>
            <span className="ln-muted">{(STATUS_TEXT[result.status] || ['', 'Check your connection and try again.'])[1]}</span>
          </div>
        )}
        {!loading && result?.status === 'valid' && (
          <>
            <section className="ln-card" style={{ gap: 10 }}>
              <div className="ln-between ln-wrap" style={{ gap: 10 }}>
                <strong className="ln-row" style={{ gap: 8, fontSize: 18 }}><ShieldCheck size={20} aria-hidden="true" color="var(--status-success)" />Authentic and unaltered</strong>
                <span className="ln-tag ln-tag-lg ln-tag-success">Valid until {fmtDate(result.valid_until)}</span>
              </div>
              <span className="ln-small ln-muted">The issuer’s signature checks out against its published keys, and the passport has not been revoked. This says the record is genuine — the skill lines below say how strongly each skill was assessed (L) and how sure Qubirex is that the learner gave the answers (A).</span>
              <dl className="ln-grid ln-g-2" style={{ gap: 8, margin: 0 }}>
                <div><dt className="ln-xs ln-muted">Evidence ID</dt><dd style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)' }}>{result.evidence_id}</dd></div>
                <div><dt className="ln-xs ln-muted">Programme</dt><dd style={{ margin: 0 }}>{result.target?.title} (v{result.target?.version}) · {result.target?.language}</dd></div>
                <div><dt className="ln-xs ln-muted">Commissioned by</dt><dd style={{ margin: 0 }}>{result.target?.commissionedBy}</dd></div>
                <div><dt className="ln-xs ln-muted">Issuer · version</dt><dd style={{ margin: 0 }}>{result.issuer} · v{result.version}</dd></div>
              </dl>
            </section>
            <section className="ln-col" style={{ gap: 10 }}>
              <h2 className="ln-h2">Skills</h2>
              {!result.skills_public ? <div className="ln-card ln-muted">The holder has not made skill details public. Ask them to share them with you.</div> : result.skills.map(s => (
                <div key={s.skill_id} className="ln-card" style={{ gap: 8 }}>
                  <div className="ln-between ln-wrap" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span className={`ln-tag ln-tag-lg ${(LABEL[s.label] || LABEL.none).cls}`}>{(LABEL[s.label] || LABEL.none).text}</span>
                  </div>
                  <div className="ln-row ln-wrap ln-small" style={{ gap: 8 }}>
                    {s.evidence && <span className="ln-tag ln-tag-neutral">{LEVEL[s.evidence]}</span>}
                    {s.assurance && <span className="ln-tag ln-tag-neutral">{ASSURANCE[s.assurance]}</span>}
                    <span className="ln-muted">Freshness {Math.round((s.freshness || 0) * 100)}% · last shown {fmtDate(s.last_demonstrated)} · institution threshold θ {s.theta}</span>
                  </div>
                </div>
              ))}
              <p className="ln-xs ln-muted">Labels are computed now by the published label function ({result.label_function}) from signed, dated facts — the same passport shows a lower label if a skill has not been shown again recently.</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
