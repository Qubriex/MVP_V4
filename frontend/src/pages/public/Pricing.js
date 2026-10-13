// src/pages/public/Pricing.js — /pricing. Prices show as [PRICE] until
// confirmed; GST is added on the invoice.
import React from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import { useUiLang } from '../../context/UiLangContext';

const PLANS = [['learners', 'price.learnerPrice', '/learner-login', 'price.learnerCta'], ['colleges', '[PRICE]', '/colleges', 'price.collegeCta'], ['employers', '[PRICE]', '/employer/register', 'price.employerCta']];

export default function Pricing() {
  const { t } = useUiLang();
  return (
    <PublicShell>
      <header className="ln-col" style={{ gap: 8 }}>
        <span className="pb-kicker">{t('nav.pricing')}</span>
        <h1 className="ln-title">{t('price.title')}</h1>
        <span className="ln-sub">{t('price.sub')}</span>
      </header>
      <section className="ln-grid ln-g-3" style={{ gap: 16 }}>
        {PLANS.map(([side, price, href, cta]) => (
          <article key={side} className="ln-card" style={{ gap: 10 }}>
            <span className="pb-kicker">{t(`nav.${side}`)}</span>
            <span className="ln-stat" style={{ fontSize: 30 }}>{price.startsWith('[') ? price : t(price)}</span><span className="ln-small ln-muted">{t(`price.${side}Unit`)}</span>
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{[1, 2, 3].map(i => <li key={i}>{t(`price.${side}${i}`)}</li>)}</ul>
            <Link to={href} className="ln-btn ln-btn-secondary ln-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>{t(cta)}</Link>
          </article>
        ))}
      </section>
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <section className="ln-card ln-card-warm" style={{ gap: 8 }}>
          <span className="pb-kicker">{t('price.sponsorKicker')}</span><b style={{ fontSize: 20 }}>{t('price.sponsorTitle')}</b>
          <span className="ln-small">{t('price.sponsorText')}</span>
          <Link to="/employers" className="ln-link">{t('home.learnMore')} →</Link>
        </section>
        <section className="ln-card" style={{ gap: 10 }}>
          <span className="pb-kicker">{t('price.faq')}</span>
          {[1, 2, 3, 4].map(i => <div key={i} className="ln-col" style={{ gap: 2 }}><b style={{ fontSize: 15 }}>{t(`price.q${i}`)}</b><span className="ln-small ln-muted">{t(`price.a${i}`)}</span></div>)}
        </section>
      </div>
      <p className="ln-xs ln-muted">{t('price.gst')}</p>
    </PublicShell>
  );
}
