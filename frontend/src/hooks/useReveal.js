// src/hooks/useReveal.js
// IntersectionObserver-backed scroll reveal. Attach the returned ref to any
// element and add className={`reveal ${visible ? 'is-visible' : ''}`}.
// No-ops usefully under prefers-reduced-motion since global.css makes
// .reveal fully visible by default in that case.
import { useEffect, useRef, useState } from 'react';

export default function useReveal(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setVisible(true); return undefined; }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px', ...options }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}
