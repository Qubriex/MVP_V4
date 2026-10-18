// Modal: a centred dialog (Drawer is the side panel). Esc and the scrim close it; focus is kept inside.
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, footer, width = 520 }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    el?.querySelector('input, select, textarea, button:not(.ui-modal-x), [href]')?.focus() || el?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  const id = `modal-${String(title).replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="sk-scrim ui-modal-scrim" onClick={onClose}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={id} style={{ maxWidth: width }} ref={ref} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="ln-between" style={{ gap: 12 }}>
          <h2 id={id} className="ln-h2">{title}</h2>
          <button type="button" className="ui-iconbtn ui-modal-x" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
