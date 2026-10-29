// src/components/learn/journey.js — small pieces the learner journey screens
// share: the result card (what was good / missing / next time, and the label
// change), plain words for stages, pipeline statuses and readiness bands, and
// the three-bar readiness row.
import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDashed, XCircle, ArrowRight } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';
import { LABEL, MISSING } from './evidenceText';

/** A learner-facing text with the test tutor's placeholder replaced. */
export const cleanAiText = (text, t) => (/^mock[:-]/.test(String(text || '')) ? t('lj.testMode') : text);

const RESULT_ICON = { pass: CheckCircle2, partial: CircleDashed, fail: XCircle };

/** Pass / nearly / not yet, the three feedback lines and the label change. */
export function ResultCard({ result, feedback, labelChange, title, children }) {
  const { t } = useUiLang();
  const Icon = RESULT_ICON[result] || CircleDashed;
  const changed = labelChange && labelChange.from !== labelChange.to;
  return (
    <section className={`ln-card lj-result is-${result}`} role="status" aria-live="polite" data-result={result}>
      <strong className="ln-row" style={{ gap: 8, fontSize: 'var(--fs-h3)' }}><Icon size={22} aria-hidden="true" />{title || t(`lj.result.${result}`)}</strong>
      {feedback && (feedback.good || feedback.missing || feedback.next) && (
        <dl className="lj-feedback">
          {feedback.good && <><dt>{t('lj.feedback.good')}</dt><dd>{feedback.good}</dd></>}
          {feedback.missing && <><dt>{t('lj.feedback.missing')}</dt><dd>{feedback.missing}</dd></>}
          {feedback.next && <><dt>{t('lj.feedback.next')}</dt><dd>{feedback.next}</dd></>}
        </dl>
      )}
      {labelChange && (
        <p className="ln-small" style={{ margin: 0 }}>
          {changed
            ? <>{t('lj.labelChanged')} <LabelTag label={labelChange.from} /> <ArrowRight size={14} aria-hidden="true" /> <LabelTag label={labelChange.to} /></>
            : <>{t('lj.labelNow')} <LabelTag label={labelChange.to} /></>}
        </p>
      )}
      {labelChange?.missing_for_confirmed?.length > 0 && labelChange.to !== 'none' && <ConfirmedSteps missing={labelChange.missing_for_confirmed} />}
      {children}
    </section>
  );
}

export function LabelTag({ label }) {
  const { t } = useUiLang();
  const l = LABEL[label] || LABEL.none;
  return <span className={`ln-tag ${l.cls}`}>{t(l.text)}</span>;
}

/** "How to reach Confirmed": the exact missing pieces, in order. */
export function ConfirmedSteps({ missing, nodeId }) {
  const { t } = useUiLang();
  if (!missing?.length) return <p className="ln-small" style={{ margin: 0 }}>{t('lj.confirmed.done')}</p>;
  return (
    <div className="ln-col" style={{ gap: 4 }}>
      <b className="ln-small">{t('lj.confirmed.howTo')}</b>
      <ul className="lj-steps">
        {missing.map(m => <li key={m}>{t(MISSING[m] || 'lj.confirmed.other')}{m === 'second_kind' && nodeId && <> · <Link className="ln-link" to={`/learn/skill/${nodeId}?tab=apply`}>{t('lj.confirmed.openTask')}</Link></>}</li>)}
      </ul>
    </div>
  );
}

/** Plain words for a pipeline stage, as the learner sees it. */
export const STAGE_WORD = {
  watching: 'lj.status.watching', requested: 'lj.status.requested', declined: 'lj.status.declined', access_granted: 'lj.status.accessGranted',
  applied: 'lj.status.applied', shortlisted: 'lj.status.shortlisted', interview: 'lj.status.interview', dayone: 'lj.status.dayone', offer: 'lj.status.offer',
  hired: 'lj.status.hired', hold: 'lj.status.hold', not_now: 'lj.status.notNow', withdrawn: 'lj.status.withdrawn'
};
export function StatusWord({ stage }) {
  const { t } = useUiLang();
  return <span className={`ln-tag ${['offer', 'hired', 'access_granted'].includes(stage) ? 'ln-tag-success' : ['declined', 'not_now', 'withdrawn'].includes(stage) ? 'ln-tag-neutral' : 'ln-tag-info'}`}>{t(STAGE_WORD[stage] || 'lj.status.requested')}</span>;
}

/** Readiness band in words, with how far away: "Building · needs 4 more skills". */
export function ReadinessWords({ band, short }) {
  const { t } = useUiLang();
  const b = band === 'ready' ? 'lj.band.ready' : band === 'nearly' ? 'lj.band.nearly' : 'lj.band.building';
  return <span>{t(b)}{band !== 'ready' && short > 0 ? ` · ${t('lj.band.needs', { n: short })}` : ''}</span>;
}

/** Three bars for one skill: you, your course, what employers ask. */
export function ThreeBars({ skill }) {
  const { t } = useUiLang();
  const row = (key, v, cls) => (
    <div className="lj-bar-row">
      <span className="ln-xs ln-muted">{t(key)}</span>
      <div className={`ln-bar ${cls}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={`${skill.name}: ${t(key)}`}><span style={{ width: `${v}%` }} /></div>
      <span className="ln-xs">{v}</span>
    </div>
  );
  return (
    <div className="lj-bars">
      {row('lj.bars.you', skill.you, 'lj-bar-you')}
      {row('lj.bars.course', skill.course, 'lj-bar-course')}
      {row('lj.bars.employers', skill.employers, 'lj-bar-employers')}
    </div>
  );
}
