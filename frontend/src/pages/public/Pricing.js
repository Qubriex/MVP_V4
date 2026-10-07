// src/pages/public/Pricing.js — /pricing (v4.3 canvas P3). Prices show as
// [PRICE] until confirmed; GST is added on the invoice.
import React from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import { CONTACT } from '../../config/contact';

const PLANS = [
  ['Learners', 'Free to start', 'via your college', ['Lessons in Telugu, Hindi or English', 'Your own Capability Passport, for life', 'Job matches only with your consent'], ['/learner-login', 'Ask your college for a join code']],
  ['Colleges', '[PRICE]', 'per student / year', ['Student seats and staff accounts', 'Bridge programmes for students who are nearly ready', 'Board reports: readiness, placements, Mastery Logs'], [`mailto:${CONTACT.sales}`, 'Talk to us']],
  ['Employers', '[PRICE]', 'per active role / month', ['Verify any Passport: always free', 'Role from a job description, candidate search, Day-One tests', 'Bulk verify + API on the higher plan ([PRICE])'], ['/employer/register', 'Register company']]
];
const FAQ = [
  ['Do learners ever pay?', 'No. Learners join free through their college or a sponsored cohort.'],
  ['Is verifying a Passport free?', 'Yes, for anyone, one at a time. Bulk verify and API are on the higher employer plan.'],
  ['What counts as an active role?', 'A role open for search or Day-One tests in that month. Closed roles are not billed.'],
  ['Can we try it before we buy?', 'Yes. Open the live demo with sample data. No sign-up needed.']
];

export default function Pricing() {
  return (
    <PublicShell>
      <header className="ln-col" style={{ gap: 8 }}>
        <span className="pb-kicker">Pricing</span>
        <h1 className="ln-title">Simple plans for each side</h1>
        <span className="ln-sub">Learners start free through their college. Colleges and employers pay for what they use. Prices shown as [PRICE] until confirmed.</span>
      </header>
      <section className="ln-grid ln-g-3" style={{ gap: 16 }}>
        {PLANS.map(([side, price, unit, points, [href, cta]]) => (
          <article key={side} className="ln-card" style={{ gap: 10 }}>
            <span className="pb-kicker">{side}</span>
            <span className="ln-stat" style={{ fontSize: 30 }}>{price}</span><span className="ln-small ln-muted">{unit}</span>
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{points.map(p => <li key={p}>{p}</li>)}</ul>
            {href.startsWith('mailto:') ? <a href={href} className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>{cta}</a> : <Link to={href} className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>{cta}</Link>}
          </article>
        ))}
      </section>
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        <section className="ln-card ln-card-warm" style={{ gap: 8 }}>
          <span className="pb-kicker">Sponsor a cohort</span><b style={{ fontSize: 20 }}>Custom pricing</b>
          <span className="ln-small">Fund training for a batch at a partner college, built to your role. You see their readiness as they learn and rate hires with a 90-day endorsement.</span>
          <a href={`mailto:${CONTACT.sales}?subject=Sponsor%20a%20cohort`} className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }}>Plan a cohort with us</a>
        </section>
        <section className="ln-card" style={{ gap: 10 }}>
          <span className="pb-kicker">Questions</span>
          {FAQ.map(([q, a]) => <div key={q} className="ln-col" style={{ gap: 2 }}><b style={{ fontSize: 15 }}>{q}</b><span className="ln-small ln-muted">{a}</span></div>)}
        </section>
      </div>
      <p className="ln-xs ln-muted">GST: All prices are in Indian rupees and exclude GST. GST at the applicable rate is added on the invoice. Billed by Inferexaa Private Limited, Hyderabad.</p>
    </PublicShell>
  );
}
