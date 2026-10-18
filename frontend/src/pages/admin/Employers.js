// src/pages/admin/Employers.js — /admin/employers — KYB decisions (§14.1).
// Approval needs a verified company-domain email; suspending or rejecting a
// company signs its users out at once.
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';

import { useUiLang } from '../../context/UiLangContext';
const STATUS = [['pending', 'adm.employers.status.pending'], ['verified', 'adm.employers.status.verified'], ['suspended', 'adm.employers.status.suspended'], ['rejected', 'adm.employers.status.rejected'], ['', 'adm.employers.status.all']];
const ACTIONS = { pending: [['verified', 'adm.employers.actions.approve'], ['rejected', 'adm.employers.actions.reject']], verified: [['suspended', 'adm.employers.actions.suspend']], suspended: [['verified', 'adm.employers.actions.reinstate']], rejected: [['pending', 'adm.employers.actions.reopen']] };

export default function AdminEmployers() {
  const { t } = useUiLang();
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
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('adm.employers.employerKyb')}</h1><span className="ln-sub">{t('adm.employers.approveCompaniesAfterTheir')}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-pilltabs" role="tablist" style={{ marginBottom: 14 }}>
        {STATUS.map(([s, label]) => <button key={s || 'all'} type="button" role="tab" className="ln-pilltab" aria-selected={status === s} onClick={() => setStatus(s)}>{t(label)}{s && data?.counts?.[s] ? ` · ${data.counts[s]}` : ''}</button>)}
      </div>
      <div className="ln-col" style={{ gap: 12 }}>
        {data && data.employers.length === 0 && <p className="ln-muted">{t('adm.employers.nothingHere')}</p>}
        {(data?.employers || []).map(e => (
          <article key={e.id} className="ln-card" style={{ gap: 8 }}>
            <div className="ln-between ln-wrap"><b style={{ fontSize: 'var(--fs-h3)' }}>{e.name}</b><span className="ln-tag ln-tag-neutral">{e.kyb_status}</span></div>
            <div className="ln-small ln-muted">{t('adm.employers.domainOwner', { domain: e.domain })}{' '} {e.owner_email || '—'} {' '}{t('adm.employers.usersUser', { users: e.users })}{e.city ? ` · ${e.city}` : ''}</div>
            <div className="ln-row ln-wrap" style={{ gap: 6 }}>
              <span className={`ln-tag ${e.domain_verified_at ? 'ln-tag-success' : 'ln-tag-warning'}`}>{e.domain_verified_at ? t('adm.employers.domainVerified') : t('adm.employers.domainNotVerified')}</span>
              <span className={`ln-tag ${e.gstin ? 'ln-tag-success' : 'ln-tag-neutral'}`}>{e.gstin ? t('adm.employers.gstinN', { gstin: e.gstin }) : t('adm.employers.noGstin')}</span>
              {e.website && <a className="ln-link ln-small" href={e.website} target="_blank" rel="noreferrer">{e.website}</a>}
            </div>
            {e.kyb_note && <div className="ln-small">{t('adm.employers.noteKybNote', { kyb_note: e.kyb_note })}</div>}
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <input className="ln-input" style={{ flex: 1, minWidth: 200 }} aria-label={t('adm.employers.noteName', { name: e.name })} placeholder={t('adm.employers.noteOptionalShownEmployer')} value={notes[e.id] || ''} onChange={ev => setNotes(n => ({ ...n, [e.id]: ev.target.value }))} />
              {(ACTIONS[e.kyb_status] || []).map(([d, label]) => (
                <button key={d} type="button" className={`ln-btn ${d === 'verified' ? 'ln-btn-primary' : ''}`} disabled={d === 'verified' && !e.domain_verified_at} onClick={() => decide(e.id, d)}>{t(label)}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
