// src/pages/learn/History.js — /learn/history: every check, review, practice
// item, work task, spoken challenge and Day-One run, with the date, the
// result, the evidence level, the authorship and the marker's feedback.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';
import { PageHeader, Skeleton, Select } from '../../components/shared/ui';
import { CodeTag } from '../../components/shared/Popover';
import { fmtDate } from '../../components/learn/evidenceText';

const KINDS = ['all', 'check', 'review', 'practice', 'task', 'challenge', 'dayone'];

export default function History() {
  const { t } = useUiLang();
  const [params] = useSearchParams();
  const node = params.get('node');
  const [rows, setRows] = useState(null);
  const [kind, setKind] = useState('all');
  const [error, setError] = useState('');
  useEffect(() => { api.get('/learner/history', { params: node ? { node } : {} }).then(r => setRows(r.data.attempts)).catch(e => setError(errMsg(e))); }, [node]);
  const shown = useMemo(() => (rows || []).filter(r => kind === 'all' || r.kind === kind), [rows, kind]);
  return (
    <>
      <PageHeader title={t('lj.history.title')} subtitle={t('lj.history.sub')}
        actions={<Select value={kind} onChange={e => setKind(e.target.value)} aria-label={t('lj.history.filter')}>{KINDS.map(k => <option key={k} value={k}>{t(k === 'all' ? 'lj.history.all' : `lj.kind.${k}`)}</option>)}</Select>} />
      {error && <div className="ln-error" role="alert">{error}</div>}
      {!rows && !error && <Skeleton lines={6} card />}
      {rows && !shown.length && <div className="ln-card ln-muted">{t('lj.history.none')}</div>}
      <ol className="lj-history">
        {shown.map(a => (
          <li key={`${a.kind}-${a.id}`} className="ln-card ln-col" style={{ gap: 6 }} data-kind={a.kind}>
            <div className="ln-between ln-wrap" style={{ gap: 8 }}>
              <b>{a.node_id ? <Link className="ln-link" to={`/learn/skill/${a.node_id}?tab=progress`}>{a.skill}</Link> : a.skill}</b>
              <span className={`ln-tag ${a.result === 'pass' ? 'ln-tag-success' : a.result === 'partial' ? 'ln-tag-warning' : 'ln-tag-neutral'}`}>{t(`lj.result.${a.result}`)}</span>
            </div>
            <span className="ln-small ln-muted ln-row ln-wrap" style={{ gap: 8 }}>
              <span>{t(`lj.kind.${a.kind}`)}</span><span>{fmtDate(a.date)}</span>
              <CodeTag code={a.evidence} /><CodeTag code={a.authorship} />
            </span>
            {a.feedback && (a.feedback.good || a.feedback.missing || a.feedback.next) && (
              <dl className="lj-feedback ln-small">
                {a.feedback.good && <><dt>{t('lj.feedback.good')}</dt><dd>{a.feedback.good}</dd></>}
                {a.feedback.missing && <><dt>{t('lj.feedback.missing')}</dt><dd>{a.feedback.missing}</dd></>}
                {a.feedback.next && <><dt>{t('lj.feedback.next')}</dt><dd>{a.feedback.next}</dd></>}
              </dl>
            )}
            {a.marker && <span className="ln-small">{t('lj.history.marker', { verdict: t(`lj.result.${a.marker.verdict}`) })}{a.marker.notes ? ` — ${a.marker.notes}` : ''}</span>}
          </li>
        ))}
      </ol>
    </>
  );
}
