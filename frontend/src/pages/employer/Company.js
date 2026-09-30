// src/pages/employer/Company.js — /employer/company — company details and
// the optional GSTIN (checked for format, state code and check character).
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useEmployer } from './Layout';

const FIELDS = [['name', 'Company name'], ['website', 'Website'], ['contact_name', 'Contact person'], ['contact_phone', 'Contact phone'], ['city', 'City'], ['gstin', 'GSTIN (optional)']];

export default function EmployerCompany() {
  const { me, refresh, isOwner } = useEmployer();
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (me && !f) setF(Object.fromEntries(FIELDS.map(([k]) => [k, me.employer[k] || '']))); }, [me, f]);
  if (!f) return <p className="ln-muted">Loading…</p>;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setSaved(false);
    try { await api.put('/employer/company', { ...f, gstin: f.gstin && f.gstin !== me.employer.gstin ? f.gstin : undefined }); setSaved(true); refresh(); }
    catch (err) { setError(errMsg(err)); }
    setBusy(false);
  };

  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Company</h1>
        <span className="ln-sub">Domain: @{me.employer.domain}{me.employer.gst_state_code ? ` · GST state ${me.employer.gst_state_code}` : ''}</span></div></header>
      <form className="ln-card" style={{ gap: 14, maxWidth: 620 }} onSubmit={save}>
        {error && <div className="ln-error" role="alert">{error}</div>}
        {saved && <div className="ln-note" role="status">Saved.</div>}
        {FIELDS.map(([k, label]) => (
          <div className="ln-field" key={k}><label className="ln-label" htmlFor={k}>{label}</label>
            <input id={k} className="ln-input" value={f[k]} disabled={!isOwner} required={k === 'name'}
              style={k === 'gstin' ? { textTransform: 'uppercase', letterSpacing: '0.05em' } : undefined}
              maxLength={k === 'gstin' ? 15 : undefined} placeholder={k === 'gstin' ? '36AABCU9603R1ZV' : undefined}
              onChange={e => setF(v => ({ ...v, [k]: k === 'gstin' ? e.target.value.toUpperCase() : e.target.value }))} /></div>
        ))}
        {isOwner ? <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          : <span className="ln-small ln-muted">Only owners can change company details.</span>}
      </form>
    </>
  );
}
