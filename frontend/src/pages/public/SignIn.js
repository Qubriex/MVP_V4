// src/pages/public/SignIn.js — /signin, "Choose your door" (v4.3 canvas):
// learner, institution staff, employer, or anyone verifying a Passport.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, School, Briefcase, ShieldCheck } from 'lucide-react';
import PublicShell from '../../components/public/PublicShell';

export default function SignIn() {
  const navigate = useNavigate();
  const [eid, setEid] = useState('');
  return (
    <PublicShell>
      <header className="ln-col" style={{ gap: 8 }}>
        <h1 className="ln-title">Choose your door</h1>
        <span className="ln-sub">Institutions commission the skill. Learners build and prove it in Telugu or Hindi. Employers hire on signed evidence, only with the learner’s consent.</span>
        <span className="ln-indic ln-small">మీ భాషలో నేర్చుకోండి. మీ నైపుణ్యాన్ని నిరూపించండి. · अपनी भाषा में सीखें। अपना कौशल साबित करें।</span>
      </header>
      <section className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <article className="ln-card" style={{ gap: 8 }}>
          <span className="pb-kicker"><GraduationCap size={14} aria-hidden="true" /> Learner</span>
          <b style={{ fontSize: 18 }}>Start or continue learning</b>
          <span className="ln-small ln-muted">You need the join code from your college, your roll number and your 6-digit PIN.</span>
          <Link to="/learner-login" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>Continue</Link>
          <span className="ln-xs ln-muted">Got an invite link? Open it to set your own PIN. Forgot your PIN? Ask on the sign-in page — your college resets it and sends it by WhatsApp or SMS.</span>
        </article>
        <article className="ln-card" style={{ gap: 8 }}>
          <span className="pb-kicker"><School size={14} aria-hidden="true" /> Institution staff</span>
          <b style={{ fontSize: 18 }}>Admin, professor or viewer</b>
          <span className="ln-small ln-muted">Sign in with your work email and password.</span>
          <Link to="/login" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>Sign in</Link>
          <span className="ln-xs ln-muted">Invited by your admin? Use the link in your email.</span>
        </article>
        <article className="ln-card" style={{ gap: 8 }}>
          <span className="pb-kicker"><Briefcase size={14} aria-hidden="true" /> Employer</span>
          <b style={{ fontSize: 18 }}>Hire on evidence</b>
          <span className="ln-small ln-muted">New companies are verified (domain email code, GSTIN, manual review) before they can request access.</span>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}><Link to="/employer/login" className="ln-btn ln-btn-primary">Sign in</Link><Link to="/employer/register" className="ln-btn">Register company</Link></div>
          <span className="ln-xs ln-muted">New to Qubirex? <Link to="/pricing" className="ln-link">See pricing</Link></span>
        </article>
        <article className="ln-card" style={{ gap: 8 }}>
          <span className="pb-kicker"><ShieldCheck size={14} aria-hidden="true" /> Anyone</span>
          <b style={{ fontSize: 18 }}>Verify a Capability Passport</b>
          <form className="ln-row" style={{ gap: 8 }} onSubmit={e => { e.preventDefault(); if (eid.trim()) navigate(`/verify/${eid.trim().toUpperCase()}`); }}>
            <label htmlFor="door-eid" className="ln-sr">Evidence ID</label>
            <input id="door-eid" className="ln-input in-code" placeholder="QBX-XXXXXXXXXXXX" value={eid} onChange={e => setEid(e.target.value)} />
            <button type="submit" className="ln-btn">Verify</button>
          </form>
          <span className="ln-xs ln-muted">Checks authenticity and today’s label. Never shows a name or contact details.</span>
          <Link to="/demo" className="ln-link ln-small">Try the live demo (no sign-up) →</Link>
        </article>
      </section>
      <p className="ln-xs ln-muted">By continuing you agree to the terms and the privacy notice in Telugu, Hindi and English. Learners under 18 join only with guardian consent collected through their institution.</p>
    </PublicShell>
  );
}
