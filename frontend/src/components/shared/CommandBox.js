// src/components/shared/CommandBox.js — the command box on each side's home
// page (v4.3 canvas I1, E1, L1): type or speak a question; Ask Qubirex opens
// with the answer.
import React, { useState } from 'react';
import { Sparkles, Mic } from 'lucide-react';
import { useSpeechInput } from '../../utils/voice';
import { useUiLang } from '../../context/UiLangContext';
import AskQubirex from './AskQubirex';

const SHORT = { english: ['en', 'en-IN'], telugu: ['te', 'te-IN'], hindi: ['hi', 'hi-IN'] };

export default function CommandBox({ side, placeholder = 'Ask about your data — for example, who is nearly ready?' }) {
  const { lang } = useUiLang();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [code, bcp47] = SHORT[lang] || SHORT.english;
  const mic = useSpeechInput({ lang: bcp47, onFinal: (text) => setOpen(text) });
  return (
    <>
      <form className="sk-command" onSubmit={e => { e.preventDefault(); if (q.trim()) { setOpen(q.trim()); setQ(''); } }}>
        <Sparkles size={18} aria-hidden="true" />
        <label htmlFor={`cmd-${side}`} className="ln-sr">Ask Qubirex</label>
        <input id={`cmd-${side}`} className="ln-indic" value={mic.listening ? mic.interim || 'Listening…' : q} onChange={e => setQ(e.target.value)} placeholder={placeholder} disabled={mic.listening} />
        {mic.supported && <button type="button" className={`sk-mic ${mic.listening ? 'is-on' : ''}`} style={{ width: 38, height: 38 }} onClick={() => (mic.listening ? mic.stop() : mic.start())} aria-label="Speak your question"><Mic size={16} aria-hidden="true" /></button>}
        <button type="submit" className="ln-btn ln-btn-primary ln-btn-sm" disabled={!q.trim()}>Ask</button>
      </form>
      {open && <AskQubirex side={side} initialLang={code} initialQuestion={open} onClose={() => setOpen(null)} />}
    </>
  );
}
