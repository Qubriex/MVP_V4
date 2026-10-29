// src/components/DevBar.js — the thin bar shown on every page during a
// developer session (/dev). Its own colour, never the brand red, so a
// screenshot is never mistaken for the real app. It says which test account
// is open and when the session ends, switches to another test account in one
// click (the /dev unlock is still valid, so no passcode), changes the
// interface language, explains phone view, and ends the session.
// It sits above the learner's phone tab bar and the toasts (styles/ui.css).
// Signed in as a test learner, "Journey" opens the time and state controls:
// move time forward, pass or fail the next check, an employer request, a
// bridge programme, make Ready, scripted or live tutor, reset this learner.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Smartphone, LogOut, SlidersHorizontal } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useUiLang, UI_LANGS } from '../context/UiLangContext';
import { DEV_CARDS, JOURNEY_KEYS, cardFor, journeyFor, isDevLearner, openDevAccount, endDevSession, journeyControl } from '../utils/devAccess';

// Controls whose effect needs fresh data on the page: reload after them.
const RELOAD = new Set(['time', 'request', 'bridge', 'ready', 'tutor']);

function JourneyControls({ accountKey, onClose }) {
  const auth = useAuth();
  const { t } = useUiLang();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { api.get('/dev/journey/me').then(r => setState(r.data)).catch(e => setNote(e?.response?.data?.error?.message || t('devx.toolFailed'))); }, []);
  const run = async (body) => {
    setBusy(body.action + (body.days || body.result || body.mode || '')); setNote('');
    try {
      const out = await journeyControl(body);
      if (out.relogin) {
        await openDevAccount(out.relogin, { login: auth.login, navigate });
        window.location.reload();
        return;
      }
      setNote(out.message);
      setState(s => ({ ...s, controls: out.controls }));
      if (RELOAD.has(body.action)) setTimeout(() => window.location.reload(), 600);
    } catch (e) { setNote(e?.response?.data?.error?.message || t('devx.toolFailed')); }
    setBusy('');
  };
  const c = state?.controls;
  const b = (key, label, body) => (
    <button type="button" onClick={() => run(body)} disabled={!!busy} data-control={key}>{busy === key ? t('devx.working') : label}</button>
  );
  return (
    <div className="dx-bar-pop dx-controls" role="dialog" aria-label={t('devx.controls.title')}>
      <div className="ln-between"><b>{t('devx.controls.title')}</b><button type="button" onClick={onClose}>{t('devx.cancel')}</button></div>
      {c && <span className="dx-controls-state">{t('devx.controls.state', { days: c.time_offset_days, tutor: t(`devx.controls.tutor.${c.tutor}`), next: c.next_check ? t(`devx.controls.next.${c.next_check}`) : '—' })}</span>}
      <span className="dx-controls-label">{t('devx.controls.time')}</span>
      <div className="dx-controls-row">{b('time1', '+1', { action: 'time', days: 1 })}{b('time7', '+7', { action: 'time', days: 7 })}{b('time30', '+30', { action: 'time', days: 30 })}</div>
      <span className="dx-controls-label">{t('devx.controls.nextCheck')}</span>
      <div className="dx-controls-row">{b('next_checkpass', t('devx.controls.pass'), { action: 'next_check', result: 'pass' })}{b('next_checkfail', t('devx.controls.fail'), { action: 'next_check', result: 'fail' })}</div>
      <div className="dx-controls-row">
        {b('request', t('devx.controls.request'), { action: 'request' })}
        {b('bridge', t('devx.controls.bridge'), { action: 'bridge' })}
        {b('ready', t('devx.controls.ready'), { action: 'ready' })}
      </div>
      <span className="dx-controls-label">{t('devx.controls.tutorLabel')}</span>
      <div className="dx-controls-row">{b('tutorscripted', t('devx.controls.tutor.scripted'), { action: 'tutor', mode: 'scripted' })}{b('tutorlive', t('devx.controls.tutor.live'), { action: 'tutor', mode: 'live' })}</div>
      {journeyFor(accountKey) && <div className="dx-controls-row">{b('reset', t('devx.controls.reset'), { action: 'reset' })}</div>}
      {note && <span className="dx-controls-note" role="status">{note}</span>}
    </div>
  );
}

