// src/components/Reveal.js
// Convenience wrapper around useReveal for fade-up-on-scroll sections/cards.
// Pass `delay` (ms) to stagger items in a list/grid.
import React from 'react';
import useReveal from '../hooks/useReveal';

export default function Reveal({ children, as: Tag = 'div', delay = 0, className = '', style = {}, ...rest }) {
  const [ref, visible] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms', ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
