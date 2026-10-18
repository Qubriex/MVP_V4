// Tooltip on hover and keyboard focus; the text is also the accessible description.
import React, { useId, useState } from 'react';

export default function Tooltip({ text, children, placement = 'top' }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const child = React.Children.only(children);
  return (
    <span className="ui-tipwrap" onPointerEnter={() => setShow(true)} onPointerLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}
      onKeyDown={e => { if (e.key === 'Escape') setShow(false); }}>
      {React.cloneElement(child, { 'aria-describedby': id })}
      <span id={id} role="tooltip" className={`ui-tip ui-tip-${placement} ${show ? 'is-on' : ''}`}>{text}</span>
    </span>
  );
}
