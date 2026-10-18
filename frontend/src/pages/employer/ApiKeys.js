// src/pages/employer/ApiKeys.js — /employer/api-keys — API keys for ATS
// integrations (sent as X-QBX-API-Key). Qubirex keeps only a hash, so a new
// key is shown once. Also the optional signing identity (did:web or JWKS URL
// on the company domain) for employer-signed endorsements in Phase 3.
import React, { useCallback, useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useEmployer } from './Layout';
import { Select } from '../../components/shared/ui';

import { useUiLang } from '../../context/UiLangContext';
const SCOPE_TEXT = { search: 'emp.apiKeys.scopeText.searchCandidates', verify: 'emp.apiKeys.scopeText.verifyEvidenceIds', 'passport.read': 'emp.apiKeys.scopeText.readSharedPassports', webhooks: 'emp.apiKeys.scopeText.receiveWebhooks' };

export default function EmployerApiKeys() {
  const { t, fmtDate } = useUiLang();
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
    if (!window.confirm(t('emp.apiKeys.revokeKeyIntegrationsUsing'))) return;
    try { await api.delete(`/employer/api-keys/${id}`); load(); } catch (err) { setError(errMsg(err)); }
  };
  const saveIdent = async (e) => {
    e.preventDefault(); setError(''); setIdentNote('');
    try { const r = await api.put('/employer/signing-identity', ident); setIdentNote(r.data.note); } catch (err) { setError(errMsg(err)); }
  };
  const toggle = (s) => setPicked(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('emp.apiKeys.apiIntegrations')}</h1>
        <span className="ln-sub">{t('emp.apiKeys.connectAtsSendKey')}{' '} <code>{t('emp.apiKeys.xQbxApiKey')}</code> {' '}{t('emp.apiKeys.header')}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {fresh && (
        <div className="ln-card" style={{ gap: 8, marginBottom: 16, borderColor: 'var(--status-warning)' }} role="status">
          <b>{t('emp.apiKeys.copyNewKeyNow')}</b>
          <div className="ln-row" style={{ gap: 8, alignItems: 'center' }}>
            <code style={{ wordBreak: 'break-all', flex: 1, padding: '8px 10px', background: 'var(--color-surface-2)', borderRadius: 8 }}>{fresh.key}</code>
            <button type="button" className="ln-btn ln-btn-sm" onClick={() => navigator.clipboard?.writeText(fresh.key)} aria-label={t('emp.apiKeys.copyKey')}><Copy size={14} aria-hidden="true" />{t('emp.apiKeys.copy')}</button>
          </div>
          <span className="ln-small ln-muted">{fresh.note}</span>
        </div>
      )}
      {isOwner && (
        <form className="ln-card" style={{ gap: 12, marginBottom: 16 }} onSubmit={create}>
          <h2 className="ln-h2" style={{ margin: 0, fontSize: 'var(--fs-h3)' }}>{t('emp.apiKeys.newApiKey')}</h2>
          <input className="ln-input" aria-label={t('emp.apiKeys.keyName')} placeholder={t('emp.apiKeys.eGGreenhouseIntegration')} value={name} onChange={e => setName(e.target.value)} required />
          <div className="ln-row ln-wrap" style={{ gap: 8 }} role="group" aria-label={t('emp.apiKeys.scopes')}>
            {scopes.map(s => (
              <label key={s} className="ln-chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={picked.includes(s)} onChange={() => toggle(s)} /> {SCOPE_TEXT[s] ? t(SCOPE_TEXT[s]) : s}</label>
            ))}
          </div>
          {me?.employer?.kyb_status !== 'verified' && <span className="ln-xs ln-muted">{t('emp.apiKeys.keysWorkNowVerification')}</span>}
          <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!picked.length}>{t('emp.apiKeys.createKey')}</button>
        </form>
      )}
      <div className="ln-tablewrap" style={{ marginBottom: 24 }}>
        <table className="ln-table">
          <thead><tr><th>{t('emp.apiKeys.name')}</th><th>{t('emp.apiKeys.key')}</th><th>{t('emp.apiKeys.scopes')}</th><th>{t('emp.apiKeys.lastUsed')}</th><th /></tr></thead>
          <tbody>
            {keys.length === 0 && <tr><td colSpan={5} className="ln-muted">{t('emp.apiKeys.noKeysYet')}</td></tr>}
            {keys.map(k => (
              <tr key={k.id}>
                <td style={{ fontWeight: 600 }}>{k.name}</td><td><code>{t('emp.apiKeys.qbxPrefix', { prefix: k.prefix })}</code></td>
                <td className="ln-small">{(k.scopes || []).join(', ')}</td>
                <td className="ln-small ln-muted">{k.revoked_at ? t('emp.apiKeys.revokedOn', { date: fmtDate(k.revoked_at) }) : k.last_used_at ? fmtDate(k.last_used_at, { dateStyle: 'medium', timeStyle: 'short' }) : t('emp.apiKeys.never')}</td>
                <td>{isOwner && !k.revoked_at && <button type="button" className="ln-btn ln-btn-sm" onClick={() => revoke(k.id)}>{t('emp.apiKeys.revoke')}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="ui-narrow ln-card" style={{ gap: 12 }} onSubmit={saveIdent}>
        <h2 className="ln-h2" style={{ margin: 0, fontSize: 'var(--fs-h3)' }}>{t('emp.apiKeys.signingIdentityOptional')}</h2>
        <p className="ln-small ln-muted" style={{ margin: 0 }}>{t('emp.apiKeys.registerDidWebIdentifier', { domain: me?.employer?.domain })}</p>
        {identNote && <div className="ln-note ln-small">{identNote}</div>}
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <Select aria-label={t('emp.apiKeys.identityType')} value={ident.kind} onChange={e => setIdent(v => ({ ...v, kind: e.target.value }))} disabled={!isOwner}><option value="did_web">{t('emp.apiKeys.didWeb')}</option><option value="jwks_url">JWKS URL</option></Select>
          <input className="ln-input" style={{ flex: 1, minWidth: 220 }} aria-label={t('emp.apiKeys.identifier')} placeholder={/* i18n-ignore */ ident.kind === 'did_web' ? `did:web:${me?.employer?.domain || 'company.com'}` : `https://${me?.employer?.domain || 'company.com'}/.well-known/jwks.json`} value={ident.value} onChange={e => setIdent(v => ({ ...v, value: e.target.value }))} disabled={!isOwner} required />
          {isOwner && <button type="submit" className="ln-btn">{t('emp.apiKeys.save')}</button>}
        </div>
      </form>
    </>
  );
}
