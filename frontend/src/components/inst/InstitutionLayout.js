// src/components/inst/InstitutionLayout.js
// Shared shell for every /institution/* page: a dark sidebar (so staff pages
// read as a different place from student pages) with the institution, the
// signed-in staff member, Logout, and nav grouped Overview · Teaching ·
// Insights · Institution. The signed-in staff profile is loaded once here
// and shared through useStaff(), so pages know the caller's role.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, Users, TrendingUp, BarChart3, ShieldCheck, UserRound, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import PhoenixMark from '../PhoenixMark';
import ThemeToggle from '../ThemeToggle';
import { initials } from '../learn/ui';

const StaffContext = createContext(null);
export const useStaff = () => useContext(StaffContext);

export const ROLE_LABEL = { admin: 'Admin', professor: 'Professor', viewer: 'Viewer' };

export function Avatar({ person, size = 36, className = '' }) {
  const name = [person?.title, person?.name].filter(Boolean).join(' ') || person?.email || '';
  return (
    <div className={`ln-avatar in-photo ${className}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {person?.photo_data_url ? <img src={person.photo_data_url} alt="" /> : initials(person?.name || person?.email || '?')}
      <span className="ln-sr">{name}</span>
    </div>
  );
}

export default function InstitutionLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState(null);
  const [alerts, setAlerts] = useState(0);

  const refresh = useCallback(() => api.get('/institution/me').then(r => setMe(r.data)).catch(() => setMe(m => m || { role: 'admin', name: 'Staff' })), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { api.get('/institution/overview').then(r => setAlerts(r.data.alerts?.length || 0)).catch(() => {}); }, [location.pathname]);
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const role = me?.role || 'admin';
  const groups = [
    { label: 'Overview', items: [{ to: '/institution/home', label: 'Home', icon: Home, badge: alerts || null }] },
    { label: 'Teaching', items: [
      { to: '/institution/cohorts', label: 'Cohorts', icon: LayoutGrid },
      { to: '/institution/students', label: 'Students & access', icon: Users }
    ] },
    { label: 'Insights', items: [
      { to: '/institution/curriculum', label: 'Curriculum vs market', icon: TrendingUp },
      { to: '/institution/benchmark', label: 'Where we stand', icon: BarChart3 }
    ] },
    { label: 'Institution', items: [
      ...(role === 'admin' ? [{ to: '/institution/team', label: 'Team & roles', icon: ShieldCheck }] : []),
      { to: '/institution/profile', label: 'My profile', icon: UserRound }
    ] }
  ];

  const doLogout = () => { logout(); navigate('/login'); };

  return (
    <StaffContext.Provider value={{ me, role, refresh, setMe }}>
      <div className="ln-shell">
        <div className="ln-topbar in-topbar">
          <button type="button" className="in-iconbtn" onClick={() => setOpen(true)} aria-label="Menu" aria-expanded={open}><Menu size={20} aria-hidden="true" /></button>
          <span className="ln-brand" style={{ fontSize: 18 }}><PhoenixMark size={24} />Qubirex</span>
          <ThemeToggle />
        </div>
        {open && <div className="ln-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

        <nav className={`ln-sidebar in-sidebar ${open ? 'is-open' : ''}`} aria-label="Institution navigation">
          <div className="ln-between">
            <span className="ln-brand"><PhoenixMark size={30} /><span>Qubirex<small>FOR INSTITUTIONS</small></span></span>
            {open && <button type="button" className="in-iconbtn" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} aria-hidden="true" /></button>}
          </div>
          <div className="in-org">
            <b style={{ fontWeight: 600 }}>{me?.institution_name || 'Your institution'}</b>
            {me?.department && <span>{me.department}</span>}
          </div>

          <div className="ln-col" style={{ gap: 16 }}>
            {groups.map(g => (
              <div key={g.label} className="ln-navgroup">
                <span className="ln-navlabel">{g.label}</span>
                {g.items.map(({ to, label, icon: Icon, badge }) => (
                  <NavLink key={to} to={to} className={({ isActive }) => `ln-navlink ${isActive ? 'is-active' : ''}`}>
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
                    {badge ? <span className="in-badge" aria-label={`${badge} items need attention`}>{badge}</span> : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>

          <div className="in-me">
            <Avatar person={me} />
            <div className="ln-col" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[me?.title, me?.name].filter(Boolean).join(' ') || me?.email || '…'}</span>
              <span style={{ fontSize: 11, color: 'var(--stage-muted)' }}>{[me?.designation, ROLE_LABEL[role]].filter(Boolean).join(' · ')}</span>
            </div>
            <ThemeToggle />
            <button type="button" className="in-iconbtn" onClick={doLogout} aria-label="Log out" title="Log out"><LogOut size={18} aria-hidden="true" /></button>
          </div>
        </nav>

        <main className="ln-main" id="main"><Outlet /></main>
      </div>
    </StaffContext.Provider>
  );
}
