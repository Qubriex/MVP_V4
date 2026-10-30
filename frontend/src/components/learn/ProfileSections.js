// src/components/learn/ProfileSections.js
// Profile form state + the section forms, shared by /learn/profile and the
// first-run /learn/welcome flow. Name and learner reference come from the
// institution and are read-only; everything else is the learner's own.
import React, { useCallback, useEffect, useState } from 'react';
import { Mic, Play, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, UI_LANGS, speechTag } from '../../context/UiLangContext';
import api, { getOr } from '../../utils/api';
import { useSpeechInput, useSpeechOutput, setDeviceVoice } from '../../utils/voice';
import { MOCK_PROFILE } from '../../utils/learnerMockData';
import { useLowBandwidth } from '../../utils/lowBandwidth';
import { errMsg } from '../../utils/errors';
import { Select } from '../shared/ui';

const EDITABLE = ['email', 'phone', 'city', 'link_url', 'headline', 'about', 'target_roles', 'preferred_cities', 'graduation_year',
  'expected_salary', 'self_skills', 'experience', 'certifications', 'ui_language', 'voice_prefs', 'education', 'projects',
  'share_with_institution'];
// Low-bandwidth mode (v4.3 §19) is a setting of this device, not the profile.
export function LowBandwidthToggle() {
  const { t } = useUiLang();
  const [on, set] = useLowBandwidth();
  return (
    <label className="ln-toggle-row">
      <span>{t('learn.profileSections.lowBandwidthModeDevice')}<span className="ln-xs ln-muted" style={{ display: 'block' }}>{t('learn.profileSections.textFirstNoAutomatic')}</span></span>
      <input type="checkbox" checked={on} onChange={e => set(e.target.checked)} />
    </label>
  );
}

export function useProfileDraft() {
  const { t } = useUiLang();
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    getOr('/learner/profile', null, d => d && d.completeness).then(p => {
      const loaded = p || MOCK_PROFILE;
      setOffline(!p);
      setProfile(loaded);
      setDraft(loaded);
    });
  }, []);

  const set = useCallback((key, value) => { setDraft(d => ({ ...d, [key]: value })); setStatus(''); }, []);
  const dirty = !!(profile && draft && EDITABLE.some(k => JSON.stringify(profile[k]) !== JSON.stringify(draft[k])));

  const save = useCallback(async () => {
    setSaving(true); setStatus('');
    try {
      const body = Object.fromEntries(EDITABLE.map(k => [k, draft[k]]));
      const res = await api.put('/learner/profile', body);
      setProfile(res.data); setDraft(res.data); setOffline(false);
      setStatus('saved');
      return true;
    } catch (e) {
      setStatus(errMsg(e, t('learn.profileSections.couldntSave')));
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const discard = useCallback(() => { setDraft(profile); setStatus(''); }, [profile]);
  return { profile, draft, set, save, discard, dirty, saving, status, offline };
}

// ─── Small building blocks ─────────────────────────────────────────────────────
export function Section({ id, title, note, action, children }) {
  return (
    <section id={id} className="ln-card" style={{ gap: 16, scrollMarginTop: 24 }}>
      <div className="ln-between ln-wrap"><h2 className="ln-h2">{title}</h2>{note && <span className="ln-xs ln-muted">{note}</span>}{action}</div>
      {children}
    </section>
  );
}

function Field({ id, label, hint, ...props }) {
  return (
    <div className="ln-field">
      <label htmlFor={id} className="ln-label">{label}{hint && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · {hint}</span>}</label>
      <input id={id} className="ln-input" {...props} />
    </div>
  );
}

export function ChipEditor({ label, values = [], onChange, placeholder = 'Add', tone = 'neutral' }) {
  const { t } = useUiLang();
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText('');
  };
  return (
    <div className="ln-col" style={{ gap: 8 }}>
      {label && <span className="ln-label">{label}</span>}
      <div className="ln-row ln-wrap" style={{ gap: 6 }}>
        {values.map(v => (
          <span key={v} className={`ln-chip ${tone === 'accent' ? 'ln-tag-accent' : ''}`}>
            {v}<button type="button" className="ln-chip-x" aria-label={t('learn.profileSections.removeV', { v })} onClick={() => onChange(values.filter(x => x !== v))}>×</button>
          </span>
        ))}
        <input className="ln-chip-input" aria-label={`${placeholder}${label ? ` to ${label}` : ''}`} placeholder={`+ ${placeholder}`} value={text}
          onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add} />
      </div>
    </div>
  );
}

