// src/pages/public/Audience.js — /learners, /colleges, /employers: one page
// per side, each with its own hero, benefits, how it works and a call to
// action (that side's demo, then that side's sign-in).
import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, School, Briefcase, CheckCircle2 } from 'lucide-react';
import PublicShell from '../../components/public/PublicShell';
import { useUiLang } from '../../context/UiLangContext';

const SIDE = {
  learners: { icon: Mic, demo: '/demo/learner', signin: '/learner-login', signinKey: 'signin.learner' },
  colleges: { icon: School, demo: '/demo/college', signin: '/login', signinKey: 'signin.staff' },
  employers: { icon: Briefcase, demo: '/demo/employer', signin: '/employer/login', signinKey: 'signin.employer' }
};

export default function Audience({ side }) {
  const { t } = useUiLang();
  const s = SIDE[side];
  const Icon = s.icon;
  return (
    <PublicShell>
      <section className="ln-col" style={{ gap: 14, maxWidth: 820 }}>
        <span className="pb-kicker"><Icon size={14} aria-hidden="true" />{t(`nav.${side}`)}</span>
        <h1 className="ln-title" style={{ fontSize: 'clamp(30px, 4.5vw, 46px)' }}>{t(`${side}.hero`)}</h1>
        <p className="ln-sub" style={{ margin: 0, fontSize: 17 }}>{t(`${side}.heroSub`)}</p>
        <div className="pb-gradient-rule" aria-hidden="true" />
        <div className="ln-row ln-wrap" style={{ gap: 10 }}>
          <Link to={s.demo} className="ln-btn ln-btn-primary">{t(`${side}.demoCta`)}</Link>
          <Link to={s.signin} className="ln-btn ln-btn-secondary">{t(s.signinKey)}</Link>
        </div>
      </section>
      <section className="ln-grid ln-g-2" style={{ gap: 14 }} aria-label={t('aud.benefits')}>
        {[1, 2, 3, 4].map(i => (
          <article key={i} className="ln-card" style={{ gap: 6 }}>
            <b className="ln-row" style={{ gap: 8 }}><CheckCircle2 size={18} style={{ color: 'var(--accent-ink)' }} aria-hidden="true" />{t(`${side}.ben${i}`)}</b>
            <span className="ln-small ln-muted">{t(`${side}.ben${i}d`)}</span>
          </article>
        ))}
      </section>
      <section className="ln-col" style={{ gap: 12 }}>
        <h2 className="ln-h2" style={{ fontSize: 22 }}>{t('aud.how')}</h2>
        <ol className="pb-steps pb-steps-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[1, 2, 3].map(i => <li key={i} className="ln-card" style={{ gap: 6 }}><span className="pb-num">{i}</span><span className="ln-small">{t(`${side}.how${i}`)}</span></li>)}
        </ol>
      </section>
      <section className="ln-card ln-card-warm ln-between ln-wrap" style={{ gap: 12 }}>
        <span><b>{t(`${side}.ctaTitle`)}</b><br /><span className="ln-small ln-muted">{t(`${side}.ctaSub`)}</span></span>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <Link to={s.demo} className="ln-btn ln-btn-primary">{t(`${side}.demoCta`)}</Link>
          <Link to={s.signin} className="ln-btn ln-btn-secondary">{t(s.signinKey)}</Link>
        </div>
      </section>
    </PublicShell>
  );
}
