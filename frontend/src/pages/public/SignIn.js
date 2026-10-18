// src/pages/public/SignIn.js — /signin: choose who you are, then the right
// sign-in form opens. Each role keeps its own existing sign-in page.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, School, Briefcase, ShieldCheck } from 'lucide-react';
import PublicShell from '../../components/public/PublicShell';
import { useUiLang } from '../../context/UiLangContext';

const DOORS = [['/learner-login', GraduationCap, 'signin.learner', 'door.learnerText', 'door.learnerNote'], ['/login', School, 'signin.staff', 'door.staffText', 'door.staffNote'], ['/employer/login', Briefcase, 'signin.employer', 'door.employerText', 'door.employerNote']];

export default function SignIn() {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const [eid, setEid] = useState('');
  return (
    <PublicShell>
      <header className="ln-col" style={{ gap: 8 }}>
        <h1 className="ln-title">{t('signin.who')}</h1>
        <span className="ln-sub">{t('door.sub')}</span>
      </header>
      <section className="ln-grid ln-g-3" style={{ gap: 16 }}>
        {DOORS.map(([to, Icon, title, text, note]) => (
          <article key={to} className="ln-card" style={{ gap: 8 }}>
            <span className="pb-kicker"><Icon size={14} aria-hidden="true" />{t(title)}</span>
            <span className="ln-small">{t(text)}</span>
            <Link to={to} className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>{t('door.continue')}</Link>
            <span className="ln-xs ln-muted">{t(note)}</span>
          </article>
        ))}
      </section>
      <section className="ln-card" style={{ gap: 8 }}>
        <span className="pb-kicker"><ShieldCheck size={14} aria-hidden="true" />{t('door.anyone')}</span>
        <form className="ln-row" style={{ gap: 8 }} onSubmit={e => { e.preventDefault(); if (eid.trim()) navigate(`/verify/${eid.trim().toUpperCase()}`); }}>
          <label htmlFor="door-eid" className="ln-sr">{t('verify.idLabel')}</label>
          <input id="door-eid" className="ln-input in-code" placeholder="QBX-XXXXXXXXXXXX" value={eid} onChange={e => setEid(e.target.value)} />
          <button type="submit" className="ln-btn">{t('verify.verify')}</button>
        </form>
        <span className="ln-xs ln-muted">{t('door.verifyNote')}</span>
      </section>
      <p className="ln-xs ln-muted">{t('door.terms')}</p>
    </PublicShell>
  );
}
