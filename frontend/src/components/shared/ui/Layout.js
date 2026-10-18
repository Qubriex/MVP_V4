// Card, PageHeader, StatTile, Tabs and Skeleton.
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { HowCounted } from '../Popover';
import { SmallSample } from '../SampleSize';

import { useUiLang } from '../../../context/UiLangContext';
export function Card({ as: As = 'section', className = '', interactive = false, children, ...rest }) {
  return <As className={`ln-card ${interactive ? 'ui-card-hover' : ''} ${className}`} {...rest}>{children}</As>;
}

/** Title, subtitle, actions and an optional breadcrumb — the top of every page. */
export function PageHeader({ title, subtitle, actions, crumbs }) {
  const { t } = useUiLang();
  return (
    <header className="ui-pagehead">
      {crumbs && (
        <nav aria-label={t('ui.layout.breadcrumb')} className="ui-crumbs">
          {crumbs.map((c, i) => (
            <span key={i} className="ln-row" style={{ gap: 4 }}>
              {c.to ? <Link to={c.to} className="ln-link ln-small">{c.label}</Link> : <span className="ln-small" aria-current="page">{c.label}</span>}
              {i < crumbs.length - 1 && <ChevronRight size={14} aria-hidden="true" />}
            </span>
          ))}
        </nav>
      )}
      <div className="ui-pagehead-row">
        <div className="ln-col" style={{ gap: 4, minWidth: 0 }}>
          <h1 className="ln-title">{title}</h1>
          {subtitle && <p className="ln-sub" style={{ margin: 0 }}>{subtitle}</p>}
        </div>
        {actions && <div className="ui-pagehead-actions">{actions}</div>}
      </div>
    </header>
  );
}

/** One number with its label, a "How it's counted" link and the small-sample pill. */
export function StatTile({ label, value, note, howCounted, sample, onClick }) {
  const body = (
    <>
      <span className="ln-small ln-muted">{label}</span>
      <span className="ln-stat">{value}</span>
      {note && <span className="ln-xs ln-muted">{note}</span>}
      {(howCounted || sample != null) && <span className="ln-row ln-wrap" style={{ gap: 8 }}>{howCounted && <HowCounted>{howCounted}</HowCounted>}<SmallSample n={sample} /></span>}
    </>
  );
  return onClick
    ? <button type="button" className="ln-card ln-card-sm ui-stat ui-card-hover" onClick={onClick}>{body}</button>
    : <div className="ln-card ln-card-sm ui-stat">{body}</div>;
}

/** Tabs with arrow-key navigation. tabs: [{ id, label }]. */
export function Tabs({ tabs, value, onChange, label }) {
  const onKey = (e, i) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = tabs[(i + d + tabs.length) % tabs.length];
    onChange(n.id);
    e.currentTarget.parentElement.querySelector(`[data-tab="${n.id}"]`)?.focus();
  };
  return (
    <div className="ln-tabs" role="tablist" aria-label={label}>
      {tabs.map((tb, i) => <button key={tb.id} data-tab={tb.id} type="button" role="tab" className="ln-tab" aria-selected={value === tb.id} tabIndex={value === tb.id ? 0 : -1} onClick={() => onChange(tb.id)} onKeyDown={e => onKey(e, i)}>{tb.label}</button>)}
    </div>
  );
}

export function Skeleton({ lines = 3, height = 16, card = false }) {
  const rows = Array.from({ length: lines }, (_, i) => <span key={i} className="ln-skeleton" style={{ height, width: `${96 - i * 14}%` }} />);
  return <div className={`ui-skeleton ${card ? 'ln-card' : ''}`} aria-hidden="true">{rows}</div>;
}
