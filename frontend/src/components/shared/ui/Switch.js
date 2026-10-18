// An on/off switch: a real button with role="switch", so Space/Enter toggle it
// and screen readers announce on or off. The label is part of the button.
import React from 'react';

export default function Switch({ checked, onChange, disabled, children, className = '' }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} disabled={disabled}
      className={`ui-switch ${checked ? 'is-on' : ''} ${className}`} onClick={() => onChange(!checked)}>
      <span className="ui-switch-track" aria-hidden="true"><span className="ui-switch-thumb" /></span>
      <span className="ui-switch-label">{children}</span>
    </button>
  );
}
