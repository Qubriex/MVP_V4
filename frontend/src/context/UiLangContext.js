// src/context/UiLangContext.js
// Interface language for every side: english | telugu | hindi. Set from the
// switch in the top bar (public site and portals) or the learner sign-in
// page, kept in localStorage across pages and reloads, and saved to the
// learner's profile (ui_language) once signed in. It sets <html lang>. It only
// changes the app's labels; the TEACHING language is set by the institution
// per engagement and never changes here. First visit: English.
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from '../i18n/en.json';
import te from '../i18n/te.json';
import hi from '../i18n/hi.json';

const STORAGE_KEY = 'qubirex_ui_lang';
export const UI_LANGS = [
  { id: 'telugu', label: 'తెలుగు', bcp47: 'te-IN' },
  { id: 'hindi', label: 'हिंदी', bcp47: 'hi-IN' },
  { id: 'english', label: 'English', bcp47: 'en-IN' }
];

// Interface strings live in src/i18n/{en,te,hi}.json — one flat key per
// string. A key missing in Telugu or Hindi falls back to English.
const DICTS = { english: en, telugu: te, hindi: hi };
export const LANG_CODE = { english: 'en', telugu: 'te', hindi: 'hi' };

const UiLangContext = createContext(null);

function loadInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (UI_LANGS.some(l => l.id === saved)) return saved;
  } catch (e) { /* storage blocked — fall through */ }
  return 'english';
}

export function UiLangProvider({ children }) {
  const [lang, setLangState] = useState(loadInitial);

  const setLang = useCallback((next) => {
    if (!UI_LANGS.some(l => l.id === next)) return;
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
  }, []);

  // The page language follows the switch (screen readers, fonts, hyphenation).
  useEffect(() => { document.documentElement.setAttribute('lang', LANG_CODE[lang] || 'en'); }, [lang]);

  // t('home.title') or t('jobs.short', { n: 3 }) → "{n}" replaced.
  const t = useCallback((key, vars) => {
    const raw = DICTS[lang]?.[key] ?? en[key] ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)) : raw;
  }, [lang]);

  return <UiLangContext.Provider value={{ lang, setLang, t }}>{children}</UiLangContext.Provider>;
}

export const useUiLang = () => useContext(UiLangContext);

// BCP-47 tag for the learner's TEACHING language (speech in and out).
export const speechTag = (language) => (language === 'hindi' ? 'hi-IN' : language === 'english' ? 'en-IN' : 'te-IN');
