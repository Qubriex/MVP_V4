// src/pages/LearnerLogin.js
// Learner sign-in: learner reference + engagement ID + PIN (unchanged auth),
// with the interface language picked up front. The choice is stored locally
// right away and written to the learner's profile after sign-in.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUiLang, UI_LANGS } from '../context/UiLangContext';
import api from '../utils/api';
import PhoenixMark from '../components/PhoenixMark';

const COPY = {
  telugu: { title: 'లెర్నర్ సైన్ ఇన్', sub: 'మీ సంస్థ ఇచ్చిన వివరాలు వాడండి.', ref: 'లెర్నర్ రిఫరెన్స్ నంబర్', eng: 'జాయిన్ కోడ్', pin: '6 అంకెల PIN', keep: 'ఈ పరికరంలో సైన్ ఇన్‌లో ఉంచండి', go: 'సైన్ ఇన్', lang: 'ఇంటర్‌ఫేస్ భాష' },
  hindi: { title: 'लर्नर साइन इन', sub: 'अपने संस्थान से मिली जानकारी डालें।', ref: 'लर्नर रेफ़रेंस नंबर', eng: 'जॉइन कोड', pin: '6 अंकों का PIN', keep: 'इस डिवाइस पर साइन इन रखें', go: 'साइन इन', lang: 'इंटरफ़ेस भाषा' },
  english: { title: 'Learner sign in', sub: 'Use the details your institution gave you.', ref: 'Learner reference number', eng: 'Join code', pin: '6-digit PIN', keep: 'Keep me signed in on this device', go: 'Sign in', lang: 'Interface language' }
};

