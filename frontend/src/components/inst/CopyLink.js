// src/components/inst/CopyLink.js — a read-only link field with a Copy button.
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyLink({ url, label = 'Copy link' }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2000); } catch (e) { /* clipboard blocked */ } };
  return (
    <div className="ln-row" style={{ gap: 8, minWidth: 0 }}>
      <input className="ln-input" readOnly value={url} aria-label="Invite link" onFocus={e => e.target.select()} style={{ minHeight: 36, fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace' }} />
      <button type="button" className="ln-btn ln-btn-sm" onClick={copy}>{done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{done ? 'Copied' : label}</button>
    </div>
  );
}
