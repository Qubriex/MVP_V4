// src/components/inst/Crumbs.js
// Back button + breadcrumbs for staff drill-down screens
// (Cohorts › Cohort A › Node › Students). Back returns to the screen the
// person came from when there is one, so filters and tabs are kept; opened
// directly, it goes to the parent crumb.
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** @param {{ items: {label: string, to?: string}[] }} props  last item is the current page */
export default function Crumbs({ items }) {
  const navigate = useNavigate();
  const location = useLocation();
  const parent = [...items].reverse().find((c, i) => i > 0 && c.to) || items.find(c => c.to);
  const back = () => {
    if (location.key !== 'default' && window.history.length > 1) navigate(-1);
    else if (parent) navigate(parent.to);
  };
  return (
    <nav className="in-crumbs" aria-label="Breadcrumb">
      <button type="button" className="ln-btn ln-btn-sm" onClick={back}><ArrowLeft size={15} aria-hidden="true" />Back</button>
      <ol>
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`}>
            {c.to && i < items.length - 1 ? <Link to={c.to} className="ln-link">{c.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
