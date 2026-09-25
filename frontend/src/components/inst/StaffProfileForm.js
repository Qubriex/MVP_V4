// src/components/inst/StaffProfileForm.js
// Staff profile state and form sections, shared by /institution/welcome
// (first-run setup) and /institution/profile. Students see only the public
// part — name, photo, designation, department, specialisation, office hours —
// shown live in <StudentPreview>. Email, phone and employee ID stay inside
// the institution.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import api from '../../utils/api';
import { ChipEditor } from '../learn/ProfileSections';
import { Avatar } from './InstitutionLayout';

const EDITABLE = ['name', 'title', 'designation', 'department', 'employee_id', 'phone', 'qualification', 'years_teaching',
  'specialisations', 'teaching_languages', 'subjects', 'office_hours', 'target_roles', 'photo_data_url', 'notification_prefs'];
export const TEACH_LANGS = [['english', 'English'], ['telugu', 'తెలుగు'], ['hindi', 'हिंदी']];

export function useStaffDraft() {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/institution/me').then(r => { setSaved(r.data); setDraft(r.data); })
      .catch(e => setStatus(e.response?.data?.error || 'Couldn’t load your profile.'));
  }, []);
  const set = useCallback((k, v) => { setDraft(d => ({ ...d, [k]: v })); setStatus(''); }, []);
  const dirty = !!(saved && draft && EDITABLE.some(k => JSON.stringify(saved[k]) !== JSON.stringify(draft[k])));
  const save = useCallback(async (extra = {}) => {
    setSaving(true); setStatus('');
    try {
      const body = { ...Object.fromEntries(EDITABLE.map(k => [k, draft[k]])), ...extra };
      const res = await api.put('/institution/me', body);
      setSaved(res.data); setDraft(d => ({ ...res.data, cohorts: d.cohorts }));
      setStatus('saved');
      return res.data;
    } catch (e) {
      setStatus(e.response?.data?.error || 'Couldn’t save — check your connection.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [draft]);
  return { saved, draft, set, save, dirty, status, saving, discard: () => setDraft(saved) };
}

// Resize to a 256px square JPEG in the browser so the stored image stays small.
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Use a JPG, PNG or WebP image.'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('That image is over 5 MB.'));
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Couldn’t read that image.'));
    img.src = URL.createObjectURL(file);
  });
}

function Field({ id, label, hint, ...props }) {
  return (
    <div className="ln-field">
      <label htmlFor={id} className="ln-label">{label}{hint && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · {hint}</span>}</label>
      <input id={id} className="ln-input" {...props} />
    </div>
  );
}

