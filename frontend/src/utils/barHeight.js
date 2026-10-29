// src/utils/barHeight.js — keeps a fixed bottom bar's real height in a CSS
// variable, so page padding, toasts and sticky footers clear it even when the
// bar wraps onto two lines.
import { useEffect } from 'react';

export function useBarHeight(selector, cssVar, active) {
  useEffect(() => {
    if (!active) return undefined;
    const el = document.querySelector(selector);
    const root = document.documentElement;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const set = () => root.style.setProperty(cssVar, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty(cssVar); };
  }, [selector, cssVar, active]);
}
