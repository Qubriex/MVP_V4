// src/pages/Verify.js — /verify and /verify/:id — the public verifier (v4.3 §10).
// Anyone can check that a Capability Passport is authentic; nobody can fish
// for data. The holder's name and contact are never shown. Three truths stay
// separate: the proof (authentic and unaltered), the evidence level L (how
// strongly each skill was assessed) and the assurance level A (how sure
// Qubirex is the learner produced the answer). Labels are computed now.
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Search, QrCode as QrIcon, UserCheck } from 'lucide-react';
import api from '../utils/api';
import PublicShell from '../components/public/PublicShell';
import { LABEL, LEVEL, ASSURANCE, fmtDate } from '../components/learn/evidenceText';

// The sample Passport from the Home page and the live demo (never on the server).
const DEMO_ID = 'QBX-DEMO-0000';
const DEMO = {
  status: 'valid', sample: true, evidence_id: DEMO_ID, issuer: 'did:web:qubirex.in', version: 2, valid_until: '2028-03-14T00:00:00Z', label_function: 'qep:label_v1',
  target: { title: 'Python + SQL for Data Roles', version: 2, language: 'telugu', commissionedBy: '[Institution name]' },
  skills_public: true,
  skills: [
    { skill_id: 'd1', name: 'SQL joins', label: 'Confirmed', evidence: 'L2', assurance: 'A3', freshness: 0.95, last_demonstrated: '2026-09-21', theta: 0.75 },
    { skill_id: 'd2', name: 'SQL aggregation', label: 'Confirmed', evidence: 'L2', assurance: 'A2', freshness: 0.9, last_demonstrated: '2026-09-24', theta: 0.75 },
    { skill_id: 'd3', name: 'Python functions', label: 'Partial', evidence: 'L2', assurance: 'A2', freshness: 0.55, last_demonstrated: '2026-06-26', theta: 0.7 }
  ]
};

const CAN = ['The record is genuine, signed by Qubirex and not revoked.', 'How each skill was proven and how sure we are the learner did the work.', 'Whether a name you type matches the holder.'];
const CANNOT = ['How the person will perform in your team, or their attitude and fit.', 'Skills the learner chose not to share publicly.', 'The holder’s name, phone, college roll or lesson history.'];

function Limits() {
  return (
    <section className="ln-card" style={{ gap: 8 }} aria-label="What this check can and can't tell you">
      <h2 className="ln-h2" style={{ fontSize: 17 }}>What this check can and can’t tell you</h2>
      <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
        <div className="ln-col" style={{ gap: 6 }}><span className="ln-kicker">It can tell you</span>{CAN.map(t => <span key={t} className="ln-small"><span className="pb-yes">Yes</span>{t}</span>)}</div>
        <div className="ln-col" style={{ gap: 6 }}><span className="ln-kicker">It can’t tell you</span>{CANNOT.map(t => <span key={t} className="ln-small"><span className="pb-no">No</span>{t}</span>)}</div>
      </div>
    </section>
  );
}

function NameCheck({ id }) {
  const [name, setName] = useState('');
  const [res, setRes] = useState(null);
  const check = async (e) => {
    e.preventDefault(); setRes(null);
    if (id === DEMO_ID) { setRes({ match: /lakshmi/i.test(name) && /rao/i.test(name) }); return; }
    try { setRes((await api.post(`/verify/${encodeURIComponent(id)}/name-check`, { name })).data); } catch (err) { setRes({ error: err.response?.data?.error?.message || 'Couldn’t check the name.' }); }
  };
  return (
    <section className="ln-card" style={{ gap: 8 }}>
      <h2 className="ln-h2" style={{ fontSize: 17 }}><UserCheck size={17} aria-hidden="true" /> Is this the person in front of you?</h2>
      <form className="ln-row ln-wrap" style={{ gap: 8 }} onSubmit={check}>
        <label htmlFor="vname" className="ln-sr">Candidate’s full name</label>
        <input id="vname" className="ln-input" style={{ flex: 1, minWidth: 200 }} placeholder="Candidate’s full name" value={name} onChange={e => setName(e.target.value)} />
        <button type="submit" className="ln-btn" disabled={name.trim().split(/\s+/).length < 2}>Check name</button>
      </form>
      {res && (res.error ? <span className="ln-small ln-error">{res.error}</span> : <span className={`ln-tag ${res.match ? 'ln-tag-success' : 'ln-tag-warning'}`} style={{ alignSelf: 'flex-start' }}>{res.match ? 'Match' : 'No match'}</span>)}
      <span className="ln-xs ln-muted">Initials and surname order are handled. The stored name is never shown.</span>
    </section>
  );
}

