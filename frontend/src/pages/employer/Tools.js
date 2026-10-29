// src/pages/employer/Tools.js — /employer/verify-bulk, /employer/templates
// and /employer/billing (v4.3 canvas E8, E5, E9). Bulk verify takes up to
// 200 Evidence IDs (pasted or a CSV) and reports each. Day-One templates are
// short practical tasks per role. Plans show [PRICE] until pricing is set.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, KeyRound, Plug } from 'lucide-react';
import api from '../../utils/api';
import { isDemoSession } from '../../utils/demoAccess';
import { errMsg } from '../../utils/errors';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const STATUS = { valid: ['emp.tools.status.valid', 'ln-tag-success'], revoked: ['emp.tools.status.revoked', 'ln-tag-warning'], expired: ['emp.tools.status.expired', 'ln-tag-warning'], not_found: ['emp.tools.status.notFound', 'ln-tag-neutral'], malformed: ['emp.tools.status.notAnEvidenceId', 'ln-tag-neutral'], signature_invalid: ['emp.tools.status.signatureDoesNotMatch', 'ln-tag-warning'], demo_not_accepted: ['emp.tools.status.demoNotAccepted', 'ln-tag-danger'] };

export function BulkVerify() {
  const { t } = useUiLang();
  const [text, setText] = useState('');
  const [out, setOut] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = [...new Set(text.split(/[\s,;]+/).map(s => s.trim()).filter(s => /^QBX-|^qbx-|\w{6,}/.test(s)))];
  const load = (file) => { const r = new FileReader(); r.onload = () => setText(String(r.result || '')); r.readAsText(file); };
  const run = async () => {
    setBusy(true); setMsg('');
    try { setOut((await api.post('/employer/verify/bulk', { ids })).data); } catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };
  const download = () => {
    const rows = [['evidence_id', 'status', 'valid_until', 'skills'], ...out.results.map(r => [r.input, r.status, r.valid_until || '', r.skills.map(s => `${s.name} (${s.label})`).join('; ')])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'verify-results.csv'; a.click();
  };
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('emp.tools.verifyBulk')}</h1><span className="ln-sub">{t('emp.tools.checkManyEvidenceIds')}</span></div></header>
      <section className="ui-narrow ln-card" style={{ gap: 10 }}>
        <label className="ln-label" htmlFor="bv">{t('emp.tools.evidenceIdsOnePer')}</label>
        <textarea id="bv" className="ln-input in-code" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="QBX-7K2M9P4XQ8RT" />
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <label className="ln-btn ln-btn-sm"><Upload size={14} aria-hidden="true" />{t('emp.tools.uploadCsv')}<input type="file" accept=".csv,.txt" hidden onChange={e => e.target.files[0] && load(e.target.files[0])} /></label>
          <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" disabled={!ids.length || ids.length > 200 || busy} onClick={run}>{busy ? t('emp.tools.checking') : t('emp.tools.verifyN', { n: ids.length || '' })}</button>
          <span className="ln-xs ln-muted">{ids.length > 200 ? t('emp.tools.tooMany', { n: ids.length }) : t('emp.tools.up200AtTime')}</span>
        </div>
        {msg && <div className="ln-error" role="alert">{msg}</div>}
      </section>
      {out && (
        <section className="ln-col" style={{ gap: 10 }}>
          <div className="ln-between ln-wrap"><span className="ln-small">{Object.entries(out.counts).map(([k, n]) => `${n} ${t((STATUS[k] || [k])[0]).toLowerCase()}`).join(' · ')}</span><button type="button" className="ln-btn ln-btn-sm" onClick={download}>{t('emp.tools.downloadResults')}</button></div>
          <div className="ln-tablewrap"><table className="ln-table"><thead><tr><th>{t('emp.tools.evidenceId')}</th><th>{t('emp.tools.result')}</th><th>{t('emp.tools.validUntil')}</th><th>{t('emp.tools.skillsIfPublic')}</th></tr></thead>
            <tbody>{out.results.map(r => <tr key={r.input}><td className="in-code">{r.evidence_id ? <Link to={`/verify/${r.evidence_id}`} className="ln-link" target="_blank" rel="noopener">{r.evidence_id}</Link> : r.input}</td>
              <td><span className={`ln-tag ${(STATUS[r.status] || ['', 'ln-tag-neutral'])[1]}`}>{t((STATUS[r.status] || [r.status])[0])}</span></td>
              <td className="ln-small">{r.valid_until ? new Date(r.valid_until).toLocaleDateString(uiLocale()) : '—'}</td>
              <td className="ln-small">{r.skills_public === false ? t('emp.tools.keptPrivateByStudent') : r.skills.map(s => s.name).join(', ') || '—'}</td></tr>)}</tbody></table></div>
        </section>
      )}
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <section className="ln-card" style={{ gap: 8 }}><b><KeyRound size={15} aria-hidden="true" /> {' '}{t('emp.tools.publicKeys')}</b>
          <span className="ln-small">{t('emp.tools.everyPassportSignedCheck')}</span>
          <a className="ln-link ln-small" href="/api/verify/jwks.json" target="_blank" rel="noopener">{t('emp.tools.jwksJson')}</a></section>
        <section className="ln-card" style={{ gap: 8 }}><b><Plug size={15} aria-hidden="true" /> {' '}{t('emp.tools.connectAts')}</b>
          <span className="ln-small">{t('emp.tools.useApiKeyVerify')}</span>
          <Link to="/employer/api-keys" className="ln-link ln-small">{t('emp.tools.apiKeys')}</Link></section>
      </div>
    </>
  );
}

