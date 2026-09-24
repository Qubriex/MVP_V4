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

const STEPS = ['Basics', 'Goals', 'Voice check'];

function VoiceCheck() {
  const { user } = useAuth();
  const { t } = useUiLang();
  const [heard, setHeard] = useState('');
  const mic = useSpeechInput({ lang: speechTag(user?.language || 'telugu'), onFinal: setHeard, onAudio: () => setHeard('(recorded — your browser sends audio to the server for transcription)') });
  const prompt = user?.language === 'hindi' ? '“नमस्ते, मेरा नाम … है।”' : '“నమస్కారం, నా పేరు …”';
  return (
    <Section title="Try your microphone">
      <span className="ln-small">Tap the mic and say {prompt} We’ll show what we heard.</span>
      <div className="ln-row ln-wrap" style={{ gap: 16 }}>
        <button type="button" className={`ln-mic ${mic.listening ? 'is-listening' : ''}`} style={{ width: 64, height: 64 }} onClick={() => (mic.listening ? mic.stop() : mic.start())}
          aria-label={mic.listening ? t('session.tapStop') : t('session.tapSpeak')} aria-pressed={mic.listening} disabled={!mic.supported}>
          <Mic size={24} aria-hidden="true" />
        </button>
        <span className="ln-indic" style={{ fontSize: 16 }}>{mic.listening ? (mic.interim || 'Listening…') : heard || (mic.supported ? 'Not tried yet' : 'Voice input isn’t available in this browser — you can still type in every session.')}</span>
      </div>
      {mic.error && <div className="ln-error">{mic.error}</div>}
    </Section>
  );
}

export default function Welcome() {
  const form = useProfileDraft();
  const { lang } = useUiLang();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const { draft, set } = form;

  // Carry the language picked on the login page into the first save.
  const loaded = !!draft;
  useEffect(() => { if (loaded && draft.has_profile === false) set('ui_language', lang); }, [loaded]);

  if (!form.draft) return <p className="ln-muted">Loading…</p>;
  const next = async () => {
    if (form.dirty || draft.has_profile === false) await form.save();
    if (step < STEPS.length - 1) setStep(step + 1);
    else navigate('/learn/dashboard');
  };

  return (
    <div className="ln-col" style={{ gap: 20, maxWidth: 880 }}>
      <header className="ln-col" style={{ gap: 6 }}>
        <span className="ln-kicker">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
        <h1 className="ln-title">Welcome, {(form.draft.name || '').split(' ')[0]}</h1>
        <span className="ln-sub">Three quick steps so Professor Qubirex and your resume start from the right place.</span>
      </header>
      <ol className="ln-row" style={{ gap: 8 }} aria-label="Progress">
        {STEPS.map((s, i) => <li key={s} style={{ flex: 1, height: 6, borderRadius: 99, background: i <= step ? 'var(--accent-700)' : 'var(--color-border)' }}><span className="ln-sr">{s}{i < step ? ' (done)' : i === step ? ' (current)' : ''}</span></li>)}
      </ol>

      {step === 0 && <PersonalSection form={form} />}
      {step === 1 && <GoalsSection form={form} />}
      {step === 2 && <><VoiceSection form={form} /><VoiceCheck /></>}

      {form.status && form.status !== 'saved' && <div className="ln-error" role="alert">{form.status}</div>}
      <div className="ln-row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="ln-btn" onClick={() => (step ? setStep(step - 1) : navigate('/learn/dashboard'))}>{step ? 'Back' : 'Skip for now'}</button>
        <button type="button" className="ln-btn ln-btn-primary" onClick={next} disabled={form.saving}>{form.saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish' : 'Next'}</button>
      </div>
    </div>
  );
}
