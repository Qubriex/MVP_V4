// src/pages/learn/Module.js — the end of a module.
//   /learn/modules/:moduleId/test     a short test (multiple choice), passed at the module's mark
//   /learn/modules/:moduleId/project  a small project in the editor, run against tests
// Passing both adds the module's skill group to the Capability Passport.
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Play, ShieldCheck } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { runCode } from '../../utils/codeRunner';
import { useUiLang } from '../../context/UiLangContext';
import { LoadingRows } from '../../components/shared/EmptyState';
import { useCachedGet } from '../../utils/cachedGet';
import { usePageCrumbs } from '../../components/learn/BackBar';

const courseOf = (moduleId) => ({ py: 'python', jv: 'java' }[moduleId.split('-')[0]] || moduleId.split('-')[0]);
// The course's name for the breadcrumb.
const useCourseTitle = (courseId) => useCachedGet(`/learner/courses/${courseId}`).data?.title || courseId;

function Done({ module, courseId }) {
  const { t } = useUiLang();
  if (!module) return null;
  return (
    <div className={`ln-card ${module.completed ? 'ln-card-warm' : ''} ln-col`} style={{ gap: 6 }} role="status" data-module-state={module.completed ? 'completed' : 'open'}>
      {module.completed
        ? <b className="ln-row" style={{ gap: 6 }}><ShieldCheck size={18} aria-hidden="true" />{t('lj.module.completed')}</b>
        : <span className="ln-small">{t('lj.module.state', { test: module.test_passed ? '✓' : '—', project: module.project_passed ? '✓' : '—' })}</span>}
      <div className="ln-row ln-wrap" style={{ gap: 8 }}>
        {module.completed && <Link className="ln-btn ln-btn-sm ln-btn-primary" to="/learn/passport">{t('lj.module.seePassport')}</Link>}
        <Link className="ln-btn ln-btn-sm" to={`/learn/courses/${courseId}`}>{t('lj.lesson.backToCourse')}</Link>
      </div>
    </div>
  );
}

