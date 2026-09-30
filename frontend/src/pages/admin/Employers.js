// src/pages/admin/Employers.js — /admin/employers — KYB decisions (§14.1).
// Approval needs a verified company-domain email; suspending or rejecting a
// company signs its users out at once.
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';

const STATUS = [['pending', 'Pending'], ['verified', 'Verified'], ['suspended', 'Suspended'], ['rejected', 'Rejected'], ['', 'All']];
const ACTIONS = { pending: [['verified', 'Approve'], ['rejected', 'Reject']], verified: [['suspended', 'Suspend']], suspended: [['verified', 'Reinstate']], rejected: [['pending', 'Reopen']] };

export default function AdminEmployers() {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');
  const load = useCallback(() => api.get(`/admin/employers${status ? `?status=${status}` : ''}`).then(r => setData(r.data)).catch(e => setError(errMsg(e))), [status]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id, decision) => {
    setError('');
    try { await api.post(`/admin/employers/${id}/kyb`, { decision, note: notes[id] || undefined }); load(); } catch (e) { setError(errMsg(e)); }
  };
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Employer KYB</h1><span className="ln-sub">Approve companies after their domain email is verified.</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-pilltabs" role="tablist" style={{ marginBottom: 14 }}>
        {STATUS.map(([s, label]) => <button key={s || 'all'} type="button" role="tab" className="ln-pilltab" aria-selected={status === s} onClick={() => setStatus(s)}>{label}{s && data?.counts?.[s] ? ` · ${data.counts[s]}` : ''}</button>)}
      </div>
      <div className="ln-col" style={{ gap: 12 }}>
        {data && data.employers.length === 0 && <p className="ln-muted">Nothing here.</p>}
        {(data?.employers || []).map(e => (
          <article key={e.id} className="ln-card" style={{ gap: 8 }}>
            <div className="ln-between ln-wrap"><b style={{ fontSize: 17 }}>{e.name}</b><span className="ln-tag ln-tag-neutral">{e.kyb_status}</span></div>
            <div className="ln-small ln-muted">@{e.domain} · owner {e.owner_email || '—'} · {e.users} user{e.users === 1 ? '' : 's'}{e.city ? ` · ${e.city}` : ''}</div>
            <div className="ln-row ln-wrap" style={{ gap: 6 }}>
              <span className={`ln-tag ${e.domain_verified_at ? 'ln-tag-success' : 'ln-tag-warning'}`}>{e.domain_verified_at ? 'Domain verified' : 'Domain not verified'}</span>
              <span className={`ln-tag ${e.gstin ? 'ln-tag-success' : 'ln-tag-neutral'}`}>{e.gstin ? `GSTIN ${e.gstin}` : 'No GSTIN'}</span>
              {e.website && <a className="ln-link ln-small" href={e.website} target="_blank" rel="noreferrer">{e.website}</a>}
            </div>
            {e.kyb_note && <div className="ln-small">Note: {e.kyb_note}</div>}
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <input className="ln-input" style={{ flex: 1, minWidth: 200 }} aria-label={`Note for ${e.name}`} placeholder="Note (optional, shown to the employer)" value={notes[e.id] || ''} onChange={ev => setNotes(n => ({ ...n, [e.id]: ev.target.value }))} />
              {(ACTIONS[e.kyb_status] || []).map(([d, label]) => (
                <button key={d} type="button" className={`ln-btn ${d === 'verified' ? 'ln-btn-primary' : ''}`} disabled={d === 'verified' && !e.domain_verified_at} onClick={() => decide(e.id, d)}>{label}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
