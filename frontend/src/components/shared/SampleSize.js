// src/components/shared/SampleSize.js — numbers about people say how many
// people they rest on. Under 5: hidden to protect privacy ("Too few to
// show"). Under 20: shown with a "Small sample" tag.
import React from 'react';
import { EyeOff } from 'lucide-react';
import { Popover } from './Popover';

export const MIN_SHOWN = 5;
export const SMALL = 20;

export function SmallSample({ n }) {
  if (n == null || n >= SMALL || n < MIN_SHOWN) return null;
  return (
    <Popover trigger="Small sample" triggerClass="sk-small" title="Small sample">
      Based on {n} {n === 1 ? 'person' : 'people'}. Treat with care: one or two people change this number a lot.
    </Popover>
  );
}

/** Renders children only when n ≥ 5; otherwise the privacy card. */
export function TooFew({ n, children, compact = false }) {
  if (n != null && n < MIN_SHOWN) {
    return compact
      ? <span className="sk-toofew-inline" title="Fewer than 5 people. Hidden to protect privacy.">Too few to show</span>
      : (
        <div className="sk-toofew" role="note">
          <EyeOff size={18} aria-hidden="true" />
          <b>Too few to show</b>
          <span>Fewer than 5 people. Hidden to protect privacy.</span>
        </div>
      );
  }
  return children;
}