const TEMPLATES = [
  ['emp.tools.templates.dataAnalyst', 'emp.tools.templates.cleanA2000', 'emp.tools.templates.45Min'],
  ['emp.tools.templates.frontendDeveloper', 'emp.tools.templates.turnASmallDesign', 'emp.tools.templates.60Min'],
  ['emp.tools.templates.pythonDeveloper', 'emp.tools.templates.fixTwoBugsIn', 'emp.tools.templates.40Min'],
  ['emp.tools.templates.cloudSupport', 'emp.tools.templates.readALogFind', 'emp.tools.templates.30Min'],
  ['emp.tools.templates.customerSupportEnglishTelugu', 'emp.tools.templates.answerThreeCustomerMessages', 'emp.tools.templates.25Min']
];
export function Templates() {
  const { t } = useUiLang();
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('emp.tools.dayOneTemplates')}</h1>
        <span className="ln-sub">{t('emp.tools.shortSupervisedPracticeRun')}</span></div></header>
      <div className="ln-note">{t('emp.tools.askQubirexSwitchedOff')}</div>
      <div className="ln-grid ln-g-2" style={{ gap: 14 }}>
        {TEMPLATES.map(([role, task, time]) => (
          <article key={role} className="ln-card" style={{ gap: 6 }}><div className="ln-between"><b>{t(role)}</b><span className="ln-tag ln-tag-neutral">{t(time)}</span></div><span className="ln-small">{t(task)}</span></article>
        ))}
      </div>
      <span className="ln-xs ln-muted">{t('emp.tools.wantTemplateOwnRole')}</span>
    </>
  );
}

const PLANS = [
  ['emp.tools.plans.starter', 'emp.tools.plans.forAFirstHiring', ['emp.tools.plans.1RoleAtA', 'emp.tools.plans.searchStudentsWhoOpted', 'emp.tools.plans.verifyUpTo50']],
  ['emp.tools.plans.growth', 'emp.tools.plans.forRegularCampusHiring', ['emp.tools.plans.10Roles', 'emp.tools.plans.requestsAndPipelineFor', 'emp.tools.plans.bulkVerifyAndCsv', 'emp.tools.plans.collegesInsights']],
  ['emp.tools.plans.enterprise', 'emp.tools.plans.forLargeHiringProgrammes', ['emp.tools.plans.unlimitedRoles', 'emp.tools.plans.apiForYourAts', 'emp.tools.plans.sponsoredCohorts', 'emp.tools.plans.namedSupport']]
];
export function Billing() {
  const { t } = useUiLang();
  const [asked, setAsked] = useState(null);
  // The working demo never takes payment (backend api/routes/demo.js).
  if (isDemoSession()) {
    return (
      <>
        <header className="ln-pagehead"><h1 className="ln-title">{t('emp.tools.planBilling')}</h1></header>
        <p className="ln-card ln-small" role="status" style={{ margin: 0 }}>{t('demo2.notInDemo')}</p>
      </>
    );
  }
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('emp.tools.planBilling')}</h1><span className="ln-sub">{t('emp.tools.pricesShownBeforeGst')}</span></div></header>
      <div className="ln-grid ln-g-3" style={{ gap: 14 }}>
        {PLANS.map(([name, sub, feats]) => (
          <article key={name} className="ln-card" style={{ gap: 8 }}>
            <b style={{ fontSize: 'var(--fs-h3)' }}>{t(name)}</b><span className="ln-small ln-muted">{t(sub)}</span>
            <span className="ln-h3" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{t('emp.tools.talkPricing')}</span>
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{feats.map(f => <li key={f}>{t(f)}</li>)}</ul>
            <button type="button" className="ln-btn ln-btn-sm" aria-expanded={asked === name} onClick={() => setAsked(name)}>{t('emp.tools.chooseName', { name: t(name) })}</button>
            {asked === name && <span className="ln-xs" role="status">{t('emp.tools.comingSoonPricingBeing', { name: t(name) })}</span>}
          </article>
        ))}
      </div>
      <section className="ln-card" style={{ gap: 8 }}>
        <h2 className="ln-h2">{t('emp.tools.invoices')}</h2>
        <span className="ln-small ln-muted">{t('emp.tools.noInvoicesYetEach')}{' '} <Link to="/employer/company" className="ln-link">{t('emp.tools.addGstin')}</Link></span>
      </section>
    </>
  );
}
