// src/components/DevBar.js — the thin bar shown on every page during a
// developer session (/dev). Its own colour, never the brand red, so a
// screenshot is never mistaken for the real app. It says which test account
// is open and when the session ends, switches to another test account in one
// click (the /dev unlock is still valid, so no passcode), changes the
// interface language, explains phone view, and ends the session.
// It sits above the learner's phone tab bar and the toasts (styles/ui.css).
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Smartphone, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUiLang, UI_LANGS } from '../context/UiLangContext';
import { DEV_CARDS, cardFor, openDevAccount, endDevSession } from '../utils/devAccess';

export default function DevBar() {
  const auth = useAuth();
  const { t, lang, setLang, fmtDate } = useUiLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [phoneHelp, setPhoneHelp] = useState(false);
  const [error, setError] = useState('');
  const dev = auth?.token ? auth.dev : null;

  useEffect(() => {
    document.body.classList.toggle('has-devbar', !!dev);
    return () => document.body.classList.remove('has-devbar');
  }, [dev]);
  if (!dev) return null;

  const card = cardFor(dev.account_key);
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
        {t('devx.barRole', { role: card ? t(card.label) : dev.account_key })}
        {' · '}
        {expired ? t('devx.barExpired') : t('devx.barExpires', { time: fmtDate(dev.expires_at, { timeStyle: 'short' }) })}
      </span>
      <select className="dx-bar-field" value={dev.account_key} onChange={e => switchTo(e.target.value)} disabled={busy} aria-label={t('devx.switchRole')} title={t('devx.switchRole')}>
        {DEV_CARDS.map(c => <option key={c.key} value={c.key}>{t(c.label)}</option>)}
      </select>
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
