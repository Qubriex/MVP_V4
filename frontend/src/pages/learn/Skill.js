// src/pages/learn/Skill.js — /learn/skill/:nodeId, one skill in five steps:
//   Concept   a short primer in the learner's language, a diagram, a worked example
//   Lesson    the voice tutor (the Session page)
//   Practice  quick questions, a short written answer, code checked against test cases
//   Apply     a work task with a visible marking guide and weights, fixed for 30 days
//   Progress  attempts, best result, the label and how to reach Confirmed
// Quick questions are for learning only. A written or code practice or a work
// task counts as evidence once the skill is mastered; Confirmed needs two
// kinds of evidence (the "How to reach Confirmed" list says what is missing).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Mic, CheckCircle2, XCircle, ClipboardList, Lock, History as HistoryIcon, MessageCircleQuestion } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';
import { Tabs, Skeleton } from '../../components/shared/ui';
import { WhyThis } from '../../components/shared/Popover';
import MermaidDiagram from '../../components/learn/MermaidDiagram';
import AnswerBox from '../../components/learn/AnswerBox';
import { ResultCard, LabelTag, ConfirmedSteps } from '../../components/learn/journey';
import { fmtDate } from '../../components/learn/evidenceText';
import { newTracker, recordPaste, provenanceFor } from '../../utils/provenance';

const TABS = ['concept', 'lesson', 'practice', 'apply', 'progress'];

function Quick({ item, nodeId, onDone }) {
  const { t } = useUiLang();
  const [picked, setPicked] = useState(null);
  const [res, setRes] = useState(null);
  const pick = async (o) => {
    setPicked(o);
    try { const r = await api.post(`/learner/skill/${nodeId}/practice`, { kind: 'quick', item_key: item.key, answer: o }); setRes(r.data); onDone(); } catch { setRes(null); }
  };
  return (
    <fieldset className="ln-card ln-col lj-quick" style={{ gap: 8 }}>
      <legend className="ln-small"><b>{item.stem}</b></legend>
      <div className="ln-row ln-wrap" style={{ gap: 8 }}>
        {item.options.map(o => (
          <button key={o} type="button" className={`ln-btn ln-btn-sm ${picked === o ? (res?.correct ? 'is-right' : res ? 'is-wrong' : '') : ''}`} onClick={() => pick(o)} disabled={!!res} aria-pressed={picked === o}><code>{o}</code></button>
        ))}
      </div>
      {res && <span className="ln-small" role="status">{res.correct ? <><CheckCircle2 size={14} aria-hidden="true" /> {t('lj.skill.quickRight')}</> : <><XCircle size={14} aria-hidden="true" /> {t('lj.skill.quickWrong', { answer: res.right_answer })}</>}</span>}
    </fieldset>
  );
}