export default function DevBar() {
  const auth = useAuth();
  const { t, lang, setLang, fmtDate } = useUiLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [phoneHelp, setPhoneHelp] = useState(false);
  const [controls, setControls] = useState(false);
  const [error, setError] = useState('');
  const dev = auth?.token ? auth.dev : null;

  useEffect(() => {
    document.body.classList.toggle('has-devbar', !!dev);
    return () => document.body.classList.remove('has-devbar');
  }, [dev]);
  if (!dev) return null;

  const card = cardFor(dev.account_key);
  const stage = journeyFor(dev.account_key);
  const roleName = card ? t(card.label) : stage ? `${stage.stage} · ${t(`devx.stage.${stage.stage}`)}${stage.hindi ? ' (हिन्दी)' : ''}` : dev.account_key;
  const expired = new Date(dev.expires_at).getTime() <= Date.now();
  const switchTo = async (key) => {
    if (!key || key === dev.account_key) return;
    setBusy(true); setError('');
    try { await openDevAccount(key, { login: auth.login, navigate }); } catch (e) { setError(e?.response?.data?.error?.message || t('devx.openFailed')); }
    setBusy(false);
  };

  return (
    <div className="dx-bar" role="region" aria-label={t('devx.barLabel')}>
      <span className="dx-bar-tag"><Wrench size={14} aria-hidden="true" />{t('devx.barTag')}</span>
      <span className="dx-bar-info">
        {t('devx.barRole', { role: roleName })}
        {' · '}
        {expired ? t('devx.barExpired') : t('devx.barExpires', { time: fmtDate(dev.expires_at, { timeStyle: 'short' }) })}
      </span>
      <select className="dx-bar-field" value={dev.account_key} onChange={e => switchTo(e.target.value)} disabled={busy} aria-label={t('devx.switchRole')} title={t('devx.switchRole')}>
        {DEV_CARDS.map(c => <option key={c.key} value={c.key}>{t(c.label)}</option>)}
        <optgroup label={t('devx.journey.title')}>
          {JOURNEY_KEYS.map(j => <option key={j.key} value={j.key}>{`${j.stage} · ${t(`devx.stage.${j.stage}`)}${j.hindi ? ' (हिन्दी)' : ''}`}</option>)}
        </optgroup>
      </select>
      {isDevLearner(dev.account_key) && (
        <span className="dx-bar-phone">
          <button type="button" onClick={() => setControls(v => !v)} aria-expanded={controls} data-dev-controls><SlidersHorizontal size={14} aria-hidden="true" />{t('devx.controls.open')}</button>
          {controls && <JourneyControls accountKey={dev.account_key} onClose={() => setControls(false)} />}
        </span>
      )}
      <span className="dx-bar-langs" role="group" aria-label={t('devx.language')}>
        {UI_LANGS.map(l => (
          <button key={l.id} type="button" className={lang === l.id ? 'is-on' : ''} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
            {l.id === 'english' ? 'EN' : l.label}
          </button>
        ))}
      </span>
      <span className="dx-bar-phone">
        <button type="button" onClick={() => setPhoneHelp(v => !v)} aria-expanded={phoneHelp}><Smartphone size={14} aria-hidden="true" />{t('devx.phoneView')}</button>
        {phoneHelp && <span className="dx-bar-pop" role="note">{t('devx.phoneHelp')}</span>}
      </span>
      <button type="button" className="dx-bar-end" onClick={() => endDevSession({ logout: auth.logout, navigate })}><LogOut size={14} aria-hidden="true" />{t('devx.end')}</button>
      {error && <span className="dx-bar-error" role="alert">{error}</span>}
    </div>
  );
}
