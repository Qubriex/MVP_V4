// src/components/inst/InstitutionLayout.js
// Shared shell for every /institution/* page: a dark sidebar (so staff pages
// read as a different place from student pages) with the institution, the
// signed-in staff member, Logout, and nav grouped Overview · Teaching ·
// Insights · Institution. The signed-in staff profile is loaded once here
// and shared through useStaff(), so pages know the caller's role.
import { useUiLang } from '../../context/UiLangContext';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, Users, TrendingUp, BarChart3, ShieldCheck, UserRound, LogOut, Menu, X, ClipboardCheck, Route as RouteIcon, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fetchCached } from '../../utils/cachedGet';
import BrandLogo from '../BrandLogo';
import ThemeToggle from '../ThemeToggle';
import { initials } from '../learn/ui';
import TopActions from '../shared/TopActions';

const StaffContext = createContext(null);
export const useStaff = () => useContext(StaffContext);

export const ROLE_LABEL = { admin: 'inst.institutionLayout.roleLabel.admin', professor: 'inst.institutionLayout.roleLabel.professor', viewer: 'inst.institutionLayout.roleLabel.viewer' };

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
  const { t } = useUiLang();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState(null);
  const [alerts, setAlerts] = useState(0);

  const refresh = useCallback(() => api.get('/institution/me').then(r => setMe(r.data)).catch(() => setMe(m => m || { role: 'admin', name: t('inst.institutionLayout.staff') })), []);
  useEffect(() => { refresh(); }, [refresh]);
  // Alerts badge: from the shared overview cache (the Home page reads the same
  // data), refreshed every minute rather than on every navigation.
  useEffect(() => {
    const get = () => fetchCached('/institution/overview').then(d => setAlerts(d.alerts?.length || 0)).catch(() => {});
    get();
    const t = setInterval(() => { if (document.visibilityState === 'visible') get(); }, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const role = me?.role || 'admin';
  const groups = [
    { label: t('inst.nav.overview'), items: [{ to: '/institution/home', label: t('nav.homeShort'), icon: Home, badge: alerts || null }] },
    { label: t('inst.nav.teaching'), items: [
      { to: '/institution/cohorts', label: t('inst.nav.cohorts'), icon: LayoutGrid },
      { to: '/institution/students', label: t('inst.nav.students'), icon: Users },
      { to: '/institution/review', label: t('inst.nav.review'), icon: ClipboardCheck },
      { to: '/institution/bridges', label: t('inst.nav.bridges'), icon: RouteIcon }
    ] },
    { label: t('inst.nav.insights'), items: [
      { to: '/institution/curriculum', label: t('inst.nav.curriculum'), icon: TrendingUp },
      { to: '/institution/benchmark', label: t('inst.nav.standing'), icon: BarChart3 },
      { to: '/institution/placements', label: t('inst.nav.placements'), icon: Briefcase }
    ] },
    { label: t('inst.nav.institution'), items: [
      ...(role === 'admin' ? [{ to: '/institution/team', label: t('inst.nav.team'), icon: ShieldCheck }] : []),
      { to: '/institution/profile', label: t('inst.nav.profile'), icon: UserRound }
    ] }
  ];

  const doLogout = () => { logout(); navigate('/login'); };

  return (
    <StaffContext.Provider value={{ me, role, refresh, setMe }}>
      <div className="ln-shell">
        <div className="ln-topbar in-topbar">
          <button type="button" className="in-iconbtn" onClick={() => setOpen(true)} aria-label={t('nav.menu')} aria-expanded={open}><Menu size={20} aria-hidden="true" /></button>
          <a href="/" className="brand-home" aria-label={t('nav.logoHome')}><BrandLogo height={28} tone="onDark" /></a>
          <ThemeToggle />
        </div>
        {open && <div className="ln-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

        <nav className={`ln-sidebar in-sidebar ${open ? 'is-open' : ''}`} aria-label={t('nav.main')}>
          <div className="ln-between">
            <span className="ln-col" style={{ gap: 4 }}><a href="/" className="brand-home" aria-label={t('nav.logoHome')}><BrandLogo height={38} tone="onDark" /></a><small className="ln-xs" style={{ color: 'var(--ink-muted)', letterSpacing: '0.08em', paddingLeft: 4 }}>{t('inst.kicker')}</small></span>
            {open && <button type="button" className="in-iconbtn" onClick={() => setOpen(false)} aria-label={t('nav.closeMenu')}><X size={18} aria-hidden="true" /></button>}
          </div>
          <div className="in-org">
            <b style={{ fontWeight: 600 }}>{me?.institution_name || t('inst.institutionLayout.yourInstitution')}</b>
            {me?.department && <span>{me.department}</span>}
          </div>

          <div className="ln-col" style={{ gap: 16 }}>
            {groups.map(g => (
              <div key={g.label} className="ln-navgroup">
                <span className="ln-navlabel">{g.label}</span>
                {g.items.map(({ to, label, icon: Icon, badge }) => (
                  <NavLink key={to} to={to} className={({ isActive }) => `ln-navlink ${isActive ? 'is-active' : ''}`}>
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
                    {badge ? <span className="in-badge" aria-label={t('inst.institutionLayout.badgeItemsNeedAttention', { badge })}>{badge}</span> : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>

          <div className="in-me">
            <Avatar person={me} />
            <div className="ln-col" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--fs-small)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[me?.title, me?.name].filter(Boolean).join(' ') || me?.email || '…'}</span>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--stage-muted)' }}>{[me?.designation, t(ROLE_LABEL[role])].filter(Boolean).join(' · ')}</span>
            </div>
            <ThemeToggle />
            <button type="button" className="in-iconbtn" onClick={doLogout} aria-label={t('nav.logout')} title={t('nav.logout')}><LogOut size={18} aria-hidden="true" /></button>
          </div>
        </nav>

        <main className="ln-main" id="main"><TopActions side="staff" /><div key={location.pathname} className="ln-page-fade"><Outlet /></div></main>
      </div>
    </StaffContext.Provider>
  );
}
