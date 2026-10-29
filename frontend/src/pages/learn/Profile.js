// src/pages/learn/Profile.js — /learn/profile
// Personal info, education, experience, projects, skills (verified by
// Qubirex vs self-declared), certifications, career goals, learning & voice
// preferences, and account. Saved in one go with "Save changes".
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bar, initials } from '../../components/learn/ui';
import { errMsg } from '../../utils/errors';
import {
  useProfileDraft, Section, PersonalSection, EducationSection, ExperienceSection, ProjectsSection,
  SkillsSection, CertificationsSection, GoalsSection, VoiceSection
} from '../../components/learn/ProfileSections';

import { useUiLang } from '../../context/UiLangContext';
import { LoadingRows } from '../../components/shared/EmptyState';
const NAV = [
  ['personal', 'learn.profile.nav.personalInfo', 'personal'], ['education', 'learn.profile.nav.education', 'education'], ['experience', 'learn.profile.nav.experience', null],
  ['projects', 'learn.profile.nav.projects', 'projects'], ['skills', 'learn.profile.nav.skills', 'skills'], ['certifications', 'learn.profile.nav.certifications', null],
  ['goals', 'learn.profile.nav.careerGoals', 'goals'], ['preferences', 'lj.profile.voice', undefined], ['account', 'learn.profile.nav.accountSharing', undefined]
];
const MISSING_LABEL = { personal: 'learn.profile.missingLabel.yourDetails', education: 'learn.dashboard.sectionNames.education', projects: 'learn.profile.missingLabel.projects', skills: 'learn.dashboard.sectionNames.skills', goals: 'learn.profile.missingLabel.goals' };


export default function Profile() {
  const { t } = useUiLang();
  const form = useProfileDraft();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { draft, profile } = form;

  useEffect(() => {
    if (draft && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [draft, location.hash]);

  if (!draft) return <LoadingRows rows={5} />;
  const c = profile.completeness || { pct: 0, sections: {}, missing: [] };
  const missing = c.missing.filter(k => MISSING_LABEL[k]);

  return (
    <>
      <section className="ln-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '24px 28px' }}>
        <div className="ln-avatar ln-avatar-lg" aria-hidden="true">{initials(draft.name)}</div>
        <div className="ln-col" style={{ gap: 4, flex: '1 1 260px' }}>
          <h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{draft.name}</h1>
          {draft.headline && <span style={{ fontSize: 'var(--fs-body)' }}>{draft.headline}</span>}
          <span className="ln-small ln-muted">{[draft.learner_ref, draft.engagement_title, draft.city].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="ln-col" style={{ width: 260, gap: 8 }}>
          <div className="ln-between" style={{ fontSize: 'var(--fs-body)' }}><span style={{ fontWeight: 600 }}>{t('learn.profile.profileStrength')}</span><b>{c.pct}%</b></div>
          <Bar pct={c.pct} label={t('learn.profile.profileStrength')} />
          <span className="ln-xs ln-muted">{missing.length ? t('learn.profile.addToReach', { sections: missing.map(k => t(MISSING_LABEL[k])).join(', ') }) : t('learn.profile.completeNiceWork')}</span>
        </div>
        <Link to="/learn/resume" className="ln-btn ln-btn-primary">{t('learn.profile.buildResume')}</Link>
      </section>

      <nav className="ln-row ln-wrap" style={{ gap: 8 }} aria-label={t('lj.profile.more')}>
        <Link className="ln-btn ln-btn-sm" to="/learn/resume">{t('nav.resume')}</Link>
        <Link className="ln-btn ln-btn-sm" to="/learn/passport">{t('nav.passport')}</Link>
        <Link className="ln-btn ln-btn-sm" to="/learn/notifications">{t('lj.profile.notifications')}</Link>
        <Link className="ln-btn ln-btn-sm" to="/learn/settings">{t('learn.profile.settings')}</Link>
        <Link className="ln-btn ln-btn-sm ln-btn-ghost" to="/learn/welcome">{t('lj.profile.welcomeAgain')}</Link>
      </nav>

      {form.offline && <div className="ln-note">{t('learn.profile.showingSampleProfileData')}</div>}

      <div className="ln-grid ln-g-side">
        <nav aria-label={t('learn.profile.profileSections')} className="ln-col" style={{ gap: 2, position: 'sticky', top: 24 }}>
          {NAV.map(([id, label, key]) => {
            const state = key === undefined ? '' : key === null ? t('learn.profile.optional') : c.sections[key] ? t('learn.profile.done') : t('learn.profile.add');
            return (
              <a key={id} href={`#${id}`} className={`ln-navlink ${location.hash === `#${id}` ? 'is-active' : ''}`} style={{ justifyContent: 'space-between' }}
                onClick={(e) => { e.preventDefault(); navigate(`#${id}`, { replace: true }); }}>
                <span>{t(label)}</span>
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
          <Section id="account" title={t('learn.profile.accountPinSharing')}>
            <span className="ln-small">{t('learn.profile.signLearnerReferenceCohort')}{' '} <Link to="/learn/settings" className="ln-link">{t('learn.profile.settings')}</Link>.</span>
            <label className="ln-toggle-row" style={{ alignItems: 'flex-start' }}>
              <span className="ln-col" style={{ gap: 2 }}><span>{t('learn.profile.shareMyCapabilityRecord')}</span>
                <span className="ln-xs ln-muted">{t('learn.profile.letsProfessorsListAmong')}</span></span>
              <input type="checkbox" checked={!!draft.share_with_institution} onChange={e => form.set('share_with_institution', e.target.checked)} />
            </label>
            <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { logout(); navigate('/learner-login'); }}>{t('learn.profile.signOutDevice')}</button>
          </Section>

          <div className="ln-row ln-wrap ln-savebar" style={{ justifyContent: 'flex-end', gap: 10, padding: '12px 0', background: 'var(--color-bg)' }}>
            {form.status === 'saved' && <span className="ln-small" style={{ color: 'var(--status-success)' }} role="status">{t('learn.profile.saved')}</span>}
            {form.status && form.status !== 'saved' && <span className="ln-small" style={{ color: 'var(--status-danger)' }} role="alert">{form.status}</span>}
            <button type="button" className="ln-btn" style={{ minHeight: 48, fontSize: 'var(--fs-body)' }} onClick={form.discard} disabled={!form.dirty || form.saving}>{t('learn.profile.discard')}</button>
            <button type="button" className="ln-btn ln-btn-primary" style={{ minHeight: 48, fontSize: 'var(--fs-body)' }} onClick={form.save} disabled={!form.dirty || form.saving}>{form.saving ? t('learn.profile.saving') : t('learn.profile.saveChanges')}</button>
          </div>
        </div>
      </div>
    </>
  );
}
