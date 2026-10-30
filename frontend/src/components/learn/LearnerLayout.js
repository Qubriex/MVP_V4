// src/components/learn/LearnerLayout.js
// Shared shell for every /learn/* page except the voice session: a sidebar
// with the learner card and three nav groups (Learn · Career · Me). Below
// 960px the sidebar becomes a drawer opened from a slim top bar, and below
// 640px a bottom tab bar (Home · Learn · Passport · Jobs · Me) is always in reach.
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Mic, Route as RouteIcon, Briefcase, TrendingUp, User, FileText, Settings, LogOut, Menu, X, RotateCcw, BadgeCheck, Handshake, History as HistoryIcon, Target, School, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, UI_LANGS } from '../../context/UiLangContext';
import BrandLogo from '../BrandLogo';
import ThemeToggle from '../ThemeToggle';
import { initials } from './ui';
import TopActions from '../shared/TopActions';
import api from '../../utils/api';
import { setDeviceVoice } from '../../utils/voice';

// Bottom tabs on phones; each lights up for the pages it stands for.
const TABS = [
  { to: '/learn/dashboard', label: 'nav.home', icon: Home, match: ['/learn/dashboard', '/learn/welcome', '/learn/baseline'] },
  { to: '/learn/record', label: 'nav.learn', icon: Mic, match: ['/learn/session', '/learn/record', '/learn/reviews', '/learn/skill', '/learn/history', '/learn/assigned'] },
  { to: '/learn/passport', label: 'nav.tabPassport', icon: BadgeCheck, match: ['/learn/passport'] },
  { to: '/learn/jobs', label: 'nav.tabJobs', icon: Handshake, match: ['/learn/jobs', '/learn/market', '/learn/topics', '/learn/readiness', '/learn/apply', '/learn/requests', '/learn/dayone'] },
  { to: '/learn/profile', label: 'nav.me', icon: User, match: ['/learn/profile', '/learn/resume', '/learn/settings', '/learn/notifications'] }
];

const GROUPS = [
  { label: 'nav.learn', items: [
    { to: '/learn/dashboard', label: 'nav.home', icon: Home },
    { to: '/learn/session', label: 'nav.session', icon: Mic },
    { to: '/learn/record', label: 'nav.path', icon: RouteIcon },
    { to: '/learn/reviews', label: 'nav.reviews', icon: RotateCcw },
    { to: '/learn/assigned', label: 'nav.assigned', icon: School },
    { to: '/learn/history', label: 'nav.history', icon: HistoryIcon },
    { to: '/learn/passport', label: 'nav.passport', icon: BadgeCheck }
  ] },
  { label: 'nav.career', items: [
    { to: '/learn/jobs', label: 'nav.jobs', icon: Handshake },
    { to: '/learn/readiness', label: 'nav.readiness', icon: Target },
    { to: '/learn/market', label: 'nav.market', icon: Briefcase },
    { to: '/learn/topics', label: 'nav.topics', icon: TrendingUp }
  ] },
  { label: 'nav.me', items: [
    { to: '/learn/profile', label: 'nav.profile', icon: User, end: true },
    { to: '/learn/resume', label: 'nav.resume', icon: FileText },
    { to: '/learn/notifications', label: 'nav.notifications', icon: Bell }
  ] }
];

export default function LearnerLayout() {
  const { user, logout } = useAuth();
  const { t, lang } = useUiLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);
  // The phone's voice only if the learner chose it (Settings → voice).
  useEffect(() => { api.get('/learner/profile').then(r => setDeviceVoice(r.data?.voice_prefs?.deviceVoice)).catch(() => {}); }, []);

  const langLabel = UI_LANGS.find(l => l.id === (user?.language || lang))?.label;
  const doLogout = () => { logout(); navigate('/learner-login'); };

  return (
    <div className="ln-shell">
      <div className="ln-topbar in-topbar">
        <button type="button" className="in-iconbtn" onClick={() => setOpen(true)} aria-label={t('nav.menu')} aria-expanded={open}>
          <Menu size={20} aria-hidden="true" />
        </button>
        <a href="/" className="brand-home" aria-label={t('nav.logoHome')}><BrandLogo height={28} tone="onDark" /></a>
        <ThemeToggle />
      </div>
      {open && <div className="ln-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <nav className={`ln-sidebar in-sidebar ${open ? 'is-open' : ''}`} aria-label={t('nav.main')}>
        <div className="ln-between">
          <a href="/" className="brand-home" aria-label={t('nav.logoHome')}><BrandLogo height={38} tone="onDark" /></a>
          {open && (
            <button type="button" className="in-iconbtn" onClick={() => setOpen(false)} aria-label={t('nav.closeMenu')}><X size={18} aria-hidden="true" /></button>
          )}
        </div>

        <div className="ln-usercard">
          <div className="ln-avatar">{initials(user?.name)}</div>
          <div className="ln-col" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || t('learn.learnerLayout.learner')}</span>
            <span className="ln-xs ln-muted ln-indic">{[user?.learner_ref, langLabel].filter(Boolean).join(' · ')}</span>
          </div>
        </div>

        <div className="ln-col" style={{ gap: 18 }}>
          {GROUPS.map(g => (
            <div key={g.label} className="ln-navgroup">
              <span className="ln-navlabel ln-indic">{t(g.label)}</span>
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `ln-navlink ln-indic ${isActive ? 'is-active' : ''}`}>
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{t(label)}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="ln-sidebar-foot">
          <NavLink to="/learn/settings" className={({ isActive }) => `ln-navlink ln-indic ${isActive ? 'is-active' : ''}`}><Settings size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t('nav.settings')}</span></NavLink>
          <div className="ln-row" style={{ gap: 8, alignItems: 'center' }}>
            <button type="button" className="ln-navlink ln-indic" style={{ flex: 1 }} onClick={doLogout}><LogOut size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t('nav.logout')}</span></button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="ln-main" id="main">
        <TopActions side="learner" settingsHref="/learn/settings" />
        <div key={location.pathname} className="ln-page-fade"><Outlet /></div>
      </main>

      <nav className="ln-tabbar" aria-label={t('nav.tabs')}>
        {TABS.map(({ to, label, icon: Icon, match }) => {
          const on = match.some(m => location.pathname.startsWith(m));
          return (
            <NavLink key={to} to={to} className={`ln-tab ln-indic ${on ? 'is-active' : ''}`} aria-current={on ? 'page' : undefined}>
              <Icon size={22} strokeWidth={on ? 2.2 : 1.8} aria-hidden="true" /><span>{t(label)}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