function QrScan({ onCode }) {
  const video = useRef(null);
  const [state, setState] = useState('idle');
  useEffect(() => () => { video.current?.srcObject?.getTracks().forEach(t => t.stop()); }, []);
  const start = async () => {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.current.srcObject = stream; await video.current.play(); setState('scanning');
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!video.current?.srcObject) return;
        const codes = await det.detect(video.current).catch(() => []);
        const raw = codes[0]?.rawValue;
        const m = raw && raw.match(/QBX-[A-Z0-9-]+/i);
        if (m) { stream.getTracks().forEach(t => t.stop()); video.current.srcObject = null; setState('idle'); onCode(m[0].toUpperCase()); } else requestAnimationFrame(tick);
      };
      tick();
    } catch { setState('denied'); }
  };
  return (
    <>
      <button type="button" className="ln-btn" style={{ minHeight: 48 }} onClick={start}><QrIcon size={16} aria-hidden="true" />Scan a Passport QR</button>
      <video ref={video} playsInline muted style={{ display: state === 'scanning' ? 'block' : 'none', width: '100%', maxWidth: 360, borderRadius: 12 }} />
      {state === 'unsupported' && <span className="ln-xs ln-muted">This browser can’t scan here. Point your phone’s camera app at the QR — it opens this page with the ID filled in.</span>}
      {state === 'denied' && <span className="ln-xs ln-muted">Camera not available. Type the Evidence ID instead.</span>}
    </>
  );
}

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
    if (id.toUpperCase() === DEMO_ID) { setResult(DEMO); return; }
    setLoading(true);
    api.get(`/verify/${encodeURIComponent(id)}`)
      .then(r => setResult(r.data))
      .catch(e => setResult(e.response?.status === 429 ? { status: 'rate_limited' } : e.response?.data?.status ? e.response.data : { status: e.response ? 'not_found' : 'offline' }))
      .finally(() => setLoading(false));
  }, [id]);

  const submit = (e) => { e.preventDefault(); if (input.trim()) navigate(`/verify/${input.trim().toUpperCase()}`); };
  const bad = result && result.status !== 'valid';

  return (
    <PublicShell>
      <div className="ln-col" style={{ gap: 20, maxWidth: 860, width: '100%', margin: '0 auto' }}>
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">Verify a Capability Passport</h1>
          <span className="ln-sub">Enter the Evidence ID the holder gave you. You will see whether the passport is authentic, and the skill details if the holder has chosen to share them.</span>
        </div>
        <form className="ln-row" style={{ gap: 10 }} onSubmit={submit}>
          <label className="ln-sr" htmlFor="eid">Evidence ID</label>
          <input id="eid" className="ln-input" style={{ flex: 1, minHeight: 48, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }} placeholder="QBX-XXXXXXXXXXXX" value={input} onChange={e => setInput(e.target.value)} />
          <button type="submit" className="ln-btn ln-btn-primary" style={{ minHeight: 48 }}><Search size={16} aria-hidden="true" />Verify</button>
        </form>
        <div className="ln-row ln-wrap" style={{ gap: 10, alignItems: 'flex-start' }}><span className="ln-small ln-muted" style={{ alignSelf: 'center' }}>or</span><QrScan onCode={(code) => { setInput(code); navigate(`/verify/${code}`); }} /></div>

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
              {result.sample && <div className="ln-note">This is a sample Passport with made-up data, for the demo. Try the name check with “Lakshmi Rao”.</div>}
              <p className="ln-xs ln-muted">Labels are computed now by the published label function ({result.label_function}) from signed, dated facts — the same passport shows a lower label if a skill has not been shown again recently.</p>
            </section>
            <NameCheck id={result.evidence_id} />
          </>
        )}
        <Limits />
        <nav className="ln-row ln-wrap ln-xs" style={{ gap: 14 }} aria-label="For developers">
          <span className="ln-muted">did:web:qubirex.in · status lists</span>
          <a className="ln-link" href="/api/verify/jwks.json" target="_blank" rel="noopener">Public keys (JWKS)</a>
          <Link className="ln-link" to="/employer/verify-bulk">Bulk verify (employers)</Link>
        </nav>
      </div>
    </PublicShell>
  );
}
