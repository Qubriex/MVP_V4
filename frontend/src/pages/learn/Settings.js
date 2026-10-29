// src/pages/learn/Settings.js — /learn/settings
// Settings, separate from the profile: voice and speech, language, captions,
// low-bandwidth mode, reminders, parent-sharing consent, PIN, active devices,
// and downloading or deleting my data. Voice and language preferences save
// with "Save changes"; everything else acts at once.
import React, { useEffect, useState } from 'react';
import { CONTACT } from '../../config/contact';
import { useNavigate } from 'react-router-dom';
import { Play, Download, Trash2, Smartphone } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, speechTag, uiLocale } from '../../context/UiLangContext';
import { useSpeechOutput } from '../../utils/voice';
import { NAME_OPTIONS } from '../../utils/pronounce';
import { useProfileDraft, Section, LowBandwidthToggle } from '../../components/learn/ProfileSections';
import { errMsg } from '../../utils/errors';

const UI_LANGS = [{ id: 'telugu', label: 'తెలుగు' }, { id: 'hindi', label: 'हिंदी' }, { id: 'english', label: 'English' }];
const when = (t) => (t ? new Date(t).toLocaleString(uiLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

function VoiceAndLanguage({ form, language }) {
  const { t } = useUiLang();
  const { setLang } = useUiLang();
  const { draft, set } = form;
  const prefs = draft.voice_prefs || {};
  const setPref = (k, v) => set('voice_prefs', { ...prefs, [k]: v });
  const tag = speechTag(language);
  const speech = useSpeechOutput({ lang: tag, rate: prefs.rate || 1 });
  const lang2 = tag.slice(0, 2);
  const sample = language === 'hindi' ? 'नमस्ते! मैं प्रोफ़ेसर Qubirex हूँ। आज हम साथ में सीखेंगे।' : 'నమస్కారం! నేను ప్రొఫెసర్ Qubirex. ఈ రోజు మనం కలిసి నేర్చుకుందాం.';
  return (
    <Section id="voice" title={t('learn.settings.voiceLanguage')}>
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <div className="ln-field"><span className="ln-label">{t('learn.settings.professorSVoice')}</span>
          <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => speech.speak(sample, 'preview')}><Play size={12} aria-hidden="true" />{t('learn.settings.hearProfessorQubirex')}</button>
          <span className="ln-xs ln-muted">{t('learn.settings.oneFemaleVoiceEvery')}</span></div>
        <div className="ln-field"><span className="ln-label" id="rate-pick">{t('learn.settings.speakingSpeed')}</span>
          <div className="ln-seg" role="group" aria-labelledby="rate-pick">
            {[0.8, 1, 1.2].map(r => <button key={r} type="button" aria-pressed={(prefs.rate || 1) === r} onClick={() => setPref('rate', r)}>{r.toFixed(1)}×</button>)}
          </div></div>
        <div className="ln-field"><span className="ln-label">{t('learn.settings.teachingLanguage')}</span>
          <span className="ln-tile ln-indic" style={{ fontSize: 'var(--fs-body)', padding: '12px 14px' }}>{language === 'hindi' ? 'हिंदी' : 'తెలుగు'} <span className="ln-muted">{t('learn.settings.setByInstitution')}</span></span></div>
        <div className="ln-field"><span className="ln-label" id="ui-lang">{t('learn.settings.interfaceLanguage')}</span>
          <div className="ln-seg ln-indic" role="group" aria-labelledby="ui-lang">
            {UI_LANGS.map(l => <button key={l.id} type="button" aria-pressed={draft.ui_language === l.id} onClick={() => { set('ui_language', l.id); setLang(l.id); }}>{l.label}</button>)}
          </div></div>
      </div>
      <div className="ln-col" style={{ gap: 6 }}>
        <label className="ln-toggle-row"><span>{t('learn.settings.startSessionsVoiceMode')}</span><input type="checkbox" checked={prefs.startInVoice !== false} onChange={e => setPref('startInVoice', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span className="ln-col" style={{ gap: 2 }}><span>{t('learn.settings.handsFree')}</span><span className="ln-xs ln-muted">{t('learn.settings.afterSheFinishesSpeaking')}</span></span><input type="checkbox" checked={!!prefs.handsFree} onChange={e => setPref('handsFree', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span>{t('learn.settings.showEnglishCaptionsUnder')}{' '} {language === 'hindi' ? t('learn.settings.hindi') : t('learn.settings.telugu')} {' '}{t('learn.settings.speech')}</span><input type="checkbox" checked={prefs.showEnglishCaptions !== false} onChange={e => setPref('showEnglishCaptions', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span>{t('learn.settings.dailyStudyReminder')}</span><input type="checkbox" checked={!!prefs.dailyReminder} onChange={e => setPref('dailyReminder', e.target.checked)} /></label>
        <LowBandwidthToggle />
      </div>
      {NAME_OPTIONS[lang2] && (
        <details className="ln-tile" style={{ padding: 12 }}>
          <summary className="ln-small" style={{ cursor: 'pointer' }}>{t('learn.settings.howShouldSheSay')}</summary>
          <div className="ln-row ln-wrap" style={{ gap: 8, paddingTop: 10 }}>
            {NAME_OPTIONS[lang2].map((n, i) => (
              <button key={n} type="button" className="ln-btn ln-btn-sm ln-indic" onClick={() => speech.speak(`${language === 'hindi' ? 'नमस्ते, मैं प्रोफ़ेसर' : 'నమస్కారం, నేను ప్రొఫెసర్'} ${n}.`, `name-${i}`, { quiet: true })}>
                <Play size={12} aria-hidden="true" />{i + 1}. {n}
              </button>
            ))}
          </div>
          <span className="ln-xs ln-muted">{t('learn.settings.option1UseTell')}</span>
        </details>
      )}
    </Section>
  );
}

function Privacy({ settings, reload }) {
  const { t } = useUiLang();
  const [busy, setBusy] = useState(false);
  const toggle = async (on) => { setBusy(true); try { await api.put('/learner/consents/parent-share', { on }); await reload(); } catch { /* shown by reload */ } setBusy(false); };
  const findable = async (on) => { setBusy(true); try { await api.put('/learner/discoverable', { on }); await reload(); } catch { /* shown by reload */ } setBusy(false); };
  return (
    <Section id="privacy" title={t('learn.settings.sharingConsent')}>
      <label className="ln-toggle-row" style={{ alignItems: 'flex-start' }}>
        <span className="ln-col" style={{ gap: 2 }}><span>{t('learn.settings.myInstitutionMayShare')}</span>
          <span className="ln-xs ln-muted">{t('learn.settings.reportShowsAttendanceSkills')}{settings.parent_share.on && settings.parent_share.since ? ` ${t('learn.settings.onSince', { date: when(settings.parent_share.since) })}` : ''}</span></span>
        <input type="checkbox" disabled={busy} checked={settings.parent_share.on} onChange={e => toggle(e.target.checked)} />
      </label>
      <label className="ln-toggle-row" style={{ alignItems: 'flex-start' }}>
        <span className="ln-col" style={{ gap: 2 }}><span>{t('learn.settings.letVerifiedEmployersFind')}</span>
          <span className="ln-xs ln-muted">{t('learn.settings.theySeeVerifiedSkills')}</span></span>
        <input type="checkbox" disabled={busy} checked={settings.discoverable} onChange={e => findable(e.target.checked)} />
      </label>
      <div className="ln-note" role="note">
        <b>{t('learn.settings.under18')}</b> {' '}{t('learn.settings.parentGuardianMustAgree')}{' '} {settings.age_status === 'minor' ? t('learn.settings.registeredAsUnder18') : t('learn.settings.tellCollegeIfUnder')}
      </div>
    </Section>
  );
}

const CHANNELS = [['in_app', 'learn.settings.channels.inTheApp', true], ['email', 'learn.settings.channels.email'], ['whatsapp', 'learn.settings.channels.whatsapp'], ['sms', 'SMS']];
function Alerts() {
  const { t } = useUiLang();
  const [ch, setCh] = useState(null);
  useEffect(() => { api.get('/notifications').then(r => setCh(r.data.channels || {})).catch(() => setCh({})); }, []);
  const set = async (k, on) => { const next = { ...ch, [k]: on }; setCh(next); try { await api.put('/notifications/channels', next); } catch { /* kept locally */ } };
  return (
    <Section id="alerts" title={t('learn.settings.alerts')}>
      <span className="ln-xs ln-muted">{t('learn.settings.whereWeTellAbout')}</span>
      {ch && CHANNELS.map(([k, label, fixed]) => (
        <label key={k} className="ln-toggle-row"><span>{t(label)}{(k === 'whatsapp' || k === 'sms') && <span className="ln-xs ln-muted"> {' '}{t('learn.settings.startsWhenCollegeTurns')}</span>}</span>
          <input type="checkbox" checked={fixed ? true : !!ch[k]} disabled={fixed} onChange={e => set(k, e.target.checked)} /></label>
      ))}
    </Section>
  );
}

function Grievance() {
  const { t } = useUiLang();
  return (
    <Section id="grievance" title={t('learn.settings.questionsComplaintsAboutData')}>
      <span className="ln-small">{t('learn.settings.grievanceOfficer')}{' '} <b>{CONTACT.grievanceOfficer || t('contact.officerRole')}</b> · <a className="ln-link" href={`mailto:${CONTACT.grievance}`}>{CONTACT.grievance}</a></span>
      <span className="ln-xs ln-muted">{t('learn.settings.weReplyWithin7')}</span>
    </Section>
  );
}

function Security({ settings, reload }) {
  const { t } = useUiLang();
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [msg, setMsg] = useState('');
  const changePin = async (e) => {
    e.preventDefault(); setMsg('');
    if (!/^\d{6}$/.test(pin)) { setMsg(t('learn.settings.newPinMustExactly')); return; }
    if (pin !== pin2) { setMsg(t('learn.settings.twoNewPinsDo')); return; }
    try { await api.put('/learner/pin', { current_pin: current, new_pin: pin }); setCurrent(''); setPin(''); setPin2(''); setMsg(t('learn.settings.pinChangedOtherDevices')); reload(); } catch (err) { setMsg(errMsg(err, t('learn.settings.couldnTChangePin'))); }
  };
  const signOut = async (id) => { try { await (id ? api.delete(`/learner/devices/${id}`) : api.post('/learner/devices/sign-out-others')); reload(); } catch { /* ignore */ } };
  const others = settings.devices.filter(d => !d.current);
  return (
    <Section id="security" title={t('learn.settings.pinDevices')}>
      <form className="ln-col" style={{ gap: 10, maxWidth: 420 }} onSubmit={changePin}>
        <span className="ln-label">{t('learn.settings.changePin')}</span>
        <input className="ln-input" type="password" inputMode="numeric" autoComplete="current-password" placeholder={t('learn.settings.currentPin')} maxLength={6} value={current} onChange={e => setCurrent(e.target.value.replace(/\D/g, ''))} aria-label={t('learn.settings.currentPin')} />
        <input className="ln-input" type="password" inputMode="numeric" autoComplete="new-password" placeholder={t('learn.settings.new6DigitPin')} maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} aria-label={t('learn.settings.newPin')} />
        <input className="ln-input" type="password" inputMode="numeric" autoComplete="new-password" placeholder={t('learn.settings.newPinAgain')} maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} aria-label={t('learn.settings.newPinAgain')} />
        <button type="submit" className="ln-btn" style={{ alignSelf: 'flex-start' }} disabled={!current || !pin}>{t('learn.settings.changePin2')}</button>
        {msg && <span className="ln-small" role="status">{msg}</span>}
      </form>
      <div className="ln-col" style={{ gap: 8 }}>
        <span className="ln-label">{t('learn.settings.signedDevices')}</span>
        <span className="ln-xs ln-muted">{t('learn.settings.accountWorksOneDevice')}</span>
        {settings.devices.map(d => (
          <div key={d.id} className="ln-tile" style={{ padding: '10px 12px', gap: 10, flexDirection: 'row', alignItems: 'center', textAlign: 'left' }}>
            <Smartphone size={16} aria-hidden="true" />
            <span className="ln-col" style={{ flex: 1, gap: 2 }}><b style={{ fontSize: 'var(--fs-body)' }}>{d.device}{d.current ? t('learn.settings.thisDevice') : ''}</b><span className="ln-xs ln-muted">{[d.city, `signed in ${when(d.signed_in_at)}`].filter(Boolean).join(' · ')}</span></span>
            {!d.current && <button type="button" className="ln-btn ln-btn-sm" onClick={() => signOut(d.id)}>{t('learn.settings.signOut')}</button>}
          </div>
        ))}
        {others.length > 1 && <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => signOut(null)}>{t('learn.settings.signOutAllOther')}</button>}
      </div>
    </Section>
  );
}

function MyData() {
  const { t } = useUiLang();
  const [msg, setMsg] = useState('');
  const [del, setDel] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/learner/account-deletion').then(r => setDel(r.data)).catch(() => setDel({ status: 'none' })); }, []);
  // Saves a real file: the server names it, the browser keeps it.
  const download = async () => {
    setMsg('');
    try {
      const r = await api.get('/learner/my-data', { responseType: 'blob' });
      const name = /filename="([^"]+)"/.exec(r.headers?.['content-disposition'] || '')?.[1] || 'qubirex-my-data.json';
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg(t('lj.settings.downloaded', { name }));
    } catch (e) { setMsg(errMsg(e, t('learn.settings.couldnTPrepareData'))); }
  };
  const step = async (path, body) => {
    setBusy(true); setMsg('');
    try { setDel((await api.post(`/learner/account-deletion/${path}`, body || {})).data); setCode(''); } catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };
  return (
    <Section id="data" title={t('learn.settings.yourData')}>
      <div className="ln-row ln-wrap" style={{ gap: 10 }}>
        <button type="button" className="ln-btn" onClick={download} data-download-data><Download size={16} aria-hidden="true" />{t('learn.settings.downloadMyData')}</button>
      </div>
      <span className="ln-xs ln-muted">{t('learn.settings.downloadHasProfileSessions')}</span>

      <div className="ln-col lj-delete" style={{ gap: 8 }} data-delete-state={del?.status || 'loading'}>
        <b>{t('lj.settings.deleteTitle')}</b>
        {del?.status === 'scheduled' ? (
          <>
            <span className="ln-small">{t('lj.settings.deleteScheduled', { date: when(del.purge_after) })}</span>
            <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => step('cancel')} disabled={busy}>{t('lj.settings.deleteCancel')}</button>
          </>
        ) : del?.status === 'otp_sent' ? (
          <>
            <span className="ln-small">{del.sent_to ? t('lj.settings.codeSentTo', { to: del.sent_to }) : t('lj.settings.codeSent')}</span>
            {del.dev_code && <span className="ln-xs ln-muted">{t('lj.settings.testCode', { code: del.dev_code })}</span>}
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <input className="ln-input" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} aria-label={t('lj.settings.codeLabel')} placeholder="000000" style={{ width: 120 }} />
              <button type="button" className="ln-btn ln-btn-sm" style={{ color: 'var(--status-danger)' }} onClick={() => step('confirm', { otp: code })} disabled={busy || code.length !== 6}>{t('lj.settings.deleteConfirm')}</button>
              <button type="button" className="ln-btn ln-btn-sm ln-btn-ghost" onClick={() => step('cancel')} disabled={busy}>{t('lj.settings.deleteCancel')}</button>
            </div>
          </>
        ) : (
          <>
            <span className="ln-small ln-muted">{t('lj.settings.deleteHow')}</span>
            <button type="button" className="ln-btn ln-btn-sm" style={{ color: 'var(--status-danger)', alignSelf: 'flex-start' }} onClick={() => step('request')} disabled={busy || !del}><Trash2 size={16} aria-hidden="true" />{t('lj.settings.deleteStart')}</button>
          </>
        )}
      </div>
      {msg && <span className="ln-small" role="status">{msg}</span>}
    </Section>
  );
}

