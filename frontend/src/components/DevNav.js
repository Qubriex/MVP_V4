// src/components/DevNav.js
// DEV-ONLY floating navigator. Since login is bypassed (see AuthContext),
// this panel is the quickest way to reach every page directly for review —
// no need to click through the real signup/engagement flow. Remove this
// component (and its <DevNav /> mount in App.js) once auth is restored.
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SECTIONS = [
  {
    group: 'Public', items: [
      { path: '/', label: 'Landing Page' },
      { path: '/login', label: 'Staff login' },
      { path: '/learner-login', label: 'Learner Login' }
    ]
  },
  {
    group: 'Institution', role: 'institution', items: [
      { path: '/institution/home', label: 'Home' },
      { path: '/institution/welcome', label: 'Profile setup' },
      { path: '/institution/team', label: 'Team & roles' },
      { path: '/institution/students', label: 'Students & access' },
      { path: '/institution/students/add', label: 'Add students' },
      { path: '/institution/cohorts', label: 'Cohorts' },
      { path: '/institution/cohorts/new', label: 'New cohort' },
      { path: '/institution/curriculum', label: 'Curriculum vs market' },
      { path: '/institution/benchmark', label: 'Where we stand' },
      { path: '/institution/profile', label: 'My profile' }
    ]
  },
  {
    group: 'Learner', role: 'learner', items: [
      { path: '/learn/dashboard', label: 'Home dashboard' },
      { path: '/learn/welcome', label: 'First-run setup' },
      { path: '/learn/session', label: 'Voice session' },
      { path: '/learn/record', label: 'Skill path & record' },
      { path: '/learn/market', label: 'Job market' },
      { path: '/learn/market/job-001', label: 'Job detail & skill gap' },
      { path: '/learn/market/job-001/interview', label: 'Interview practice' },
      { path: '/learn/topics', label: 'Emerging topics' },
      { path: '/learn/profile', label: 'Profile & settings' },
      { path: '/learn/resume', label: 'Resume builder' }
    ]
  }
];

export default function DevNav() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  if (!auth?.devMode) return null;

  const go = (path, role) => {
    if (role && auth.role !== role) auth.loginAs(role);
    navigate(path);
  };

  return (
    <div style={S.wrap}>
      {open && (
        <div style={S.panel}>
          <div style={S.header}>
            <span style={S.badge}>DEV MODE</span>
            <span style={S.note}>Login bypassed — click to jump to any page</span>
          </div>
          <div style={S.roleRow}>
            <button style={{ ...S.roleBtn, ...(auth.role === 'institution' ? S.roleBtnActive : {}) }} onClick={() => auth.loginAs('institution')}>
              Viewing as: Institution
            </button>
            <button style={{ ...S.roleBtn, ...(auth.role === 'learner' ? S.roleBtnActiveGreen : {}) }} onClick={() => auth.loginAs('learner')}>
              Viewing as: Learner
            </button>
          </div>
          {SECTIONS.map(section => (
            <div key={section.group}>
              <div style={S.groupLabel}>{section.group}</div>
              {section.items.map(item => (
                <div
                  key={item.path}
                  style={{ ...S.link, ...(location.pathname === item.path ? S.linkActive : {}) }}
                  onClick={() => go(item.path, section.role)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <button style={S.toggle} onClick={() => setOpen(o => !o)}>
        {open ? '✕ Close Dev Nav' : '☰ Dev Nav'}
      </button>
    </div>
  );
}

const S = {
  wrap: { position: 'fixed', bottom: 16, right: 16, zIndex: 9999, fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 },
  toggle: { background: 'var(--brand-primary-strong)', color: '#FFFFFF', border: 'none', padding: '10px 18px', borderRadius: 24, fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' },
  panel: { width: 270, maxHeight: '72vh', overflowY: 'auto', background: 'var(--ink-750)', border: '1px solid var(--ink-500)', borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' },
  header: { marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 },
  badge: { background: 'var(--accent-400)', color: 'var(--brand-ink)', fontSize: 'var(--fs-caption)', fontWeight: 800, letterSpacing: 1, padding: '2px 8px', borderRadius: 10, width: 'fit-content' },
  note: { color: 'var(--ink-faint)', fontSize: 'var(--fs-caption)', lineHeight: 1.4 },
  roleRow: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  roleBtn: { background: 'var(--ink-900)', border: '1px solid var(--ink-500)', color: 'var(--ink-muted)', padding: '8px', borderRadius: 6, fontSize: 'var(--fs-caption)', cursor: 'pointer', textAlign: 'left' },
  roleBtnActive: { background: 'var(--ink-650)', borderColor: 'var(--brand-primary-strong)', color: 'var(--accent-300)' },
  roleBtnActiveGreen: { background: 'var(--ok-bg)', borderColor: 'var(--ok)', color: 'var(--ok)' },
  groupLabel: { color: 'var(--ink-faint)', fontSize: 'var(--fs-caption)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', margin: '14px 0 6px' },
  link: { color: 'var(--ink-text)', fontSize: 'var(--fs-small)', padding: '7px 8px', borderRadius: 6, cursor: 'pointer' },
  linkActive: { background: 'var(--ink-650)', color: 'var(--accent-300)', fontWeight: 600 }
};
