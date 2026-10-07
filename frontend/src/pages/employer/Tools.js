// src/pages/employer/Tools.js — /employer/verify-bulk, /employer/templates
// and /employer/billing (v4.3 canvas E8, E5, E9). Bulk verify takes up to
// 200 Evidence IDs (pasted or a CSV) and reports each. Day-One templates are
// short practical tasks per role. Plans show [PRICE] until pricing is set.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, KeyRound, Plug } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';

const STATUS = { valid: ['Valid', 'ln-tag-success'], revoked: ['Revoked', 'ln-tag-warning'], expired: ['Expired', 'ln-tag-warning'], not_found: ['Not found', 'ln-tag-neutral'], malformed: ['Not an Evidence ID', 'ln-tag-neutral'], signature_invalid: ['Signature does not match', 'ln-tag-warning'] };

export function BulkVerify() {
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
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Verify in bulk</h1><span className="ln-sub">Check many Evidence IDs at once — from a CSV or pasted from your ATS.</span></div></header>
      <section className="ln-card" style={{ gap: 10, maxWidth: 900 }}>
        <label className="ln-label" htmlFor="bv">Evidence IDs (one per line, or comma-separated)</label>
        <textarea id="bv" className="ln-input in-code" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="QBX-7K2M9P4XQ8RT" />
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <label className="ln-btn ln-btn-sm"><Upload size={14} aria-hidden="true" />Upload CSV<input type="file" accept=".csv,.txt" hidden onChange={e => e.target.files[0] && load(e.target.files[0])} /></label>
          <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" disabled={!ids.length || ids.length > 200 || busy} onClick={run}>{busy ? 'Checking…' : `Verify ${ids.length || ''}`}</button>
          <span className="ln-xs ln-muted">{ids.length > 200 ? `${ids.length} found — up to 200 at a time.` : 'Up to 200 at a time.'}</span>
        </div>
        {msg && <div className="ln-error" role="alert">{msg}</div>}
      </section>
      {out && (
        <section className="ln-col" style={{ gap: 10 }}>
          <div className="ln-between ln-wrap"><span className="ln-small">{Object.entries(out.counts).map(([k, n]) => `${n} ${(STATUS[k] || [k])[0].toLowerCase()}`).join(' · ')}</span><button type="button" className="ln-btn ln-btn-sm" onClick={download}>Download results</button></div>
          <div className="ln-tablewrap"><table className="ln-table"><thead><tr><th>Evidence ID</th><th>Result</th><th>Valid until</th><th>Skills (if public)</th></tr></thead>
            <tbody>{out.results.map(r => <tr key={r.input}><td className="in-code">{r.evidence_id ? <Link to={`/verify/${r.evidence_id}`} className="ln-link" target="_blank" rel="noopener">{r.evidence_id}</Link> : r.input}</td>
              <td><span className={`ln-tag ${(STATUS[r.status] || ['', 'ln-tag-neutral'])[1]}`}>{(STATUS[r.status] || [r.status])[0]}</span></td>
              <td className="ln-small">{r.valid_until ? new Date(r.valid_until).toLocaleDateString('en-IN') : '—'}</td>
              <td className="ln-small">{r.skills_public === false ? 'Kept private by the student' : r.skills.map(s => s.name).join(', ') || '—'}</td></tr>)}</tbody></table></div>
        </section>
      )}
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <section className="ln-card" style={{ gap: 8 }}><b><KeyRound size={15} aria-hidden="true" /> Public keys</b>
          <span className="ln-small">Every Passport is signed. Check signatures yourself with our published keys.</span>
          <a className="ln-link ln-small" href="/api/verify/jwks.json" target="_blank" rel="noopener">jwks.json →</a></section>
        <section className="ln-card" style={{ gap: 8 }}><b><Plug size={15} aria-hidden="true" /> Connect your ATS</b>
          <span className="ln-small">Use an API key to verify Evidence IDs from [ATS name] or your own system.</span>
          <Link to="/employer/api-keys" className="ln-link ln-small">API keys →</Link></section>
      </div>
    </>
  );
}

const TEMPLATES = [
  ['Data analyst', 'Clean a 2,000-row sales file, answer five questions with SQL, and explain one chart to a manager.', '45 min'],
  ['Frontend developer', 'Turn a small design into a responsive page that loads data from an API and handles errors.', '60 min'],
  ['Python developer', 'Fix two bugs in a short script, add a test, and write what you changed in plain words.', '40 min'],
  ['Cloud support', 'Read a log, find why a service stopped, and write the reply you would send the customer.', '30 min'],
  ['Customer support (English/Telugu)', 'Answer three customer messages, one by voice, in the customer’s language.', '25 min']
];
export function Templates() {
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Day-One templates</h1>
        <span className="ln-sub">A short supervised practice run of real first-week work. Invite a candidate from their page.</span></div></header>
      <div className="ln-note">Ask Qubirex is switched off for the candidate during a Day-One run. The result is shown to you as evidence, not as a pass or fail.</div>
      <div className="ln-grid ln-g-2" style={{ gap: 14 }}>
        {TEMPLATES.map(([role, task, time]) => (
          <article key={role} className="ln-card" style={{ gap: 6 }}><div className="ln-between"><b>{role}</b><span className="ln-tag ln-tag-neutral">{time}</span></div><span className="ln-small">{task}</span></article>
        ))}
      </div>
      <span className="ln-xs ln-muted">Want a template for your own role? Ask through Help → Contact.</span>
    </>
  );
}

const PLANS = [
  ['Starter', 'For a first hiring drive', ['1 role at a time', 'Search students who opted in', 'Verify up to 50 Evidence IDs a month']],
  ['Growth', 'For regular campus hiring', ['10 roles', 'Requests and pipeline for your team', 'Bulk verify and CSV export', 'Colleges & insights']],
  ['Enterprise', 'For large hiring programmes', ['Unlimited roles', 'API for your ATS', 'Sponsored cohorts', 'Named support']]
];
export function Billing() {
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Plan &amp; billing</h1><span className="ln-sub">Prices are shown before GST. Invoices carry your GSTIN when you have added it.</span></div></header>
      <div className="ln-grid ln-g-3" style={{ gap: 14 }}>
        {PLANS.map(([name, sub, feats]) => (
          <article key={name} className="ln-card" style={{ gap: 8 }}>
            <b style={{ fontSize: 18 }}>{name}</b><span className="ln-small ln-muted">{sub}</span>
            <span className="ln-stat" style={{ fontSize: 26 }}>[PRICE]<span className="ln-small ln-muted"> / month + GST</span></span>
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{feats.map(f => <li key={f}>{f}</li>)}</ul>
            <button type="button" className="ln-btn ln-btn-sm" disabled title="Pricing is being finalised">Choose {name}</button>
          </article>
        ))}
      </div>
      <section className="ln-card" style={{ gap: 8 }}>
        <h2 className="ln-h2">Invoices</h2>
        <span className="ln-small ln-muted">No invoices yet. Each invoice shows CGST and SGST, or IGST across states, with your GSTIN. <Link to="/employer/company" className="ln-link">Add your GSTIN →</Link></span>
      </section>
    </>
  );
}
