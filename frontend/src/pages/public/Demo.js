// src/pages/public/Demo.js — /demo (launcher) and /demo/learner,
// /demo/college, /demo/employer. Sample data only; nothing calls the server
// or is saved. Every demo page has the demo banner (Exit demo) and
// "← Back to home". The learner demo speaks and listens in the selected
// language using the browser's own voice and speech recognition.
import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Mic, Square, Volume2, CheckCircle2, Circle, Send } from 'lucide-react';
import PublicShell, { BackHome } from '../../components/public/PublicShell';
import Drawer from '../../components/shared/Drawer';
import { Bar } from '../../components/learn/ui';
import { useUiLang, UI_LANGS, LANG_CODE } from '../../context/UiLangContext';
import { useSpeechInput } from '../../utils/voice';
import { demoSpeak, demoStop } from '../../utils/demoVoice';

const COHORT = { ready: 9, nearly: 14, building: 21 };
const CANDIDATES = [[1, 86, 'ready'], [2, 82, 'ready'], [3, 74, 'nearly'], [4, 66, 'nearly']];

// Answer check for the sample lesson: any of these words counts as right.
const KEYWORDS = /match|both|same|common|రెండు|సరిపో|ఒకే|दोनों|मेल|समान|एक ही/i;

function LearnerDemo() {
  const { t, lang } = useUiLang();
  const bcp47 = (UI_LANGS.find(l => l.id === lang) || UI_LANGS[2]).bcp47;
  const [step, setStep] = useState('start'); // start | lesson | answered
  const [chat, setChat] = useState([]);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [done, setDone] = useState(false);
  const say = async (text) => {
    setNote(''); setSpeaking(true);
    const r = await demoSpeak(text, bcp47);
    setSpeaking(false);
    if (r === 'novoice') setNote(t('demo.noVoice'));
    if (r === 'unsupported') setNote(t('demo.noSpeech'));
  };
  const reply = (answer, heard = true) => {
    const ok = heard && KEYWORDS.test(answer);
    const text = !heard ? t('demo.l.heardAudio') : ok ? t('demo.l.correct') : t('demo.l.hint');
    setChat(c => [...c, { who: 'you', text: answer }, { who: 'q', text }]);
    if (ok || !heard) { setDone(true); setStep('answered'); }
    say(text);
  };
  const mic = useSpeechInput({
    lang: bcp47,
    onFinal: (text) => reply(text),
    // Browsers without speech recognition record audio instead; the demo
    // cannot turn that into text without the server, so it says so kindly.
    onAudio: () => reply(t('demo.l.voiceNote'), false)
  });
  useEffect(() => () => demoStop(), []);
  // Language changed: restart the lesson in the new language.
  useEffect(() => { demoStop(); setChat([]); setStep('start'); setDone(false); setNote(''); }, [lang]);
  const micError = mic.error ? (/blocked/i.test(mic.error) ? t('demo.micBlocked') : /not available/i.test(mic.error) ? t('demo.micNone') : t('demo.micRetry')) : '';
  const start = () => { setStep('lesson'); setChat([{ who: 'q', text: t('demo.l.lesson') }, { who: 'q', text: t('demo.l.question') }]); say(`${t('demo.l.lesson')} ${t('demo.l.question')}`); };
  return (
    <div className="ln-grid ln-g-2" style={{ gap: 20, alignItems: 'start' }}>
      <section className="pb-phone ln-col" style={{ gap: 10 }} aria-label={t('demo.learnerTitle')}>
        <b style={{ fontSize: 18 }}>{t('demo.l.hello')}</b>
        <span className="ln-small">{t('demo.l.today')}</span>
        {step === 'start' && <button type="button" className="ln-btn ln-btn-amber" onClick={start}><Volume2 size={18} aria-hidden="true" />{t('demo.l.start')}</button>}
        {chat.map((m, i) => (
          <div key={i} className={`demo-msg ${m.who === 'you' ? 'is-you' : ''}`}>{m.text}</div>
        ))}
        {step === 'lesson' && (
          <div className="ln-col" style={{ gap: 8 }}>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <button type="button" className={`ln-btn ${mic.listening ? 'ln-btn-primary' : 'ln-btn-secondary'}`} onClick={() => (mic.listening ? mic.stop() : (demoStop(), mic.start()))} aria-pressed={mic.listening} disabled={!mic.supported}>
                {mic.listening ? <><Square size={16} aria-hidden="true" />{t('demo.l.stopMic')}</> : <><Mic size={16} aria-hidden="true" />{t('demo.l.speak')}</>}
              </button>
              <button type="button" className="ln-btn" onClick={() => say(t('demo.l.question'))} disabled={speaking}><Volume2 size={16} aria-hidden="true" />{t('demo.l.replay')}</button>
            </div>
            {mic.listening && <span className="ln-small ln-muted" aria-live="polite">{mic.interim || t('demo.l.listening')}</span>}
            {!mic.supported && <span className="ln-small" role="alert">{t('demo.micNone')}</span>}
            <form className="ln-row" style={{ gap: 6 }} onSubmit={e => { e.preventDefault(); if (typed.trim()) { reply(typed.trim()); setTyped(''); } }}>
              <label htmlFor="demo-answer" className="ln-sr">{t('demo.l.typeLabel')}</label>
              <input id="demo-answer" className="ln-input" value={typed} onChange={e => setTyped(e.target.value)} placeholder={t('demo.l.typeLabel')} />
              <button type="submit" className="ln-btn ln-btn-sm" aria-label={t('demo.l.send')}><Send size={16} aria-hidden="true" /></button>
            </form>
          </div>
        )}
        {(note || micError) && <span className="ln-small" role="alert" style={{ color: 'var(--warn)' }}>{micError || note}</span>}
        {step === 'answered' && <button type="button" className="ln-btn ln-btn-sm" onClick={start}>{t('demo.l.again')}</button>}
      </section>
      <section className="ln-card" style={{ gap: 8 }}>
        <b>{t('demo.l.passport')}</b>
        {[['demo.l.skill1', true], ['demo.l.skill2', done], ['demo.l.skill3', false]].map(([k, ok]) => <span key={k} className="ln-row ln-small" style={{ gap: 8 }}>{ok ? <CheckCircle2 size={16} style={{ color: 'var(--ok)' }} aria-label={t('common.done')} /> : <Circle size={16} aria-label={t('common.notDone')} />}{t(k)}</span>)}
        <span className="ln-xs ln-muted">{t('demo.l.passportNote')}</span>
      </section>
    </div>
  );
}

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
function CollegeDemo() {
  const { t, lang } = useUiLang();
  const total = COHORT.ready + COHORT.nearly + COHORT.building;
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ skill: 'demo.c.skill1', cohort: 'CSE 2026', due: inDays(14), retest: true });
  const firstField = useRef(null);
  const submit = (e) => {
    e.preventDefault();
    setList(l => [...l, { ...f, id: Date.now() }]);
    setOpen(false);
    setMsg(t('demo.c.saved'));
  };
  return (
    <div className="ln-col" style={{ gap: 16 }}>
      <div className="ln-grid ln-g-2" style={{ gap: 20, alignItems: 'start' }}>
        <section className="ln-card" style={{ gap: 10 }}>
          <span className="ln-kicker">{t('demo.c.cohort')}</span>
          {[['band.ready', COHORT.ready, 'ln-bar-good'], ['band.nearly', COHORT.nearly, ''], ['band.building', COHORT.building, '']].map(([k, n, v]) => (
            <div key={k} className="ln-row" style={{ gap: 10 }}><span className="ln-small" style={{ width: 110 }}>{t(k)}</span><div style={{ flex: 1 }}><Bar pct={(n / total) * 100} variant={v} label={`${t(k)}: ${n}`} /></div><b>{n}</b></div>
          ))}
        </section>
        <section className="ln-card ln-card-warm" style={{ gap: 8 }}>
          <b>{t('demo.c.nearly', { n: COHORT.nearly })}</b>
          <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>{t('demo.c.start')}</button>
          {msg && <span className="ln-small" role="status">{msg}</span>}
        </section>
      </div>
      <section className="ln-card" style={{ gap: 8 }} aria-live="polite">
        <b>{t('demo.c.listTitle')}</b>
        {list.length === 0 ? <span className="ln-small ln-muted">{t('demo.c.empty')}</span> : list.map(b => (
          <div key={b.id} className="ln-between ln-wrap ln-small" style={{ gap: 8 }}>
            <span><b>{t(b.skill)}</b> · {b.cohort}</span>
            <span className="ln-muted">{t('demo.c.due', { date: new Date(b.due).toLocaleDateString(`${LANG_CODE[lang]}-IN`, { day: 'numeric', month: 'short' }) })}{b.retest ? ` · ${t('demo.c.retestOn')}` : ''}</span>
            <span className="ln-tag ln-tag-neutral">{t('demo.c.demoOnly')}</span>
          </div>
        ))}
      </section>
      {open && (
        <Drawer title={t('demo.c.start')} onClose={() => setOpen(false)}>
          <form className="ln-col" style={{ gap: 12 }} onSubmit={submit}>
            <div className="ln-field"><label className="ln-label" htmlFor="db-skill">{t('demo.c.skill')}</label>
              <select id="db-skill" ref={firstField} className="ln-select" value={f.skill} onChange={e => setF(x => ({ ...x, skill: e.target.value }))}>
                {['demo.c.skill1', 'demo.c.skill2', 'demo.c.skill3'].map(k => <option key={k} value={k}>{t(k)}</option>)}
              </select></div>
            <div className="ln-field"><label className="ln-label" htmlFor="db-cohort">{t('demo.c.cohortLabel')}</label>
              <select id="db-cohort" className="ln-select" value={f.cohort} onChange={e => setF(x => ({ ...x, cohort: e.target.value }))}>{['CSE 2026', 'ECE 2026'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="ln-field"><label className="ln-label" htmlFor="db-due">{t('demo.c.dueLabel')}</label>
              <input id="db-due" type="date" className="ln-input" value={f.due} min={inDays(1)} onChange={e => setF(x => ({ ...x, due: e.target.value }))} required /></div>
            <label className="ln-check"><input type="checkbox" checked={f.retest} onChange={e => setF(x => ({ ...x, retest: e.target.checked }))} />{t('demo.c.retest')}</label>
            <div className="ln-note" role="note">{t('demo.c.demoNote')}</div>
            <div className="ln-row" style={{ gap: 8 }}><button type="submit" className="ln-btn ln-btn-primary">{t('demo.c.create')}</button><button type="button" className="ln-btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button></div>
          </form>
        </Drawer>
      )}
    </div>
  );
}

function EmployerDemo() {
  const { t } = useUiLang();
  const [asked, setAsked] = useState({});
  return (
    <section className="ln-card" style={{ gap: 10 }}>
      <span className="ln-kicker">{t('demo.e.role')}</span>
      <div className="ln-tablewrap"><table className="ln-table"><thead><tr><th>{t('demo.e.candidate')}</th><th>{t('demo.e.readiness')}</th><th><span className="ln-sr">{t('demo.e.action')}</span></th></tr></thead>
        <tbody>{CANDIDATES.map(([n, r, band]) => (
          <tr key={n}><td>{t('demo.e.cand', { n })}<span className="ln-xs ln-muted" style={{ display: 'block' }}>{t('demo.e.college')}</span></td>
            <td><span className={`ln-tag ${band === 'ready' ? 'ln-tag-success' : 'ln-tag-info'}`}>{r} · {t(`band.${band}`)}</span></td>
            <td>{asked[n] ? <span className="ln-small ln-muted" role="status">{t('demo.e.asked')}</span> : <button type="button" className="ln-btn ln-btn-sm" onClick={() => setAsked(a => ({ ...a, [n]: true }))}>{t('demo.e.request')}</button>}</td></tr>
        ))}</tbody></table></div>
      <span className="ln-xs ln-muted">{t('demo.e.note')}</span>
    </section>
  );
}

const SIDES = { learner: ['demo.learnerKicker', 'demo.learnerTitle', 'demo.learnerText', LearnerDemo], college: ['demo.collegeKicker', 'demo.collegeTitle', 'demo.collegeText', CollegeDemo], employer: ['demo.employerKicker', 'demo.employerTitle', 'demo.employerText', EmployerDemo] };

export function DemoSide() {
  const { t } = useUiLang();
  const { side } = useParams();
  if (!SIDES[side]) return <Navigate to="/demo" replace />;
  const [kicker, title, text, Comp] = SIDES[side];
  return (
    <PublicShell demo>
      <div className="ln-row ln-wrap" style={{ gap: 18 }}><BackHome /><Link to="/demo" className="ln-link pb-back">{t('demo.allDemos')}</Link></div>
      <header className="ln-col" style={{ gap: 6 }}>
        <span className="pb-kicker">{t(kicker)}</span>
        <h1 className="ln-title">{t(title)}</h1>
        <span className="ln-sub">{t(text)}</span>
      </header>
      <Comp />
      <p className="ln-xs ln-muted">{t('demo.footer')}</p>
    </PublicShell>
  );
}

export default function Demo() {
  const { t } = useUiLang();
  return (
    <PublicShell demo>
      <BackHome />
      <header className="ln-col" style={{ gap: 8 }}>
        <span className="pb-kicker">{t('nav.demo')}</span>
        <h1 className="ln-title">{t('demo.title')}</h1>
        <span className="ln-sub">{t('demo.sub')}</span>
      </header>
      <section className="ln-grid ln-g-3" style={{ gap: 16 }}>
        {Object.entries(SIDES).map(([id, [kicker, title, text]]) => (
          <article key={id} className="ln-card" style={{ gap: 8 }}>
            <span className="pb-kicker">{t(kicker)}</span><b style={{ fontSize: 18 }}>{t(title)}</b><span className="ln-small ln-muted">{t(text)}</span>
            <Link to={`/demo/${id}`} className="ln-btn ln-btn-primary ln-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>{t(`demo.open.${id}`)}</Link>
          </article>
        ))}
      </section>
      <section className="ln-card ln-between ln-wrap" style={{ gap: 10 }}>
        <span className="ln-small"><b>{t('demo.verifyTitle')}</b> {t('demo.verifyText')}</span>
        <Link to="/verify/QBX-DEMO-0000" className="ln-btn ln-btn-secondary ln-btn-sm">{t('demo.verifyCta')}</Link>
      </section>
      <p className="ln-xs ln-muted">{t('demo.footer')}</p>
    </PublicShell>
  );
}
