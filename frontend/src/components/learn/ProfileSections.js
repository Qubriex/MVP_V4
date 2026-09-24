// src/components/learn/ProfileSections.js
// Profile form state + the section forms, shared by /learn/profile and the
// first-run /learn/welcome flow. Name and learner reference come from the
// institution and are read-only; everything else is the learner's own.
import React, { useCallback, useEffect, useState } from 'react';
import { Mic, Play, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, UI_LANGS, speechTag } from '../../context/UiLangContext';
import api, { getOr } from '../../utils/api';
import { useSpeechInput, useSpeechOutput } from '../../utils/voice';
import { MOCK_PROFILE } from '../../utils/learnerMockData';

const EDITABLE = ['email', 'phone', 'city', 'link_url', 'headline', 'about', 'target_roles', 'preferred_cities', 'available_from',
  'expected_salary', 'self_skills', 'experience', 'certifications', 'ui_language', 'voice_prefs', 'education', 'projects'];

export function useProfileDraft() {
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
      setStatus(e.response?.data?.error || 'Couldn’t save — check your connection and try again.');
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
            {v}<button type="button" className="ln-chip-x" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter(x => x !== v))}>×</button>
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
  const [editing, setEditing] = useState(null);
  const update = (i, key, v) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  return (
    <div className="ln-col" style={{ gap: 10 }}>
      {items.length === 0 && editing === null && (
        <div className="ln-col" style={{ alignItems: 'center', gap: 8, padding: 26, border: '1.5px dashed var(--color-border-strong)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{empty.title}</span>
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
            <button type="button" className="ln-btn ln-btn-sm" onClick={() => { onChange(items.filter((_, j) => j !== i)); setEditing(null); }}><Trash2 size={14} aria-hidden="true" />Remove</button>
            <button type="button" className="ln-btn ln-btn-sm ln-btn-ink" onClick={() => setEditing(null)}>Done</button>
          </div>
        </div>
      ) : (
        <div key={i} className="ln-tile ln-between" style={{ padding: '14px 16px', alignItems: 'flex-start' }}>
          <div className="ln-col" style={{ gap: 2, minWidth: 0 }}>{render(it)}</div>
          <button type="button" className="ln-btn ln-btn-sm" onClick={() => setEditing(i)}>Edit</button>
        </div>
      )))}
      <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start', fontWeight: 600 }}
        onClick={() => { onChange([...items, {}]); setEditing(items.length); }}><Plus size={14} aria-hidden="true" />{addLabel}</button>
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────────
export function PersonalSection({ form }) {
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
      setErr('Couldn’t write the summary right now. You can type it instead.');
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
    } catch (e) { setErr('Couldn’t hear that. Try again, or type it.'); setWriting(false); }
  };
  const mic = useSpeechInput({ lang: speechTag(language), onFinal: writeSummary, onAudio: transcribe });
  const langName = language === 'hindi' ? 'Hindi' : 'Telugu';

  return (
    <Section id="personal" title="Personal info" note="Name and learner ref come from your institution">
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <Field id="fn" label="Full name" value={draft.name || ''} readOnly />
        <Field id="ref" label="Learner reference" value={draft.learner_ref || ''} readOnly />
        <Field id="em" label="Email" type="email" value={draft.email || ''} onChange={e => set('email', e.target.value)} autoComplete="email" />
        <Field id="ph" label="Phone" type="tel" placeholder="+91" value={draft.phone || ''} onChange={e => set('phone', e.target.value)} autoComplete="tel" />
        <Field id="city" label="City" value={draft.city || ''} onChange={e => set('city', e.target.value)} />
        <Field id="li" label="LinkedIn or GitHub" placeholder="https://" type="url" value={draft.link_url || ''} onChange={e => set('link_url', e.target.value)} />
        <div style={{ gridColumn: '1 / -1' }}>
          <Field id="hl" label="Headline" hint="one line under your name" placeholder="e.g. Aspiring frontend developer · B.Tech CSE, final year" value={draft.headline || ''} onChange={e => set('headline', e.target.value)} />
        </div>
      </div>
      <div className="ln-field">
        <label htmlFor="about" className="ln-label">About you <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>· used as your resume summary</span></label>
        <textarea id="about" className="ln-textarea" rows={3} value={draft.about || ''} onChange={e => set('about', e.target.value)} />
        <div className="ln-row ln-wrap" style={{ gap: 10 }}>
          <button type="button" className={`ln-btn ln-btn-sm ${mic.listening ? 'ln-btn-ink' : ''}`} onClick={() => (mic.listening ? mic.stop() : mic.start())} disabled={writing || !mic.supported} aria-pressed={mic.listening}>
            <Mic size={14} aria-hidden="true" />{mic.listening ? 'Stop — I’m done' : writing ? 'Writing it in English…' : `Say it in ${langName}, we’ll write it in English`}
          </button>
          {mic.listening && <span className="ln-small ln-muted ln-indic">{mic.interim || 'Listening…'}</span>}
        </div>
        {heard && !mic.listening && <span className="ln-xs ln-muted ln-indic">You said: “{heard}”</span>}
        {(err || mic.error) && <div className="ln-error">{err || mic.error}</div>}
      </div>
    </Section>
  );
}

