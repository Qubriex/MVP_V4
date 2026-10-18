// src/components/shared/Popover.js — "Why this?", "How it's counted" and
// glossary terms: a small card under a trigger, closed by Esc, a click
// outside, or the trigger again.
import React, { useEffect, useRef, useState } from 'react';
import { GLOSSARY } from './glossary';

import { useUiLang } from '../../context/UiLangContext';
export function Popover({ trigger, triggerClass = 'sk-why', title, children, dark = false, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span className="sk-pop-wrap" ref={ref}>
      <button type="button" className={triggerClass} aria-expanded={open} aria-label={label} onClick={() => setOpen(o => !o)}>{trigger}</button>
      {open && (
        <span className={`sk-pop ${dark ? 'is-dark' : ''}`} role="dialog" aria-label={title}>
          {title && <b className="sk-pop-title">{title}</b>}
          <span className="sk-pop-body">{children}</span>
        </span>
      )}
    </span>
  );
}

/** "Why this?" next to a number or an action card. */
export function WhyThis({ title, children, label }) {
  const { t } = useUiLang();
  return <Popover trigger={label || t('shared.popover.whyThis')} title={title}>{children}</Popover>;
}

/** "How it's counted" under a headline number. */
export function HowCounted({ children }) {
  const { t } = useUiLang();
  return <Popover trigger={t('shared.popover.howSCounted')} title={t('shared.popover.howSCounted')}>{children}</Popover>;
}

/** A term with its plain-words meaning: <Term k="A3">A3</Term>. */
export function Term({ k, children }) {
  const { t } = useUiLang();
  const g = GLOSSARY[k];
  if (!g) return children;
  return (
    <Popover trigger={children || t(g[0])} triggerClass="sk-term" title={t('shared.popover.plainWords')} dark label={t('shared.popover.valueWhatMeans', { value: t(g[0]) })}>
      <b>{t(g[0])}</b> — {t(g[1])}
    </Popover>
  );
}

/** An evidence (L1–L4) or authorship (A0–A3) level: plain words on the tag,
 *  the code and its glossary meaning in the popover. */
export function CodeTag({ code, label }) {
  const { t } = useUiLang();
  const g = GLOSSARY[code];
  return (
    <Popover trigger={label} triggerClass="ln-tag ln-tag-neutral sk-codetag" title={code} label={t('shared.popover.valueWhatMeans', { value: `${label} (${code})` })}>
      {g ? <><b>{t(g[0])}</b> — {t(g[1])}</> : code}
    </Popover>
  );
}
