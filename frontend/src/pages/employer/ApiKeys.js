// src/pages/employer/ApiKeys.js — /employer/api-keys — API keys for ATS
// integrations (sent as X-QBX-API-Key). Qubirex keeps only a hash, so a new
// key is shown once. Also the optional signing identity (did:web or JWKS URL
// on the company domain) for employer-signed endorsements in Phase 3.
import React, { useCallback, useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useEmployer } from './Layout';

const SCOPE_TEXT = { search: 'Search candidates', verify: 'Verify Evidence IDs', 'passport.read': 'Read shared passports', webhooks: 'Receive webhooks' };

export default function EmployerApiKeys() {
  const { me, isOwner } = useEmployer();
  const [keys, setKeys] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState(['verify']);
  const [fresh, setFresh] = useState(null);
  const [ident, setIdent] = useState({ kind: 'did_web', value: '' });
  const [identNote, setIdentNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/employer/api-keys').then(r => { setKeys(r.data.keys); setScopes(r.data.scopes); }).catch(e => setError(errMsg(e)));
    api.get('/employer/signing-identity').then(r => { if (r.data.identity) setIdent({ kind: r.data.identity.kind, value: r.data.identity.value }); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault(); setError('');
    try { const r = await api.post('/employer/api-keys', { name, scopes: picked }); setFresh(r.data); setName(''); load(); }
    catch (err) { setError(errMsg(err)); }
  };
  const revoke = async (id) => {
    if (!window.confirm('Revoke this key? Integrations using it stop working at once.')) return;
    try { await api.delete(`/employer/api-keys/${id}`); load(); } catch (err) { setError(errMsg(err)); }
  };
  const saveIdent = async (e) => {
    e.preventDefault(); setError(''); setIdentNote('');
    try { const r = await api.put('/employer/signing-identity', ident); setIdentNote(r.data.note); } catch (err) { setError(errMsg(err)); }
  };
  const toggle = (s) => setPicked(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">API & integrations</h1>
        <span className="ln-sub">Connect your ATS. Send the key in the <code>X-QBX-API-Key</code> header.</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {fresh && (
        <div className="ln-card" style={{ gap: 8, marginBottom: 16, borderColor: 'var(--status-warning)' }} role="status">
          <b>Copy your new key now</b>
          <div className="ln-row" style={{ gap: 8, alignItems: 'center' }}>
            <code style={{ wordBreak: 'break-all', flex: 1, padding: '8px 10px', background: 'var(--color-surface-2)', borderRadius: 8 }}>{fresh.key}</code>
            <button type="button" className="ln-btn ln-btn-sm" onClick={() => navigator.clipboard?.writeText(fresh.key)} aria-label="Copy key"><Copy size={14} aria-hidden="true" />Copy</button>
          </div>
          <span className="ln-small ln-muted">{fresh.note}</span>
        </div>
      )}
      {isOwner && (
        <form className="ln-card" style={{ gap: 12, marginBottom: 16 }} onSubmit={create}>
          <h2 className="ln-h2" style={{ margin: 0, fontSize: 18 }}>New API key</h2>
          <input className="ln-input" aria-label="Key name" placeholder="e.g. Greenhouse integration" value={name} onChange={e => setName(e.target.value)} required />
          <div className="ln-row ln-wrap" style={{ gap: 8 }} role="group" aria-label="Scopes">
            {scopes.map(s => (
              <label key={s} className="ln-chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={picked.includes(s)} onChange={() => toggle(s)} /> {SCOPE_TEXT[s] || s}</label>
            ))}
          </div>
          {me?.employer?.kyb_status !== 'verified' && <span className="ln-xs ln-muted">Keys work now for verification; search and passport scopes return data once your company is verified.</span>}
          <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!picked.length}>Create key</button>
        </form>
      )}
      <div className="ln-tablewrap" style={{ marginBottom: 24 }}>
        <table className="ln-table">
          <thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Last used</th><th /></tr></thead>
          <tbody>
            {keys.length === 0 && <tr><td colSpan={5} className="ln-muted">No keys yet.</td></tr>}
            {keys.map(k => (
              <tr key={k.id}>
                <td style={{ fontWeight: 600 }}>{k.name}</td><td><code>qbx_{k.prefix}_…</code></td>
                <td className="ln-small">{(k.scopes || []).join(', ')}</td>
                <td className="ln-small ln-muted">{k.revoked_at ? `Revoked ${new Date(k.revoked_at).toLocaleDateString()}` : k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</td>
                <td>{isOwner && !k.revoked_at && <button type="button" className="ln-btn ln-btn-sm" onClick={() => revoke(k.id)}>Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="ln-card" style={{ gap: 12, maxWidth: 620 }} onSubmit={saveIdent}>
        <h2 className="ln-h2" style={{ margin: 0, fontSize: 18 }}>Signing identity (optional)</h2>
        <p className="ln-small ln-muted" style={{ margin: 0 }}>Register a did:web identifier or an https JWKS URL on @{me?.employer?.domain}. Endorsements stay signed by Qubirex until employer-held keys are switched on.</p>
        {identNote && <div className="ln-note ln-small">{identNote}</div>}
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <select className="ln-select" aria-label="Identity type" value={ident.kind} onChange={e => setIdent(v => ({ ...v, kind: e.target.value }))} disabled={!isOwner}><option value="did_web">did:web</option><option value="jwks_url">JWKS URL</option></select>
          <input className="ln-input" style={{ flex: 1, minWidth: 220 }} aria-label="Identifier" placeholder={ident.kind === 'did_web' ? `did:web:${me?.employer?.domain || 'company.com'}` : `https://${me?.employer?.domain || 'company.com'}/.well-known/jwks.json`} value={ident.value} onChange={e => setIdent(v => ({ ...v, value: e.target.value }))} disabled={!isOwner} required />
          {isOwner && <button type="submit" className="ln-btn">Save</button>}
        </div>
      </form>
    </>
  );
}
