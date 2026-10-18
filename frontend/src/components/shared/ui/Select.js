// Select — a styled, keyboard-accessible replacement for the browser <select>.
// Same props as a native select: value, onChange(e) with e.target.value, options
// [{ value, label }] (or <option> children), label/aria-label. Keys: Enter/Space/
// ArrowDown open; arrows move; Home/End; type to jump; Enter selects; Esc closes.
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const fromChildren = (children) => React.Children.toArray(children).filter(c => c && c.type === 'option')
  .map(c => ({ value: String(c.props.value ?? c.props.children), label: c.props.children, disabled: c.props.disabled }));

export default function Select({ value, onChange, options, children, id, className = '', style, disabled, 'aria-label': ariaLabel, name, required }) {
  const auto = useId();
  const btnId = id || `sel-${auto}`;
  const listId = `${btnId}-list`;
  const opts = useMemo(() => (options || fromChildren(children)).map(o => ({ ...o, value: String(o.value) })), [options, children]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef(null); const list = useRef(null); const typed = useRef({ s: '', t: 0 });
  const current = opts.find(o => o.value === String(value ?? '')) || opts[0];
  const choose = (o) => { if (!o || o.disabled) return; onChange?.({ target: { value: o.value, name } }); setOpen(false); wrap.current?.querySelector('button')?.focus(); };
  useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, opts.findIndex(o => o.value === current?.value)));
    const close = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => { if (open) list.current?.children[active]?.scrollIntoView?.({ block: 'nearest' }); }, [active, open]);
  const move = (d) => { let i = active; do { i = (i + d + opts.length) % opts.length; } while (opts[i]?.disabled && i !== active); setActive(i); };
  const onKey = (e) => {
    if (disabled) return;
    if (!open && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(opts[active]); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      const now = Date.now(); typed.current = { s: (now - typed.current.t < 600 ? typed.current.s : '') + e.key.toLowerCase(), t: now };
      const i = opts.findIndex(o => String(o.label).toLowerCase().startsWith(typed.current.s)); if (i >= 0) setActive(i);
    }
  };
  return (
    <div className={`ui-select ${open ? 'is-open' : ''} ${className}`} ref={wrap} style={style}>
      <button type="button" id={btnId} className="ui-select-btn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined} aria-label={ariaLabel} aria-required={required || undefined}
        disabled={disabled} onClick={() => setOpen(o => !o)} onKeyDown={onKey}>
        <span className="ui-select-value">{current?.label ?? ''}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      {name && <input type="hidden" name={name} value={current?.value ?? ''} />}
      {open && (
        <ul className="ui-select-list" role="listbox" id={listId} ref={list} aria-labelledby={btnId}>
          {opts.map((o, i) => (
            <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={o.value === current?.value} aria-disabled={o.disabled || undefined}
              className={`${i === active ? 'is-active' : ''} ${o.disabled ? 'is-disabled' : ''}`} onPointerEnter={() => setActive(i)} onPointerDown={e => { e.preventDefault(); choose(o); }}>
              <span>{o.label}</span>{o.value === current?.value && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
