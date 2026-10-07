// src/components/public/PublicShell.js — header and footer for the public
// pages (v4.3 canvas P1–P4): For learners · For colleges · For employers ·
// Verify a Passport · Pricing · Live demo · EN · తెలుగు · हिंदी · Sign in.
import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import PhoenixMark from '../PhoenixMark';
import ThemeToggle from '../ThemeToggle';
import { useUiLang } from '../../context/UiLangContext';

const LINKS = [['/#learners', 'For learners'], ['/#colleges', 'For colleges'], ['/#employers', 'For employers'], ['/verify', 'Verify a Passport'], ['/pricing', 'Pricing'], ['/demo', 'Live demo']];
const LANGS = [['english', 'EN'], ['telugu', 'తెలుగు'], ['hindi', 'हिंदी']];

export default function PublicShell({ children }) {
  const { lang, setLang } = useUiLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="pb-page">
      <header className="pb-head">
        <Link to="/" className="ln-brand" style={{ fontSize: 20, textDecoration: 'none' }}><PhoenixMark size={26} />qubirex</Link>
        <nav className={`pb-nav ${open ? 'is-open' : ''}`} aria-label="Main">
          {LINKS.map(([to, label]) => (to.startsWith('/#') ? <a key={to} href={to} onClick={() => setOpen(false)}>{label}</a> : <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>))}
        </nav>
        <div className="ln-row" style={{ gap: 8 }}>
          <div className="pb-langs" role="group" aria-label="Language">
            {LANGS.map(([k, label]) => <button key={k} type="button" className={`ln-indic ${lang === k ? 'is-on' : ''}`} aria-pressed={lang === k} onClick={() => setLang(k)}>{label}</button>)}
          </div>
          <ThemeToggle />
          <Link to="/signin" className="ln-btn ln-btn-primary ln-btn-sm">Sign in</Link>
          <button type="button" className="in-iconbtn pb-menu" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </header>
      <main className="pb-main">{children}</main>
      <footer className="pb-foot">
        <span>Inferexaa Private Limited · Hyderabad</span>
        <nav className="ln-row ln-wrap" style={{ gap: 16 }} aria-label="Legal">
          <Link to="/legal/privacy">Privacy</Link><Link to="/legal/terms">Terms</Link><Link to="/legal/dpdp">DPDP Act 2023</Link><Link to="/legal/grievance">Grievance officer</Link>
        </nav>
      </footer>
    </div>
  );
}
