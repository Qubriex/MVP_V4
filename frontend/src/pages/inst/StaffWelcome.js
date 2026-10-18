// src/pages/inst/StaffWelcome.js — /institution/welcome
// Short profile setup after accepting an invite: Account (done) → Profile →
// Teaching → Notifications, with a live preview of what students see.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo';
import { useStaffDraft, ProfileFields, TeachingFields, NotificationFields, StudentPreview } from '../../components/inst/StaffProfileForm';

import { useUiLang } from '../../context/UiLangContext';
const STEPS = ['inst.staffWelcome.steps.account', 'inst.staffWelcome.steps.profile', 'inst.staffWelcome.steps.teaching', 'inst.staffWelcome.steps.notifications'];
const INTRO = {
  1: ['inst.staffWelcome.intro.yourProfile', 'inst.staffWelcome.intro.studentsSeeYourName'],
  2: ['inst.staffWelcome.intro.whatYouTeach', 'inst.staffWelcome.intro.weUseThisTo'],
  3: ['inst.staffWelcome.intro.notifications', 'inst.staffWelcome.intro.chooseWhatQubirexTells']
};

export default function StaffWelcome() {
  const { t } = useUiLang();
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
        <a href="/" className="brand-home" aria-label={t('inst.staffWelcome.qubirexHome')}><BrandLogo height={34} /></a>
        <ol className="in-steps" aria-label={t('inst.staffWelcome.setupSteps')}>
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="in-dot">{i < step ? '✓' : i + 1}</span>{t(label)}
            </li>
          ))}
        </ol>
        <Link to="/institution/home" className="ln-link">{t('inst.staffWelcome.skipNow')}</Link>
      </header>

      {!form.draft ? <p className="ln-muted" style={{ padding: 40 }}>{form.status || t('inst.staffWelcome.loading')}</p> : (
        <div className="ln-grid ln-g-detail ui-g-side" style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 6vw, 80px)', gap: 40 }}>
          <div className="ln-col" style={{ gap: 22, minWidth: 0 }}>
            <div className="ln-col" style={{ gap: 6 }}><h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{t(INTRO[step][0])}</h1><p className="ln-sub">{t(INTRO[step][1])}</p></div>
            {step === 1 && <ProfileFields form={form} />}
            {step === 2 && <TeachingFields form={form} />}
            {step === 3 && <NotificationFields form={form} />}
            {form.status && form.status !== 'saved' && <div className="ln-error" role="alert">{form.status}</div>}
            <div className="ln-between" style={{ paddingTop: 8 }}>
              <button type="button" className="ln-btn" style={{ minHeight: 48 }} onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>{t('inst.staffWelcome.back')}</button>
              <button type="button" className="ln-btn ln-btn-primary" style={{ minHeight: 48 }} onClick={next} disabled={form.saving}>{form.saving ? t('inst.staffWelcome.saving') : step === STEPS.length - 1 ? t('inst.staffWelcome.finish') : t('inst.staffWelcome.saveAndContinue')}</button>
            </div>
          </div>
          <aside><StudentPreview person={form.draft} /></aside>
        </div>
      )}
    </div>
  );
}
