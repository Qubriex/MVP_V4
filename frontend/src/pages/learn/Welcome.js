// src/pages/learn/Welcome.js — /learn/welcome
// First-run setup after the first sign-in, in three short steps: language and
// voice, a 10-second microphone test, then the starting check. Personal
// details, education and goals live on the profile page and can wait.
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, speechTag } from '../../context/UiLangContext';
import { useSpeechInput } from '../../utils/voice';
import { useProfileDraft, VoiceSection, Section } from '../../components/learn/ProfileSections';
import { LoadingRows } from '../../components/shared/EmptyState';

const STEPS = ['lj.welcome.step.voice', 'lj.welcome.step.mic', 'lj.welcome.step.check'];
const MIC_SECONDS = 10;

// Ten seconds of listening: the learner says one line, we show what we heard.
function VoiceCheck() {
  const { user } = useAuth();
  const { t } = useUiLang();
  const [heard, setHeard] = useState('');
  const [left, setLeft] = useState(0);
  const timer = useRef(null);
  const mic = useSpeechInput({ lang: speechTag(user?.language || 'telugu'), onFinal: setHeard, onAudio: () => setHeard(t('learn.welcome.recordedYourBrowserSends')) });
  const prompt = user?.language === 'hindi' ? '“नमस्ते, मेरा नाम … है।”' : '“నమస్కారం, నా పేరు …”';
  const stop = () => { clearInterval(timer.current); setLeft(0); mic.stop(); };
  const start = () => {
    setHeard(''); setLeft(MIC_SECONDS); mic.start();
    clearInterval(timer.current);
    timer.current = setInterval(() => setLeft(l => { if (l <= 1) { clearInterval(timer.current); mic.stop(); return 0; } return l - 1; }), 1000);
  };
  useEffect(() => () => clearInterval(timer.current), []);
  return (
    <Section title={t('learn.welcome.tryMicrophone')}>
      <span className="ln-small">{t('lj.welcome.micHow', { prompt, s: MIC_SECONDS })}</span>
      <div className="ln-row ln-wrap" style={{ gap: 16 }}>
        <button type="button" className={`ln-mic ${mic.listening ? 'is-listening' : ''}`} style={{ width: 64, height: 64 }} onClick={() => (mic.listening ? stop() : start())}
          aria-label={mic.listening ? t('session.tapStop') : t('session.tapSpeak')} aria-pressed={mic.listening} disabled={!mic.supported} data-mic-test>
          <Mic size={24} aria-hidden="true" />
        </button>
        <span className="ln-col" style={{ gap: 4 }}>
          {mic.listening && <span className="ln-small ln-muted" aria-live="polite">{t('lj.welcome.secondsLeft', { s: left })}</span>}
          <span className="ln-indic" style={{ fontSize: 'var(--fs-h3)' }}>{mic.listening ? (mic.interim || t('learn.welcome.listening')) : heard || (mic.supported ? t('learn.welcome.notTriedYet') : t('learn.welcome.voiceInputIsnT'))}</span>
        </span>
      </div>
      {heard && !mic.listening && <span className="ln-small ln-row" style={{ gap: 6, color: 'var(--status-success)' }} role="status"><CheckCircle2 size={16} aria-hidden="true" />{t('lj.welcome.micWorks')}</span>}
      {!mic.supported && <span className="ln-small ln-muted">{t('lj.welcome.noMic')}</span>}
      {mic.error && <div className="ln-error">{mic.error}</div>}
    </Section>
  );
}

function StartCheck() {
  const { t } = useUiLang();
  return (
    <Section title={t('lj.welcome.checkTitle')}>
      <span className="ln-row" style={{ gap: 10, alignItems: 'flex-start' }}><ClipboardCheck size={22} aria-hidden="true" style={{ flexShrink: 0 }} /><span>{t('lj.welcome.checkWhy')}</span></span>
      <span className="ln-small ln-muted">{t('lj.welcome.profileLater')} <Link className="ln-link" to="/learn/profile">{t('lj.welcome.openProfile')}</Link></span>
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
    else navigate('/learn/baseline');
  };

  return (
    <div className="ui-narrow ln-col" style={{ gap: 20 }}>
      <header className="ln-col" style={{ gap: 6 }}>
        <span className="ln-kicker">{t('learn.welcome.stepValueLengthStep', { value: step + 1, length: STEPS.length, step: t(STEPS[step]) })}</span>
        <h1 className="ln-title">{t('learn.welcome.welcomeValue', { value: (form.draft.name || '').split(' ')[0] })}</h1>
        <span className="ln-sub">{t('lj.welcome.sub')}</span>
      </header>
      <ol className="ln-row" style={{ gap: 8 }} aria-label={t('learn.welcome.progress')}>
        {STEPS.map((s, i) => <li key={s} style={{ flex: 1, height: 6, borderRadius: 99, background: i <= step ? 'var(--accent-700)' : 'var(--color-border)' }}><span className="ln-sr">{t(s)}{i < step ? t('learn.welcome.done') : i === step ? ' ' + t('learn.welcome.current') : ''}</span></li>)}
      </ol>

      {step === 0 && <VoiceSection form={form} />}
      {step === 1 && <VoiceCheck />}
      {step === 2 && <StartCheck />}

      {form.status && form.status !== 'saved' && <div className="ln-error" role="alert">{form.status}</div>}
      <div className="ln-row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="ln-btn" onClick={() => (step ? setStep(step - 1) : navigate('/learn/dashboard'))}>{step ? t('learn.welcome.back') : t('learn.welcome.skipNow')}</button>
        <button type="button" className="ln-btn ln-btn-primary" onClick={next} disabled={form.saving}>{form.saving ? t('learn.welcome.saving') : step === STEPS.length - 1 ? t('lj.welcome.startCheck') : t('learn.welcome.next')}</button>
      </div>
    </div>
  );
}
