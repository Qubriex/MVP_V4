// src/pages/learn/Welcome.js — /learn/welcome
// First-run setup after the first sign-in: three short steps (basics, goals,
// voice check) built from the same forms as the profile page. Every step can
// be skipped; the profile page covers the rest later.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, speechTag } from '../../context/UiLangContext';
import { useSpeechInput } from '../../utils/voice';
import { useProfileDraft, PersonalSection, GoalsSection, VoiceSection, Section } from '../../components/learn/ProfileSections';
import { LoadingRows } from '../../components/shared/EmptyState';

const STEPS = ['learn.welcome.steps.basics', 'learn.welcome.steps.goals', 'learn.welcome.steps.voiceCheck'];

function VoiceCheck() {
  const { user } = useAuth();
  const { t } = useUiLang();
  const [heard, setHeard] = useState('');
  const mic = useSpeechInput({ lang: speechTag(user?.language || 'telugu'), onFinal: setHeard, onAudio: () => setHeard(t('learn.welcome.recordedYourBrowserSends')) });
  const prompt = user?.language === 'hindi' ? '“नमस्ते, मेरा नाम … है।”' : '“నమస్కారం, నా పేరు …”';
  return (
    <Section title={t('learn.welcome.tryMicrophone')}>
      <span className="ln-small">{t('learn.welcome.tapMicSayPrompt', { prompt })}</span>
      <div className="ln-row ln-wrap" style={{ gap: 16 }}>
        <button type="button" className={`ln-mic ${mic.listening ? 'is-listening' : ''}`} style={{ width: 64, height: 64 }} onClick={() => (mic.listening ? mic.stop() : mic.start())}
          aria-label={mic.listening ? t('session.tapStop') : t('session.tapSpeak')} aria-pressed={mic.listening} disabled={!mic.supported}>
          <Mic size={24} aria-hidden="true" />
        </button>
        <span className="ln-indic" style={{ fontSize: 'var(--fs-h3)' }}>{mic.listening ? (mic.interim || t('learn.welcome.listening')) : heard || (mic.supported ? t('learn.welcome.notTriedYet') : t('learn.welcome.voiceInputIsnT'))}</span>
      </div>
      {mic.error && <div className="ln-error">{mic.error}</div>}
    </Section>
  );
}

export default function Welcome() {
  const { t } = useUiLang();
  const form = useProfileDraft();
  const { lang } = useUiLang();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const { draft, set } = form;

  // Carry the language picked on the login page into the first save.
  const loaded = !!draft;
  useEffect(() => { if (loaded && draft.has_profile === false) set('ui_language', lang); }, [loaded]);

  if (!form.draft) return <LoadingRows rows={5} />;
  const next = async () => {
    if (form.dirty || draft.has_profile === false) await form.save();
    if (step < STEPS.length - 1) setStep(step + 1);
    else navigate('/learn/dashboard');
  };

  return (
    <div className="ui-narrow ln-col" style={{ gap: 20 }}>
      <header className="ln-col" style={{ gap: 6 }}>
        <span className="ln-kicker">{t('learn.welcome.stepValueLengthStep', { value: step + 1, length: STEPS.length, step: t(STEPS[step]) })}</span>
        <h1 className="ln-title">{t('learn.welcome.welcomeValue', { value: (form.draft.name || '').split(' ')[0] })}</h1>
        <span className="ln-sub">{t('learn.welcome.threeQuickStepsSo')}</span>
      </header>
      <ol className="ln-row" style={{ gap: 8 }} aria-label={t('learn.welcome.progress')}>
        {STEPS.map((s, i) => <li key={s} style={{ flex: 1, height: 6, borderRadius: 99, background: i <= step ? 'var(--accent-700)' : 'var(--color-border)' }}><span className="ln-sr">{t(s)}{i < step ? t('learn.welcome.done') : i === step ? ' ' + t('learn.welcome.current') : ''}</span></li>)}
      </ol>

      {step === 0 && <PersonalSection form={form} />}
      {step === 1 && <GoalsSection form={form} />}
      {step === 2 && <><VoiceSection form={form} /><VoiceCheck /></>}

      {form.status && form.status !== 'saved' && <div className="ln-error" role="alert">{form.status}</div>}
      <div className="ln-row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="ln-btn" onClick={() => (step ? setStep(step - 1) : navigate('/learn/dashboard'))}>{step ? t('learn.welcome.back') : t('learn.welcome.skipNow')}</button>
        <button type="button" className="ln-btn ln-btn-primary" onClick={next} disabled={form.saving}>{form.saving ? t('learn.welcome.saving') : step === STEPS.length - 1 ? t('learn.welcome.finish') : t('learn.welcome.next')}</button>
      </div>
    </div>
  );
}
