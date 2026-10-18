// Input, Textarea and Field (label + control + hint/error), one look everywhere.
import React from 'react';

export function Field({ id, label, hint, error, children }) {
  return (
    <div className="ln-field">
      {label && <label className="ln-label" htmlFor={id}>{label}</label>}
      {children}
      {hint && !error && <span className="ln-xs ln-muted" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="ln-xs" style={{ color: 'var(--danger)' }} id={`${id}-err`} role="alert">{error}</span>}
    </div>
  );
}
export const Input = React.forwardRef(function Input({ className = '', ...rest }, ref) { return <input ref={ref} className={`ln-input ${className}`} {...rest} />; });
export const Textarea = React.forwardRef(function Textarea({ className = '', rows = 4, ...rest }, ref) { return <textarea ref={ref} rows={rows} className={`ln-input ui-textarea ${className}`} {...rest} />; });
