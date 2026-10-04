// src/pages/learn/Settings.js — /learn/settings
// Settings, separate from the profile: voice and speech, language, captions,
// low-bandwidth mode, reminders, parent-sharing consent, PIN, active devices,
// and downloading or deleting my data. Voice and language preferences save
// with "Save changes"; everything else acts at once.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Download, Trash2, Smartphone } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, speechTag } from '../../context/UiLangContext';
import { useSpeechOutput } from '../../utils/voice';
import { NAME_OPTIONS } from '../../utils/pronounce';
import { useProfileDraft, Section, LowBandwidthToggle } from '../../components/learn/ProfileSections';
import { errMsg } from '../../utils/errors';

const UI_LANGS = [{ id: 'telugu', label: 'తెలుగు' }, { id: 'hindi', label: 'हिंदी' }, { id: 'english', label: 'English' }];
const when = (t) => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

function VoiceAndLanguage({ form, language }) {
  const { setLang } = useUiLang();
  const { draft, set } = form;
  const prefs = draft.voice_prefs || {};
  const setPref = (k, v) => set('voice_prefs', { ...prefs, [k]: v });
  const tag = speechTag(language);
  const speech = useSpeechOutput({ lang: tag, rate: prefs.rate || 1 });
  const lang2 = tag.slice(0, 2);
  const sample = language === 'hindi' ? 'नमस्ते! मैं प्रोफ़ेसर Qubirex हूँ। आज हम साथ में सीखेंगे।' : 'నమస్కారం! నేను ప్రొఫెసర్ Qubirex. ఈ రోజు మనం కలిసి నేర్చుకుందాం.';
  return (
    <Section id="voice" title="Voice and language">
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <div className="ln-field"><span className="ln-label">Professor’s voice</span>
          <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => speech.speak(sample, 'preview')}><Play size={12} aria-hidden="true" />Hear Professor Qubirex</button>
          <span className="ln-xs ln-muted">One female voice for every lesson and reply.</span></div>
        <div className="ln-field"><span className="ln-label" id="rate-pick">Speaking speed</span>
          <div className="ln-seg" role="group" aria-labelledby="rate-pick">
            {[0.8, 1, 1.2].map(r => <button key={r} type="button" aria-pressed={(prefs.rate || 1) === r} onClick={() => setPref('rate', r)}>{r.toFixed(1)}×</button>)}
          </div></div>
        <div className="ln-field"><span className="ln-label">Teaching language</span>
          <span className="ln-tile ln-indic" style={{ fontSize: 14, padding: '12px 14px' }}>{language === 'hindi' ? 'हिंदी' : 'తెలుగు'} <span className="ln-muted">· set by your institution</span></span></div>
        <div className="ln-field"><span className="ln-label" id="ui-lang">Interface language</span>
          <div className="ln-seg ln-indic" role="group" aria-labelledby="ui-lang">
            {UI_LANGS.map(l => <button key={l.id} type="button" aria-pressed={draft.ui_language === l.id} onClick={() => { set('ui_language', l.id); setLang(l.id); }}>{l.label}</button>)}
          </div></div>
      </div>
      <div className="ln-col" style={{ gap: 6 }}>
        <label className="ln-toggle-row"><span>Start sessions in voice mode</span><input type="checkbox" checked={prefs.startInVoice !== false} onChange={e => setPref('startInVoice', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span className="ln-col" style={{ gap: 2 }}><span>Hands-free</span><span className="ln-xs ln-muted">After she finishes speaking, the microphone opens by itself (with a short sound). Start talking while she speaks to interrupt her.</span></span><input type="checkbox" checked={!!prefs.handsFree} onChange={e => setPref('handsFree', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span>Show English captions under {language === 'hindi' ? 'Hindi' : 'Telugu'} speech</span><input type="checkbox" checked={prefs.showEnglishCaptions !== false} onChange={e => setPref('showEnglishCaptions', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span>Daily study reminder</span><input type="checkbox" checked={!!prefs.dailyReminder} onChange={e => setPref('dailyReminder', e.target.checked)} /></label>
        <LowBandwidthToggle />
      </div>
      {NAME_OPTIONS[lang2] && (
        <details className="ln-tile" style={{ padding: 12 }}>
          <summary className="ln-small" style={{ cursor: 'pointer' }}>How should she say “Qubirex”? Listen to three spellings</summary>
          <div className="ln-row ln-wrap" style={{ gap: 8, paddingTop: 10 }}>
            {NAME_OPTIONS[lang2].map((n, i) => (
              <button key={n} type="button" className="ln-btn ln-btn-sm ln-indic" onClick={() => speech.speak(`${language === 'hindi' ? 'नमस्ते, मैं प्रोफ़ेसर' : 'నమస్కారం, నేను ప్రొఫెసర్'} ${n}.`, `name-${i}`, { quiet: true })}>
                <Play size={12} aria-hidden="true" />{i + 1}. {n}
              </button>
            ))}
          </div>
          <span className="ln-xs ln-muted">Option 1 is in use. Tell your institution if another one sounds right.</span>
        </details>
      )}
    </Section>
  );
}

function Privacy({ settings, reload }) {
  const [busy, setBusy] = useState(false);
  const toggle = async (on) => { setBusy(true); try { await api.put('/learner/consents/parent-share', { on }); await reload(); } catch { /* shown by reload */ } setBusy(false); };
  return (
    <Section id="privacy" title="Sharing and consent">
      <label className="ln-toggle-row" style={{ alignItems: 'flex-start' }}>
        <span className="ln-col" style={{ gap: 2 }}><span>My institution may share my progress report with my parents or guardians</span>
          <span className="ln-xs ln-muted">The report shows attendance, skills passed or stuck and readiness. It never includes what you said in sessions or how your answers were marked.{settings.parent_share.on && settings.parent_share.since ? ` On since ${when(settings.parent_share.since)}.` : ''}</span></span>
        <input type="checkbox" disabled={busy} checked={settings.parent_share.on} onChange={e => toggle(e.target.checked)} />
      </label>
      {settings.age_status === 'minor' && <span className="ln-xs ln-muted">You are registered as under 18, so your parent or guardian’s consent also applies.</span>}
    </Section>
  );
}

function Security({ settings, reload }) {
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [msg, setMsg] = useState('');
  const changePin = async (e) => {
    e.preventDefault(); setMsg('');
    if (!/^\d{6}$/.test(pin)) { setMsg('Your new PIN must be exactly 6 digits.'); return; }
    if (pin !== pin2) { setMsg('The two new PINs do not match.'); return; }
    try { await api.put('/learner/pin', { current_pin: current, new_pin: pin }); setCurrent(''); setPin(''); setPin2(''); setMsg('PIN changed. Your other devices were signed out.'); reload(); } catch (err) { setMsg(errMsg(err, 'Couldn’t change your PIN.')); }
  };
  const signOut = async (id) => { try { await (id ? api.delete(`/learner/devices/${id}`) : api.post('/learner/devices/sign-out-others')); reload(); } catch { /* ignore */ } };
  const others = settings.devices.filter(d => !d.current);
  return (
    <Section id="security" title="PIN and devices">
      <form className="ln-col" style={{ gap: 10, maxWidth: 420 }} onSubmit={changePin}>
        <span className="ln-label">Change your PIN</span>
        <input className="ln-input" type="password" inputMode="numeric" autoComplete="current-password" placeholder="Current PIN" maxLength={6} value={current} onChange={e => setCurrent(e.target.value.replace(/\D/g, ''))} aria-label="Current PIN" />
        <input className="ln-input" type="password" inputMode="numeric" autoComplete="new-password" placeholder="New 6-digit PIN" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} aria-label="New PIN" />
        <input className="ln-input" type="password" inputMode="numeric" autoComplete="new-password" placeholder="New PIN again" maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} aria-label="New PIN again" />
        <button type="submit" className="ln-btn" style={{ alignSelf: 'flex-start' }} disabled={!current || !pin}>Change PIN</button>
        {msg && <span className="ln-small" role="status">{msg}</span>}
      </form>
      <div className="ln-col" style={{ gap: 8 }}>
        <span className="ln-label">Signed-in devices</span>
        <span className="ln-xs ln-muted">Your account works on one device at a time. Signing in on a new device signs out the old one.</span>
        {settings.devices.map(d => (
          <div key={d.id} className="ln-tile" style={{ padding: '10px 12px', gap: 10, flexDirection: 'row', alignItems: 'center', textAlign: 'left' }}>
            <Smartphone size={16} aria-hidden="true" />
            <span className="ln-col" style={{ flex: 1, gap: 2 }}><b style={{ fontSize: 14 }}>{d.device}{d.current ? ' · this device' : ''}</b><span className="ln-xs ln-muted">{[d.city, `signed in ${when(d.signed_in_at)}`].filter(Boolean).join(' · ')}</span></span>
            {!d.current && <button type="button" className="ln-btn ln-btn-sm" onClick={() => signOut(d.id)}>Sign out</button>}
          </div>
        ))}
        {others.length > 1 && <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => signOut(null)}>Sign out all other devices</button>}
      </div>
    </Section>
  );
}

function MyData({ settings, reload }) {
  const [msg, setMsg] = useState('');
  const download = async () => {
    try {
      const r = await api.get('/learner/my-data', { responseType: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'qubirex-my-data.json'; a.click();
    } catch (e) { setMsg(errMsg(e, 'Couldn’t prepare your data.')); }
  };
  const requestDelete = async () => {
    if (!window.confirm('Ask your institution to delete your Qubirex data? Your progress and record would be lost. They will contact you first.')) return;
    try { const r = await api.post('/learner/delete-request', {}); setMsg(r.data.message); reload(); } catch (e) { setMsg(errMsg(e, 'Couldn’t send the request.')); }
  };
  return (
    <Section id="data" title="Your data">
      <div className="ln-row ln-wrap" style={{ gap: 10 }}>
        <button type="button" className="ln-btn" onClick={download}><Download size={16} aria-hidden="true" />Download my data</button>
        <button type="button" className="ln-btn" style={{ color: 'var(--status-danger)' }} onClick={requestDelete} disabled={!!settings.deletion_requested_at}><Trash2 size={16} aria-hidden="true" />{settings.deletion_requested_at ? 'Deletion requested' : 'Ask to delete my data'}</button>
      </div>
      <span className="ln-xs ln-muted">The download has your profile, sessions and your own messages, skills, reviews, consents and sign-ins, in one file.{settings.deletion_requested_at ? ` Deletion was requested on ${when(settings.deletion_requested_at)}; your institution will contact you.` : ''}</span>
      {msg && <span className="ln-small" role="status">{msg}</span>}
    </Section>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const form = useProfileDraft();
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const reload = () => api.get('/learner/settings').then(r => { setSettings(r.data); setError(''); }).catch(e => setError(errMsg(e, 'Couldn’t load your settings.')));
  useEffect(() => { reload(); }, []); // eslint-disable-line
  const language = user?.language || form.draft?.language || 'telugu';

  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Settings</h1><span className="ln-sub">Voice, language, sharing, PIN, devices and your data.</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-col" style={{ gap: 20, maxWidth: 860 }}>
        {form.draft ? <VoiceAndLanguage form={form} language={language} /> : <div className="ln-card ln-skeleton" style={{ height: 220 }} aria-hidden="true" />}
        {form.dirty && (
          <div className="ln-row ln-wrap" style={{ justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, padding: '12px 0', background: 'var(--color-bg)', zIndex: 2 }}>
            {form.status && form.status !== 'saved' && <span className="ln-small" style={{ color: 'var(--status-danger)' }} role="alert">{form.status}</span>}
            <button type="button" className="ln-btn" onClick={form.discard} disabled={form.saving}>Discard</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={form.save} disabled={form.saving}>{form.saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        )}
        {form.status === 'saved' && !form.dirty && <span className="ln-small" style={{ color: 'var(--status-success)' }} role="status">Saved</span>}
        {settings ? (
          <>
            <Privacy settings={settings} reload={reload} />
            <Security settings={settings} reload={reload} />
            <MyData settings={settings} reload={reload} />
          </>
        ) : !error && <div className="ln-card ln-skeleton" style={{ height: 320 }} aria-hidden="true" />}
        <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { logout(); navigate('/learner-login'); }}>Sign out of this device</button>
      </div>
    </>
  );
}
