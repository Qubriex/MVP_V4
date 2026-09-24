// src/components/learn/MermaidDiagram.js
// Renders a mermaid diagram string from TEACH (the `mermaid` field on an
// instruction turn). mermaid is loaded on first use so it stays out of the
// main bundle. securityLevel 'strict' sanitises labels and disables click
// handlers — the source is model output, so it is treated as untrusted.
// If rendering fails, the source is shown as text instead.
import React, { useEffect, useRef, useState } from 'react';

let mermaidPromise = null;
let counter = 0;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(mod => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'Inter, sans-serif' });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export default function MermaidDiagram({ source }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    loadMermaid()
      .then(mermaid => mermaid.render(`qbx-mermaid-${counter += 1}`, source))
      .then(({ svg }) => { if (!cancelled && ref.current) ref.current.innerHTML = svg; })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [source]);

  if (failed) return <pre className="ln-board-code">{source}</pre>;
  return <div className="ln-board-diagram" ref={ref} role="img" aria-label="Diagram from Professor Qubirex" />;
}