export default function Settings() {
  const { t } = useUiLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const form = useProfileDraft();
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const reload = () => api.get('/learner/settings').then(r => { setSettings(r.data); setError(''); }).catch(e => setError(errMsg(e, t('learn.settings.couldnTLoadSettings'))));
  useEffect(() => { reload(); }, []); // eslint-disable-line
  const language = user?.language || form.draft?.language || 'telugu';

  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('learn.settings.settings')}</h1><span className="ln-sub">{t('learn.settings.accountPrivacyVoiceLanguage')}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ui-narrow ln-col" style={{ gap: 20 }}>
        {form.draft ? <VoiceAndLanguage form={form} language={language} /> : <div className="ln-card ln-skeleton" style={{ height: 220 }} aria-hidden="true" />}
        {form.dirty && (
          <div className="ln-row ln-wrap" style={{ justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, padding: '12px 0', background: 'var(--color-bg)', zIndex: 2 }}>
            {form.status && form.status !== 'saved' && <span className="ln-small" style={{ color: 'var(--status-danger)' }} role="alert">{form.status}</span>}
            <button type="button" className="ln-btn" onClick={form.discard} disabled={form.saving}>{t('learn.settings.discard')}</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={form.save} disabled={form.saving}>{form.saving ? t('learn.settings.saving') : t('learn.settings.saveChanges')}</button>
          </div>
        )}
        {form.status === 'saved' && !form.dirty && <span className="ln-small" style={{ color: 'var(--status-success)' }} role="status">{t('learn.settings.saved')}</span>}
        {settings ? (
          <>
            <Privacy settings={settings} reload={reload} />
            <Security settings={settings} reload={reload} />
            <Alerts />
            <MyData />
            <Grievance />
          </>
        ) : !error && <div className="ln-card ln-skeleton" style={{ height: 320 }} aria-hidden="true" />}
        <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { logout(); navigate('/learner-login'); }}>{t('learn.settings.signOutDevice')}</button>
      </div>
    </>
  );
}
