// src/pages/inst/Review.js — /institution/review — faculty review (v4.3 §7.8).
// Queue: blind review — the question, the student's answer and the rubric;
// never the AI score, and the student is named only after you submit.
// Calibration: weighted κ per node between faculty and the evaluator on the
// random calibration sample (n ≥ 20, lower ≥ 0.50, point ≥ 0.60 → calibrated).
// Load: minutes per week forecast against the contracted review time.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useStaff } from '../../components/inst/InstitutionLayout';
import { Select } from '../../components/shared/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const BAND_TEXT = { '0.0-0.49': 'inst.review.bandText.weak0049', '0.5-0.69': 'inst.review.bandText.partial050', '0.7-0.89': 'inst.review.bandText.good070', '0.9-1.0': 'inst.review.bandText.excellent091' };
const CAL = { calibrated: ['inst.review.cal.calibrated', 'ln-tag-success'], rubric_under_review: ['inst.review.cal.rubricUnderReview', 'ln-tag-warning'], sampling: ['inst.review.cal.sampling', 'ln-tag-neutral'] };

function ReviewCard({ item, onDone, canDecide }) {
  const { t } = useUiLang();
  const [verdict, setVerdict] = useState('');
  const [band, setBand] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(Date.now());
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/institution/review-queue/${item.id}/verdict`, { verdict, band, notes, seconds_spent: Math.round((Date.now() - started.current) / 1000) });
      onDone(r.data);
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  return (
    <article className="ln-card" style={{ gap: 12 }}>
      <div className="ln-between ln-wrap"><span className="ln-kicker">{item.cluster} · {item.node}</span><span className="ln-xs ln-muted">{item.purpose} · {new Date(item.created_at).toLocaleDateString(uiLocale())}</span></div>
      <div className="ln-col" style={{ gap: 4 }}><span className="ln-xs ln-muted">{t('inst.review.question')}</span><p style={{ margin: 0, lineHeight: 1.6 }}>{item.question || '—'}</p></div>
      <div className="ln-col" style={{ gap: 4 }}><span className="ln-xs ln-muted">{t('inst.review.studentAnswerStudentHidden')}</span>
        <blockquote style={{ margin: 0, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.answer || '—'}</blockquote></div>
      <details><summary className="ln-small" style={{ cursor: 'pointer' }}>{t('inst.review.rubric')}</summary>
        <div className="ln-grid ln-g-2" style={{ gap: 10, marginTop: 8 }}>
          <div><b className="ln-small">{t('inst.review.passingCriteria')}</b><ul className="ln-small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{item.rubric.passing.map(c => <li key={c}>{c}</li>)}</ul></div>
          <div><b className="ln-small">{t('inst.review.failingIndicators')}</b><ul className="ln-small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{item.rubric.failing.map(c => <li key={c}>{c}</li>)}</ul></div>
        </div>
      </details>
      {canDecide ? (
        <div className="ln-col" style={{ gap: 10 }}>
          <div className="ln-row ln-wrap" style={{ gap: 8 }} role="group" aria-label={t('inst.review.verdict')}>
            <button type="button" className={`ln-btn ${verdict === 'pass' ? 'ln-btn-primary' : ''}`} aria-pressed={verdict === 'pass'} onClick={() => setVerdict('pass')}><CheckCircle2 size={16} aria-hidden="true" />{t('inst.review.pass')}</button>
            <button type="button" className={`ln-btn ${verdict === 'fail' ? 'ln-btn-primary' : ''}`} aria-pressed={verdict === 'fail'} onClick={() => setVerdict('fail')}><XCircle size={16} aria-hidden="true" />{t('inst.review.notYet')}</button>
          </div>
          <div className="ln-row ln-wrap" style={{ gap: 6 }} role="group" aria-label={t('inst.review.band')}>
            {item.bands.map(b => <button key={b} type="button" className={`ln-chip ${band === b ? 'ln-tag-accent' : ''}`} aria-pressed={band === b} onClick={() => setBand(b)}>{t(BAND_TEXT[b])}</button>)}
          </div>
          <textarea className="ln-textarea" rows={2} placeholder={t('inst.review.notesOptional')} value={notes} onChange={e => setNotes(e.target.value)} />
          {error && <div className="ln-error">{error}</div>}
          <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!verdict || !band || busy} onClick={submit}>{busy ? t('inst.review.saving') : t('inst.review.submitReview')}</button>
        </div>
      ) : <span className="ln-small ln-muted">{t('inst.review.viewersCanReadQueue')}</span>}
    </article>
  );
}

export default function Review() {
  const { t } = useUiLang();
  const { role } = useStaff();
  const [tab, setTab] = useState('queue');
  const [cohorts, setCohorts] = useState([]);
  const [cohortId, setCohortId] = useState('');
  const [queue, setQueue] = useState(null);
  const [cal, setCal] = useState(null);
  const [load, setLoad] = useState(null);
  const [done, setDone] = useState([]);
  const [contract, setContract] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.get('/institution/engagements').then(r => { setCohorts(r.data); if (r.data[0]) setCohortId(r.data[0].id); }).catch(e => setError(errMsg(e))); }, []);
  const refresh = useCallback(() => {
    if (!cohortId) return;
    api.get(`/institution/review-queue?engagement_id=${cohortId}`).then(r => setQueue(r.data)).catch(e => setError(errMsg(e)));
    api.get(`/institution/calibration?engagement_id=${cohortId}`).then(r => setCal(r.data)).catch(() => {});
    api.get(`/institution/review-load?engagement_id=${cohortId}`).then(r => setLoad(r.data)).catch(() => {});
  }, [cohortId]);
  useEffect(() => { refresh(); }, [refresh]);

  const saveContract = async () => {
    try { await api.put('/institution/review-contract', { review_minutes_per_100: Number(contract) }); setContract(''); refresh(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{t('inst.review.facultyReview')}</h1>
          <span className="ln-sub">{t('inst.review.blindReviewChecksEvaluator')}</span>
        </div>
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>{t('inst.review.cohort')}</span>
          <Select value={cohortId} onChange={e => setCohortId(e.target.value)}>{cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></label>
        <div className="ln-pilltabs" role="tablist">
          {[['queue', `Queue${queue ? ` · ${queue.items.length}` : ''}`], ['calibration', t('inst.review.calibration')], ['load', t('inst.review.reviewLoad')]].map(([id, label]) => (
            <button key={id} type="button" role="tab" className="ln-pilltab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'queue' && (
        <section className="ln-col" style={{ gap: 14 }}>
          <div className="ln-note" role="note"><b>{t('inst.review.integrityFlagsReasonTalk')}</b> {' '}{t('inst.review.flagMeansAnswerLooked')}</div>
          {queue?.cap_reached && <div className="ln-note">{t('inst.review.weekSContractedReview')}</div>}
          {done.map(d => (
            <div key={d.item.id} className="ln-card ln-card-sm" role="status" style={{ gap: 4 }}>
              <span><b>{t('inst.review.saved')}</b> {d.item.node} — {d.item.learner ? `${d.item.learner.name} (${d.item.learner.learner_ref})` : ''}</span>
              <span className="ln-small ln-muted">{d.outcome.recheck ? t('inst.review.disagreedPassStudentWill') : d.outcome.lifted ? t('inst.review.agreedOnACalibrated') : d.outcome.provisionalCleared ? t('inst.review.agreedTheProvisionalPass') : t('inst.review.recorded')}</span>
            </div>
          ))}
          {queue && queue.items.length === 0 && <div className="ln-card ln-muted">{t('inst.review.nothingReviewCohortRight')}</div>}
          {(queue?.items || []).map(item => (
            <ReviewCard key={item.id} item={item} canDecide={role !== 'viewer'} onDone={(r) => { setDone(d => [r, ...d].slice(0, 5)); refresh(); }} />
          ))}
          <span className="ln-xs ln-muted">{t('inst.review.about')}{' '} {queue?.minutes_per_review || 2} {' '}{t('inst.review.minutesPerReviewEvery')}</span>
        </section>
      )}

      {tab === 'calibration' && cal && (
        <section className="ln-card" style={{ gap: 12 }}>
          <span className="ln-small ln-muted">{t('inst.review.agreementBetweenFacultyBands', { min_n: cal.rule.min_n, min_lower: cal.rule.min_lower, min_point: cal.rule.min_point })}</span>
          <div className="ln-tablewrap"><table className="ln-table">
            <thead><tr><th>{t('inst.review.node')}</th><th>{t('inst.review.reviews')}</th><th>{t('inst.review.weighted')}</th><th>{t('inst.review.90Interval')}</th><th>{t('inst.review.status')}</th></tr></thead>
            <tbody>{cal.nodes.map(n => (
              <tr key={n.node_id}><td>{n.node}<span className="ln-xs ln-muted" style={{ display: 'block' }}>{n.cluster}</span></td><td>{n.n}</td>
                <td>{n.kappa == null ? '—' : n.kappa.toFixed(2)}</td><td>{n.lower == null ? '—' : `${n.lower.toFixed(2)} – ${n.upper.toFixed(2)}`}</td>
                <td><span className={`ln-tag ${CAL[n.status][1]}`}>{t(CAL[n.status][0])}</span></td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {tab === 'load' && load && (
        <section className="ln-grid ln-g-2" style={{ gap: 16 }}>
          <div className="ln-card" style={{ gap: 10 }}>
            <span className="ln-kicker">{t('inst.review.forecast')}</span>
            <span className="ln-stat">{t('inst.review.forecastMinutesPerWeek', { forecast_minutes_per_week: load.forecast_minutes_per_week })}</span>
            <span className="ln-small ln-muted">{t('inst.review.learnersStudentsNodesNodes', { learners: load.learners, nodes: load.nodes, weeks: load.weeks, expected_checks_per_week: load.expected_checks_per_week, round: Math.round(load.decision_rate * 100) })}{load.decision_rate_source === 'prior' ? t('inst.review.startingEstimate') : t('inst.review.measured')}{t('inst.review.plusCalibrationSample')}</span>
            <span className="ln-small">{t('inst.review.contracted')}{' '} <b>{load.contracted_minutes_per_week == null ? t('inst.review.notSet') : t('inst.review.minPerWeek', { n: load.contracted_minutes_per_week })}</b> {' '}{t('inst.review.usedWeekMinutesUsed', { minutes_used_this_week: load.minutes_used_this_week, open_items: load.open_items })}</span>
            <div className={load.over_contract ? 'ln-error' : 'ln-note'}>{load.advice}</div>
          </div>
          {role === 'admin' && (
            <div className="ln-card" style={{ gap: 10 }}>
              <span className="ln-kicker">{t('inst.review.contractedReviewTime')}</span>
              <span className="ln-small ln-muted">{t('inst.review.minutesFacultyReviewPer')}</span>
              <div className="ln-row" style={{ gap: 8 }}>
                <input className="ln-input" type="number" min="0" placeholder={load.contracted_minutes_per_100 != null ? t('inst.review.nowN', { n: load.contracted_minutes_per_100 }) : t('inst.review.eg120')} value={contract} onChange={e => setContract(e.target.value)} aria-label={t('inst.review.minutesPer100Students')} />
                <button type="button" className="ln-btn ln-btn-primary" disabled={contract === ''} onClick={saveContract}>{t('inst.review.save')}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
