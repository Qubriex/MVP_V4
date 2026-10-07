// src/pages/public/Demo.js — /demo (v4.3 canvas P4). Step into each side
// with made-up data. Nothing here calls the server or saves anything; the
// screens mirror the real ones so a visitor sees what each side gets.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, CheckCircle2, Circle } from 'lucide-react';
import PublicShell from '../../components/public/PublicShell';
import { Bar } from '../../components/learn/ui';

const COHORT = { ready: 9, nearly: 14, building: 21 };
const CANDIDATES = [['Candidate 1', 86, 'Ready'], ['Candidate 2', 82, 'Ready'], ['Candidate 3', 74, 'Nearly ready'], ['Candidate 4', 66, 'Nearly ready']];

function LearnerDemo() {
  const [step, setStep] = useState(0);
  const skills = [['SQL basics', true], ['SQL joins', step >= 2], ['SQL aggregation', false]];
  return (
    <div className="ln-grid ln-g-2" style={{ gap: 20, alignItems: 'start' }}>
      <div className="pb-phone ln-col ln-indic" style={{ gap: 10 }}>
        <b style={{ fontSize: 18 }}>నమస్తే, లక్ష్మి</b>
        <span className="ln-small">ఈరోజు పాఠం: SQL joins</span>
        {step === 0 && <button type="button" className="ln-btn ln-btn-amber" onClick={() => setStep(1)}><Mic size={18} aria-hidden="true" />మాట్లాడి నేర్చుకోండి</button>}
        {step === 1 && (
          <div className="ln-col" style={{ gap: 8 }}>
            <span className="ln-small">రెండు పట్టికల్లో ఒకే విలువ ఉన్న వరుసలను కలపడానికి JOIN వాడతాం — రెండు జాబితాల్లో ఒకే రోల్ నంబర్ ఉన్న విద్యార్థులను జత చేసినట్టు.</span>
            <span className="ln-xs ln-muted">Check: Which rows does an INNER JOIN keep?</span>
            <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => setStep(2)}>Answer: rows that match in both tables</button>
          </div>
        )}
        {step === 2 && <span className="ln-tag ln-tag-success" style={{ alignSelf: 'flex-start' }}>✓ SQL joins added to your Passport</span>}
      </div>
      <div className="ln-card" style={{ gap: 8 }}>
        <b>Your Passport</b>
        {skills.map(([s, done]) => <span key={s} className="ln-row ln-small" style={{ gap: 8 }}>{done ? <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}{s}</span>)}
        <span className="ln-xs ln-muted">Lessons by voice in Telugu or Hindi, with English captions. Each skill is proven on fresh questions.</span>
      </div>
    </div>
  );
}

function CollegeDemo() {
  const total = COHORT.ready + COHORT.nearly + COHORT.building;
  const [bridged, setBridged] = useState(false);
  return (
    <div className="ln-grid ln-g-2" style={{ gap: 20, alignItems: 'start' }}>
      <div className="ln-card" style={{ gap: 10 }}>
        <span className="ln-kicker">Cohort · CSE 2026</span>
        {[['Ready', COHORT.ready, 'ln-bar-good'], ['Nearly ready', COHORT.nearly, ''], ['Building', COHORT.building, '']].map(([l, n, v]) => (
          <div key={l} className="ln-row" style={{ gap: 10 }}><span className="ln-small" style={{ width: 96 }}>{l}</span><div style={{ flex: 1 }}><Bar pct={(n / total) * 100} variant={v} label={`${l}: ${n}`} /></div><b>{n}</b></div>
        ))}
      </div>
      <div className="ln-card ln-card-warm" style={{ gap: 8 }}>
        <b>{COHORT.nearly} nearly ready — most need SQL aggregation.</b>
        {!bridged ? <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setBridged(true)}>Start a bridge programme</button>
          : <span className="ln-small">Bridge programme started for {COHORT.nearly} students. Re-test in 2 weeks, then “Did it work?” compares before and after.</span>}
      </div>
    </div>
  );
}

function EmployerDemo() {
  const [asked, setAsked] = useState({});
  return (
    <div className="ln-card" style={{ gap: 10 }}>
      <span className="ln-kicker">Role · Junior data analyst · bar 80</span>
      <div className="ln-tablewrap"><table className="ln-table"><thead><tr><th>Candidate</th><th>Readiness</th><th /></tr></thead>
        <tbody>{CANDIDATES.map(([c, r, band]) => (
          <tr key={c}><td>{c}<span className="ln-xs ln-muted" style={{ display: 'block' }}>[Institution name] · Hyderabad</span></td><td><span className={`ln-tag ${band === 'Ready' ? 'ln-tag-success' : 'ln-tag-info'}`}>{r} · {band}</span></td>
            <td>{asked[c] ? <span className="ln-small ln-muted">Asked — the student decides what to share</span> : <button type="button" className="ln-btn ln-btn-sm" onClick={() => setAsked(a => ({ ...a, [c]: true }))}>Request</button>}</td></tr>
        ))}</tbody></table></div>
      <span className="ln-xs ln-muted">Names stay hidden until the student says yes. Send a Day-One task before you hire.</span>
    </div>
  );
}

const SIDES = [['learner', 'Learner · phone · Telugu', 'Learn and prove a skill', 'Take a voice lesson in Telugu, answer a check, see your Passport grow.', LearnerDemo],
  ['college', 'College · admin view', 'Run a cohort to placement', 'Set a capability target, watch readiness, start a bridge programme.', CollegeDemo],
  ['employer', 'Employer · recruiter view', 'Hire from a job description', 'Paste a JD, see matching candidates, send a Day-One test.', EmployerDemo]];

export default function Demo() {
  const [side, setSide] = useState(null);
  const Active = SIDES.find(s => s[0] === side)?.[4];
  return (
    <PublicShell>
      <header className="ln-col" style={{ gap: 8 }}>
        <span className="pb-kicker">Live demo</span>
        <h1 className="ln-title">See Qubirex with sample data. No sign-up.</h1>
        <span className="ln-sub">Pick a side to step into. Each one opens with a ready-made college, cohort and roles.</span>
      </header>
      <section className="ln-grid ln-g-3" style={{ gap: 16 }}>
        {SIDES.map(([id, kicker, title, text]) => (
          <article key={id} className={`ln-card ${side === id ? 'ln-card-warm' : ''}`} style={{ gap: 8 }}>
            <span className="pb-kicker">{kicker}</span><b style={{ fontSize: 18 }}>{title}</b><span className="ln-small ln-muted">{text}</span>
            <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" style={{ alignSelf: 'flex-start', marginTop: 'auto' }} onClick={() => setSide(id)}>Open {id} demo</button>
          </article>
        ))}
      </section>
      {Active && <section aria-live="polite"><Active /></section>}
      <section className="ln-card ln-between ln-wrap" style={{ gap: 10 }}>
        <span className="ln-small"><b>Verify a sample Passport.</b> Check Evidence ID QBX-DEMO-0000 and see what an employer sees.</span>
        <Link to="/verify/QBX-DEMO-0000" className="ln-btn ln-btn-sm">Verify sample</Link>
      </section>
      <p className="ln-xs ln-muted">Demo data only. Nothing you do is saved. People and colleges in the demo are made up.</p>
    </PublicShell>
  );
}
