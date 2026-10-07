// src/components/shared/HelpPanel.js — Help: common questions per side, a
// contact form (answered on WhatsApp or email within 1 working day) and
// whether the service is running.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import Drawer from './Drawer';

const DOCS = {
  learner: [
    ['How is readiness counted?', 'Readiness compares the skills you have proven (passed a fresh check) with what your target role asks for, out of 100. Ready starts at 80. Skills you only said you have do not count.'],
    ['Who can see my Passport?', 'Anyone with your Evidence ID can check it is genuine. The details — which skills, how they were proven — are shared only with employers you say yes to. You can change this in Settings.'],
    ['I forgot my PIN', 'On the sign-in page, choose “Forgot PIN?”. Your professor resets it, or you get a new invite link.'],
    ['Why was I signed out?', 'Your account works on one device at a time. Signing in on another device signs out the first one.'],
    ['How do reviews work?', 'A few days after you master a skill, a short review keeps it fresh. Each takes about 2 minutes.']
  ],
  staff: [
    ['How is readiness counted?', 'For each student: how well their verified skills match the best-fitting target role, out of 100. Ready from 80, Nearly ready from 60. Self-declared skills never count.'],
    ['Who can see a learner’s Passport?', 'Anyone can check a Passport is genuine with its Evidence ID. Details go to an employer only after the learner says yes. Institutions see progress, not session conversations.'],
    ['How do I reset a student’s PIN?', 'Students & access → select the student → Reset PIN. Print a one-time PIN slip, or send a new invite link.'],
    ['How do I start a bridge programme?', 'Bridge programmes → New. Choose the cohort or students and the skills to strengthen, and a re-test date. Afterwards it shows whether it worked.'],
    ['What do the live lights mean?', 'Green: learning now. Yellow: idle, or 1–2 loops on a skill. Red: inactive 3+ days, never started, or 3+ loops.']
  ],
  employer: [
    ['What does a Passport check tell me?', 'That the record is genuine, signed and not revoked; how each skill was proven (L1–L4) and how sure we are the learner did it (A0–A3). It cannot tell you how someone will fit in your team.'],
    ['When can I see a candidate’s name?', 'Search is anonymous. You see names and contact details only after the candidate says yes to your request.'],
    ['Is verifying free?', 'Yes, one Passport at a time, for anyone. Bulk verify and the API are on the higher plan.']
  ]
};

export default function HelpPanel({ side = 'learner', onClose }) {
  const [tab, setTab] = useState('docs');
  const [open, setOpen] = useState(null);
  const [type, setType] = useState('question');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState('');
  const [status, setStatus] = useState(null);
  useEffect(() => { if (tab === 'status') api.get('/help/status').then(r => setStatus(r.data)).catch(() => setStatus({ ok: false })); }, [tab]);
  const send = async (e) => {
    e.preventDefault(); setSent('');
    try { const r = await api.post('/help/contact', { type, message }); setSent(r.data.message); setMessage(''); } catch (err) { setSent(errMsg(err, 'Couldn’t send. Try again.')); }
  };
  return (
    <Drawer title="Help" onClose={onClose}>
      <div className="ln-tabs" role="tablist">
        {[['docs', 'Docs'], ['contact', 'Contact'], ['status', 'Status']].map(([id, l]) => <button key={id} type="button" role="tab" className="ln-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      {tab === 'docs' && (
        <div className="ln-col" style={{ gap: 6 }}>
          {DOCS[side].map(([qq, a], i) => (
            <div key={qq} className="sk-faq">
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(o => (o === i ? null : i))}>{qq}<span aria-hidden="true">{open === i ? '–' : '›'}</span></button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      )}
      {tab === 'contact' && (
        <form className="ln-col" style={{ gap: 10 }} onSubmit={send}>
          <label className="ln-field"><span className="ln-label">Type</span>
            <select className="ln-select" value={type} onChange={e => setType(e.target.value)}>
              <option value="question">Question</option><option value="problem">Something is not working</option>
              <option value="data_request">My data</option><option value="grievance">Complaint (grievance officer)</option>
            </select></label>
          <label className="ln-field"><span className="ln-label">Message</span>
            <textarea className="ln-textarea" rows={5} value={message} onChange={e => setMessage(e.target.value)} required minLength={5} /></label>
          <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>Send</button>
          <span className="ln-xs ln-muted">We reply on WhatsApp or email within 1 working day.</span>
          {sent && <span className="ln-small" role="status">{sent}</span>}
        </form>
      )}
      {tab === 'status' && (
        <div className="ln-col" style={{ gap: 8 }}>
          {!status ? <span className="ln-small ln-muted">Checking…</span> : (
            <>
              <span className="ln-row" style={{ gap: 8, fontWeight: 600 }}><span className={`in-light ${status.ok ? 'is-green' : 'is-red'}`}><i aria-hidden="true" /></span>{status.ok ? 'All systems running' : 'Some parts are not responding'}</span>
              <span className="ln-small">Lessons and AI help: {status.ai ? 'running' : 'not set up on this deployment'}</span>
              <span className="ln-xs ln-muted">Last checked {status.checked_at ? new Date(status.checked_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'just now'}</span>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
