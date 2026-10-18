// src/components/learn/ui.js
// Small shared pieces for the learner pages: status tags, match ring,
// progress bar, sample-data badge, formatters and the skill-request hook.
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import api from '../../utils/api';

import { useUiLang } from '../../context/UiLangContext';
// ─── Skill status → tag (JD skills, topic steps, "skills to learn next") ──────
// The institution owns the pathway, so skills outside it show "Not in path"
// and a Request action — never "add to path".
export const STATUS = {
  mastered:    { label: 'learn.ui.status.mastered', cls: 'ln-tag-success' },
  in_progress: { label: 'learn.ui.status.inProgress', cls: 'ln-tag-accent' },
  in_path:     { label: 'learn.ui.status.inYourPath', cls: 'ln-tag-info' },
  declared:    { label: 'learn.ui.status.selfDeclared', cls: 'ln-tag-neutral' },
  requested:   { label: 'learn.ui.status.requested', cls: 'ln-tag-warning' },
  not_in_path: { label: 'learn.ui.status.notInPath', cls: 'ln-tag-accent' }
};

export function StatusTag({ status, large }) {
  const { t } = useUiLang();
  const s = STATUS[status] || STATUS.not_in_path;
  return <span className={`ln-tag ${s.cls} ${large ? 'ln-tag-lg' : ''}`}>{t(s.label)}</span>;
}

export function SkillChip({ name, status }) {
  const { t } = useUiLang();
  const have = status === 'mastered' || status === 'declared' || status === 'in_progress';
  return (
    <span className={`ln-tag ln-tag-lg ${have ? 'ln-tag-success' : 'ln-tag-warning'}`} style={{ fontWeight: 500 }}>
      {have ? <Check size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
      {name}
      <span className="ln-sr">{have ? t('learn.ui.have') : t('learn.ui.missing')}</span>
    </span>
  );
}

export function SampleBadge() {
  const { t } = useUiLang();
  return <span className="ln-tag ln-tag-sample" title={t('learn.ui.theseFiguresPlaceholdersUntil')}>{t('learn.ui.sampleData')}</span>;
}

export function Bar({ pct, variant = '', label }) {
  const v = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className={`ln-bar ${variant}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function MatchRing({ pct, size = 72, label = 'MATCH' }) {
  const { t } = useUiLang();
  const inner = Math.round(size * 0.8);
  const color = pct >= 70 ? 'var(--status-success)' : 'var(--accent-700)';
  return (
    <div className="ln-ring" style={{ width: size, height: size, background: `conic-gradient(${color} ${pct}%, var(--color-border) 0)` }}
      role="img" aria-label={t('learn.ui.pctSkillMatch', { pct })}>
      <div style={{ width: inner, height: inner }}>
        <span style={{ fontSize: size > 100 ? 'var(--fs-h1)' : 'var(--fs-h3)', fontWeight: 700, fontFamily: size > 100 ? 'var(--font-display)' : undefined, lineHeight: 1.1 }}>{pct}%</span>
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>{label}</span>
      </div>
    </div>
  );
}

// ─── Formatters ────────────────────────────────────────────────────────────────
export const salary = (min, max) => `₹${min}–${max} LPA`;
export const minutes = (m) => {
  const total = Math.round(m || 0);
  const h = Math.floor(total / 60);
  return h ? `${h}h ${total % 60}m` : `${total}m`;
};
export const posted = (days, t) => (days <= 0 ? t('learn.ui.postedToday') : days === 1 ? t('learn.ui.postedYesterday') : days < 7 ? t('learn.ui.postedDays', { n: days }) : t('learn.ui.postedWeeks', { n: Math.round(days / 7) }));
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// ─── Request a skill from the institution ──────────────────────────────────────
// Returns request(name, source) and a Set of names already requested this
// session, so buttons can flip to "Requested" straight away.
// Skill requests the learner sent to their institution, with each one's
// status (pending / added / declined), and a short confirmation after sending.
export const REQUEST_STATUS = { pending: 'learn.ui.requestStatus.requestedWaitingForYour', added: 'learn.ui.requestStatus.addedToYourProgramme', declined: 'learn.ui.requestStatus.yourInstitutionDeclinedThis' };
export function useSkillRequests() {
  const { t } = useUiLang();
  const [statuses, setStatuses] = useState(() => new Map());
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/learner/skill-requests').then(r => setStatuses(new Map((r.data || []).map(x => [x.skill_name, x.status || 'pending'])))).catch(() => {});
  }, []);
  const requestMany = useCallback(async (names, source) => {
    setError(''); setSent(''); setBusy(true);
    const results = await Promise.allSettled(names.map(n => api.post('/learner/skill-requests', { skill_name: n, source })));
    const ok = names.filter((n, i) => results[i].status === 'fulfilled');
    setStatuses(prev => { const m = new Map(prev); ok.forEach(n => { if (!m.has(n)) m.set(n, 'pending'); }); return m; });
    if (ok.length) setSent(t('learn.ui.skillsSent', { n: ok.length }));
    if (ok.length < names.length) setError(t('learn.ui.someRequestsFailed'));
    setBusy(false);
    return ok.length;
  }, []);
  const request = useCallback((skillName, source) => requestMany([skillName], source), [requestMany]);
  const requested = { has: (n) => statuses.has(n) };
  return { request, requestMany, requested, statusOf: (n) => statuses.get(n) || null, error, sent, busy };
}

export function RequestButton({ name, source, requests, small = true }) {
  const { t } = useUiLang();
  const status = requests.statusOf(name);
  return (
    <button type="button" className={`ln-btn ln-btn-outline-accent ${small ? 'ln-btn-sm' : ''}`} disabled={!!status || requests.busy}
      onClick={() => requests.request(name, source)}
      title={status ? t(REQUEST_STATUS[status]) : t('learn.ui.institutionOwnsProgrammeAsks')}>
      {status === 'added' ? t('learn.ui.added') : status === 'declined' ? t('learn.ui.declined') : status ? t('learn.ui.requested2') : t('learn.ui.request')}
    </button>
  );
}
