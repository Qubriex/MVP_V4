// src/components/public/DemoTour.js — a 3–4 step guided tour of a demo side.
// Each step highlights one part of the page (elements marked data-tour="…")
// and explains it in a card pinned to the bottom of the screen. Back, Next,
// Esc to close. It opens by itself the first time a side is visited.
import React, { useCallback, useEffect, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';

const STEPS = {
  learner: ['lesson', 'answer', 'record'],
  college: ['bands', 'bridge', 'result'],
  employer: ['readiness', 'ask', 'privacy']
};
const seenKey = (side) => `qubirex_tour_${side}`;

export default function DemoTour({ side }) {
  const { t } = useUiLang();
  const steps = STEPS[side] || [];
  const [i, setI] = useState(null);
  useEffect(() => {
    let seen = true;
    try { seen = !!localStorage.getItem(seenKey(side)); localStorage.setItem(seenKey(side), '1'); } catch { /* storage blocked */ }
    if (!seen && steps.length) setI(0);
  }, [side, steps.length]);
  const close = useCallback(() => setI(null), []);
  useEffect(() => {
    document.querySelectorAll('.tour-on').forEach(el => el.classList.remove('tour-on'));
    if (i == null) return undefined;
    const el = document.querySelector(`[data-tour="${steps[i]}"]`);
    if (el) {
      el.classList.add('tour-on');
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView?.({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    }
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); el?.classList.remove('tour-on'); };
  }, [i, steps, close]);
  if (!steps.length) return null;
  return (
    <>
      <button type="button" className="ln-btn ln-btn-secondary ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setI(0)}>
        <Compass size={16} aria-hidden="true" />{t('tour.start')}
      </button>
      {i != null && (
        <div className="pb-tour" role="dialog" aria-modal="false" aria-labelledby="tour-title">
          <div className="ln-between" style={{ gap: 8 }}>
            <span className="ln-xs" style={{ fontWeight: 600 }}>{t('tour.step', { n: i + 1, total: steps.length })} · {t('tour.demoOnly')}</span>
            <button type="button" className="in-iconbtn" onClick={close} aria-label={t('tour.close')}><X size={18} aria-hidden="true" /></button>
          </div>
          <b id="tour-title" style={{ fontSize: 'var(--fs-h3)' }}>{t(`tour.${side}.${steps[i]}.title`)}</b>
          <span className="ln-small">{t(`tour.${side}.${steps[i]}.text`)}</span>
          <div className="ln-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            {i > 0 && <button type="button" className="ln-btn ln-btn-sm" onClick={() => setI(i - 1)}>{t('tour.back')}</button>}
            {i < steps.length - 1
              ? <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => setI(i + 1)} autoFocus>{t('tour.next')}</button>
              : <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={close} autoFocus>{t('tour.done')}</button>}
          </div>
        </div>
      )}
    </>
  );
}
