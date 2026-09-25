// src/components/inst/AccessResults.js
// What staff get back after giving access or resetting PINs:
//   - invite links (the student sets their own PIN) — email delivery isn't
//     switched on yet, so each link can be copied and shared;
//   - login slips with one-time PINs — shown only in this response, printed
//     as cut-out cards (print CSS keeps only the slips). Students must change
//     the PIN at first sign-in.
import React from 'react';
import { Printer } from 'lucide-react';
import CopyLink from './CopyLink';

const loginUrl = () => `${window.location.origin}/learner-login`;

export function LoginSlips({ slips }) {
  return (
    <div className="in-print">
      <div className="in-slips">
        {slips.map(s => (
          <div key={s.learner_ref} className="in-slip">
            <b>{s.name}</b>
            <span style={{ color: '#6B6659' }}>{s.cohort}</span>
            <span>Learner reference: <span className="in-code">{s.learner_ref}</span></span>
            <span>Join code: <span className="in-code">{s.join_code}</span></span>
            <span>One-time PIN: <span className="in-code">{s.pin}</span></span>
            <span style={{ fontSize: 11, color: '#6B6659' }}>Sign in at {loginUrl()} — you’ll choose your own PIN the first time.</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccessResults({ invites = [], slips = [], kept = [], skipped = [] }) {
  return (
    <div className="ln-col" style={{ gap: 16 }}>
      {invites.length > 0 && (
        <div className="ln-card" style={{ gap: 10 }}>
          <b>{invites.length} invite{invites.length > 1 ? 's' : ''} ready</b>
          <span className="ln-small ln-muted">Email delivery isn’t switched on yet, so share each link with the student (WhatsApp, email, LMS). Links expire in 7 days; you’ll see each student move from Invited to Active.</span>
          {invites.map(i => (
            <div key={i.learner_ref} className="ln-col" style={{ gap: 4 }}>
              <span className="ln-small"><b>{i.name}</b> · {i.learner_ref} · {i.email}</span>
              <CopyLink url={i.invite_url} />
            </div>
          ))}
        </div>
      )}
      {slips.length > 0 && (
        <div className="ln-card" style={{ gap: 12 }}>
          <div className="ln-between ln-wrap in-no-print">
            <div className="ln-col"><b>{slips.length} login slip{slips.length > 1 ? 's' : ''}</b>
              <span className="ln-small ln-muted">One-time PINs are shown only here. Print or save them now — they can’t be shown again (you can always reset a PIN).</span></div>
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print slips (or save as PDF)</button>
          </div>
          <LoginSlips slips={slips} />
        </div>
      )}
      {kept.length > 0 && <div className="ln-note">{kept.length} existing student{kept.length > 1 ? 's' : ''} keep their current PIN and can sign in with this cohort’s join code: {kept.map(k => k.name).join(', ')}.</div>}
      {skipped.length > 0 && <div className="ln-note" style={{ background: 'var(--status-warning-bg)', color: '#7A5418' }}>Skipped: {skipped.map(s => `${s.name || `row ${s.row}`} (${s.check || s.reason})`).join('; ')}</div>}
    </div>
  );
}
