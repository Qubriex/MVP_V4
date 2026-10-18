// Button and IconButton — the only button styles in the app.
// variant: primary (filled red) · secondary (outlined) · ghost · danger; size: sm · md.
// A disabled button can say why (`disabledReason`): shown on hover/focus and read by screen readers.
import React, { useId } from 'react';
import { Loader2 } from 'lucide-react';

export function Button({ as: As = 'button', variant = 'secondary', size = 'md', loading = false, disabled = false, disabledReason, icon: Icon, children, className = '', type, ...rest }) {
  const cls = `ln-btn ui-btn-${variant} ${size === 'sm' ? 'ln-btn-sm' : ''} ${className}`.trim();
  const off = disabled || loading;
  const uid = useId();
  const reasonId = disabledReason && off ? `why-${uid}` : undefined;
  const props = As === 'button' ? { type: type || 'button', disabled: off } : { 'aria-disabled': off || undefined };
  return (
    <span className={`ui-btn-wrap ${reasonId ? 'has-reason' : ''}`}>
      <As className={cls} aria-busy={loading || undefined} aria-describedby={reasonId} {...props} {...rest}>
        {loading ? <Loader2 size={16} className="ui-spin" aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
        {children}
      </As>
      {reasonId && <span id={reasonId} role="tooltip" className="ui-tip">{disabledReason}</span>}
    </span>
  );
}

export function IconButton({ label, icon: Icon, size = 18, className = '', ...rest }) {
  return <button type="button" className={`ui-iconbtn ${className}`} aria-label={label} title={label} {...rest}><Icon size={size} aria-hidden="true" /></button>;
}
