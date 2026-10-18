// src/pages/public/Home.js — /. What Qubirex is for each side, how it works,
// what a Passport does and does not prove, and sign-in for each role. All
// text follows the language switch; the one exception is the three-language
// brand line under the headline.
import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, School, Briefcase, ShieldCheck, ArrowRight } from 'lucide-react';
import HeroDemo from '../../components/public/HeroDemo';
import { FEATURES } from '../../config/features';
import PublicShell, { SIGN_IN } from '../../components/public/PublicShell';
import { useUiLang } from '../../context/UiLangContext';

export const SIDES = [
  ['learners', Mic], ['colleges', School], ['employers', Briefcase]
];

const SCREENS = [['learner-home', 'home.screen.learner'], ['passport', 'home.screen.passport'], ['college-home', 'home.screen.college'], ['employer-home', 'home.screen.employer']];
const FAQ = [1, 2, 3, 4, 5];

/** Screenshots of each portal (sample data), scrolled sideways on small screens. */
function ScreenStrip() {
  const { t } = useUiLang();
  return (
    <section className="ln-col" style={{ gap: 12 }} aria-labelledby="home-screens">
      <h2 id="home-screens" className="ln-h2">{t('home.screensTitle')}</h2>
      <div className="pb-screens" tabIndex={0} role="region" aria-label={t('home.screensTitle')}>
        {SCREENS.map(([file, key]) => (
          <figure key={file} className="pb-screen">
            <img src={`/screens/${file}.png`} alt={t(key)} loading="lazy" width="640" height="400" />
            <figcaption className="ln-small">{t(key)}</figcaption>
          </figure>
        ))}
      </div>
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

export function SignInStrip() {
  const { t } = useUiLang();
  return (
    <section className="ln-card" style={{ gap: 12 }} aria-labelledby="home-signin">
      <h2 id="home-signin" className="ln-h2">{t('home.signinTitle')}</h2>
      <div className="ln-grid ln-g-3" style={{ gap: 10 }}>
        {SIGN_IN.map(([to, key, Icon]) => (
          <Link key={to} to={to} className="ln-btn ln-btn-secondary" style={{ justifyContent: 'flex-start' }}><Icon size={18} aria-hidden="true" />{t(key)}</Link>
        ))}
      </div>
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
          {/* Brand line: the one place all three languages appear together. */}
          <p className="ln-indic ln-muted" style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 1.7 }} aria-label={t('home.tagline')}>
            <span lang="en">{t('pub.home.languageSkillsFuture')}</span><br />
            <span lang="te">మీ భాష. మీ నైపుణ్యాలు. మీ భవిష్యత్తు.</span><br />
            <span lang="hi">आपकी भाषा। आपके कौशल। आपका भविष्य।</span>
          </p>
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
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{[1, 2, 3].map(i => <li key={i}>{t(`${id}.b${i}`)}</li>)}</ul>
            <Link to={`/${id}`} className="ln-link" style={{ marginTop: 'auto' }}>{t('home.learnMore')} →</Link>
          </article>
        ))}
      </section>

      <SignInStrip />

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
