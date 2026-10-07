// src/components/shared/Drawer.js — a right-hand panel over the page (Ask
// Qubirex, Help, Notifications). Esc or the scrim closes it; focus moves in.
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Drawer({ title, onClose, children, width = 420, labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const id = labelledBy || `drawer-${String(title).replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="sk-scrim" onClick={onClose}>
      <aside className="sk-drawer" role="dialog" aria-modal="true" aria-labelledby={id} style={{ width }} onClick={e => e.stopPropagation()} tabIndex={-1} ref={ref}>
        <div className="sk-drawer-head">
          <h2 id={id} className="sk-drawer-title">{title}</h2>
          <button type="button" className="in-iconbtn sk-close" onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="sk-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
