// src/pages/learn/Lesson.js — /learn/lesson/:lessonId: one lesson, taught
// first, in a fixed order shown as a stepper:
//   1 Learn          one line, where you'll use it, the simple explanation
//                    (Listen, with English captions), one picture, common mistakes
//   2 See the code   a working example, explained line by line (the line she is
//                    on is highlighted), with Run
//   3 Practise       three quick questions, then "Try it yourself" in an editor:
//                    run against tests, see what failed, hints one at a time
//   4 Check          only then: a fresh question, the result, the spoken
//                    challenge, the next lesson
// The learner can ask at any time ("Why return?", "Explain in Telugu",
// "Slower", "Another example"); the answer stays within this lesson. "I
// already know this" (test-out) is a small link, never the start.
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Square, Headphones, ThumbsUp, ThumbsDown, Lightbulb, Eye, ArrowRight, Download, Send, MessageCircleQuestion, Check, X, ShieldCheck, Gauge } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { runCode } from '../../utils/codeRunner';
import { useSpeechOutput, useLineWalk } from '../../utils/voice';
import { codeSpeech } from '../../utils/codeSpeech';
import { learningSpeechTag } from '../../utils/learningLanguage';
import { useUiLang } from '../../context/UiLangContext';
import { LoadingRows } from '../../components/shared/EmptyState';
import { usePageCrumbs } from '../../components/learn/BackBar';
import LearningLangPicker, { LEARNING_LABEL } from '../../components/learn/LearningLangPicker';
import MermaidDiagram from '../../components/learn/MermaidDiagram';
import AnswerBox from '../../components/learn/AnswerBox';
import VoiceStatus from '../../components/learn/VoiceStatus';
import { ResultCard } from '../../components/learn/journey';
import usePageTitle from '../../hooks/usePageTitle';

const STEPS = ['learn', 'code', 'practise', 'check'];
const RATES = [0.8, 1, 1.2];