function CodeItem({ item, nodeId, onDone }) {
  const { t } = useUiLang();
  const [code, setCode] = useState(item.starter || '');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const tracker = useRef(newTracker());
  const submit = async () => {
    setBusy(true); setError('');
    try { const r = await api.post(`/learner/skill/${nodeId}/practice`, { kind: 'code', item_key: item.key, answer: code, provenance: provenanceFor(tracker.current, code) }); setRes(r.data); onDone(); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  return (
    <section className="ln-card ln-col" style={{ gap: 8 }} aria-label={t('lj.skill.code')}>
      <b>{t('lj.skill.code')}</b>
      <p style={{ margin: 0 }}>{item.prompt}</p>
      <textarea className="ln-textarea lj-code" rows={8} spellCheck={false} value={code} onChange={e => setCode(e.target.value)} aria-label={t('lj.skill.yourCode')}
        onPaste={e => { tracker.current = recordPaste(tracker.current, e.clipboardData.getData('text')); }} />
      <span className="ln-xs ln-muted">{t('lj.skill.checkedFor')} {item.checks.join(' · ')}</span>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={submit} disabled={busy || !code.trim()}>{busy ? t('lj.checking') : t('lj.skill.runChecks')}</button>
      {res && (
        <ResultCard result={res.result} labelChange={res.label_change}>
          <ul className="lj-checks">{res.checks.map(c => <li key={c.label} className={c.passed ? 'is-pass' : 'is-fail'}>{c.passed ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />} {c.label}</li>)}</ul>
          <span className="ln-xs ln-muted">{res.counts ? t('lj.skill.counted') : t('lj.skill.notCounted')}</span>
        </ResultCard>
      )}
    </section>
  );
}

function Written({ item, nodeId, kind = 'written', onDone, label }) {
  const { t } = useUiLang();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const submit = async (text, provenance, clear) => {
    setBusy(true); setError('');
    try { const r = await api.post(`/learner/skill/${nodeId}/practice`, { kind, item_key: item?.key, answer: text, provenance }); setRes(r.data); clear(); onDone(); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  return (
    <>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <AnswerBox onSubmit={submit} busy={busy} submitLabel={label || t('lj.skill.submit')} />
      {res && (
        <ResultCard result={res.result} feedback={res.feedback} labelChange={res.label_change}>
          <span className="ln-xs ln-muted">{res.counts ? t('lj.skill.counted') : t('lj.skill.notCounted')}</span>
        </ResultCard>
      )}
    </>
  );
}

function Challenge({ nodeId, onDone }) {
  const { t } = useUiLang();
  const [ch, setCh] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const open = async () => { setBusy(true); setError(''); try { setCh((await api.post(`/learner/skill/${nodeId}/challenge`)).data); } catch (e) { setError(errMsg(e)); } setBusy(false); };
  const answer = async (text, provenance, clear) => {
    setBusy(true); setError('');
    try { const r = await api.post(`/learner/challenge/${ch.id}/answer`, { answer: text, mode: provenance?.mode === 'voice' ? 'voice' : 'typed' }); setRes(r.data); clear(); onDone(); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  return (
    <section className="ln-card ln-col" style={{ gap: 8 }} aria-label={t('lj.skill.challenge')}>
      <b className="ln-row" style={{ gap: 8 }}><Mic size={16} aria-hidden="true" />{t('lj.skill.challenge')}</b>
      <span className="ln-small ln-muted">{t('lj.skill.challengeWhy')}</span>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {!ch ? <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={open} disabled={busy}>{t('lj.skill.challengeStart')}</button> : !res ? (
        <>
          <p className="ln-indic" style={{ margin: 0, fontSize: 'var(--fs-h3)' }} data-challenge-question>{ch.question}</p>
          <AnswerBox onSubmit={answer} busy={busy} submitLabel={t('lj.skill.submit')} />
          <span className="ln-xs ln-muted">{t('lj.skill.challengeVoice')}</span>
        </>
      ) : <ResultCard result={res.result} feedback={res.feedback} labelChange={res.label_change} />}
    </section>
  );
}

export default function Skill() {
  const { t } = useUiLang();
  const { nodeId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'concept';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get(`/learner/skill/${nodeId}`).then(r => setData(r.data)).catch(e => setError(errMsg(e))), [nodeId]);
  useEffect(() => { load(); }, [load]);
  const setTab = (id) => (id === 'lesson' ? navigate('/learn/session', { state: { from: `/learn/skill/${nodeId}` } }) : setParams({ tab: id }, { replace: true }));
  const openTask = async () => { setBusy(true); try { await api.post(`/learner/skill/${nodeId}/task`); await load(); } catch (e) { setError(errMsg(e)); } setBusy(false); };

  if (!data) return error ? <div className="ln-error" role="alert">{error}</div> : <Skeleton lines={6} card />;
  const p = data.progress;
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <span className="ln-kicker">{data.node.group}</span>
          <h1 className="ln-title">{data.node.label}</h1>
          <span className="ln-row ln-wrap" style={{ gap: 8 }}><LabelTag label={p.label} /><span className="ln-small ln-muted">{t('lj.skill.about', { n: data.node.minutes })}</span></span>
        </div>
      </header>
      <Tabs tabs={TABS.map(id => ({ id, label: t(`lj.skill.tab.${id}`) }))} value={tab} onChange={setTab} label={t('lj.skill.steps')} />
      {error && <div className="ln-error" role="alert">{error}</div>}

      {tab === 'concept' && (
        <section className="ln-col" style={{ gap: 12 }}>
          <div className="ln-card ln-col" style={{ gap: 8 }}>
            <p className="ln-indic" style={{ margin: 0, lineHeight: 1.7 }}>{data.concept.primer}</p>
            {data.concept.caption_en && <p className="ln-small ln-muted" lang="en" style={{ margin: 0 }}>{data.concept.caption_en}</p>}
          </div>
          {data.concept.mermaid && <div className="ln-card"><MermaidDiagram source={data.concept.mermaid} /></div>}
          <div className="ln-card ln-col" style={{ gap: 8 }}>
            <b>{t('lj.skill.workedExample')}</b>
            <p className="ln-indic" style={{ margin: 0 }}>{data.concept.example}</p>
            {data.concept.code && <pre className="ln-code"><code>{data.concept.code}</code></pre>}
          </div>
          <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/learn/session', { state: { from: `/learn/skill/${nodeId}` } })}><Mic size={16} aria-hidden="true" />{t('lj.skill.toLesson')}</button>
        </section>
      )}

      {tab === 'practice' && (
        <section className="ln-col" style={{ gap: 12 }}>
          <p className="ln-small ln-muted" style={{ margin: 0 }}>{data.mastered ? t('lj.skill.practiceCounts') : t('lj.skill.practiceLearning')}</p>
          {data.practice.filter(i => i.kind === 'quick').map(i => <Quick key={i.key} item={i} nodeId={nodeId} onDone={load} />)}
          {data.practice.filter(i => i.kind === 'written').map(i => (
            <section key={i.key} className="ln-card ln-col" style={{ gap: 8 }} aria-label={t('lj.skill.written')}>
              <b>{t('lj.skill.written')}</b>
              <p className="ln-indic" style={{ margin: 0 }}>{i.prompt}</p>
              <Written item={i} nodeId={nodeId} onDone={load} />
            </section>
          ))}
          {data.practice.filter(i => i.kind === 'code').map(i => <CodeItem key={i.key} item={i} nodeId={nodeId} onDone={load} />)}
        </section>
      )}

      {tab === 'apply' && (
        <section className="ln-col" style={{ gap: 12 }}>
          {!data.task || data.task.expired ? (
            <div className="ln-card ln-col" style={{ gap: 8 }}>
              <b className="ln-row" style={{ gap: 8 }}><ClipboardList size={18} aria-hidden="true" />{t('lj.skill.taskTitle')}</b>
              <span className="ln-small">{t('lj.skill.taskIntro')}</span>
              <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={openTask} disabled={busy}>{t('lj.skill.taskOpen')}</button>
            </div>
          ) : (
            <>
              <div className="ln-card ln-col" style={{ gap: 8 }}>
                <b className="ln-row" style={{ gap: 8 }}><ClipboardList size={18} aria-hidden="true" />{t('lj.skill.taskTitle')}</b>
                <p className="ln-indic" style={{ margin: 0 }} data-task-brief>{data.task.brief.task}</p>
                <span className="ln-small">{data.task.brief.deliverable}</span>
                <span className="ln-xs ln-muted ln-row" style={{ gap: 6 }}><Lock size={12} aria-hidden="true" />{t('lj.skill.taskFixed', { date: fmtDate(data.task.locked_until) })}</span>
              </div>
              <div className="ln-card ln-col" style={{ gap: 6 }}>
                <b>{t('lj.skill.guide')}</b>
                <table className="lj-guide"><thead><tr><th scope="col">{t('lj.skill.criterion')}</th><th scope="col">{t('lj.skill.weight')}</th></tr></thead>
                  <tbody>{data.task.guide.map(g => <tr key={g.criterion}><td>{g.criterion}</td><td>{g.weight}%</td></tr>)}</tbody></table>
              </div>
              {data.task.status === 'submitted'
                ? <div className="ln-card ln-card-warm">{t('lj.skill.taskDone')}</div>
                : <div className="ln-card"><Written nodeId={nodeId} kind="task" onDone={load} label={t('lj.skill.taskSubmit')} /></div>}
            </>
          )}
        </section>
      )}

      {tab === 'progress' && (
        <section className="ln-col" style={{ gap: 12 }}>
          <div className="ln-card ln-col" style={{ gap: 8 }}>
            <div className="ln-between ln-wrap"><b>{t('lj.skill.labelNow')}</b><LabelTag label={p.label} /></div>
            <span className="ln-small">{t('lj.skill.attempts', { n: p.attempts, passes: p.passes })} · {t('lj.skill.best')}: {p.best ? t(`lj.result.${p.best}`) : '—'}</span>
            {p.kinds?.length > 0 && <span className="ln-small ln-muted">{t('lj.skill.kinds')} {p.kinds.map(k => t(`lj.kind.${k}`)).join(', ')}</span>}
            <span className="ln-row" style={{ gap: 6 }}><WhyThis title={t('lj.skill.whyConfirmedTitle')}>{t('lj.skill.whyConfirmed')}</WhyThis></span>
            {data.mastered && <ConfirmedSteps missing={p.missing_for_confirmed} nodeId={nodeId} />}
          </div>
          {data.mastered && p.missing_for_confirmed.includes('challenge_bound') && <Challenge nodeId={nodeId} onDone={load} />}
          <div className="ln-card ln-col" style={{ gap: 8 }}>
            <div className="ln-between"><b>{t('lj.skill.recent')}</b><Link className="ln-link ln-small" to={`/learn/history?node=${nodeId}`}><HistoryIcon size={14} aria-hidden="true" /> {t('lj.skill.allAttempts')}</Link></div>
            {p.recent.length ? p.recent.map(a => (
              <div key={a.id} className="ln-between ln-wrap ln-small"><span>{t(`lj.kind.${a.kind}`)} · {fmtDate(a.date)}</span><span>{t(`lj.result.${a.result}`)} · {a.evidence} · {a.authorship}</span></div>
            )) : <span className="ln-small ln-muted">{t('lj.skill.noAttempts')}</span>}
          </div>
          <div className="ln-card ln-between ln-wrap" style={{ gap: 8 }}>
            <span className="ln-small"><b>{t('lj.whatNext')}</b> {t(`lj.skill.next.${p.next.key}`)}</span>
            {p.next.href ? <Link className="ln-btn ln-btn-primary" to={p.next.href}>{t('lj.go')}</Link> : p.next.tab ? <button type="button" className="ln-btn ln-btn-primary" onClick={() => setTab(p.next.tab)}>{t('lj.go')}</button> : null}
          </div>
          {!data.mastered && <Link className="ln-link ln-small" to="/learn/session"><MessageCircleQuestion size={14} aria-hidden="true" /> {t('lj.skill.stuck')}</Link>}
        </section>
      )}
    </>
  );
}
