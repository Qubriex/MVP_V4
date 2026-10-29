// src/pages/learn/DayOne.js — /learn/dayone, the Day-One Simulation.
// What it is; a check before starting (a quiet room, the camera on for
// supervision, 45 free minutes); an unscored practice run; the scored,
// supervised run (authorship A3); the result; and where it shows on the
// Passport.
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Volume2, Clock, Play, CheckCircle2 } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';
import { PageHeader, Skeleton } from '../../components/shared/ui';
import { ResultCard } from '../../components/learn/journey';
import { fmtDate } from '../../components/learn/evidenceText';

function Run({ tasks, scored, onSubmit, busy }) {
  const { t } = useUiLang();
  const [answers, setAnswers] = useState(tasks.map(() => ''));
  const [left, setLeft] = useState(45 * 60);
  const hidden = useRef({ since: null, ms: 0 });
  useEffect(() => {
    const id = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000);
    const vis = () => { const h = hidden.current; if (document.hidden) h.since = Date.now(); else if (h.since) { h.ms += Date.now() - h.since; h.since = null; } };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return (
    <section className="ln-card ln-col" style={{ gap: 12 }} aria-label={scored ? t('lj.dayone.scoredRun') : t('lj.dayone.practiceRun')}>
      <div className="ln-between ln-wrap"><b>{scored ? t('lj.dayone.scoredRun') : t('lj.dayone.practiceRun')}</b>
        <span className="ln-row ln-small" style={{ gap: 6 }} role="timer"><Clock size={14} aria-hidden="true" />{t('lj.dayone.left', { m: Math.floor(left / 60), s: String(left % 60).padStart(2, '0') })}</span></div>
      {tasks.map((tk, i) => (
        <div key={tk.node_id} className="ln-col" style={{ gap: 6 }}>
          <label className="ln-label" htmlFor={`d1-${i}`}>{t('lj.dayone.task', { n: i + 1 })} · {tk.skill}</label>
          <p className="ln-indic" style={{ margin: 0 }}>{tk.prompt}</p>
          <textarea id={`d1-${i}`} className="ln-textarea" rows={4} value={answers[i]} onChange={e => setAnswers(a => a.map((x, k) => (k === i ? e.target.value : x)))} />
        </div>
      ))}
      <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy || answers.some(a => !a.trim())}
        onClick={() => onSubmit(answers, { tab_hidden_ms: hidden.current.ms, minutes: Math.round((45 * 60 - left) / 60) })}>{busy ? t('lj.checking') : t('lj.dayone.submit')}</button>
    </section>
  );
}

