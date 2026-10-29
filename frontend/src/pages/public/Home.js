// src/pages/public/Home.js — /. What Qubirex is for each side, how it works,
// what a Passport does and does not prove. Sign-in lives in the header's
// Sign in menu only. All text follows the language switch, including the
// brand line under the headline.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, School, Briefcase, ShieldCheck, ArrowRight, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import HeroDemo from '../../components/public/HeroDemo';
import { Modal } from '../../components/shared/ui';
import { FEATURES } from '../../config/features';
import PublicShell from '../../components/public/PublicShell';
import { useUiLang } from '../../context/UiLangContext';

export const SIDES = [
  ['learners', Mic], ['colleges', School], ['employers', Briefcase]
];

const SCREENS = [['learner-home', 'home.screen.learner'], ['passport', 'home.screen.passport'], ['college-home', 'home.screen.college'], ['employer-home', 'home.screen.employer']];
const FAQ = [1, 2, 3, 4, 5];

/** Screenshots of each portal (sample data), scrolled sideways on small screens. */
function ScreenStrip() {
  const { t } = useUiLang();
  const [open, setOpen] = useState(null); // index of the enlarged screenshot
  const touch = useRef(null);
  const go = useCallback((d) => setOpen(i => (i + d + SCREENS.length) % SCREENS.length), []);
  useEffect(() => {
    if (open == null) return undefined;
    const onKey = (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, go]);
  return (
    <section className="ln-col" style={{ gap: 12 }} aria-labelledby="home-screens">
      <h2 id="home-screens" className="ln-h2">{t('home.screensTitle')}</h2>
      <div className="pb-screens" role="list" aria-label={t('home.screensTitle')}>
        {SCREENS.map(([file, key], i) => (
          <figure key={file} className="pb-screen" role="listitem">
            <button type="button" className="pb-screen-btn" onClick={() => setOpen(i)} aria-label={t('home.screenOpen', { name: t(key) })}>
              <img src={`/screens/${file}.png`} alt={t(key)} loading="lazy" width="640" height="400" />
              <span className="pb-screen-zoom" aria-hidden="true"><Maximize2 size={16} /></span>
            </button>
            <figcaption className="ln-small">{t(key)}</figcaption>
          </figure>
        ))}
      </div>
      {open != null && (
        <Modal title={t(SCREENS[open][1])} onClose={() => setOpen(null)} width={1100}
          footer={<div className="ln-between" style={{ width: '100%' }}>
            <button type="button" className="ln-btn ln-btn-sm" onClick={() => go(-1)}><ChevronLeft size={16} aria-hidden="true" />{t('home.screenPrev')}</button>
            <span className="ln-small ln-muted">{t('home.screenCount', { n: open + 1, total: SCREENS.length })}</span>
            <button type="button" className="ln-btn ln-btn-sm" onClick={() => go(1)}>{t('home.screenNext')}<ChevronRight size={16} aria-hidden="true" /></button>
          </div>}>
          <img className="pb-screen-full" src={`/screens/${SCREENS[open][0]}.png`} alt={t(SCREENS[open][1])}
            onTouchStart={e => { touch.current = e.touches[0].clientX; }}
            onTouchEnd={e => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }} />
        </Modal>
      )}
    </section>
  );
}

/** Questions people ask first; native details/summary, so keyboard and screen readers work. */
function Faq() {
  const { t } = useUiLang();
  return (
    <section className="ln-col" style={{ gap: 10 }} aria-labelledby="home-faq">
      <h2 id="home-faq" className="ln-h2">{t('home.faqTitle')}</h2>
      {FAQ.map(i => (
        <details key={i} className="pb-faq">
          <summary>{t(`home.faq.q${i}`)}</summary>
          <p className="ln-small" style={{ margin: 0 }}>{t(`home.faq.a${i}`)}</p>
        </details>
      ))}
    </section>
  );
}

export default function Home() {
  const { t } = useUiLang();
  const proves = [[true, 'home.p1'], [true, 'home.p2'], [true, 'home.p3'], [false, 'home.n1'], [false, 'home.n2'], [false, 'home.n3']];
  return (
    <PublicShell>
      <section className="pb-hero">
        <div className="ln-col" style={{ gap: 16 }}>
          <span className="pb-kicker">{t('home.kicker')}</span>
          <h1>{t('home.title')}</h1>
          <p className="ln-indic ln-muted" style={{ margin: 0, fontSize: 'var(--fs-h3)', lineHeight: 1.5 }}>{t('brand.tagline')}</p>
          <div className="ln-row ln-wrap" style={{ gap: 10 }}>
            <Link to="/demo" className="ln-btn ln-btn-primary">{t('nav.demo')}<ArrowRight size={16} aria-hidden="true" /></Link>
            <Link to="/verify/QBX-DEMO-0000" className="ln-btn ln-btn-secondary"><ShieldCheck size={16} aria-hidden="true" />{t('home.verifySample')}</Link>
          </div>
        </div>
        <HeroDemo />
      </section>

      <section className="pb-steps" aria-label={t('home.howTitle')}>
        {[1, 2, 3, 4].map(i => <div key={i} className="ln-card" style={{ gap: 6 }}><span className="pb-num">{i}</span><b>{t(`home.step${i}`)}</b><span className="ln-small ln-muted">{t(`home.step${i}d`)}</span></div>)}
      </section>

      <section className="ln-grid ln-g-3" style={{ gap: 16 }}>
        {SIDES.map(([id, Icon]) => (
          <article key={id} className="ln-card" style={{ gap: 10 }}>
            <span className="pb-kicker"><Icon size={14} aria-hidden="true" />{t(`nav.${id}`)}</span>
            <b style={{ fontSize: 'var(--fs-h2)' }}>{t(`${id}.title`)}</b>
            {id === 'learners' && <span className="ln-small ln-muted">{t('learners.devices')}</span>}
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{[1, 2, 3].map(i => <li key={i}>{t(`${id}.b${i}`)}</li>)}</ul>
            <Link to={`/${id}`} className="ln-link" style={{ marginTop: 'auto' }}>{t('home.learnMore')} →</Link>
          </article>
        ))}
      </section>

      <section className="ln-card" style={{ gap: 12 }}>
        <span className="pb-kicker">{t('home.honestKicker')}</span>
        <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h2)' }}>{t('home.honestTitle')}</h2>
        <div className="ln-grid ln-g-2" style={{ gap: 8 }}>
          {proves.map(([yes, k]) => <span key={k} className="ln-small"><span className={yes ? 'pb-yes' : 'pb-no'}>{yes ? t('common.yes') : t('common.no')}</span>{t(k)}</span>)}
        </div>
      </section>

      <ScreenStrip />

      {FEATURES.trustedBy && FEATURES.trustedByNames.length > 0 && (
        <section className="ln-card" style={{ gap: 10 }} aria-labelledby="home-trusted">
          <h2 id="home-trusted" className="ln-h2">{t('home.trustedTitle')}</h2>
          <ul className="ln-row ln-wrap" style={{ gap: 18, listStyle: 'none', margin: 0, padding: 0 }}>{FEATURES.trustedByNames.map(n => <li key={n} className="ln-small" style={{ fontWeight: 600 }}>{n}</li>)}</ul>
        </section>
      )}

      <Faq />

      <section className="ln-grid ln-g-4" style={{ gap: 12 }} aria-label={t('home.whyTitle')}>
        {[1, 2, 3, 4].map(i => <div key={i} className="ln-tile" style={{ padding: 16 }}><b style={{ fontSize: 'var(--fs-body)' }}>{t(`home.why${i}`)}</b></div>)}
      </section>
    </PublicShell>
  );
}