export default function LearnerLogin() {
  const [ref, setRef] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [pin, setPin] = useState('');
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState('');
  const [showPinHelp, setShowPinHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { lang, setLang } = useUiLang();
  const navigate = useNavigate();
  const c = COPY[lang];

  const [mustChange, setMustChange] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [resetSent, setResetSent] = useState('');

  // After sign-in (and any PIN change): first-run welcome or the dashboard.
  const enter = async () => {
    // First sign-in (no profile saved yet) goes through the short welcome
    // flow, which saves the interface language with the rest. Otherwise
    // remember the language choice, best effort.
    const profile = await api.get('/learner/profile').then(r => r.data).catch(() => null);
    if (profile && profile.has_profile === false) { navigate('/learn/welcome'); return; }
    api.put('/learner/profile', { ui_language: lang }).catch(() => {});
    navigate('/learn/dashboard');
  };

  // "Forgot PIN?" asks staff to reset it; the reply never says whether the
  // details matched, so it can't be used to probe the roster.
  const requestReset = async () => {
    setResetSent('');
    if (!ref.trim() || !engagementId.trim()) { setResetSent('Enter your learner reference and join code first.'); return; }
    try {
      const res = await api.post('/auth/learner/pin-reset-request', { learner_ref: ref.trim(), join_code: engagementId.trim() });
      setResetSent(res.data.message);
    } catch (e) { setResetSent('Couldn’t send the request. Ask your professor directly.'); }
  };

  const changePin = async (e) => {
    e.preventDefault(); setError('');
    if (!/^\d{6}$/.test(newPin)) return setError('Your PIN must be exactly 6 digits.');
    if (newPin !== newPin2) return setError('The two PINs don’t match.');
    setLoading(true);
    try { await api.put('/learner/pin', { new_pin: newPin }); await enter(); } catch (err) { setError(err.response?.data?.error || 'Couldn’t change your PIN.'); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/learner/login', { learner_ref: ref.trim(), join_code: engagementId.trim(), pin });
      login(res.data.token, res.data.learner, 'learner', { persist: keep });
      if (res.data.must_change_pin) { setMustChange(true); setLoading(false); return; }
      await enter();
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your learner reference, join code and PIN.');
    }
    setLoading(false);
  };

  return (
    <div className="ln-login">
      <aside className="ln-login-aside">
        <span className="ln-brand" style={{ fontSize: 24, padding: 0 }}><PhoenixMark size={36} />Qubirex</span>
        <div className="ln-col ln-hide-phone" style={{ gap: 24 }}>
          <h1 style={{ fontSize: 'clamp(34px, 3vw + 12px, 52px)' }}>Learn in your language.<br />Speak, listen, build.</h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 460 }}>
            Your institution has set a path for you. Professor Qubirex teaches it in Telugu or Hindi, by voice or text, and shows you which jobs your skills open up.
          </p>
          <ul className="ln-col" style={{ gap: 12, paddingTop: 8 }}>
            {['Voice sessions in తెలుగు and हिंदी', 'Job market matched to your skills', 'A resume built from what you have mastered'].map((text, i) => (
              <li key={text} className="ln-row" style={{ gap: 14 }}><span className="ln-login-num">0{i + 1}</span><span className="ln-indic" style={{ fontSize: 15 }}>{text}</span></li>
            ))}
          </ul>
        </div>
        <span className="ln-small ln-hide-phone" style={{ color: 'var(--stage-muted)' }}>Receive. Build. Return.</span>
      </aside>

      <div className="ln-login-main">
        {mustChange ? (
          <form className="ln-login-form" onSubmit={changePin}>
            <div className="ln-col" style={{ gap: 8 }}>
              <h2 style={{ fontSize: 32, fontFamily: 'var(--font-display)' }}>Choose your own PIN</h2>
              <p className="ln-muted">You signed in with a one-time PIN. Pick a 6-digit PIN only you know.</p>
            </div>
            {error && <div className="ln-error" role="alert">{error}</div>}
            <div className="ln-field"><label className="ln-label" htmlFor="np1">New PIN</label>
              <input id="np1" className="ln-input" style={{ minHeight: 48, fontSize: 18, letterSpacing: '0.3em' }} type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} required /></div>
            <div className="ln-field"><label className="ln-label" htmlFor="np2">Type it again</label>
              <input id="np2" className="ln-input" style={{ minHeight: 48, fontSize: 18, letterSpacing: '0.3em' }} type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={newPin2} onChange={e => setNewPin2(e.target.value.replace(/\D/g, ''))} required /></div>
            <button className="ln-btn ln-btn-primary ln-btn-block" type="submit" disabled={loading} style={{ minHeight: 52, fontSize: 16 }}>{loading ? '…' : 'Save PIN and continue'}</button>
          </form>
        ) : (
        <form className="ln-login-form ln-indic" onSubmit={handleSubmit}>
          <div className="ln-col" style={{ gap: 8 }}>
            <h2 style={{ fontSize: 34, fontFamily: 'var(--font-display), var(--font-indic)' }}>{c.title}</h2>
            <p className="ln-muted" style={{ fontSize: 15 }}>{c.sub}</p>
          </div>

          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="ln-label" style={{ marginBottom: 8, padding: 0 }}>{c.lang}</legend>
            <div className="ln-seg">
              {UI_LANGS.map(l => (
                <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => setLang(l.id)} lang={l.bcp47}>{l.label}</button>
              ))}
            </div>
          </fieldset>

          {error && <div className="ln-error" role="alert">{error}</div>}

          <div className="ln-field">
            <label className="ln-label" htmlFor="lref">{c.ref}</label>
            <input id="lref" className="ln-input" style={{ minHeight: 48, fontSize: 15 }} value={ref} onChange={e => setRef(e.target.value)} placeholder="LRNR-001" autoComplete="username" required />
          </div>
          <div className="ln-field">
            <label className="ln-label" htmlFor="leng">{c.eng}</label>
            <input id="leng" className="ln-input" style={{ minHeight: 48, fontSize: 15 }} value={engagementId} onChange={e => setEngagementId(e.target.value)} placeholder="e.g. QX-FSA-7K2" autoCapitalize="characters" required />
          </div>
          <div className="ln-field">
            <div className="ln-between">
              <label className="ln-label" htmlFor="lpin">{c.pin}</label>
              <button type="button" className="ln-link" style={{ fontSize: 13 }} onClick={() => setShowPinHelp(v => !v)} aria-expanded={showPinHelp}>Forgot PIN?</button>
            </div>
            <input id="lpin" className="ln-input" style={{ minHeight: 48, fontSize: 18, letterSpacing: '0.3em' }} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" autoComplete="current-password" required />
            {showPinHelp && (
              <div className="ln-note ln-col" style={{ gap: 8 }}>
                <span>We’ll ask your professor to reset your PIN. Enter your learner reference and join code above, then:</span>
                <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={requestReset}>Ask for a PIN reset</button>
                {resetSent && <span role="status">{resetSent}</span>}
              </div>
            )}
          </div>

          <label className="ln-check"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />{c.keep}</label>

          <button className="ln-btn ln-btn-primary ln-btn-block" type="submit" disabled={loading} style={{ minHeight: 52, fontSize: 16 }}>
            {loading ? '…' : c.go}<ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="ln-small ln-muted" style={{ textAlign: 'center' }}>Are you an institution? <Link to="/login" className="ln-link" style={{ fontSize: 13 }}>Institution login</Link></p>
        </form>
        )}
      </div>
    </div>
  );
}
