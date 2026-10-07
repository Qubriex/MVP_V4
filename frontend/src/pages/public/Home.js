// src/pages/public/Home.js — / (v4.3 canvas P1). What Qubirex is for each
// side, how it works in four steps, and what a Passport does and does not
// prove. The sample Passport is labelled as sample.
import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, School, Briefcase, ShieldCheck } from 'lucide-react';
import PublicShell from '../../components/public/PublicShell';
import { CONTACT } from '../../config/contact';

const STEPS = [
  ['Receive the target', 'A college or employer sets the skills a role needs.'],
  ['Build in your language', 'Lessons by voice in Telugu or Hindi, with English captions.'],
  ['Prove with signed evidence', 'Fresh checks, spoken challenges, faculty review.'],
  ['Return to work', 'A Capability Passport employers can trust.']
];
const SIDES = [
  ['learners', Mic, 'For learners', 'Learn on your phone, in your words', ['Lessons and questions by voice in Telugu, Hindi or English', 'A Passport you own — you choose who sees it', 'A clear bridge plan to the job you want'], '/learner-login', 'Start learning'],
  ['colleges', School, 'For colleges', 'Teach to what employers need', ['Turn a role into capability targets in minutes', 'See each cohort’s readiness and early warnings', 'Signed Mastery Logs and placement reports for your board'], '/login', 'College sign in'],
  ['employers', Briefcase, 'For employers', 'Hire on proof, not on CVs', ['Paste a job description, get a role profile and ready candidates', 'Run supervised Day-One tasks before you hire', 'Sponsor a cohort and rate hires at 90 days'], '/employer/login', 'Hire on evidence']
];
const PROVES = [
  [true, 'The learner showed each skill on fresh questions, not memorised ones'],
  [true, 'How strong the evidence is (L1–L4) and how sure we are they did it themselves (A0–A3)'],
  [true, 'How recent it is: Fresh, Ageing or Needs refresh'],
  [false, 'How someone will fit in your team or culture'],
  [false, 'Skills outside the target that was taught'],
  [false, 'Anything the learner chose not to share']
];

export default function Home() {
  return (
    <PublicShell>
      <section className="pb-hero">
        <div className="ln-col" style={{ gap: 16 }}>
          <span className="pb-kicker">For learners, colleges and employers in India</span>
          <h1>Learn in your language. Prove what you can do. Get hired on proof.</h1>
          <span className="ln-indic" style={{ fontSize: 17 }}>మీ భాషలో నేర్చుకోండి. మీ నైపుణ్యాన్ని నిరూపించండి. రుజువుతో ఉద్యోగం పొందండి.</span>
          <span className="ln-indic" style={{ fontSize: 17 }}>अपनी भाषा में सीखें। अपना कौशल साबित करें। सबूत पर नौकरी पाएँ।</span>
          <div className="ln-row ln-wrap" style={{ gap: 10 }}>
            <Link to="/demo" className="ln-btn ln-btn-primary">Try the live demo</Link>
            <a href={`mailto:${CONTACT.sales}`} className="ln-btn">Talk to us</a>
          </div>
        </div>
        <article className="ln-card" style={{ gap: 10 }} aria-label="Sample Capability Passport">
          <div className="ln-between"><span className="ln-kicker">Capability Passport · sample</span><span className="ln-tag ln-tag-neutral">Demo data</span></div>
          <b style={{ fontSize: 18 }}>Python + SQL for Data Roles</b>
          {[['SQL joins', 'Confirmed · L2 · A3'], ['SQL aggregation', 'Confirmed · L2 · A2'], ['Python functions', 'Partial · L2 · A2']].map(([s, l]) => (
            <div key={s} className="ln-between ln-small"><span>{s}</span><span className={`ln-tag ${l.startsWith('Confirmed') ? 'ln-tag-success' : 'ln-tag-info'}`}>{l}</span></div>
          ))}
          <span className="ln-xs ln-muted">Signed. Anyone can check it with the Evidence ID. Shared only with the learner’s consent.</span>
        </article>
      </section>

      <section className="pb-steps" aria-label="How it works">
        {STEPS.map(([t, d], i) => <div key={t} className="ln-card" style={{ gap: 6 }}><span className="pb-num">{i + 1}</span><b>{t}</b><span className="ln-small ln-muted">{d}</span></div>)}
      </section>

      <section className="ln-grid ln-g-3" style={{ gap: 16 }}>
        {SIDES.map(([id, Icon, kicker, title, points, href, cta]) => (
          <article key={id} id={id} className="ln-card" style={{ gap: 10, scrollMarginTop: 80 }}>
            <span className="pb-kicker"><Icon size={14} aria-hidden="true" /> {kicker}</span>
            <b style={{ fontSize: 19 }}>{title}</b>
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{points.map(p => <li key={p}>{p}</li>)}</ul>
            <Link to={href} className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>{cta}</Link>
          </article>
        ))}
      </section>

      <section className="ln-card" style={{ gap: 12 }}>
        <span className="pb-kicker">Honest by design</span>
        <h2 className="ln-h2" style={{ fontSize: 24 }}>What a Capability Passport proves — and what it doesn’t</h2>
        <div className="ln-grid ln-g-2" style={{ gap: 8 }}>
          {PROVES.map(([yes, text]) => <span key={text} className="ln-small"><span className={yes ? 'pb-yes' : 'pb-no'}>{yes ? 'Yes' : 'No'}</span>{text}</span>)}
        </div>
        <Link to="/verify/QBX-DEMO-0000" className="ln-link ln-small"><ShieldCheck size={14} aria-hidden="true" /> Verify a sample Passport →</Link>
      </section>

      <section className="ln-grid ln-g-4" style={{ gap: 12 }} aria-label="Why Qubirex">
        {['Teaches in Telugu & Hindi by voice', 'Proof the learner did the work (authorship A0–A3)', 'Supervised Day-One tasks', 'Employers fund training and rate hires at 90 days'].map(t => <div key={t} className="ln-tile" style={{ padding: 16 }}><b style={{ fontSize: 14 }}>{t}</b></div>)}
      </section>
    </PublicShell>
  );
}
