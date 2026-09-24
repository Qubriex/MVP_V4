// src/components/learn/ui.js
// Small shared pieces for the learner pages: status tags, match ring,
// progress bar, sample-data badge, formatters and the skill-request hook.
import React, { useCallback, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import api from '../../utils/api';

// ─── Skill status → tag (JD skills, topic steps, "skills to learn next") ──────
// The institution owns the pathway, so skills outside it show "Not in path"
// and a Request action — never "add to path".
export const STATUS = {
  mastered:    { label: '✓ Mastered', cls: 'ln-tag-success' },
  in_progress: { label: 'In progress', cls: 'ln-tag-accent' },
  in_path:     { label: 'In your path', cls: 'ln-tag-info' },
  declared:    { label: 'Self-declared', cls: 'ln-tag-neutral' },
  requested:   { label: 'Requested', cls: 'ln-tag-warning' },
  not_in_path: { label: 'Not in path', cls: 'ln-tag-accent' }
};

export function StatusTag({ status, large }) {
  const s = STATUS[status] || STATUS.not_in_path;
  return <span className={`ln-tag ${s.cls} ${large ? 'ln-tag-lg' : ''}`}>{s.label}</span>;
}

export function SkillChip({ name, status }) {
  const have = status === 'mastered' || status === 'declared' || status === 'in_progress';
  return (
    <span className={`ln-tag ln-tag-lg ${have ? 'ln-tag-success' : 'ln-tag-warning'}`} style={{ fontWeight: 500 }}>
      {have ? <Check size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
      {name}
      <span className="ln-sr">{have ? ' (you have this)' : ' (missing)'}</span>
    </span>
  );
}

export function SampleBadge() {
  return <span className="ln-tag ln-tag-sample" title="These figures are placeholders until a live job feed is connected">Sample data</span>;
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
  const inner = Math.round(size * 0.8);
  const color = pct >= 70 ? 'var(--status-success)' : 'var(--accent-700)';
  return (
    <div className="ln-ring" style={{ width: size, height: size, background: `conic-gradient(${color} ${pct}%, var(--color-border) 0)` }}
      role="img" aria-label={`${pct}% skill match`}>
      <div style={{ width: inner, height: inner }}>
        <span style={{ fontSize: size > 100 ? 34 : 17, fontWeight: 700, fontFamily: size > 100 ? 'var(--font-display)' : undefined, lineHeight: 1.1 }}>{pct}%</span>
        <span style={{ fontSize: size > 100 ? 11 : 9, color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>{label}</span>
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
export const posted = (days) => (days <= 0 ? 'Posted today' : days === 1 ? 'Posted yesterday' : days < 7 ? `Posted ${days} days ago` : `Posted ${Math.round(days / 7)} week${days >= 14 ? 's' : ''} ago`);
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// ─── Request a skill from the institution ──────────────────────────────────────
// Returns request(name, source) and a Set of names already requested this
// session, so buttons can flip to "Requested" straight away.
export function useSkillRequests() {
  const [requested, setRequested] = useState(() => new Set());
  const [error, setError] = useState('');
  const request = useCallback(async (skillName, source) => {
    setError('');
    try {
      await api.post('/learner/skill-requests', { skill_name: skillName, source });
      setRequested(prev => new Set(prev).add(skillName));
    } catch (e) {
      setError('Could not send the request. Check your connection and try again.');
    }
  }, []);
  return { request, requested, error };
}

export function RequestButton({ name, source, requests, small = true }) {
  const done = requests.requested.has(name);
  return (
    <button type="button" className={`ln-btn ln-btn-outline-accent ${small ? 'ln-btn-sm' : ''}`} disabled={done}
      onClick={() => requests.request(name, source)}
      title="Your institution owns your programme. This asks them to add the skill.">
      {done ? 'Requested' : 'Request'}
    </button>
  );
}