export function EducationSection({ form }) {
  return (
    <Section id="education" title="Education">
      <RecordList items={form.draft.education} onChange={v => form.set('education', v)} addLabel="Add education"
        empty={{ title: 'No education added', text: 'Add your degree or diploma, where you studied and when.' }}
        fields={[{ key: 'degree', label: 'Degree', placeholder: 'B.Tech, Computer Science' }, { key: 'institution_name', label: 'College or school' },
          { key: 'city', label: 'City' }, { key: 'grade', label: 'CGPA or %' }, { key: 'start_year', label: 'Start year' }, { key: 'end_year', label: 'End year' }]}
        render={e => <><span style={{ fontSize: 15, fontWeight: 600 }}>{e.degree || 'Untitled'}</span><span className="ln-small">{[e.institution_name, e.city].filter(Boolean).join(', ')}{e.start_year || e.end_year ? ` · ${e.start_year || ''}–${e.end_year || ''}` : ''}</span>{e.grade && <span className="ln-small ln-muted">{e.grade}</span>}</>} />
    </Section>
  );
}

export function ExperienceSection({ form }) {
  return (
    <Section id="experience" title="Experience" note="Optional — internships, part-time work, volunteering">
      <RecordList items={form.draft.experience} onChange={v => form.set('experience', v)} addLabel="Add experience"
        empty={{ title: 'No experience added', text: 'Freshers often skip this. Internships and volunteering count.' }}
        fields={[{ key: 'role', label: 'Role' }, { key: 'org', label: 'Organisation' }, { key: 'period', label: 'When', placeholder: 'May–Jul 2026' }, { key: 'notes', label: 'What you did', multiline: true }]}
        render={x => <><span style={{ fontSize: 15, fontWeight: 600 }}>{x.role || 'Untitled'}</span><span className="ln-small">{[x.org, x.period].filter(Boolean).join(' · ')}</span></>} />
    </Section>
  );
}

export function ProjectsSection({ form }) {
  return (
    <Section id="projects" title="Projects">
      <RecordList items={form.draft.projects} onChange={v => form.set('projects', v)} addLabel="Add project"
        empty={{ title: 'No projects yet', text: 'Add a title, what you built, the tools you used and a GitHub or demo link. Projects are what recruiters read first on a fresher resume.' }}
        fields={[{ key: 'title', label: 'Title' }, { key: 'link_url', label: 'GitHub or demo link', placeholder: 'https://' }, { key: 'tools', label: 'Tools (comma separated)', list: true }, { key: 'description', label: 'What you built', multiline: true }]}
        render={p => <><span style={{ fontSize: 15, fontWeight: 600 }}>{p.title || 'Untitled'}</span>{p.description && <span className="ln-small">{p.description}</span>}{(p.tools || []).length > 0 && <span className="ln-xs ln-muted">{p.tools.join(' · ')}</span>}</>} />
    </Section>
  );
}

export function SkillsSection({ form }) {
  const { draft, set } = form;
  return (
    <Section id="skills" title="Skills">
      <div className="ln-col" style={{ gap: 8 }}>
        <span className="ln-small" style={{ fontWeight: 600, color: 'var(--status-success)' }}>Verified by Qubirex · from your mastery checks</span>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          {(draft.verified_skills || []).length === 0 && <span className="ln-small ln-muted">Skills appear here as you pass mastery checks.</span>}
          {(draft.verified_skills || []).map(v => <span key={v} className="ln-chip ln-tag-success" style={{ fontWeight: 500 }}>✓ {v}</span>)}
        </div>
      </div>
      <ChipEditor label="Self-declared" values={draft.self_skills} onChange={v => set('self_skills', v)} placeholder="Add skill" />
      <span className="ln-xs ln-muted">Self-declared skills are shown separately on your resume and never marked as verified.</span>
    </Section>
  );
}

