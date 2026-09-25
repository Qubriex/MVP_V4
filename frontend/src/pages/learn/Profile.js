// src/pages/learn/Profile.js — /learn/profile
// Personal info, education, experience, projects, skills (verified by
// Qubirex vs self-declared), certifications, career goals, learning & voice
// preferences, and account. Saved in one go with "Save changes".
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
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

function ChangePin() {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const save = async (e) => {
    e.preventDefault(); setMsg('');
    if (!/^\d{6}$/.test(pin)) { setMsg('Your PIN must be exactly 6 digits.'); return; }
    try { await api.put('/learner/pin', { new_pin: pin }); setPin(''); setMsg('PIN changed. Use it next time you sign in.'); } catch (err) { setMsg(err.response?.data?.error || 'Couldn’t change your PIN.'); }
  };
  return (
    <form className="ln-row ln-wrap" style={{ gap: 10, alignItems: 'flex-end' }} onSubmit={save}>
      <div className="ln-field" style={{ width: 200 }}><label className="ln-label" htmlFor="chpin">New PIN</label>
        <input id="chpin" className="ln-input" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /></div>
      <button type="submit" className="ln-btn" disabled={pin.length !== 6}>Change PIN</button>
      {msg && <span className="ln-small" role="status">{msg}</span>}
    </form>
  );
}

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
          <Section id="account" title="Account, PIN and sharing">
            <span className="ln-small">You sign in with your learner reference, your cohort’s join code and your 6-digit PIN. Forgot it? Use “Forgot PIN?” on the sign-in page and your professor will reset it.</span>
            <ChangePin />
            <label className="ln-toggle-row" style={{ alignItems: 'flex-start' }}>
              <span className="ln-col" style={{ gap: 2 }}><span>Share my capability record with my institution’s placement cell</span>
                <span className="ln-xs ln-muted">Lets your professors list you among students closest to job-ready, with your verified skills and job match. Off by default; you can turn it off any time.</span></span>
              <input type="checkbox" checked={!!draft.share_with_institution} onChange={e => form.set('share_with_institution', e.target.checked)} />
            </label>
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
