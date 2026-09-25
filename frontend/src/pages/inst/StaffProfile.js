// src/pages/inst/StaffProfile.js — /institution/profile
// Edit your own staff profile (same fields as first-run setup), with the
// student-facing preview, and change your password.
import React, { useState } from 'react';
import api from '../../utils/api';
import { Section } from '../../components/learn/ProfileSections';
import { useStaff, ROLE_LABEL } from '../../components/inst/InstitutionLayout';
import { useStaffDraft, ProfileFields, TeachingFields, NotificationFields, StudentPreview } from '../../components/inst/StaffProfileForm';

function PasswordSection() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const change = async (e) => {
    e.preventDefault(); setMsg('');
    try { await api.put('/institution/me/password', { current_password: cur, new_password: next }); setMsg('Password changed.'); setCur(''); setNext(''); }
    catch (err) { setMsg(err.response?.data?.error || 'Couldn’t change the password.'); }
  };
  return (
    <Section id="password" title="Password">
      <form className="ln-grid ln-g-3" style={{ gap: 12, alignItems: 'end' }} onSubmit={change}>
        <div className="ln-field"><label className="ln-label" htmlFor="cpw">Current password</label><input id="cpw" className="ln-input" type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} required /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="npw">New password</label><input id="npw" className="ln-input" type="password" autoComplete="new-password" placeholder="At least 10 characters" value={next} onChange={e => setNext(e.target.value)} required /></div>
        <button type="submit" className="ln-btn">Change password</button>
      </form>
      {msg && <span className="ln-small" role="status">{msg}</span>}
    </Section>
  );
}

export default function StaffProfile() {
  const form = useStaffDraft();
  const staff = useStaff();
  if (!form.draft) return <p className="ln-muted">{form.status || 'Loading…'}</p>;
  const save = async () => { const saved = await form.save({ profile_completed: true }); if (saved) staff.setMe(m => ({ ...m, ...saved })); };

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">My profile</h1>
          <span className="ln-sub">{form.draft.email} · {ROLE_LABEL[form.draft.role]}</span>
        </div>
      </header>
      <div className="ln-grid ln-g-detail" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px' }}>
        <div className="ln-col" style={{ gap: 20, minWidth: 0 }}>
          <Section title="Profile"><ProfileFields form={form} /></Section>
          <Section title="Teaching"><TeachingFields form={form} /></Section>
          <Section title="Notifications"><NotificationFields form={form} /></Section>
          <PasswordSection />
          <div className="ln-row ln-wrap" style={{ justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, padding: '12px 0', background: 'var(--color-bg)' }}>
            {form.status === 'saved' && <span className="ln-small" style={{ color: 'var(--status-success)' }} role="status">Saved</span>}
            {form.status && form.status !== 'saved' && <span className="ln-small" style={{ color: 'var(--status-danger)' }} role="alert">{form.status}</span>}
            <button type="button" className="ln-btn" onClick={form.discard} disabled={!form.dirty || form.saving}>Discard</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={save} disabled={!form.dirty || form.saving}>{form.saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
        <aside style={{ position: 'sticky', top: 24, alignSelf: 'start' }}><StudentPreview person={form.draft} /></aside>
      </div>
    </>
  );
}