export function CertificationsSection({ form }) {
  const clusters = form.draft.record?.clusters_done || [];
  return (
    <Section id="certifications" title="Certifications" note="Optional">
      {clusters.length > 0 && (
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          {clusters.map(c => <span key={c} className="ln-chip ln-tag-success">Qubirex cluster certificate · {c}</span>)}
        </div>
      )}
      <RecordList items={form.draft.certifications} onChange={v => form.set('certifications', v)} addLabel="Add certification"
        empty={{ title: 'No other certifications', text: 'Add certificates from courses or exams you have passed elsewhere.' }}
        fields={[{ key: 'name', label: 'Name' }, { key: 'issuer', label: 'Issued by' }, { key: 'year', label: 'Year' }]}
        render={c => <><span style={{ fontSize: 15, fontWeight: 600 }}>{c.name || 'Untitled'}</span><span className="ln-small">{[c.issuer, c.year].filter(Boolean).join(' · ')}</span></>} />
    </Section>
  );
}

export function GoalsSection({ form }) {
  const { draft, set } = form;
  return (
    <Section id="goals" title="Career goals">
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <ChipEditor label="Target roles" values={draft.target_roles} onChange={v => set('target_roles', v)} placeholder="Add role" tone="accent" />
        <ChipEditor label="Preferred cities" values={draft.preferred_cities} onChange={v => set('preferred_cities', v)} placeholder="Add city" />
        <Field id="avail" label="Available from" placeholder="e.g. June 2027" value={draft.available_from || ''} onChange={e => set('available_from', e.target.value)} />
        <Field id="sal" label="Expected salary" hint="private, used for job filters" placeholder="e.g. ₹4 LPA" value={draft.expected_salary || ''} onChange={e => set('expected_salary', e.target.value)} />
      </div>
    </Section>
  );
}

export function VoiceSection({ form }) {
  const { user } = useAuth();
  const { setLang } = useUiLang();
  const { draft, set } = form;
  const prefs = draft.voice_prefs || {};
  const setPref = (k, v) => set('voice_prefs', { ...prefs, [k]: v });
  const language = user?.language || draft.language || 'telugu';
  const speech = useSpeechOutput({ lang: speechTag(language), rate: prefs.rate || 1 });
  const sample = language === 'hindi' ? 'नमस्ते! मैं प्रोफ़ेसर क्यूबिरेक्स हूँ।' : 'నమస్కారం! నేను ప్రొఫెసర్ క్యూబిరెక్స్.';
  const preview = (variant) => { setPref('voice', variant); speech.speak(sample, variant); };

  return (
    <Section id="preferences" title="Learning and voice preferences">
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <div className="ln-field"><span className="ln-label">Teaching language</span>
          <span className="ln-tile ln-indic" style={{ fontSize: 14, padding: '12px 14px' }}>{language === 'hindi' ? 'हिंदी' : 'తెలుగు'} <span className="ln-muted">· set by your institution</span></span></div>
        <div className="ln-field"><span className="ln-label" id="ui-lang">Interface language</span>
          <div className="ln-seg ln-indic" role="group" aria-labelledby="ui-lang">
            {UI_LANGS.map(l => <button key={l.id} type="button" aria-pressed={draft.ui_language === l.id} onClick={() => { set('ui_language', l.id); setLang(l.id); }}>{l.label}</button>)}
          </div></div>
        <div className="ln-field"><span className="ln-label" id="voice-pick">Professor’s voice</span>
          <div className="ln-seg" role="group" aria-labelledby="voice-pick">
            {['A', 'B'].map(v => <button key={v} type="button" aria-pressed={(prefs.voice || 'A') === v} onClick={() => preview(v)}>Voice {v} <Play size={12} aria-hidden="true" style={{ display: 'inline' }} /></button>)}
          </div></div>
        <div className="ln-field"><span className="ln-label" id="rate-pick">Speaking speed</span>
          <div className="ln-seg" role="group" aria-labelledby="rate-pick">
            {[0.8, 1, 1.2].map(r => <button key={r} type="button" aria-pressed={(prefs.rate || 1) === r} onClick={() => setPref('rate', r)}>{r.toFixed(1)}×</button>)}
          </div></div>
      </div>
      <div className="ln-col" style={{ gap: 6 }}>
        <label className="ln-toggle-row"><span>Start sessions in voice mode</span><input type="checkbox" checked={prefs.startInVoice !== false} onChange={e => setPref('startInVoice', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span>Show English captions under {language === 'hindi' ? 'Hindi' : 'Telugu'} speech</span><input type="checkbox" checked={prefs.showEnglishCaptions !== false} onChange={e => setPref('showEnglishCaptions', e.target.checked)} /></label>
        <label className="ln-toggle-row"><span>Daily study reminder</span><input type="checkbox" checked={!!prefs.dailyReminder} onChange={e => setPref('dailyReminder', e.target.checked)} /></label>
      </div>
    </Section>
  );
}