export default function DayOne() {
  const { t } = useUiLang();
  const [d, setD] = useState(null);
  const [mode, setMode] = useState(null); // practice | scored
  const [checks, setChecks] = useState({ quiet_room: false, camera: false, minutes: false });
  const [camera, setCamera] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const load = () => api.get('/learner/dayone').then(r => { setD(r.data); if (r.data.checks) setChecks(c => ({ ...c, ...r.data.checks })); }).catch(e => setError(errMsg(e)));
  useEffect(() => { load(); return () => camera?.getTracks().forEach(tr => tr.stop()); }, []);

  const tryCamera = async () => {
    setError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setCamera(s); setChecks(c => ({ ...c, camera: true }));
    } catch { setError(t('lj.dayone.cameraFailed')); }
  };
  const savePrecheck = async () => { setBusy(true); try { await api.post('/learner/dayone/precheck', { checks }); await load(); } catch (e) { setError(errMsg(e)); } setBusy(false); };
  const submit = async (answers, sup) => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/learner/dayone/${mode}`, { answers, supervision: { ...sup, camera_on: !!camera } });
      setRes({ mode, ...r.data }); setMode(null); await load();
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };

  if (!d) return error ? <div className="ln-error" role="alert">{error}</div> : <Skeleton lines={5} card />;
  if (d.status === 'none') {
    return (<><PageHeader title={t('lj.dayone.title')} subtitle={t('lj.dayone.what')} /><div className="ln-card ln-muted">{t('lj.dayone.none')}</div></>);
  }
  const ready = checks.quiet_room && checks.camera && checks.minutes;
  return (
    <>
      <PageHeader title={t('lj.dayone.title')} subtitle={`${d.role || ''}${d.employer ? ` · ${d.employer}` : ''}`} />
      <section className="ln-card ln-col" style={{ gap: 6 }}>
        <b>{t('lj.dayone.whatTitle')}</b>
        <span className="ln-small">{t('lj.dayone.what')}</span>
        <ol className="lj-steps ln-small">
          <li className={d.checks ? 'is-done' : ''}>{t('lj.dayone.step1')}</li>
          <li className={d.practice_at ? 'is-done' : ''}>{t('lj.dayone.step2')}</li>
          <li className={d.status === 'scored' ? 'is-done' : ''}>{t('lj.dayone.step3')}</li>
          <li>{t('lj.dayone.step4')}</li>
        </ol>
      </section>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {res && (
        <ResultCard result={res.mode === 'practice' ? (res.results.every(x => x === 'pass') ? 'pass' : 'partial') : res.passed ? 'pass' : 'fail'}
          title={res.mode === 'practice' ? t('lj.dayone.practiceDone') : res.passed ? t('lj.dayone.passed') : t('lj.dayone.notPassed')}>
          {res.mode !== 'practice' && res.passed && <span className="ln-small">{t('lj.dayone.onPassport')} <Link className="ln-link" to="/learn/passport">{t('lj.dayone.openPassport')}</Link></span>}
        </ResultCard>
      )}
      {d.status === 'scored' ? (
        <section className="ln-card ln-col" style={{ gap: 6 }}>
          <b className="ln-row" style={{ gap: 8 }}><CheckCircle2 size={18} aria-hidden="true" />{d.passed ? t('lj.dayone.passed') : t('lj.dayone.notPassed')}</b>
          <span className="ln-small">{t('lj.dayone.scoredOn', { date: fmtDate(d.scored_at) })}</span>
          {d.passed && <span className="ln-small">{t('lj.dayone.onPassport')}</span>}
        </section>
      ) : mode ? <Run tasks={d.tasks} scored={mode === 'scored'} onSubmit={submit} busy={busy} /> : (
        <>
          <section className="ln-card ln-col" style={{ gap: 8 }} aria-labelledby="pre">
            <b id="pre">{t('lj.dayone.precheck')}</b>
            <label className="ln-row" style={{ gap: 8 }}><input type="checkbox" checked={checks.quiet_room} onChange={e => setChecks(c => ({ ...c, quiet_room: e.target.checked }))} /><Volume2 size={16} aria-hidden="true" />{t('lj.dayone.quiet')}</label>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <span className="ln-row" style={{ gap: 8 }}><Camera size={16} aria-hidden="true" />{checks.camera ? t('lj.dayone.cameraOn') : t('lj.dayone.cameraNeeded')}</span>
              {!checks.camera && <button type="button" className="ln-btn ln-btn-sm" onClick={tryCamera}>{t('lj.dayone.cameraTest')}</button>}
            </div>
            <label className="ln-row" style={{ gap: 8 }}><input type="checkbox" checked={checks.minutes} onChange={e => setChecks(c => ({ ...c, minutes: e.target.checked }))} /><Clock size={16} aria-hidden="true" />{t('lj.dayone.minutes')}</label>
            <span className="ln-xs ln-muted">{t('lj.dayone.cameraWhy')}</span>
            <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={savePrecheck} disabled={busy || !ready}>{t('lj.dayone.saveCheck')}</button>
          </section>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <button type="button" className="ln-btn" onClick={() => setMode('practice')}><Play size={16} aria-hidden="true" />{t('lj.dayone.startPractice')}</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => setMode('scored')} disabled={!d.checks?.camera || !d.checks?.quiet_room || !d.checks?.minutes}><Play size={16} aria-hidden="true" />{t('lj.dayone.startScored')}</button>
          </div>
          {!d.practice_at && <span className="ln-xs ln-muted">{t('lj.dayone.practiceFirst')}</span>}
        </>
      )}
    </>
  );
}
