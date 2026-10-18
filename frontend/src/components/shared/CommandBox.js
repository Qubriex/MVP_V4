// src/components/shared/CommandBox.js — the one Ask Qubirex box on each side's
// home page (v4.3 canvas I1, E1, L1): type or speak a question and Ask Qubirex
// opens with the answer. With searchHref, the same text can search jobs and
// skills instead. "/" anywhere on the page puts the cursor in the box.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Mic, Search } from 'lucide-react';
import { useSpeechInput } from '../../utils/voice';
import { useUiLang } from '../../context/UiLangContext';
import AskQubirex from './AskQubirex';

const SHORT = { english: ['en', 'en-IN'], telugu: ['te', 'te-IN'], hindi: ['hi', 'hi-IN'] };

export default function CommandBox({ side, placeholder, searchHref }) {
  const { t, lang } = useUiLang();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const input = useRef(null);
  const [code, bcp47] = SHORT[lang] || SHORT.english;
  const mic = useSpeechInput({ lang: bcp47, onFinal: (text) => setOpen(text) });
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault(); input.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const search = () => { if (q.trim()) navigate(`${searchHref}?q=${encodeURIComponent(q.trim())}`); };
  return (
    <>
      <form className="sk-command" role="search" onSubmit={e => { e.preventDefault(); if (q.trim()) { setOpen(q.trim()); setQ(''); } }}>
        <Sparkles size={18} aria-hidden="true" />
        <label htmlFor={`cmd-${side}`} className="ln-sr">{t('shared.commandBox.askQubirex')}</label>
        <input id={`cmd-${side}`} ref={input} className="ln-indic" value={mic.listening ? mic.interim || t('learn.welcome.listening') : q} onChange={e => setQ(e.target.value)}
          placeholder={placeholder || t('shared.commandBox.placeholder')} disabled={mic.listening} aria-keyshortcuts="/" />
        {mic.supported && <button type="button" className={`sk-mic ${mic.listening ? 'is-on' : ''}`} style={{ width: 38, height: 38 }} onClick={() => (mic.listening ? mic.stop() : mic.start())} aria-label={t('shared.commandBox.speakQuestion')}><Mic size={16} aria-hidden="true" /></button>}
        {searchHref && <button type="button" className="ln-btn ln-btn-sm sk-command-search" disabled={!q.trim()} onClick={search} title={t('shared.commandBox.searchJobs')}><Search size={14} aria-hidden="true" /><span>{t('shared.commandBox.searchJobs')}</span></button>}
        <button type="submit" className="ln-btn ln-btn-primary ln-btn-sm" disabled={!q.trim()}>{t('shared.commandBox.ask')}</button>
      </form>
      {open && <AskQubirex side={side} initialLang={code} initialQuestion={open} onClose={() => setOpen(null)} />}
    </>
  );
}
