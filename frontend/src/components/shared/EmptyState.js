// src/components/shared/EmptyState.js — what a page says when there is
// nothing yet (and the action that fills it), and placeholder rows while
// something loads.
import React from 'react';
import { Inbox } from 'lucide-react';

import { useUiLang } from '../../context/UiLangContext';
export default function EmptyState({ title, text, action, icon: Icon = Inbox }) {
  return (
    <div className="sk-empty">
      <Icon size={22} aria-hidden="true" />
      <b>{title}</b>
      {text && <span>{text}</span>}
      {action}
    </div>
  );
}

export function LoadingRows({ rows = 3, height = 18 }) {
  const { t } = useUiLang();
  return (
    <div className="ln-col" style={{ gap: 10 }} aria-label={t('shared.emptyState.loading')} role="status">
      <span className="ln-small ln-muted">{t('shared.emptyState.loading2')}</span>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="ln-skeleton" style={{ height, borderRadius: 8, width: `${90 - i * 12}%` }} />)}
    </div>
  );
}