export function ProfileFields({ form }) {
  const { draft, set } = form;
  const fileRef = useRef(null);
  const [photoError, setPhotoError] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPhotoError(''); set('photo_data_url', await resizePhoto(file)); } catch (err) { setPhotoError(err.message); }
  };
  const langs = draft.teaching_languages || [];
  return (
    <div className="ln-col" style={{ gap: 20 }}>
      <div className="ln-row ln-wrap" style={{ gap: 18 }}>
        {draft.photo_data_url
          ? <Avatar person={draft} size={84} />
          : <div className="ln-avatar" style={{ width: 84, height: 84, background: 'var(--color-bg-alt)', border: '1.5px dashed var(--color-border-strong)', color: 'var(--color-text-muted)' }}><Camera size={26} aria-hidden="true" /></div>}
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} className="ln-sr" id="photo" />
          <button type="button" className="ln-btn" onClick={() => fileRef.current?.click()}>{draft.photo_data_url ? 'Change photo' : 'Upload photo'}</button>
          {draft.photo_data_url && <button type="button" className="ln-btn" onClick={() => set('photo_data_url', null)}>Remove</button>}
          <span className="ln-xs ln-muted">JPG, PNG or WebP. Cropped to a square.</span>
        </div>
        {photoError && <div className="ln-error">{photoError}</div>}
      </div>
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <Field id="sfn" label="Full name" value={draft.name || ''} onChange={e => set('name', e.target.value)} autoComplete="name" />
        <Field id="stt" label="Title" placeholder="Dr., Prof., Mr., Ms." value={draft.title || ''} onChange={e => set('title', e.target.value)} />
        <Field id="sds" label="Designation" placeholder="e.g. Associate Professor" value={draft.designation || ''} onChange={e => set('designation', e.target.value)} />
        <Field id="sdp" label="Department" placeholder="e.g. Computer Science & Engineering" value={draft.department || ''} onChange={e => set('department', e.target.value)} />
        <Field id="seid" label="Employee ID" hint="admin only" placeholder="e.g. FAC-1042" value={draft.employee_id || ''} onChange={e => set('employee_id', e.target.value)} />
        <Field id="sph" label="Phone" hint="admin only" type="tel" placeholder="+91" value={draft.phone || ''} onChange={e => set('phone', e.target.value)} />
        <Field id="sq" label="Highest qualification" placeholder="e.g. Ph.D., Computer Science" value={draft.qualification || ''} onChange={e => set('qualification', e.target.value)} />
        <Field id="sex" label="Years teaching" type="number" min="0" max="60" value={draft.years_teaching ?? ''} onChange={e => set('years_teaching', e.target.value)} />
      </div>
      <ChipEditor label="Specialisation" values={draft.specialisations || []} onChange={v => set('specialisations', v)} placeholder="Add" tone="accent" />
      <div className="ln-col" style={{ gap: 8 }}>
        <span className="ln-label" id="tl">Languages you can teach in</span>
        <div className="ln-row ln-wrap ln-indic" role="group" aria-labelledby="tl" style={{ gap: 8 }}>
          {TEACH_LANGS.map(([id, label]) => (
            <button key={id} type="button" className="ln-pilltab" aria-selected={langs.includes(id)} aria-pressed={langs.includes(id)}
              onClick={() => set('teaching_languages', langs.includes(id) ? langs.filter(x => x !== id) : [...langs, id])}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TeachingFields({ form }) {
  const { draft, set } = form;
  return (
    <div className="ln-col" style={{ gap: 20 }}>
      <ChipEditor label="Subjects" values={draft.subjects || []} onChange={v => set('subjects', v)} placeholder="Add subject" />
      <div className="ln-col" style={{ gap: 10 }}>
        <span className="ln-label">Cohorts assigned to you <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>· set by your admin</span></span>
        {(draft.cohorts || []).length === 0 && <span className="ln-small ln-muted">None yet. Your admin assigns cohorts from Team &amp; roles.</span>}
        {(draft.cohorts || []).map(c => (
          <div key={c.id} className="ln-card ln-between" style={{ padding: '14px 16px', borderRadius: 'var(--radius-lg)', flexDirection: 'row' }}>
            <div className="ln-col"><span style={{ fontSize: 15, fontWeight: 600 }}>{c.title}</span>
              <span className="ln-small ln-muted">{c.students} students · {c.language === 'hindi' ? 'Hindi' : 'Telugu'} · {c.cohort_role === 'lead' ? 'Lead professor' : 'Co-professor'}</span></div>
            <span className={`ln-tag ln-tag-lg ${c.status === 'active' ? 'ln-tag-success' : 'ln-tag-warning'}`}>{c.status === 'active' ? 'Active' : c.status === 'setup' ? 'Setting up' : c.status}</span>
          </div>
        ))}
      </div>
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <ChipEditor label="Target roles for your students" values={draft.target_roles || []} onChange={v => set('target_roles', v)} placeholder="Add role" />
        <Field id="soh" label="Office hours" hint="shown to students" placeholder="e.g. Tue & Thu, 3–4 pm, Block C 204" value={draft.office_hours || ''} onChange={e => set('office_hours', e.target.value)} />
      </div>
    </div>
  );
}

const NOTIFY = [
  ['weekly_digest', 'Weekly summary of my cohorts', true],
  ['stuck_alerts', 'When students are stuck on a node (3+ loops)', true],
  ['access_alerts', 'PIN reset requests and students who never signed in', true],
  ['invite_accepted', 'When a student accepts their invite', false]
];
export function NotificationFields({ form }) {
  const prefs = form.draft.notification_prefs || {};
  return (
    <div className="ln-col" style={{ gap: 6 }}>
      {NOTIFY.map(([k, label, def]) => (
        <label key={k} className="ln-toggle-row"><span>{label}</span>
          <input type="checkbox" checked={prefs[k] ?? def} onChange={e => form.set('notification_prefs', { ...prefs, [k]: e.target.checked })} /></label>
      ))}
      <span className="ln-xs ln-muted">Email delivery isn’t switched on yet. These choices are saved and apply once it is.</span>
    </div>
  );
}

export function StudentPreview({ person }) {
  const name = [person?.title, person?.name].filter(Boolean).join(' ') || 'Your name';
  return (
    <div className="ln-col" style={{ gap: 14 }}>
      <span className="ln-kicker">How students see you</span>
      <div className="ln-card" style={{ alignItems: 'center', textAlign: 'center', gap: 8, padding: '28px 24px' }}>
        <Avatar person={person} size={72} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{name}</span>
        {(person?.designation || person?.department) && <span style={{ fontSize: 14 }}>{[person.designation, person.department].filter(Boolean).join(' · ')}</span>}
        {(person?.specialisations || []).length > 0 && <span className="ln-small ln-muted">{person.specialisations.join(' · ')}</span>}
        {person?.office_hours && <span className="ln-small ln-muted">Office hours: {person.office_hours}</span>}
      </div>
      <div className="ln-tile ln-small" style={{ padding: 16, lineHeight: 1.55 }}>Your email, phone and employee ID are visible only to your institution admin.</div>
    </div>
  );
}
