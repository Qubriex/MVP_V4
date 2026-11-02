// src/components/learn/MermaidDiagram.js
// Renders a mermaid diagram (a lesson picture, or the `mermaid` field on a
// TEACH turn). mermaid is loaded on first use so it stays out of the main
// bundle. securityLevel 'strict' sanitises labels and disables click handlers.
//
// A diagram that cannot be drawn shows nothing: the lesson goes on without
// the picture. Never mermaid's own error graphic ("Syntax error in text") and
// never the diagram source. The source is parsed first, mermaid is told not to
// draw errors, anything it left in the page is removed, and a slow render
// gives up after a few seconds. Failures are logged for admins.
import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { useUiLang } from '../../context/UiLangContext';
import SafeSection from '../shared/SafeSection';

let mermaidPromise = null;
let counter = 0;
const RENDER_TIMEOUT_MS = 6000;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(mod => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'Inter, sans-serif', suppressErrorRendering: true });
      return mermaid;
    });
  }
  return mermaidPromise;
}

/** Remove anything mermaid put in the page for this render, and any stray error graphic. */
export function cleanUpMermaid(id) {
  if (typeof document === 'undefined') return;
  [id, `d${id}`, `i${id}`].forEach(x => document.getElementById(x)?.remove());
  // A stray error graphic outside any diagram box (never another diagram's work in progress).
  document.querySelectorAll('.error-icon, svg[aria-roledescription="error"]').forEach(el => {
    if (el.closest('.ln-board-diagram')) { el.closest('.ln-board-diagram').innerHTML = ''; return; }
    (el.closest('body > *') || el).remove();
  });
}

function reportFailure(where, error) {
  const message = String(error?.message || error || 'parse failed').slice(0, 200);
  if (process.env.NODE_ENV !== 'production') { console.warn('diagram not drawn', where, message); return; } // eslint-disable-line no-console
  api.post('/ui-errors', { kind: 'diagram', where, message }).catch(() => {});
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('render timeout')), ms))]);

function Diagram({ source, where = '' }) {
  const { t } = useUiLang();
  const ref = useRef(null);
  const [state, setState] = useState('loading'); // loading | ok | failed

  useEffect(() => {
    let cancelled = false;
    const id = `qbx-mermaid-${counter += 1}`;
    setState('loading');
    (async () => {
      try {
        const mermaid = await loadMermaid();
        const valid = await mermaid.parse(source, { suppressErrors: true });
        if (!valid) throw new Error('parse failed');
        const { svg } = await withTimeout(mermaid.render(id, source), RENDER_TIMEOUT_MS);
        if (/aria-roledescription="error"|Syntax error in text/.test(svg)) throw new Error('error graphic');
        if (!cancelled && ref.current) { ref.current.innerHTML = svg; setState('ok'); }
      } catch (err) {
        cleanUpMermaid(id);
        reportFailure(where, err);
        if (!cancelled) setState('failed');
      }
    })();
    return () => { cancelled = true; cleanUpMermaid(id); };
  }, [source, where]);

  if (state === 'failed') return null;
  return <div className="ln-board-diagram" ref={ref} role="img" aria-label={t('learn.mermaidDiagram.diagramFromProfessorQubirex')} data-diagram={state} />;
}

// Even a crash inside the diagram code shows nothing: the lesson goes on.
export default function MermaidDiagram(props) {
  return <SafeSection quiet name={`diagram ${props.where || ''}`} resetKey={props.source}><Diagram {...props} /></SafeSection>;
}
