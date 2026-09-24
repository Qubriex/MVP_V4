// src/components/learn/LearnerLayout.js
// Shared shell for every /learn/* page except the voice session: a sidebar
// with the learner card and three nav groups (Learn · Career · Me). Below
// 960px the sidebar becomes a drawer opened from a slim top bar.
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Mic, Route as RouteIcon, Briefcase, TrendingUp, User, FileText, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, UI_LANGS } from '../../context/UiLangContext';
import PhoenixMark from '../PhoenixMark';
import ThemeToggle from '../ThemeToggle';
import { initials } from './ui';

const GROUPS = [
  { label: 'nav.learn', items: [
    { to: '/learn/dashboard', label: 'nav.home', icon: Home },
    { to: '/learn/session', label: 'nav.session', icon: Mic },
    { to: '/learn/record', label: 'nav.path', icon: RouteIcon }
  ] },
  { label: 'nav.career', items: [
    { to: '/learn/market', label: 'nav.market', icon: Briefcase },
    { to: '/learn/topics', label: 'nav.topics', icon: TrendingUp }
  ] },
  { label: 'nav.me', items: [
    { to: '/learn/profile', label: 'nav.profile', icon: User, end: true },
    { to: '/learn/resume', label: 'nav.resume', icon: FileText }
  ] }
];

export default function LearnerLayout() {
  const { user, logout } = useAuth();
  const { t, lang } = useUiLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const langLabel = UI_LANGS.find(l => l.id === (user?.language || lang))?.label;
  const doLogout = () => { logout(); navigate('/learner-login'); };

  return (
    <div className="ln-shell">
      <div className="ln-topbar">
        <button type="button" className="ln-btn ln-btn-sm" onClick={() => setOpen(true)} aria-label={t('nav.menu')} aria-expanded={open}>
          <Menu size={18} aria-hidden="true" />
        </button>
        <span className="ln-brand" style={{ fontSize: 18 }}><PhoenixMark size={24} />Qubirex</span>
        <ThemeToggle />
      </div>
      {open && <div className="ln-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <nav className={`ln-sidebar ${open ? 'is-open' : ''}`} aria-label="Learner navigation">
        <div className="ln-between">
          <span className="ln-brand"><PhoenixMark size={30} />Qubirex</span>
          {open && (
            <button type="button" className="ln-btn ln-btn-sm" onClick={() => setOpen(false)} aria-label="Close menu"><X size={16} aria-hidden="true" /></button>
          )}
        </div>

        <div className="ln-usercard">
          <div className="ln-avatar">{initials(user?.name)}</div>
          <div className="ln-col" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Learner'}</span>
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
          <NavLink to="/learn/profile#preferences" className="ln-navlink ln-indic"><Settings size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t('nav.settings')}</span></NavLink>
          <button type="button" className="ln-navlink ln-indic" onClick={doLogout}><LogOut size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t('nav.logout')}</span></button>
          <div style={{ padding: '8px 12px 0' }}><ThemeToggle /></div>
        </div>
      </nav>

      <main className="ln-main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
