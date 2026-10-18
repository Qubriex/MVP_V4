// src/components/PortalLayout.js
// Shell for the employer portal and the Qubirex admin area: the same dark
// sidebar as the institution pages, with a kicker naming the portal, a flat
// nav list, the signed-in account and Logout.
import { useUiLang } from '../context/UiLangContext';
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import TopActions from './shared/TopActions';

export default function PortalLayout({ kicker, org, account, items, loginPath, context, side = null }) {
  const { t } = useUiLang();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  const doLogout = () => { logout(); navigate(loginPath); };

  return (
    <div className="ln-shell">
      <div className="ln-topbar in-topbar">
        <button type="button" className="in-iconbtn" onClick={() => setOpen(true)} aria-label={t('nav.menu')} aria-expanded={open}><Menu size={20} aria-hidden="true" /></button>
        <a href="/" className="brand-home" aria-label={t('nav.logoHome')}><BrandLogo height={28} tone="onDark" /></a>
        <ThemeToggle />
      </div>
      {open && <div className="ln-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <nav className={`ln-sidebar in-sidebar ${open ? 'is-open' : ''}`} aria-label={t('ui.portalLayout.kickerNavigation', { kicker })}>
        <div className="ln-between">
          <span className="ln-col" style={{ gap: 4 }}><a href="/" className="brand-home" aria-label={t('nav.logoHome')}><BrandLogo height={38} tone="onDark" /></a><small className="ln-xs" style={{ color: 'var(--ink-muted)', letterSpacing: '0.08em', paddingLeft: 4 }}>{kicker}</small></span>
          {open && <button type="button" className="in-iconbtn" onClick={() => setOpen(false)} aria-label={t('nav.closeMenu')}><X size={18} aria-hidden="true" /></button>}
        </div>
        {org && <div className="in-org">{org}</div>}
        <div className="ln-navgroup">
          {items.map(({ to, label, icon: Icon, badge, badgeLabel }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `ln-navlink ${isActive ? 'is-active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
              {badge ? <span className="in-badge" title={badgeLabel || undefined}><span aria-hidden="true">{badge}</span>{badgeLabel && <span className="ln-sr">{badgeLabel}</span>}</span> : null}
            </NavLink>
          ))}
        </div>
        <div className="in-me">
          <div className="ln-col" style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 'var(--fs-small)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account?.primary || '…'}</span>
            {account?.secondary && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--stage-muted)' }}>{account.secondary}</span>}
          </div>
          <ThemeToggle />
          <button type="button" className="in-iconbtn" onClick={doLogout} aria-label={t('nav.logout')} title={t('nav.logout')}><LogOut size={18} aria-hidden="true" /></button>
        </div>
      </nav>

      <main className="ln-main" id="main">{side && <TopActions side={side} />}<div key={location.pathname} className="ln-page-fade"><Outlet context={context} /></div></main>
    </div>
  );
}
