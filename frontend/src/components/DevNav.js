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
      { path: '/login', label: 'Institution Login' },
      { path: '/learner-login', label: 'Learner Login' }
    ]
  },
  {
    group: 'Institution', role: 'institution', items: [
      { path: '/institution/dashboard', label: 'Institution Dashboard' },
      { path: '/institution/upload-target', label: 'Upload Capability Target' },
      { path: '/institution/engagement/new', label: 'Engagement Setup' },
      { path: '/institution/engagement/demo-eng-1', label: 'Engagement Detail' },
      { path: '/institution/mastery-log/demo-log-1', label: 'Mastery Log View' }
    ]
  },
  {
    group: 'Learner', role: 'learner', items: [
      { path: '/learn/dashboard', label: 'Learner Dashboard' },
      { path: '/learn/session', label: 'Learning Session' }
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
  toggle: { background: '#3B82F6', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 24, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' },
  panel: { width: 270, maxHeight: '72vh', overflowY: 'auto', background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' },
  header: { marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 },
  badge: { background: '#F59E0B', color: '#1E1300', fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: '2px 8px', borderRadius: 10, width: 'fit-content' },
  note: { color: '#64748B', fontSize: 11, lineHeight: 1.4 },
  roleRow: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  roleBtn: { background: '#0F172A', border: '1px solid #334155', color: '#94A3B8', padding: '8px', borderRadius: 6, fontSize: 12, cursor: 'pointer', textAlign: 'left' },
  roleBtnActive: { background: '#1E3A5F', borderColor: '#3B82F6', color: '#60A5FA' },
  roleBtnActiveGreen: { background: '#0F3A2A', borderColor: '#10B981', color: '#10B981' },
  groupLabel: { color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', margin: '14px 0 6px' },
  link: { color: '#CBD5E1', fontSize: 13, padding: '7px 8px', borderRadius: 6, cursor: 'pointer' },
  linkActive: { background: '#1E3A5F', color: '#60A5FA', fontWeight: 600 }
};
