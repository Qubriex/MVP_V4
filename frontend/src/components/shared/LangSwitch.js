// src/components/shared/LangSwitch.js — the one language switch used on every
// page (public header, sign-in pages, portal top bar). Desktop shows
// "EN · తెలుగు · हिंदी"; below 640 px it folds into a globe button with a
// short menu (full keeps the row, e.g. inside the phone menu). Both drive the
// same UiLangContext state.
import React, { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';

export const LANGS = [['english', 'EN', 'English', 'en'], ['telugu', 'తెలుగు', 'తెలుగు', 'te'], ['hindi', 'हिंदी', 'हिंदी', 'hi']];

export default function LangSwitch({ className = '', full = false }) {
  const { lang, setLang, t } = useUiLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const cur = LANGS.find(l => l[0] === lang) || LANGS[0];
  return (
    <div className={`ui-lang ${full ? 'is-full' : ''} ${className}`} ref={ref}>
      <div className="pb-langs ui-lang-full" role="group" aria-label={t('lang.label')}>
        {LANGS.map(([k, short, name, code]) => (
          <button key={k} type="button" lang={code} className={`ln-indic ${lang === k ? 'is-on' : ''}`} aria-pressed={lang === k} aria-label={name} onClick={() => setLang(k)}>{short}</button>
        ))}
      </div>
      <button type="button" className="in-iconbtn ui-lang-globe" aria-haspopup="true" aria-expanded={open} aria-label={`${t('lang.label')}: ${cur[2]}`} onClick={() => setOpen(o => !o)}>
        <Globe size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="ui-lang-menu" role="menu" aria-label={t('lang.label')}>
          {LANGS.map(([k, , name, code]) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={lang === k} lang={code} className="ln-indic" onClick={() => { setLang(k); setOpen(false); }}>
              <span>{name}</span>{lang === k && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
