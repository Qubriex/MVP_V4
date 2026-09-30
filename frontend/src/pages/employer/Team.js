// src/pages/employer/Team.js — /employer/team — owners invite recruiters and
// viewers on the company domain, change roles and disable accounts.
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useEmployer } from './Layout';

export default function EmployerTeam() {
  const { me, isOwner } = useEmployer();
  const [data, setData] = useState(null);
  const [inv, setInv] = useState({ email: '', name: '', role: 'recruiter' });
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => api.get('/employer/users').then(r => setData(r.data)).catch(e => setError(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);

  const invite = async (e) => {
    e.preventDefault(); setError(''); setLink('');
    try { const r = await api.post('/employer/users/invites', inv); setLink(r.data.invite_url); setInv({ email: '', name: '', role: 'recruiter' }); load(); }
    catch (err) { setError(errMsg(err)); }
  };
  const update = async (id, body) => {
    setError('');
    try { await api.put(`/employer/users/${id}`, body); load(); } catch (err) { setError(errMsg(err)); }
  };

  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Team</h1>
        <span className="ln-sub">Owners manage the account · recruiters search and request access · viewers read.</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {isOwner && (
        <form className="ln-card" style={{ gap: 12, marginBottom: 16 }} onSubmit={invite}>
          <h2 className="ln-h2" style={{ margin: 0, fontSize: 18 }}>Invite a colleague</h2>
          <div className="ln-row ln-wrap" style={{ gap: 10 }}>
            <input className="ln-input" style={{ flex: '2 1 220px' }} type="email" aria-label="Work email" placeholder={`name@${me?.employer?.domain || 'company.com'}`} value={inv.email} onChange={e => setInv(v => ({ ...v, email: e.target.value }))} required />
            <input className="ln-input" style={{ flex: '1 1 160px' }} aria-label="Name" placeholder="Name (optional)" value={inv.name} onChange={e => setInv(v => ({ ...v, name: e.target.value }))} />
            <select className="ln-select" aria-label="Role" value={inv.role} onChange={e => setInv(v => ({ ...v, role: e.target.value }))}><option value="recruiter">Recruiter</option><option value="viewer">Viewer</option></select>
            <button type="submit" className="ln-btn ln-btn-primary">Send invite</button>
          </div>
          {link && <div className="ln-note ln-small">Invite sent. You can also share this link: <code style={{ wordBreak: 'break-all' }}>{link}</code></div>}
        </form>
      )}
      <div className="ln-tablewrap">
        <table className="ln-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign in</th></tr></thead>
          <tbody>
            {(data?.users || []).map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name || '—'}</td><td>{u.email}</td>
                <td>{isOwner && u.id !== me?.user?.id ? (
                  <select className="ln-select" aria-label={`Role for ${u.email}`} value={u.role} onChange={e => update(u.id, { role: e.target.value })}>
                    <option value="owner">Owner</option><option value="recruiter">Recruiter</option><option value="viewer">Viewer</option></select>) : u.role}</td>
                <td>{isOwner && u.id !== me?.user?.id ? (
                  <button type="button" className="ln-btn ln-btn-sm" onClick={() => update(u.id, { status: u.status === 'active' ? 'disabled' : 'active' })}>{u.status === 'active' ? 'Disable' : 'Enable'}</button>) : u.status}</td>
                <td className="ln-small ln-muted">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</td>
              </tr>
            ))}
            {(data?.invites || []).map(i => (
              <tr key={i.id}><td>{i.name || '—'}</td><td>{i.email}</td><td>{i.role}</td><td><span className="ln-tag ln-tag-neutral">Invited</span></td><td className="ln-small ln-muted">Expires {new Date(i.expires_at).toLocaleDateString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
