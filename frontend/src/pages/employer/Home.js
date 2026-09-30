// src/pages/employer/Home.js — /employer/home — KYB progress (§14.1):
// 1 company details, 2 domain email code, 3 Qubirex approval. Until approved
// the company can search but cannot request access to learner evidence.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useEmployer, KYB_TEXT } from './Layout';

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
      {e.kyb_status === 'verified' ? (
        <div className="ln-note" role="status">Your company is verified. You can verify credentials, create API keys for your ATS and, as candidate search opens, request access to learner evidence.</div>
      ) : (
        <div className="ln-note" role="status">Until your company is verified you can check Evidence IDs and prepare your account, but you cannot request access to a learner’s evidence.</div>
      )}
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-col" style={{ gap: 14, marginTop: 16 }}>
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
      </div>
    </>
  );
}
