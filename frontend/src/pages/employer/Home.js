// src/pages/employer/Home.js — /employer/home — KYB progress (§14.1):
// 1 company details, 2 domain email code, 3 Qubirex approval. Until approved
// the company can search but cannot request access to learner evidence.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Plus, Users } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useCachedGet } from '../../utils/cachedGet';
import { useEmployer, KYB_TEXT } from './Layout';
import CommandBox from '../../components/shared/CommandBox';
import { HowCounted } from '../../components/shared/Popover';
import { Bar } from '../../components/learn/ui';

// The hiring side of Home (v4.3 canvas E1): who is waiting for a decision,
// open roles and the funnel. Verification steps follow until approved.
function Hiring() {
  const { data } = useCachedGet('/employer/home');
  if (!data) return <CommandBox side="employer" placeholder="Ask about your hiring — for example, who is waiting for me?" />;
  const top = Math.max(1, ...data.funnel.map(f => f.n));
  return (
    <>
      <CommandBox side="employer" placeholder="Ask about your hiring — for example, who is waiting for me?" />
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <section className="ln-card" style={{ gap: 10 }}>
          <div className="ln-between"><h2 className="ln-h2">{data.waiting} waiting for your decision</h2><Link to="/employer/pipeline" className="ln-link">Pipeline →</Link></div>
          {data.waiting_rows.length === 0 ? <span className="ln-small ln-muted">Nobody is waiting. Candidates who say yes or apply appear here.</span>
            : data.waiting_rows.map(r => (
              <Link key={r.id} to={`/employer/candidates/${r.id}`} className="ln-tile ln-card-link ln-between" style={{ flexDirection: 'row', padding: '10px 12px', alignItems: 'center' }}>
                <span className="ln-col" style={{ gap: 2 }}><b style={{ fontSize: 14 }}>{r.name || r.code}</b><span className="ln-xs ln-muted">{r.role_title} · {r.college} · {r.stage_label}{r.waiting_days ? ` · ${r.waiting_days} day${r.waiting_days === 1 ? '' : 's'}` : ''}</span></span>
                <span className="ln-tag ln-tag-info">{r.readiness}</span>
              </Link>
            ))}
          {data.unanswered > 0 && <span className="ln-xs ln-muted">{data.unanswered} request{data.unanswered === 1 ? '' : 's'} not answered by students yet.</span>}
        </section>
        <section className="ln-card" style={{ gap: 10 }}>
          <div className="ln-between"><h2 className="ln-h2">Funnel</h2>{data.weeks_to_decide != null && <span className="ln-small ln-muted">{data.weeks_to_decide} weeks to decide</span>}</div>
          {data.funnel.map(f => (
            <div key={f.label} className="ln-row" style={{ gap: 10 }}><span className="ln-small" style={{ width: 140 }}>{f.label}</span><div style={{ flex: 1 }}><Bar pct={(f.n / top) * 100} label={`${f.label}: ${f.n}`} /></div><b style={{ width: 28, textAlign: 'right' }}>{f.n}</b></div>
          ))}
          <HowCounted>Asked = candidates you requested or who applied. Weeks to decide = average time from asking to interview, offer or “not now”.</HowCounted>
        </section>
      </div>
      <section className="ln-col" style={{ gap: 12 }}>
        <div className="ln-between"><h2 className="ln-h2">Open roles</h2><Link to="/employer/roles?new=1" className="ln-btn ln-btn-sm ln-btn-primary"><Plus size={14} aria-hidden="true" />New role</Link></div>
        {data.roles.length === 0 ? <div className="ln-card ln-small ln-muted">Paste a job description to create your first role. We pick out the skills and show how you compare with the market.</div> : (
          <div className="ln-grid ln-g-3" style={{ gap: 12 }}>
            {data.roles.map(r => (
              <Link key={r.id} to={`/employer/roles/${r.id}`} className="ln-card ln-card-link" style={{ gap: 6 }}>
                <b>{r.title}</b><span className="ln-xs ln-muted">{r.city || 'Any city'} · bar {r.bar} · {r.skills.length} skills{r.published ? ' · shared with colleges' : ''}</span>
                <span className="ln-link ln-small"><Users size={13} aria-hidden="true" /> Find candidates →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Step({ n, done, title, children }) {
  return (
    <article className="ln-card" style={{ gap: 10 }}>
      <div className="ln-row" style={{ gap: 10, alignItems: 'center' }}>
        {done ? <CheckCircle2 size={22} color="var(--status-success)" aria-hidden="true" /> : <Circle size={22} aria-hidden="true" />}
        <h2 className="ln-h2" style={{ margin: 0, fontSize: 18 }}>{n}. {title}</h2>
        {done && <span className="ln-tag ln-tag-success">Done</span>}
      </div>
      {children}
    </article>
  );
}

export default function EmployerHome() {
  const { me, refresh, isOwner } = useEmployer();
  const [otp, setOtp] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!me) return <p className="ln-muted">Loading…</p>;
  const e = me.employer;
  const s = e.kyb_steps;
  const [kybLabel, kybClass] = KYB_TEXT[e.kyb_status] || KYB_TEXT.pending;

  const request = async () => {
    setBusy(true); setError('');
    try { const r = await api.post('/employer/verify-domain/request'); setOtp(r.data); if (r.data.already_verified) refresh(); }
    catch (err) { setError(errMsg(err)); }
    setBusy(false);
  };
  const confirm = async (ev) => {
    ev.preventDefault();
    setBusy(true); setError('');
    try { await api.post('/employer/verify-domain/confirm', { code }); setOtp(null); setCode(''); refresh(); }
    catch (err) { setError(errMsg(err)); }
    setBusy(false);
  };

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{e.name}</h1>
          <span className="ln-sub">@{e.domain} · <span className={`ln-tag ${kybClass}`}>{kybLabel}</span></span>
        </div>
      </header>
      <Hiring />
      {e.kyb_status === 'verified' ? null : (
        <div className="ln-note" role="status">Until your company is verified you can check Evidence IDs and prepare your account, but you cannot request access to a learner’s evidence.</div>
      )}
      {error && <div className="ln-error" role="alert">{error}</div>}
      {e.kyb_status !== 'verified' && <div className="ln-col" style={{ gap: 14, marginTop: 16 }}>
        <Step n={1} done={s.details} title="Company details">
          <p className="ln-small ln-muted" style={{ margin: 0 }}>Contact person and phone, city and — if you have one — your GSTIN.</p>
          <Link to="/employer/company" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }}>{s.details ? 'Edit details' : 'Add details'}</Link>
        </Step>
        <Step n={2} done={s.domain_verified} title={`Verify your @${e.domain} email`}>
          {s.domain_verified ? <p className="ln-small ln-muted" style={{ margin: 0 }}>Verified on {new Date(e.domain_verified_at).toLocaleDateString()}.</p>
            : !isOwner ? <p className="ln-small ln-muted" style={{ margin: 0 }}>An owner of this account needs to do this step.</p>
            : otp && !otp.already_verified ? (
              <form className="ln-col" style={{ gap: 10 }} onSubmit={confirm}>
                <p className="ln-small" style={{ margin: 0 }}>We sent a 6-digit code to <b>{otp.sent_to}</b>. It expires in {otp.expires_minutes} minutes.</p>
                {otp.dev_code && <div className="ln-note ln-xs">No email is sent on this test deployment. Your code is <b>{otp.dev_code}</b>.</div>}
                <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                  <input className="ln-input" style={{ maxWidth: 160, letterSpacing: '0.2em' }} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label="Verification code" value={code} onChange={ev => setCode(ev.target.value.replace(/\D/g, ''))} required />
                  <button type="submit" className="ln-btn ln-btn-primary" disabled={busy || code.length !== 6}>Verify</button>
                  <button type="button" className="ln-btn" onClick={request} disabled={busy}>Send a new code</button>
                </div>
              </form>
            ) : (
              <><p className="ln-small ln-muted" style={{ margin: 0 }}>We email a one-time code to {me.user?.email} to prove the company controls this domain.</p>
                <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={request} disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button></>
            )}
        </Step>
        <Step n={3} done={s.approved} title="Qubirex approval">
          <p className="ln-small ln-muted" style={{ margin: 0 }}>
            {s.approved ? 'Approved.' : e.kyb_status === 'rejected' ? `Not approved${e.kyb_note ? `: ${e.kyb_note}` : '.'}` : s.domain_verified ? 'We review new companies within one working day.' : 'Starts once your domain is verified.'}
          </p>
        </Step>
      </div>}
    </>
  );
}
