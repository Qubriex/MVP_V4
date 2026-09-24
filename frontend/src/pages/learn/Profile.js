// src/pages/learn/Profile.js — /learn/profile
// Personal info, education, experience, projects, skills (verified by
// Qubirex vs self-declared), certifications, career goals, learning & voice
// preferences, and account. Saved in one go with "Save changes".
import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bar, initials } from '../../components/learn/ui';
import {
  useProfileDraft, Section, PersonalSection, EducationSection, ExperienceSection, ProjectsSection,
  SkillsSection, CertificationsSection, GoalsSection, VoiceSection
} from '../../components/learn/ProfileSections';

const NAV = [
  ['personal', 'Personal info', 'personal'], ['education', 'Education', 'education'], ['experience', 'Experience', null],
  ['projects', 'Projects', 'projects'], ['skills', 'Skills', 'skills'], ['certifications', 'Certifications', null],
  ['goals', 'Career goals', 'goals'], ['preferences', 'Learning & voice', 'preferences'], ['account', 'Account & PIN', undefined]
];
const MISSING_LABEL = { personal: 'your details', education: 'education', projects: 'projects', skills: 'skills', goals: 'goals' };

export default function Profile() {
  const form = useProfileDraft();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { draft, profile } = form;

  useEffect(() => {
    if (draft && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [draft, location.hash]);

  if (!draft) return <p className="ln-muted">Loading…</p>;
  const c = profile.completeness || { pct: 0, sections: {}, missing: [] };
  const missing = c.missing.filter(k => MISSING_LABEL[k]);

  return (
    <>
      <section className="ln-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '24px 28px' }}>
        <div className="ln-avatar ln-avatar-lg" aria-hidden="true">{initials(draft.name)}</div>
        <div className="ln-col" style={{ gap: 4, flex: '1 1 260px' }}>
          <h1 className="ln-title" style={{ fontSize: 30 }}>{draft.name}</h1>
          {draft.headline && <span style={{ fontSize: 15 }}>{draft.headline}</span>}
          <span className="ln-small ln-muted">{[draft.learner_ref, draft.engagement_title, draft.city].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="ln-col" style={{ width: 260, gap: 8 }}>
          <div className="ln-between" style={{ fontSize: 14 }}><span style={{ fontWeight: 600 }}>Profile strength</span><b>{c.pct}%</b></div>
          <Bar pct={c.pct} label="Profile strength" />
          <span className="ln-xs ln-muted">{missing.length ? `Add ${missing.map(k => MISSING_LABEL[k]).join(' and ')} to reach 100%` : 'Complete — nice work.'}</span>
        </div>
        <Link to="/learn/resume" className="ln-btn ln-btn-primary">Build resume →</Link>
      </section>

      {form.offline && <div className="ln-note">Showing sample profile data — the server isn’t reachable, so changes can’t be saved yet.</div>}

      <div className="ln-grid ln-g-side">
        <nav aria-label="Profile sections" className="ln-col" style={{ gap: 2, position: 'sticky', top: 24 }}>
          {NAV.map(([id, label, key]) => {
            const state = key === undefined ? '' : key === null ? 'Optional' : c.sections[key] ? 'Done' : 'Add';
            return (
              <a key={id} href={`#${id}`} className={`ln-navlink ${location.hash === `#${id}` ? 'is-active' : ''}`} style={{ justifyContent: 'space-between' }}
                onClick={(e) => { e.preventDefault(); navigate(`#${id}`, { replace: true }); }}>
                <span>{label}</span>
                <span className="ln-xs" style={{ fontWeight: 600, color: state === 'Done' ? 'var(--status-success)' : state === 'Add' ? 'var(--accent-ink)' : 'var(--color-text-muted)' }}>{state}</span>
              </a>
            );
          })}
        </nav>

        <div className="ln-col" style={{ gap: 20, minWidth: 0 }}>
          <PersonalSection form={form} />
          <EducationSection form={form} />
          <ExperienceSection form={form} />
          <ProjectsSection form={form} />
          <SkillsSection form={form} />
          <CertificationsSection form={form} />
          <GoalsSection form={form} />
          <VoiceSection form={form} />
          <Section id="account" title="Account and PIN">
            <span className="ln-small">Your sign-in is your learner reference, engagement ID and a 6-digit PIN from your institution. To change or reset your PIN, ask your programme coordinator.</span>
            <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { logout(); navigate('/learner-login'); }}>Sign out of this device</button>
          </Section>

          <div className="ln-row ln-wrap" style={{ justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, padding: '12px 0', background: 'var(--color-bg)' }}>
            {form.status === 'saved' && <span className="ln-small" style={{ color: 'var(--status-success)' }} role="status">Saved</span>}
            {form.status && form.status !== 'saved' && <span className="ln-small" style={{ color: 'var(--status-danger)' }} role="alert">{form.status}</span>}
            <button type="button" className="ln-btn" style={{ minHeight: 48, fontSize: 15 }} onClick={form.discard} disabled={!form.dirty || form.saving}>Discard</button>
            <button type="button" className="ln-btn ln-btn-primary" style={{ minHeight: 48, fontSize: 15 }} onClick={form.save} disabled={!form.dirty || form.saving}>{form.saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
