// src/pages/public/Legal.js — /legal/:page: privacy, terms, DPDP Act 2023
// and the grievance officer. Short plain-words summaries; the full legal
// text is to be supplied and reviewed by counsel before launch.
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import { CONTACT } from '../../config/contact';

const PAGES = {
  privacy: ['Privacy notice', [
    'We collect what is needed to teach you and to prove what you learned: your name, college, roll number, lessons, answers and results.',
    'Employers never see your name, contact details or lesson history unless you say yes to that employer, item by item. You can withdraw at any time.',
    'Your college sees your progress. Your parents see a progress report only if you agree.',
    'You can download everything we hold about you from Settings, and ask for it to be deleted.'
  ]],
  terms: ['Terms of use', [
    'Use Qubirex for learning, teaching, verifying and hiring as described on this site.',
    'Do not share your PIN or let someone else answer checks for you; Passports record how sure we are that you did the work.',
    'Employers may request a learner’s evidence only for a real role and only after their company is verified.'
  ]],
  dpdp: ['Digital Personal Data Protection Act, 2023', [
    'Consent is asked for each purpose separately, in your language, and can be withdrawn as easily as it was given.',
    'For learners under 18, a parent or guardian’s consent is collected through the institution before anything is shared with employers.',
    'You have the right to access, correct and erase your data, and to name someone to act for you.'
  ]],
  grievance: ['Grievance officer', [
    `${CONTACT.grievanceOfficer}, ${CONTACT.company}, ${CONTACT.city}.`,
    `Email: ${CONTACT.grievance}. We acknowledge within 7 days and resolve within 30 days.`,
    'Signed-in users can also use Help → Contact and choose “Complaint”.'
  ]]
};

export default function Legal() {
  const { page } = useParams();
  const [title, paras] = PAGES[page] || PAGES.privacy;
  return (
    <PublicShell>
      <article className="ln-col" style={{ gap: 12, maxWidth: 760 }}>
        <h1 className="ln-title">{title}</h1>
        {paras.map(p => <p key={p} style={{ margin: 0 }}>{p}</p>)}
        <p className="ln-xs ln-muted">Plain-words summary. The full legal text in Telugu, Hindi and English is being finalised.</p>
        <nav className="ln-row ln-wrap" style={{ gap: 14 }}>{Object.entries(PAGES).map(([k, [t]]) => <Link key={k} to={`/legal/${k}`} className="ln-link ln-small">{t}</Link>)}</nav>
      </article>
    </PublicShell>
  );
}
