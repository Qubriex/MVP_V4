// src/components/public/PublicShell.js — header and footer for every public
// page: logo (home), For learners · For colleges · For employers · Verify a
// Passport · Pricing · Live demo, the language switch, Talk to us and Sign in
// (which first asks who you are). demo={true} adds the demo banner with
// Exit demo. On phones the links fold into a menu; language and Sign in stay
// in reach.
import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, GraduationCap, School, Briefcase, LogOut } from 'lucide-react';
import BrandLogo from '../BrandLogo';
import ThemeToggle from '../ThemeToggle';
import TalkToUs from './TalkToUs';
import { useUiLang } from '../../context/UiLangContext';

const LANGS = [['english', 'EN', 'English'], ['telugu', 'తెలుగు', 'తెలుగు'], ['hindi', 'हिंदी', 'हिंदी']];
export const SIGN_IN = [['/learner-login', 'signin.learner', GraduationCap], ['/login', 'signin.staff', School], ['/employer/login', 'signin.employer', Briefcase]];

export function LangSwitch({ className = '' }) {
  const { lang, setLang, t } = useUiLang();
  return (
    <div className={`pb-langs ${className}`} role="group" aria-label={t('lang.label')}>
      {LANGS.map(([k, short, full]) => (
        <button key={k} type="button" className={`ln-indic ${lang === k ? 'is-on' : ''}`} aria-pressed={lang === k} aria-label={full} onClick={() => setLang(k)}>{short}</button>
      ))}
    </div>
  );
}

/** "Sign in" opens a short menu: Learner / College staff / Employer. */
export function SignInMenu() {
  const { t } = useUiLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="pb-signin" ref={ref}>
      <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {t('nav.signIn')}<ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="pb-signin-menu" role="menu" aria-label={t('signin.who')}>
          <span className="ln-xs ln-muted" style={{ padding: '6px 12px' }}>{t('signin.who')}</span>
          {SIGN_IN.map(([to, key, Icon]) => (
            <Link key={to} to={to} role="menuitem" className="pb-signin-item" onClick={() => setOpen(false)}><Icon size={16} aria-hidden="true" />{t(key)}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV = [['/learners', 'nav.learners'], ['/colleges', 'nav.colleges'], ['/employers', 'nav.employers'], ['/verify', 'nav.verify'], ['/pricing', 'nav.pricing'], ['/demo', 'nav.demo']];

export default function PublicShell({ children, demo = false }) {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [talk, setTalk] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  return (
    <div className="pb-page">
      <a href="#main" className="pb-skip">{t('a11y.skip')}</a>
      {demo && (
        <div className="pb-demobar" role="status">
          <span>{t('demo.banner')}</span>
          <button type="button" className="pb-demobar-exit" onClick={() => navigate('/')}><LogOut size={14} aria-hidden="true" />{t('demo.exit')}</button>
        </div>
      )}
      <header className="pb-head">
        <Link to="/" className="brand-home" aria-label={t('nav.logoHome')}><BrandLogo height={40} /></Link>
        <nav id="pb-nav" className={`pb-nav ${open ? 'is-open' : ''}`} aria-label={t('nav.main')}>
          {NAV.map(([to, key]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive || (to === '/demo' && location.pathname.startsWith('/demo')) ? 'active' : undefined)}>{t(key)}</NavLink>)}
          <div className="pb-nav-extra"><LangSwitch /><button type="button" className="ln-btn ln-btn-secondary ln-btn-sm" onClick={() => setTalk(true)}>{t('nav.talk')}</button></div>
        </nav>
        <div className="pb-actions">
          <LangSwitch className="pb-hide-phone" />
          <ThemeToggle />
          <button type="button" className="ln-btn ln-btn-secondary ln-btn-sm pb-hide-phone" onClick={() => setTalk(true)}>{t('nav.talk')}</button>
          <SignInMenu />
          <button type="button" className="in-iconbtn pb-menu" aria-label={open ? t('nav.closeMenu') : t('nav.menu')} aria-expanded={open} aria-controls="pb-nav" onClick={() => setOpen(o => !o)}>{open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button>
        </div>
      </header>
      <main id="main" className="pb-main">{children}</main>
      <footer className="pb-foot">
        <div className="ln-col" style={{ gap: 8 }}>
          <Link to="/" className="brand-home" aria-label={t('nav.logoHome')}><BrandLogo height={36} /></Link>
          <span>{t('foot.by')}</span>
        </div>
        <nav className="pb-foot-links" aria-label={t('foot.legal')}>
          <Link to="/legal/privacy">{t('foot.privacy')}</Link><Link to="/legal/terms">{t('foot.terms')}</Link><Link to="/legal/dpdp">{t('foot.dpdp')}</Link><Link to="/legal/grievance">{t('foot.grievance')}</Link>
          <button type="button" className="ln-link" onClick={() => setTalk(true)}>{t('nav.talk')}</button>
        </nav>
      </footer>
      {talk && <TalkToUs onClose={() => setTalk(false)} />}
    </div>
  );
}

/** "← Back to home" for demo and inner public pages. */
export function BackHome({ to = '/', label }) {
  const { t } = useUiLang();
  return <Link to={to} className="ln-link pb-back">← {label || t('nav.backHome')}</Link>;
}
