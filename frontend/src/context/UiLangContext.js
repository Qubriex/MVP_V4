// src/context/UiLangContext.js
// Interface language for every side: english | telugu | hindi. Set from the
// shared switch (public header, sign-in pages, portal top bar), kept in
// localStorage across pages and reloads, and saved to the learner's profile
// (ui_language) once signed in. It sets <html lang>. It only changes the app's
// labels; the TEACHING language is set by the institution
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

// Translate in a given interface language (e.g. a report printed in Hindi
// while the screen is in English).
export function translate(lang, key, vars) {
  const raw = DICTS[lang]?.[key] ?? en[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)) : raw;
}

// Dates and numbers follow the interface language through Intl.
const LOCALE = { english: 'en-IN', telugu: 'te-IN', hindi: 'hi-IN' };
// The current interface locale for module-level formatters (kept in step with
// setLang, before React re-renders).
let current = 'english';
export const uiLocale = () => LOCALE[current] || 'en-IN';
export const formatDate = (lang, value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(LOCALE[lang] || 'en-IN', opts).format(d);
};
export const formatNumber = (lang, n, opts) => (n == null ? '' : new Intl.NumberFormat(LOCALE[lang] || 'en-IN', opts).format(n));

function loadInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (UI_LANGS.some(l => l.id === saved)) return saved;
  } catch (e) { /* storage blocked — fall through */ }
  return 'english';
}

export function UiLangProvider({ children }) {
  const [lang, setLangState] = useState(() => { current = loadInitial(); return current; });

  const setLang = useCallback((next) => {
    if (!UI_LANGS.some(l => l.id === next)) return;
    current = next;
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
  }, []);

  // The page language follows the switch (screen readers, fonts, hyphenation).
  useEffect(() => { document.documentElement.setAttribute('lang', LANG_CODE[lang] || 'en'); }, [lang]);

  // t('home.title') or t('jobs.short', { n: 3 }) → "{n}" replaced.
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const fmtDate = useCallback((value, opts) => formatDate(lang, value, opts), [lang]);
  const fmtNum = useCallback((n, opts) => formatNumber(lang, n, opts), [lang]);

  return <UiLangContext.Provider value={{ lang, setLang, t, fmtDate, fmtNum }}>{children}</UiLangContext.Provider>;
}

export const useUiLang = () => useContext(UiLangContext);

// BCP-47 tag for the learner's TEACHING language (speech in and out).
export const speechTag = (language) => (language === 'hindi' ? 'hi-IN' : language === 'english' ? 'en-IN' : 'te-IN');
