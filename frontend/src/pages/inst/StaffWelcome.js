// src/pages/inst/StaffWelcome.js — /institution/welcome
// Short profile setup after accepting an invite: Account (done) → Profile →
// Teaching → Notifications, with a live preview of what students see.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PhoenixMark from '../../components/PhoenixMark';
import { useStaffDraft, ProfileFields, TeachingFields, NotificationFields, StudentPreview } from '../../components/inst/StaffProfileForm';

const STEPS = ['Account', 'Profile', 'Teaching', 'Notifications'];
const INTRO = {
  1: ['Your profile', 'Students see your name, photo and designation in their cohort. The rest stays inside your institution.'],
  2: ['What you teach', 'We use this to show you the market data and cohorts that matter to you.'],
  3: ['Notifications', 'Choose what Qubirex tells you about.']
};

export default function StaffWelcome() {
  const form = useStaffDraft();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const next = async () => {
    const last = step === STEPS.length - 1;
    const ok = await form.save(last ? { profile_completed: true } : {});
    if (!ok) return;
    if (last) navigate('/institution/home'); else setStep(step + 1);
  };

  return (
    <div className="ln-col" style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header className="ln-between ln-wrap" style={{ padding: '14px 40px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', gap: 16 }}>
        <span className="ln-brand" style={{ padding: 0 }}><PhoenixMark size={26} />Qubirex</span>
        <ol className="in-steps" aria-label="Setup steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="in-dot">{i < step ? '✓' : i + 1}</span>{label}
            </li>
          ))}
        </ol>
        <Link to="/institution/home" className="ln-link">Skip for now</Link>
      </header>

      {!form.draft ? <p className="ln-muted" style={{ padding: 40 }}>{form.status || 'Loading…'}</p> : (
        <div className="ln-grid ln-g-detail" style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 6vw, 80px)', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 40 }}>
          <div className="ln-col" style={{ gap: 22, minWidth: 0 }}>
            <div className="ln-col" style={{ gap: 6 }}><h1 className="ln-title" style={{ fontSize: 34 }}>{INTRO[step][0]}</h1><p className="ln-sub">{INTRO[step][1]}</p></div>
            {step === 1 && <ProfileFields form={form} />}
            {step === 2 && <TeachingFields form={form} />}
            {step === 3 && <NotificationFields form={form} />}
            {form.status && form.status !== 'saved' && <div className="ln-error" role="alert">{form.status}</div>}
            <div className="ln-between" style={{ paddingTop: 8 }}>
              <button type="button" className="ln-btn" style={{ minHeight: 48 }} onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>Back</button>
              <button type="button" className="ln-btn ln-btn-primary" style={{ minHeight: 48 }} onClick={next} disabled={form.saving}>{form.saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish' : 'Save and continue →'}</button>
            </div>
          </div>
          <aside><StudentPreview person={form.draft} /></aside>
        </div>
      )}
    </div>
  );
}
