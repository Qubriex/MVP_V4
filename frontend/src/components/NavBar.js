// src/components/NavBar.js
// Shared sticky/blurred nav chrome used by every page. Pages pass their own
// `right` content (login buttons, user menu, logout, language badge, etc.)
// so page-specific functionality is untouched — only the visual frame
// (brand mark, blur-on-scroll, spacing, theme toggle) is centralized here.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PhoenixMark from './PhoenixMark';
import ThemeToggle from './ThemeToggle';

export default function NavBar({ brandHref = '/', links = [], right = null }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container nav-inner">
        <Link to={brandHref} className="nav-brand">
          <PhoenixMark size={26} />
          QUBIREX
        </Link>
        <div className="nav-links">
          {links.map(l => (
            <Link key={l.to} to={l.to} className={`nav-link ${l.active ? 'is-active' : ''}`}>
              <span className="nav-link-label">{l.label}</span>
            </Link>
          ))}
          {right}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