// A list of small records (education, projects, experience, certifications).
function RecordList({ items = [], onChange, fields, empty, addLabel, render }) {
  const { t } = useUiLang();
  const [editing, setEditing] = useState(null);
  const update = (i, key, v) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  return (
    <div className="ln-col" style={{ gap: 10 }}>
      {items.length === 0 && editing === null && (
        <div className="ln-col" style={{ alignItems: 'center', gap: 8, padding: 26, border: '1.5px dashed var(--color-border-strong)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{empty.title}</span>
          <span className="ln-small ln-muted" style={{ maxWidth: 440 }}>{empty.text}</span>
        </div>
      )}
      {items.map((it, i) => (editing === i ? (
        <div key={i} className="ln-tile" style={{ padding: 16, gap: 12 }}>
          <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
            {fields.map(f => (f.multiline ? (
              <div key={f.key} className="ln-field" style={{ gridColumn: '1 / -1' }}>
                <label className="ln-label" htmlFor={`${f.key}-${i}`}>{f.label}</label>
                <textarea id={`${f.key}-${i}`} className="ln-textarea" rows={3} value={it[f.key] || ''} onChange={e => update(i, f.key, e.target.value)} />
              </div>
            ) : (
              <Field key={f.key} id={`${f.key}-${i}`} label={f.label} placeholder={f.placeholder}
                value={f.list ? (it[f.key] || []).join(', ') : it[f.key] || ''}
                onChange={e => update(i, f.key, f.list ? e.target.value.split(',').map(x => x.trim()).filter(Boolean) : e.target.value)} />
            )))}
          </div>
          <div className="ln-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ln-btn ln-btn-sm" onClick={() => { onChange(items.filter((_, j) => j !== i)); setEditing(null); }}><Trash2 size={14} aria-hidden="true" />{t('learn.profileSections.remove')}</button>
            <button type="button" className="ln-btn ln-btn-sm ln-btn-ink" onClick={() => setEditing(null)}>{t('learn.profileSections.done')}</button>
          </div>
        </div>
      ) : (
        <div key={i} className="ln-tile ln-between" style={{ padding: '14px 16px', alignItems: 'flex-start' }}>
          <div className="ln-col" style={{ gap: 2, minWidth: 0 }}>{render(it)}</div>
          <button type="button" className="ln-btn ln-btn-sm" onClick={() => setEditing(i)}>{t('learn.profileSections.edit')}</button>
        </div>
      )))}
      <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start', fontWeight: 600 }}
        onClick={() => { onChange([...items, {}]); setEditing(items.length); }}><Plus size={14} aria-hidden="true" />{addLabel}</button>
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────────
export function PersonalSection({ form }) {
  const { t } = useUiLang();
  const { user } = useAuth();
  const { draft, set } = form;
  const language = user?.language || draft.language || 'telugu';
  const [heard, setHeard] = useState('');
  const [writing, setWriting] = useState(false);
  const [err, setErr] = useState('');

  const writeSummary = async (transcript) => {
    setHeard(transcript); setWriting(true); setErr('');
    try {
      const res = await api.post('/learner/profile/summary-from-speech', { transcript });
      set('about', res.data.summary);
    } catch (e) {
      setErr(t('learn.profileSections.couldnTWriteThe'));
    }
    setWriting(false);
  };
  const transcribe = async (blob) => {
    setWriting(true);
    try {
      const f = new FormData();
      f.append('audio', blob, 'about.webm');
      const res = await api.post('/learner/transcribe', f);
      await writeSummary(res.data.transcript);
    } catch (e) { setErr(t('learn.profileSections.couldnTHearThat')); setWriting(false); }
  };
  const mic = useSpeechInput({ lang: speechTag(language), onFinal: writeSummary, onAudio: transcribe });
  const langName = language === 'hindi' ? t('learn.profileSections.hindi') : t('learn.profileSections.telugu');

  return (
    <Section id="personal" title={t('learn.profileSections.personalInfo')} note={t('learn.profileSections.nameLearnerRefCome')}>
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <Field id="fn" label={t('learn.profileSections.fullName')} value={draft.name || ''} readOnly />
        <Field id="ref" label={t('learn.profileSections.learnerReference')} value={draft.learner_ref || ''} readOnly />
        <Field id="em" label={t('learn.profileSections.email')} type="email" value={draft.email || ''} onChange={e => set('email', e.target.value)} autoComplete="email" />
        <Field id="ph" label={t('learn.profileSections.phone')} type="tel" placeholder="+91" value={draft.phone || ''} onChange={e => set('phone', e.target.value)} autoComplete="tel" />
        <Field id="city" label={t('learn.profileSections.city')} value={draft.city || ''} onChange={e => set('city', e.target.value)} />
        <Field id="li" label={t('learn.profileSections.linkedinGithub')} placeholder={t('learn.profileSections.https')} type="url" value={draft.link_url || ''} onChange={e => set('link_url', e.target.value)} />
        <div style={{ gridColumn: '1 / -1' }}>
          <Field id="hl" label={t('learn.profileSections.headline')} hint={t('learn.profileSections.oneLineUnderName')} placeholder={t('learn.profileSections.eGAspiringFrontend')} value={draft.headline || ''} onChange={e => set('headline', e.target.value)} />
        </div>
      </div>
      <div className="ln-field">
        <label htmlFor="about" className="ln-label">{t('learn.profileSections.aboutYou')}{' '} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{t('learn.profileSections.usedAsResumeSummary')}</span></label>
        <textarea id="about" className="ln-textarea" rows={3} value={draft.about || ''} onChange={e => set('about', e.target.value)} />
        <div className="ln-row ln-wrap" style={{ gap: 10 }}>
          <button type="button" className={`ln-btn ln-btn-sm ${mic.listening ? 'ln-btn-ink' : ''}`} onClick={() => (mic.listening ? mic.stop() : mic.start())} disabled={writing || !mic.supported} aria-pressed={mic.listening}>
            <Mic size={14} aria-hidden="true" />{mic.listening ? t('learn.profileSections.stopIMDone') : writing ? t('learn.profileSections.writingItInEnglish') : t('learn.profileSections.sayItIn', { lang: langName })}
          </button>
          {mic.listening && <span className="ln-small ln-muted ln-indic">{mic.interim || t('learn.profileSections.listening')}</span>}
        </div>
        {heard && !mic.listening && <span className="ln-xs ln-muted ln-indic">{t('learn.profileSections.saidHeard', { heard })}</span>}
        {(err || mic.error) && <div className="ln-error">{err || mic.error}</div>}
      </div>
    </Section>
  );
}

export function EducationSection({ form }) {
  const { t } = useUiLang();
  return (
    <Section id="education" title={t('learn.profileSections.education')}>
      <RecordList items={form.draft.education} onChange={v => form.set('education', v)} addLabel="Add education"
        empty={{ title: 'No education added', text: 'Add your degree or diploma, where you studied and when.' }}
        fields={[{ key: 'degree', label: 'Degree', placeholder: 'B.Tech, Computer Science' }, { key: 'institution_name', label: 'College or school' },
          { key: 'city', label: 'City' }, { key: 'grade', label: 'CGPA or %' }, { key: 'start_year', label: 'Start year' }, { key: 'end_year', label: 'End year' }]}
        render={e => <><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{e.degree || t('learn.profileSections.untitled')}</span><span className="ln-small">{[e.institution_name, e.city].filter(Boolean).join(', ')}{e.start_year || e.end_year ? ` · ${e.start_year || ''}–${e.end_year || ''}` : ''}</span>{e.grade && <span className="ln-small ln-muted">{e.grade}</span>}</>} />
    </Section>
  );
}

export function ExperienceSection({ form }) {
  const { t } = useUiLang();
  return (
    <Section id="experience" title={t('learn.profileSections.experience')} note={t('learn.profileSections.optionalInternshipsPartTime')}>
      <RecordList items={form.draft.experience} onChange={v => form.set('experience', v)} addLabel="Add experience"
        empty={{ title: 'No experience added', text: 'Freshers often skip this. Internships and volunteering count.' }}
        fields={[{ key: 'role', label: 'Role' }, { key: 'org', label: 'Organisation' }, { key: 'period', label: 'When', placeholder: 'May–Jul 2026' }, { key: 'notes', label: 'What you did', multiline: true }]}
        render={x => <><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{x.role || t('learn.profileSections.untitled')}</span><span className="ln-small">{[x.org, x.period].filter(Boolean).join(' · ')}</span></>} />
    </Section>
  );
}

export function ProjectsSection({ form }) {
  const { t } = useUiLang();
  return (
    <Section id="projects" title={t('learn.profileSections.projects')}>
      <RecordList items={form.draft.projects} onChange={v => form.set('projects', v)} addLabel="Add project"
        empty={{ title: 'No projects yet', text: 'Add a title, what you built, the tools you used and a GitHub or demo link. Projects are what recruiters read first on a fresher resume.' }}
        fields={[{ key: 'title', label: 'Title' }, { key: 'link_url', label: 'GitHub or demo link', placeholder: 'https://' }, { key: 'tools', label: 'Tools (comma separated)', list: true }, { key: 'description', label: 'What you built', multiline: true }]}
        render={p => <><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{p.title || t('learn.profileSections.untitled')}</span>{p.description && <span className="ln-small">{p.description}</span>}{(p.tools || []).length > 0 && <span className="ln-xs ln-muted">{p.tools.join(' · ')}</span>}</>} />
    </Section>
  );
}

export function SkillsSection({ form }) {
  const { t } = useUiLang();
  const { draft, set } = form;
  return (
    <Section id="skills" title={t('learn.profileSections.skills')}>
      <div className="ln-col" style={{ gap: 8 }}>
        <span className="ln-small" style={{ fontWeight: 600, color: 'var(--status-success)' }}>{t('learn.profileSections.verifiedByQubirexFrom')}</span>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          {(draft.verified_skills || []).length === 0 && <span className="ln-small ln-muted">{t('learn.profileSections.skillsAppearHereAs')}</span>}
          {(draft.verified_skills || []).map(v => <span key={v} className="ln-chip ln-tag-success" style={{ fontWeight: 500 }}>✓ {v}</span>)}
        </div>
      </div>
      <ChipEditor label={t('learn.profileSections.selfDeclared')} values={draft.self_skills} onChange={v => set('self_skills', v)} placeholder={t('learn.profileSections.addSkill')} />
      <span className="ln-xs ln-muted">{t('learn.profileSections.selfDeclaredSkillsShown')}</span>
    </Section>
  );
}

export function CertificationsSection({ form }) {
  const { t } = useUiLang();
  const clusters = form.draft.record?.clusters_done || [];
  return (
    <Section id="certifications" title={t('learn.profileSections.certifications')} note={t('learn.profileSections.optional')}>
      {clusters.length > 0 && (
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          {clusters.map(c => <span key={c} className="ln-chip ln-tag-success">{t('learn.profileSections.qubirexClusterCertificateC', { c })}</span>)}
        </div>
      )}
      <RecordList items={form.draft.certifications} onChange={v => form.set('certifications', v)} addLabel="Add certification"
        empty={{ title: 'No other certifications', text: 'Add certificates from courses or exams you have passed elsewhere.' }}
        fields={[{ key: 'name', label: 'Name' }, { key: 'issuer', label: 'Issued by' }, { key: 'year', label: 'Year' }]}
        render={c => <><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{c.name || t('learn.profileSections.untitled')}</span><span className="ln-small">{[c.issuer, c.year].filter(Boolean).join(' · ')}</span></>} />
    </Section>
  );
}

export function GoalsSection({ form }) {
  const { t } = useUiLang();
  const { draft, set } = form;
  return (
    <Section id="goals" title={t('learn.profileSections.careerGoals')}>
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <ChipEditor label={t('learn.profileSections.targetRoles')} values={draft.target_roles} onChange={v => set('target_roles', v)} placeholder={t('learn.profileSections.addRole')} tone="accent" />
        <ChipEditor label={t('learn.profileSections.preferredCities')} values={draft.preferred_cities} onChange={v => set('preferred_cities', v)} placeholder={t('learn.profileSections.addCity')} />
        <div className="ln-field">
          <label className="ln-label" htmlFor="gradyear">{t('learn.profileSections.graduationYear')}</label>
          <Select id="gradyear" value={draft.graduation_year || ''} onChange={e => set('graduation_year', e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('learn.profileSections.chooseYear')}</option>
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 3 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
          <span className="ln-xs ln-muted">{t('learn.profileSections.employersSeeAsAvailable')}</span>
        </div>
        <Field id="sal" label={t('learn.profileSections.expectedSalary')} hint={t('learn.profileSections.privateUsedJobFilters')} placeholder={t('learn.profileSections.egSalary')} value={draft.expected_salary || ''} onChange={e => set('expected_salary', e.target.value)} />
      </div>
    </Section>
  );
}

export function VoiceSection({ form }) {
  const { t } = useUiLang();
  const { user } = useAuth();
  const { setLang } = useUiLang();
  const { draft, set } = form;
  const prefs = draft.voice_prefs || {};
  const setPref = (k, v) => set('voice_prefs', { ...prefs, [k]: v });
  const language = user?.language || draft.language || 'telugu';
  const speech = useSpeechOutput({ lang: speechTag(language), rate: prefs.rate || 1 });
  const sample = language === 'hindi' ? 'नमस्ते! मैं प्रोफ़ेसर क्यूबिरेक्स हूँ।' : 'నమస్కారం! నేను ప్రొఫెసర్ క్యూబిరెక్స్.';
  const preview = () => speech.speak(sample, 'preview');

  return (
    <Section id="preferences" title={t('learn.profileSections.learningVoicePreferences')}>
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <div className="ln-field"><span className="ln-label">{t('learn.profileSections.teachingLanguage')}</span>
          <span className="ln-tile ln-indic" style={{ fontSize: 'var(--fs-body)', padding: '12px 14px' }}>{language === 'hindi' ? 'हिंदी' : 'తెలుగు'} <span className="ln-muted">{t('learn.profileSections.setByInstitution')}</span></span></div>
        <div className="ln-field"><span className="ln-label" id="ui-lang">{t('learn.profileSections.interfaceLanguage')}</span>
          <div className="ln-seg ln-indic" role="group" aria-labelledby="ui-lang">
            {UI_LANGS.map(l => <button key={l.id} type="button" aria-pressed={draft.ui_language === l.id} onClick={() => { set('ui_language', l.id); setLang(l.id); }}>{l.label}</button>)}
          </div></div>
        <div className="ln-field"><span className="ln-label">{t('learn.profileSections.professorSVoice')}</span>
          <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={preview}>
            <Play size={12} aria-hidden="true" />{t('learn.profileSections.hearProfessorQubirex')}
          </button></div>
        <div className="ln-field"><span className="ln-label" id="rate-pick">{t('learn.profileSections.speakingSpeed')}</span>
          <div className="ln-seg" role="group" aria-labelledby="rate-pick">
            {[0.8, 1, 1.2].map(r => <button key={r} type="button" aria-pressed={(prefs.rate || 1) === r} onClick={() => setPref('rate', r)}>{r.toFixed(1)}×</button>)}
          </div></div>
      </div>
      <div className="ln-col" style={{ gap: 6 }}>
        <label className="ln-toggle-row"><span>{t('learn.profileSections.startSessionsVoiceMode')}</span><input type="checkbox" checked={prefs.startInVoice !== false} onChange={e => setPref('startInVoice', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span>{t('learn.profileSections.showEnglishCaptionsUnder')}{' '} {language === 'hindi' ? t('learn.profileSections.hindi') : t('learn.profileSections.telugu')} {' '}{t('learn.profileSections.speech')}</span><input type="checkbox" checked={prefs.showEnglishCaptions !== false} onChange={e => setPref('showEnglishCaptions', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span>{t('learn.profileSections.dailyStudyReminder')}</span><input type="checkbox" checked={!!prefs.dailyReminder} onChange={e => setPref('dailyReminder', e.target.checked)} /></label>
        <label className="ln-toggle-row" style={{ alignItems: 'flex-start' }}>
          <span className="ln-col" style={{ gap: 2 }}><span>{t('voice.deviceChoice')}</span><span className="ln-xs ln-muted">{t('voice.deviceChoiceHelp')}</span></span>
          <input type="checkbox" checked={!!prefs.deviceVoice} onChange={e => { setPref('deviceVoice', e.target.checked); setDeviceVoice(e.target.checked); }} data-device-voice />
        </label>
        <LowBandwidthToggle />
      </div>
    </Section>
  );
}
