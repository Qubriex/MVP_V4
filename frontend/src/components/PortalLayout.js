// src/components/PortalLayout.js
// Shell for the employer portal and the Qubirex admin area: the same dark
// sidebar as the institution pages, with a kicker naming the portal, a flat
// nav list, the signed-in account and Logout.
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PhoenixMark from './PhoenixMark';
import ThemeToggle from './ThemeToggle';

export default function PortalLayout({ kicker, org, account, items, loginPath, context }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  const doLogout = () => { logout(); navigate(loginPath); };

  return (
    <div className="ln-shell">
      <div className="ln-topbar in-topbar">
        <button type="button" className="in-iconbtn" onClick={() => setOpen(true)} aria-label="Menu" aria-expanded={open}><Menu size={20} aria-hidden="true" /></button>
        <span className="ln-brand" style={{ fontSize: 18 }}><PhoenixMark size={24} />Qubirex</span>
        <ThemeToggle />
      </div>
      {open && <div className="ln-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <nav className={`ln-sidebar in-sidebar ${open ? 'is-open' : ''}`} aria-label={`${kicker} navigation`}>
        <div className="ln-between">
          <span className="ln-brand"><PhoenixMark size={30} /><span>Qubirex<small>{kicker}</small></span></span>
          {open && <button type="button" className="in-iconbtn" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} aria-hidden="true" /></button>}
        </div>
        {org && <div className="in-org">{org}</div>}
        <div className="ln-navgroup">
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `ln-navlink ${isActive ? 'is-active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
              {badge ? <span className="in-badge">{badge}</span> : null}
            </NavLink>
          ))}
        </div>
        <div className="in-me">
          <div className="ln-col" style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account?.primary || '…'}</span>
            {account?.secondary && <span style={{ fontSize: 11, color: 'var(--stage-muted)' }}>{account.secondary}</span>}
          </div>
          <ThemeToggle />
          <button type="button" className="in-iconbtn" onClick={doLogout} aria-label="Log out" title="Log out"><LogOut size={18} aria-hidden="true" /></button>
        </div>
      </nav>

      <main className="ln-main" id="main"><Outlet context={context} /></main>
    </div>
  );
}