export function ModuleTest() {
  const { t } = useUiLang();
  const { moduleId } = useParams();
  const courseId = courseOf(moduleId);
  const [d, setD] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/learner/modules/${moduleId}/test`).then(r => setD(r.data)).catch(e => setError(errMsg(e))); }, [moduleId]);
  const courseTitle = useCourseTitle(courseId);
  usePageCrumbs([{ key: 'nav.courses', to: '/learn/courses' }, { label: courseTitle, to: `/learn/courses/${courseId}` }, { key: 'lj.course.moduleTest' }]);
  if (error && !d) return <div className="ln-error">{error}</div>;
  if (!d) return <LoadingRows rows={5} />;
  const send = async () => {
    try { setResult((await api.post(`/learner/modules/${moduleId}/test`, { answers: d.questions.map(q => answers[q.i]) })).data); } catch (e) { setError(errMsg(e)); }
  };
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}>
        <h1 className="ln-title">{t('lj.course.moduleTest')}</h1><span className="ln-sub">{t('lj.module.testSub', { pass: d.pass, of: d.questions.length })}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <section className="ln-col" style={{ gap: 12 }} data-module-test-form>
        {d.questions.map(q => (
          <fieldset key={q.i} className="ln-card ln-col" style={{ gap: 6 }}>
            <legend className="ln-small"><b>{q.i + 1}.</b></legend>
            <pre className="lj-q">{q.q}</pre>
            {q.options.map((o, k) => (
              <label key={k} className="ln-row ln-small" style={{ gap: 8 }}>
                <input type="radio" name={`q${q.i}`} checked={answers[q.i] === k} onChange={() => setAnswers(a => ({ ...a, [q.i]: k }))} />{o}
              </label>
            ))}
            {result && <span className="ln-xs" role="status">{result.review[q.i].right ? '✓' : '✗'} {result.review[q.i].why}</span>}
          </fieldset>
        ))}
      </section>
      {!result?.passed && <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={send} disabled={Object.keys(answers).length < d.questions.length} data-send-test>{t('lj.module.sendTest')}</button>}
      {result && <div className="ln-note" role="status" data-test-result={result.passed ? 'pass' : 'fail'}>{t(result.passed ? 'lj.module.testPassed' : 'lj.module.testNotYet', { score: result.score, of: result.of, needed: result.needed })}</div>}
      {result && <Done module={result.module} courseId={courseId} />}
    </>
  );
}

export function ModuleProject() {
  const { t } = useUiLang();
  const { moduleId } = useParams();
  const courseId = courseOf(moduleId);
  const [d, setD] = useState(null);
  const [code, setCode] = useState('');
  const [run, setRun] = useState(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hints, setHints] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/learner/modules/${moduleId}/project`).then(r => { setD(r.data); setCode(r.data.starter); }).catch(e => setError(errMsg(e))); }, [moduleId]);
  const courseTitle = useCourseTitle(courseId);
  usePageCrumbs([{ key: 'nav.courses', to: '/learn/courses' }, { label: courseTitle, to: `/learn/courses/${courseId}` }, { key: 'lj.course.project' }]);
  if (error && !d) return <div className="ln-error">{error}</div>;
  if (!d) return <LoadingRows rows={5} />;
  const submit = async () => {
    setBusy(true);
    try {
      const r = await runCode({ language: d.language, code, tests: d.runner_tests, setup: d.setup, expectedOutput: d.expected_output });
      setRun(r);
      setState((await api.post(`/learner/modules/${moduleId}/project`, { results: r.results, code })).data);
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}>
        <span className="ln-kicker">{t('lj.course.project')}</span><h1 className="ln-title">{d.title}</h1></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <section className="ln-card ln-col" style={{ gap: 10 }} data-project>
        <p className="ln-small" style={{ margin: 0 }}>{d.prompt}</p>
        <textarea className="lj-editor" value={code} onChange={e => setCode(e.target.value)} spellCheck={false} rows={Math.max(10, code.split('\n').length + 1)} aria-label={t('lj.lesson.editor')} data-editor />
        <span className="ln-xs ln-muted">{t('lj.lesson.testsInfo', { shown: d.tests.length, hidden: d.hidden_tests })}{d.language === 'java' ? ` · ${t('lj.lesson.javaPending')}` : ''}</span>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <button type="button" className="ln-btn ln-btn-primary" onClick={submit} disabled={busy} data-run-project><Play size={16} aria-hidden="true" />{busy ? t('lj.lesson.running') : t('lj.module.runProject')}</button>
          {d.hints.length > 0 && <button type="button" className="ln-btn" onClick={() => setHints(h => Math.min(h + 1, d.hints.length))} disabled={hints >= d.hints.length}>{t('lj.lesson.hint', { n: Math.min(hints + 1, d.hints.length) })}</button>}
        </div>
        {d.hints.slice(0, hints).map((h, i) => <p key={i} className="lj-hint"><b>{t('lj.lesson.hintN', { n: i + 1 })}</b> {h}</p>)}
        {run && (
          <ul className="lj-tests">{run.results.map((r, i) => (
            <li key={i} className={r.passed ? 'is-pass' : 'is-fail'} data-passed={r.passed ? 'yes' : 'no'}>{r.passed ? '✓' : '✗'} <span className="ln-small">{r.hidden ? t('lj.lesson.hiddenTest', { n: i + 1 }) : r.name}{!r.passed && !r.hidden ? ` — ${t('lj.lesson.expectedGot', { expected: r.expected, got: r.got ?? '—' })}` : ''}</span></li>
          ))}</ul>
        )}
        {run?.error && <span className="ln-small lj-runerror">{run.timedOut ? t('lj.lesson.timedOut') : t('lj.lesson.codeError', { error: run.error })}</span>}
      </section>
      {state && <div className="ln-note" role="status" data-project-result={state.passed ? 'pass' : 'fail'}>{state.passed ? t('lj.module.projectPassed') : t('lj.module.projectNotYet')}</div>}
      {state && <Done module={state.module} courseId={courseId} />}
    </>
  );
}