function Stepper({ step, reached, onGo }) {
  const { t } = useUiLang();
  return (
    <ol className="lj-stepper" aria-label={t('lj.lesson.steps')}>
      {STEPS.map((s, i) => {
        const state = s === step ? 'is-now' : STEPS.indexOf(s) <= STEPS.indexOf(reached) ? 'is-done' : '';
        return (
          <li key={s} className={state} data-step={s} aria-current={s === step ? 'step' : undefined}>
            <button type="button" onClick={() => onGo(s)} disabled={STEPS.indexOf(s) > STEPS.indexOf(reached) + 1}>
              <span className="lj-stepper-n">{i + 1}</span><span>{t(`lj.lesson.step.${s}`)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// "Was this clear?" on each part; the votes reach the professor's Topics page.
function Clear({ lessonId, part }) {
  const { t } = useUiLang();
  const [sent, setSent] = useState(null);
  const [comment, setComment] = useState('');
  const vote = async (v) => {
    setSent(v);
    try { await api.post(`/learner/lessons/${lessonId}/feedback`, { part, vote: v, comment: v < 0 ? comment : '' }); } catch { /* best effort */ }
  };
  return (
    <div className="lj-clear" data-feedback={part}>
      <span className="ln-xs ln-muted">{t('lj.lesson.clear')}</span>
      <button type="button" aria-pressed={sent === 1} onClick={() => vote(1)} aria-label={t('lj.lesson.clearYes')}><ThumbsUp size={14} aria-hidden="true" /></button>
      <button type="button" aria-pressed={sent === -1} onClick={() => setSent(s => (s === -1 ? null : -2))} aria-label={t('lj.lesson.clearNo')}><ThumbsDown size={14} aria-hidden="true" /></button>
      {sent === -2 && (
        <span className="ln-row" style={{ gap: 6 }}>
          <input className="ln-input lj-clear-input" value={comment} onChange={e => setComment(e.target.value)} placeholder={t('lj.lesson.clearWhat')} aria-label={t('lj.lesson.clearWhat')} />
          <button type="button" className="ln-btn ln-btn-sm" onClick={() => vote(-1)}>{t('lj.lesson.clearSend')}</button>
        </span>
      )}
      {sent === 1 || sent === -1 ? <span className="ln-xs" role="status">{t('lj.lesson.clearThanks')}</span> : null}
    </div>
  );
}

function CodePanel({ code, active, onLine }) {
  const lines = code.source.split('\n');
  return (
    <pre className="lj-code" data-code-panel>
      {lines.map((l, i) => (
        <span key={i} className={`lj-code-line ${active === i + 1 ? 'is-active' : ''}`} data-line={i + 1} onClick={() => onLine?.(i + 1)}>
          <span className="lj-code-n" aria-hidden="true">{i + 1}</span><code>{l || ' '}</code>
        </span>
      ))}
    </pre>
  );
}

// Plain words for a test result: what it checked, what it expected, what came back.
function TestResults({ results }) {
  const { t } = useUiLang();
  if (!results) return null;
  let hiddenN = 0;
  return (
    <ul className="lj-tests" data-test-results>
      {results.map((r, i) => {
        const name = r.hidden ? t('lj.lesson.hiddenTest', { n: (hiddenN += 1) }) : r.name;
        return (
          <li key={i} className={r.passed ? 'is-pass' : 'is-fail'} data-passed={r.passed ? 'yes' : 'no'}>
            {r.passed ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
            <span className="ln-col" style={{ gap: 2 }}>
              <b className="ln-small">{name}</b>
              {!r.passed && !r.hidden && <span className="ln-xs">{t('lj.lesson.expectedGot', { expected: r.expected, got: r.got ?? '—' })}</span>}
              {!r.passed && r.hidden && <span className="ln-xs">{t('lj.lesson.hiddenFailed')}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Quick({ items }) {
  const { t } = useUiLang();
  const [picked, setPicked] = useState({});
  return (
    <section className="ln-card ln-col" style={{ gap: 12 }} aria-label={t('lj.lesson.quick')} data-quick>
      <b>{t('lj.lesson.quick')}</b>
      {items.map(q => (
        <div key={q.i} className="ln-col" style={{ gap: 6 }}>
          <pre className="lj-q">{q.q}</pre>
          <div className="ln-row ln-wrap" style={{ gap: 6 }}>
            {q.options.map((o, k) => (
              <button key={k} type="button" className={`ln-btn ln-btn-sm lj-opt ${picked[q.i] === k ? (k === q.answer ? 'is-right' : 'is-wrong') : ''}`} onClick={() => setPicked(p => ({ ...p, [q.i]: k }))}>{o}</button>
            ))}
          </div>
          {picked[q.i] != null && <span className="ln-small" role="status">{picked[q.i] === q.answer ? '✓ ' : '✗ '}{q.why}</span>}
        </div>
      ))}
    </section>
  );
}

export default function Lesson() {
  const { t } = useUiLang();
  const { lessonId } = useParams();
  const location = useLocation();
  const [d, setD] = useState(null);
  usePageTitle(d?.title);
  const [error, setError] = useState('');
  const [step, setStepState] = useState('learn');
  const [reached, setReached] = useState('learn');
  const [showEn, setShowEn] = useState(false);
  const [extra, setExtra] = useState(null); // { kind, text }
  const [rate, setRate] = useState(1);
  const [line, setLine] = useState(null);
  const [run, setRun] = useState(null);
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState('');
  const [tests, setTests] = useState(null);
  const [practice, setPractice] = useState(null);
  const [hints, setHints] = useState([]);
  const [solution, setSolution] = useState('');
  const [check, setCheck] = useState(null); // { question, attempt, early }
  const [result, setResult] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [asks, setAsks] = useState([]);
  const [question, setQuestion] = useState('');
  const [testout, setTestout] = useState(null); // { questions, answers, result }
  const [busy, setBusy] = useState(false);
  const from = location.state?.from || null;

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await api.get(`/learner/lessons/${lessonId}`);
      setD(r.data);
      const s = STEPS.includes(r.data.progress.step) ? r.data.progress.step : r.data.progress.step === 'result' ? 'check' : 'learn';
      setReached(s); setStepState(cur => (cur === 'learn' ? 'learn' : cur));
      setDraft(cur => cur || r.data.parts?.task.starter || '');
    } catch (e) { setError(errMsg(e)); }
  }, [lessonId]);
  useEffect(() => { setD(null); setResult(null); setCheck(null); setRun(null); setPractice(null); setHints([]); setSolution(''); setAsks([]); setDraft(''); setStepState('learn'); load(); }, [load]);

  const lang = d?.language || 'telugu';
  const speech = useSpeechOutput({ lang: learningSpeechTag(lang), rate });
  const walk = useLineWalk({ lang: learningSpeechTag(lang), rate });
  useEffect(() => () => speech.stop(), []);

  usePageCrumbs(d ? [{ key: 'nav.courses', to: '/learn/courses' }, { label: d.course.title, to: `/learn/courses/${d.course.id}` }, { label: t('lj.course.lessonN', { m: d.module_n, n: d.n }) + ` · ${d.title}` }] : null);

  const go = async (s) => {
    speech.stop(); walk.stop();
    setStepState(s);
    if (STEPS.indexOf(s) > STEPS.indexOf(reached)) setReached(s);
    try { await api.post(`/learner/lessons/${lessonId}/step`, { step: s }); } catch { /* the page still moves on */ }
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  if (error && !d) return <div className="ln-error" role="alert">{error}</div>;
  if (!d) return <LoadingRows rows={6} />;
  const P = d.parts;
  const course = d.course;
  const codeLang = P?.code.language || course.language;

  // Walk through the example: one clip per explained line, played in order;
  // the highlight follows the clip that is playing (utils/voice.js useLineWalk).
  const startWalk = () => { speech.stop(); walk.start(P.code.notes.map(n => n.note)); };
  const stopWalk = () => { walk.stop(); setLine(null); };
  const shownLine = walk.active ? (walk.index >= 0 ? P.code.notes[walk.index].line : null) : line;

  const runExample = async () => {
    setRunning(true); setRun(null);
    const r = await runCode({ language: codeLang, code: P.code.source, setup: P.code.setup, expectedOutput: P.code.output });
    setRun(r); setRunning(false);
  };

  const runPractice = async () => {
    setBusy(true); setPractice(null);
    try {
      const tt = tests || (await api.get(`/learner/lessons/${lessonId}/practice/tests`)).data;
      if (!tests) setTests(tt);
      const r = await runCode({ language: tt.language, code: draft, tests: tt.tests, setup: tt.setup });
      const saved = (await api.post(`/learner/lessons/${lessonId}/practice`, { results: r.results, hints_used: hints.length, code: draft })).data;
      setPractice({ ...r, ...saved });
      if (saved.practice_passed) setReached(s => (STEPS.indexOf(s) < STEPS.indexOf('check') ? 'check' : s));
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  const hint = async () => {
    try { const r = (await api.post(`/learner/lessons/${lessonId}/hint`)).data; setHints(h => (h.length >= r.n ? h : [...h, r.hint])); } catch (e) { setError(errMsg(e)); }
  };
  const showSolution = async () => {
    try { setSolution((await api.post(`/learner/lessons/${lessonId}/hint`, { solution: true })).data.solution); } catch (e) { setError(errMsg(e)); }
  };

  const startCheck = async () => {
    setBusy(true); setResult(null); setChallenge(null);
    try { setCheck((await api.post(`/learner/lessons/${lessonId}/check`)).data); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  const answerCheck = async (text, provenance, clear) => {
    setBusy(true);
    try {
      const r = (await api.post(`/learner/lessons/${lessonId}/check/answer`, { answer: text, provenance })).data;
      if (r.result === 'hold') setError(r.message); else { clear(); setResult(r); setCheck(null); }
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  const answerChallenge = async (text, provenance, clear) => {
    setBusy(true);
    try { setChallenge((await api.post(`/learner/lessons/${lessonId}/challenge`, { answer: text, mode: provenance?.mode })).data); clear(); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };

  const ask = async (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    try {
      const r = (await api.post(`/learner/lessons/${lessonId}/ask`, { question: q })).data;
      setAsks(a => [...a, { q, ...r }]);
      if (r.rate) setRate(r.rate);
      speech.speak(r.answer, `ask-${asks.length}`, r.language ? { lang: learningSpeechTag(r.language) } : {});
    } catch (err) { setError(errMsg(err)); }
  };

  const openTestout = async () => {
    try { setTestout({ questions: (await api.get(`/learner/lessons/${lessonId}/testout`)).data.questions, answers: ['', ''], result: null }); } catch (e) { setError(errMsg(e)); }
  };
  const sendTestout = async () => {
    setBusy(true);
    try { const r = (await api.post(`/learner/lessons/${lessonId}/testout`, { answers: testout.answers })).data; setTestout(x => ({ ...x, result: r })); if (r.known) load(); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };

  const saveCheat = () => {
    const text = [`${course.title} · ${t('lj.course.lessonN', { m: d.module_n, n: d.n })} · ${d.title}`, '', ...(P.cheat || []).map(c => `• ${c}`), '', P.code.source].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${d.id}-cheat-sheet.txt`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const spokenPart = speech.part?.text || '';
  const sayExplain = () => (speech.speakingId === 'listen' ? speech.stop() : speech.speak(P.listen, 'listen'));

  return (
    <div className="lj-lesson" data-lesson-page={d.id} data-step={step}>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4, minWidth: 0 }}>
          <span className="ln-kicker">{course.title} · {t('lj.course.lessonN', { m: d.module_n, n: d.n })} · {t('lj.course.minutes', { n: d.minutes })}</span>
          <h1 className="ln-title">{d.title}</h1>
          {d.reviewed_by && <span className="ln-tag ln-tag-success" style={{ alignSelf: 'flex-start' }}><ShieldCheck size={13} aria-hidden="true" />{t('lj.lesson.reviewedBy', { college: d.reviewed_by.college })}</span>}
        </div>
        <div className="ln-col" style={{ gap: 6, alignItems: 'flex-end' }}>
          <LearningLangPicker onChange={load} />
          {d.progress.status !== 'known' && d.progress.status !== 'done' && <button type="button" className="ln-link ln-small" onClick={openTestout} data-testout>{t('lj.lesson.alreadyKnow')}</button>}
        </div>
      </header>

      {!P ? (
        <div className="ln-card ln-col" style={{ gap: 8 }} role="note" data-language-missing>
          <b>{t('lj.lesson.notInLanguage', { lang: LEARNING_LABEL[lang] || lang })}</b>
          <span className="ln-small">{t('lj.lesson.availableIn', { list: d.available.map(c => ({ en: 'English', te: 'తెలుగు', hi: 'हिंदी' }[c])).join(', ') })}</span>
        </div>
      ) : (
        <>
          <Stepper step={step} reached={reached} onGo={go} />
          {d.prev && !d.prev.done && step === 'learn' && <div className="ln-note" role="note">{t('lj.lesson.suggestPrev')} <Link className="ln-link" to={`/learn/lesson/${d.prev.id}`} state={{ from }}>{d.prev.title}</Link></div>}
          {error && <div className="ln-error" role="alert">{error}</div>}
          <VoiceStatus speech={speech} />

          {step === 'learn' && (
            <section className="ln-col" style={{ gap: 14 }} data-step-panel="learn">
              <div className="ln-card ln-col" style={{ gap: 6 }}>
                <span className="ln-kicker">{t('lj.lesson.inOneLine')}</span>
                <p className="lj-oneline">{P.oneLine}</p>
                {showEn && P.oneLine_en && <p className="ln-small ln-muted" lang="en">{P.oneLine_en}</p>}
                <span className="ln-kicker">{t('lj.lesson.useIt')}</span>
                <p className="ln-small" style={{ margin: 0 }}>{P.useCase}</p>
                <Clear lessonId={d.id} part="oneLine" />
              </div>
              <div className="ln-card ln-col" style={{ gap: 10 }} data-explain>
                <div className="ln-between ln-wrap" style={{ gap: 8 }}>
                  <b>{t('lj.lesson.explain')}</b>
                  <span className="ln-row ln-wrap" style={{ gap: 6 }}>
                    <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={sayExplain} data-listen>
                      {speech.speakingId === 'listen' ? <Square size={14} aria-hidden="true" /> : <Headphones size={14} aria-hidden="true" />}{speech.speakingId === 'listen' ? t('lj.lesson.stop') : t('lj.lesson.listen')}
                    </button>
                    <span className="lj-rates" role="group" aria-label={t('lj.lesson.speed')}><Gauge size={14} aria-hidden="true" />
                      {RATES.map(r => <button key={r} type="button" aria-pressed={rate === r} onClick={() => setRate(r)}>{r.toFixed(1)}×</button>)}</span>
                    {P.explain_en && <label className="ln-row ln-xs" style={{ gap: 4 }}><input type="checkbox" checked={showEn} onChange={e => setShowEn(e.target.checked)} data-caption-toggle />{t('lj.lesson.englishCaption')}</label>}
                  </span>
                </div>
                {P.explain.map((s, i) => (
                  <p key={i} className={`lj-sentence ${spokenPart && spokenPart.includes(s.slice(0, 24)) ? 'is-spoken' : ''}`}>
                    {s}{showEn && P.explain_en?.[i] && <span className="lj-cap" lang="en">{P.explain_en[i]}</span>}
                  </p>
                ))}
                <div className="ln-row ln-wrap" style={{ gap: 6 }}>
                  <button type="button" className="ln-btn ln-btn-sm" onClick={() => { setExtra({ kind: 'simpler', text: P.simpler.join(' ') }); speech.speak(P.simpler.join(' '), 'simpler'); }} data-simpler>{t('lj.lesson.simpler')}</button>
                  <button type="button" className="ln-btn ln-btn-sm" onClick={() => { setExtra({ kind: 'example', text: P.anotherExample.join(' ') }); speech.speak(P.anotherExample.join(' '), 'example'); }} data-another-example>{t('lj.lesson.anotherExample')}</button>
                </div>
                {extra && <p className="lj-extra" role="status" data-extra={extra.kind}>{extra.text}</p>}
                <Clear lessonId={d.id} part="explain" />
              </div>
              <div className="ln-card ln-col" style={{ gap: 8 }}>
                <b>{t('lj.lesson.picture')}</b>
                <MermaidDiagram source={P.picture} />
                <Clear lessonId={d.id} part="picture" />
              </div>
              <div className="ln-card ln-col" style={{ gap: 8 }}>
                <b>{t('lj.lesson.mistakes')}</b>
                {P.mistakes.map((m, i) => (
                  <div key={i} className="lj-mistake">
                    <pre className="lj-code-small"><code>{m.wrong}</code></pre>
                    <span className="ln-small">✓ {m.fix}</span>
                  </div>
                ))}
                <Clear lessonId={d.id} part="mistakes" />
              </div>
              <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => go('code')} data-next-step>{t('lj.lesson.toCode')}<ArrowRight size={16} aria-hidden="true" /></button>
            </section>
          )}

          {step === 'code' && (
            <section className="ln-col" style={{ gap: 14 }} data-step-panel="code">
              <div className="ln-card ln-col" style={{ gap: 10 }}>
                <div className="ln-between ln-wrap" style={{ gap: 8 }}>
                  <b>{t('lj.lesson.codeTitle')}</b>
                  <span className="ln-row" style={{ gap: 6 }}>
                    {walk.active
                      ? <button type="button" className="ln-btn ln-btn-sm" onClick={stopWalk} data-walk-stop><Square size={14} aria-hidden="true" />{t('lj.lesson.stop')}</button>
                      : <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={startWalk} data-walk><Headphones size={14} aria-hidden="true" />{t('lj.lesson.walk')}</button>}
                    <button type="button" className="ln-btn ln-btn-sm" onClick={runExample} disabled={running} data-run-example><Play size={14} aria-hidden="true" />{running ? t('lj.lesson.running') : t('lj.lesson.run')}</button>
                  </span>
                </div>
                {walk.active && (
                  <div className="ln-row ln-wrap" style={{ gap: 6 }} role="group" aria-label={t('lj.walk.controls')} data-walk-state={walk.state} data-walk-index={walk.index}>
                    {walk.state === 'preparing' && <span className="ln-small ln-muted" role="status">{t('lj.walk.preparing')}</span>}
                    {walk.state !== 'preparing' && (<>
                      <button type="button" className="ln-btn ln-btn-sm" onClick={walk.prev} disabled={walk.index <= 0} data-walk-prev><SkipBack size={14} aria-hidden="true" />{t('lj.walk.prev')}</button>
                      {walk.state === 'playing'
                        ? <button type="button" className="ln-btn ln-btn-sm" onClick={walk.pause} data-walk-pause><Pause size={14} aria-hidden="true" />{t('lj.walk.pause')}</button>
                        : walk.state === 'paused' && <button type="button" className="ln-btn ln-btn-sm" onClick={walk.resume} data-walk-resume><Play size={14} aria-hidden="true" />{t('lj.walk.resume')}</button>}
                      <button type="button" className="ln-btn ln-btn-sm" onClick={walk.replay} data-walk-replay><RotateCcw size={14} aria-hidden="true" />{t('lj.walk.replay')}</button>
                      <button type="button" className="ln-btn ln-btn-sm" onClick={walk.next} data-walk-next><SkipForward size={14} aria-hidden="true" />{walk.index >= P.code.notes.length - 1 ? t('lj.walk.finish') : t('lj.walk.next')}</button>
                    </>)}
                    {walk.state === 'text' && <span className="ln-xs ln-muted" data-walk-text>{t('lj.walk.noAudio')}</span>}
                  </div>
                )}
                <CodePanel code={P.code} active={shownLine} onLine={(n) => { const k = P.code.notes.findIndex(x => x.line === n); if (k >= 0) { walk.stop(); setLine(n); speech.speak(codeSpeech(P.code.notes[k].note), `note-${k}`); } }} />
                {shownLine && (() => { const n = P.code.notes.find(x => x.line === shownLine); return n ? <p className="lj-note-now" role="status" data-line-note={shownLine}><b>{t('lj.lesson.lineN', { n: shownLine })}</b> {n.note}{showEn && n.note_en ? <span className="lj-cap" lang="en">{n.note_en}</span> : null}</p> : null; })()}
                {run && (
                  <div className="lj-output" data-output>
                    <span className="ln-xs ln-muted">{t('lj.lesson.output')}</span>
                    <pre>{run.timedOut ? t('lj.lesson.timedOut') : run.error ? run.error : (run.output || '')}</pre>
                    {run.runner === 'java-structure' && <span className="ln-xs ln-muted">{t('lj.lesson.javaPending')}</span>}
                  </div>
                )}
                <details className="ln-small"><summary>{t('lj.lesson.allNotes')}</summary>
                  <ol className="lj-notes">{P.code.notes.map(n => <li key={n.line}><b>{t('lj.lesson.lineN', { n: n.line })}</b> {n.note}</li>)}</ol>
                </details>
                <Clear lessonId={d.id} part="code" />
              </div>
              <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => go('practise')} data-next-step>{t('lj.lesson.toPractise')}<ArrowRight size={16} aria-hidden="true" /></button>
            </section>
          )}

          {step === 'practise' && (
            <section className="ln-col" style={{ gap: 14 }} data-step-panel="practise">
              <Quick items={P.quick} />
              <div className="ln-card ln-col" style={{ gap: 10 }} data-task>
                <b>{t('lj.lesson.tryIt')}</b>
                <p className="ln-small" style={{ margin: 0 }}>{P.task.prompt}</p>
                {showEn && P.task.prompt_en && <p className="ln-xs ln-muted" lang="en">{P.task.prompt_en}</p>}
                <textarea className="lj-editor" value={draft} spellCheck={false} aria-label={t('lj.lesson.editor')} data-editor rows={Math.max(6, draft.split('\n').length + 1)}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const el = e.target; const s = el.selectionStart;
                      const next = `${draft.slice(0, s)}    ${draft.slice(el.selectionEnd)}`;
                      setDraft(next); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
                    }
                  }} />
                <span className="ln-xs ln-muted">{t('lj.lesson.testsInfo', { shown: P.task.tests.length, hidden: P.task.hidden_tests })}</span>
                <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                  <button type="button" className="ln-btn ln-btn-primary" onClick={runPractice} disabled={busy || !draft.trim()} data-run-tests><Play size={16} aria-hidden="true" />{busy ? t('lj.lesson.running') : t('lj.lesson.runTests')}</button>
                  <button type="button" className="ln-btn" onClick={hint} disabled={hints.length >= P.task.hint_count} data-hint><Lightbulb size={16} aria-hidden="true" />{t('lj.lesson.hint', { n: Math.min(hints.length + 1, P.task.hint_count) })}</button>
                  <button type="button" className="ln-btn ln-btn-ghost" onClick={showSolution} disabled={!practice?.solution_available && hints.length < P.task.hint_count} data-solution><Eye size={16} aria-hidden="true" />{t('lj.lesson.solution')}</button>
                </div>
                {hints.map((h, i) => <p key={i} className="lj-hint" data-hint-text={i + 1}><b>{t('lj.lesson.hintN', { n: i + 1 })}</b> {h}</p>)}
                {practice && (
                  <div className="ln-col" style={{ gap: 6 }} role="status">
                    {practice.timedOut && <span className="ln-error">{t('lj.lesson.timedOut')}</span>}
                    {practice.error && !practice.timedOut && <span className="ln-small lj-runerror">{t('lj.lesson.codeError', { error: practice.error })}</span>}
                    <TestResults results={practice.results} />
                    <b className="ln-small" data-practice-result={practice.passed ? 'pass' : 'fail'}>{practice.passed ? t('lj.lesson.allPassed') : t('lj.lesson.notYet')}</b>
                  </div>
                )}
                {solution && <pre className="lj-code-small" data-solution-text><code>{solution}</code></pre>}
                <Clear lessonId={d.id} part="task" />
              </div>
              <div className="ln-card ln-col" style={{ gap: 6 }} data-cheat>
                <div className="ln-between"><b>{t('lj.lesson.cheat')}</b><button type="button" className="ln-btn ln-btn-sm" onClick={saveCheat}><Download size={14} aria-hidden="true" />{t('lj.lesson.saveCheat')}</button></div>
                <ul className="lj-steps">{P.cheat.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
              <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => go('check')} data-next-step>
                {t('lj.lesson.toCheck')}<ArrowRight size={16} aria-hidden="true" /></button>
              {!d.progress.practice_passed && !practice?.practice_passed && <span className="ln-xs ln-muted" style={{ alignSelf: 'flex-end' }}>{t('lj.lesson.checkEarly')}</span>}
            </section>
          )}

          {step === 'check' && (
            <section className="ln-col" style={{ gap: 14 }} data-step-panel="check">
              {!check && !result && (
                <div className="ln-card ln-col" style={{ gap: 8 }}>
                  <b>{t('lj.lesson.checkTitle')}</b>
                  <span className="ln-small">{t('lj.lesson.checkWhy')}</span>
                  <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={startCheck} disabled={busy} data-start-check>{t('lj.lesson.startCheck')}</button>
                </div>
              )}
              {check && (
                <div className="ln-card ln-col" style={{ gap: 10 }} data-check-question>
                  <span className="ln-kicker">{t('lj.session.attempt', { n: check.attempt })}{check.early ? ` · ${t('lj.lesson.earlyNote')}` : ''}</span>
                  <p className="ln-indic" style={{ fontSize: 'var(--fs-h3)', margin: 0, lineHeight: 1.6 }}>{check.question}</p>
                  <AnswerBox onSubmit={answerCheck} busy={busy} submitLabel={t('lj.lesson.submitAnswer')} />
                </div>
              )}
              {result && (
                <ResultCard result={result.result_band} feedback={result.feedback_parts} labelChange={result.label_change}>
                  {result.module_progress && <span className="ln-small">{t('lj.lesson.moduleNow', { done: result.module_progress.lessons_done, total: result.module_progress.lessons_total })}</span>}
                  <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                    {result.passed && result.next_lesson && <Link className="ln-btn ln-btn-primary" to={`/learn/lesson/${result.next_lesson.id}`} state={{ from }} data-next-lesson>{t('lj.lesson.nextLesson', { m: result.next_lesson.module_n, n: result.next_lesson.n })}<ArrowRight size={16} aria-hidden="true" /></Link>}
                    {!result.passed && <button type="button" className="ln-btn ln-btn-primary" onClick={() => go('learn')}>{t('lj.lesson.learnAgain')}</button>}
                    {!result.passed && <button type="button" className="ln-btn" onClick={startCheck}>{t('lj.session.tryAgain')}</button>}
                    <Link className="ln-btn" to={`/learn/courses/${course.id}`}>{t('lj.lesson.backToCourse')}</Link>
                  </div>
                </ResultCard>
              )}
              {result?.passed && !challenge && (
                <div className="ln-card ln-col" style={{ gap: 8 }} data-challenge>
                  <b>{t('lj.lesson.challengeTitle')}</b>
                  <span className="ln-small">{t('lj.lesson.challengeWhy')}</span>
                  <AnswerBox onSubmit={answerChallenge} busy={busy} submitLabel={t('lj.lesson.submitAnswer')} />
                </div>
              )}
              {challenge && <div className="ln-note" role="status">{challenge.passed ? t('lj.lesson.challengePassed', { label: t(`label.${String(challenge.label).toLowerCase()}`) }) : t('lj.lesson.challengeAgain')}</div>}
            </section>
          )}

          <section className="ln-card ln-col lj-ask" style={{ gap: 8 }} aria-label={t('lj.lesson.askTitle')} data-ask>
            <b className="ln-row" style={{ gap: 6 }}><MessageCircleQuestion size={16} aria-hidden="true" />{t('lj.lesson.askTitle')}</b>
            {asks.map((a, i) => (
              <div key={i} className="ln-col" style={{ gap: 2 }} data-ask-answer={i}>
                <span className="ln-xs ln-muted">{a.q}</span>
                <span className="ln-small">{a.answer}</span>
              </div>
            ))}
            <form className="ln-row" style={{ gap: 6 }} onSubmit={ask}>
              <input className="ln-input" style={{ flex: 1, minWidth: 0 }} value={question} onChange={e => setQuestion(e.target.value)} placeholder={t('lj.lesson.askHint')} aria-label={t('lj.lesson.askTitle')} data-ask-input />
              <button type="submit" className="ln-btn ln-btn-sm" disabled={!question.trim()} aria-label={t('lj.lesson.askSend')}><Send size={14} aria-hidden="true" /></button>
            </form>
          </section>
        </>
      )}

      {testout && (
        <div className="ln-card ln-col lj-testout" style={{ gap: 10 }} role="dialog" aria-label={t('lj.lesson.alreadyKnow')} data-testout-panel>
          <div className="ln-between"><b>{t('lj.lesson.testoutTitle')}</b><button type="button" className="ln-link" onClick={() => setTestout(null)}>{t('common.close')}</button></div>
          <span className="ln-small">{t('lj.lesson.testoutWhy')}</span>
          {testout.questions.map((q, i) => (
            <label key={i} className="ln-col" style={{ gap: 4 }}>
              <span className="ln-small">{i + 1}. {q}</span>
              <textarea className="ln-textarea" rows={3} value={testout.answers[i]} onChange={e => setTestout(x => ({ ...x, answers: x.answers.map((a, k) => (k === i ? e.target.value : a)) }))} data-testout-answer={i} />
            </label>
          ))}
          <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={sendTestout} disabled={busy || testout.answers.some(a => !a.trim())} data-testout-send>{t('lj.lesson.testoutSend')}</button>
          {testout.result && <span className="ln-small" role="status" data-testout-result={testout.result.known ? 'known' : 'learn'}>{testout.result.known ? t('lj.lesson.testoutKnown') : t('lj.lesson.testoutLearn')}</span>}
        </div>
      )}
    </div>
  );
}
