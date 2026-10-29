// src/pages/learn/Assigned.js — /learn/assigned: bridge programmes your
// college assigned, with the due date (the re-test), progress, and after the
// re-test "Did it work?".
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';
import { PageHeader, Skeleton } from '../../components/shared/ui';
import { WhyThis } from '../../components/shared/Popover';
import { fmtDate } from '../../components/learn/evidenceText';

export default function Assigned() {
  const { t } = useUiLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/learner/assigned').then(r => setRows(r.data.bridges)).catch(e => setError(errMsg(e))); }, []);
  return (
    <>
      <PageHeader title={t('lj.assigned.title')} subtitle={t('lj.assigned.sub')} />
      {error && <div className="ln-error" role="alert">{error}</div>}
      {!rows && !error && <Skeleton lines={4} card />}
      {rows && !rows.length && <div className="ln-card ln-muted">{t('lj.assigned.none')}</div>}
      {(rows || []).map(b => (
        <section key={b.id} className="ln-card ln-col" style={{ gap: 8 }} data-bridge={b.id}>
          <div className="ln-between ln-wrap" style={{ gap: 8 }}>
            <b>{b.title}</b>
            <span className="ln-small ln-row" style={{ gap: 6 }}><CalendarClock size={14} aria-hidden="true" />{t('lj.assigned.retest', { date: fmtDate(b.retest_at) })}</span>
          </div>
          {b.note && <span className="ln-small ln-muted">{b.note}</span>}
          <div className="ln-bar" role="progressbar" aria-valuenow={b.done} aria-valuemin={0} aria-valuemax={b.total} aria-label={t('lj.assigned.progress', { done: b.done, total: b.total })}><span style={{ width: `${(b.done / Math.max(1, b.total)) * 100}%` }} /></div>
          <span className="ln-small">{t('lj.assigned.progress', { done: b.done, total: b.total })}</span>
          <ul className="lj-steps">
            {b.skills.map(s => <li key={s.id}>{s.mastered ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />} <Link className="ln-link" to={`/learn/skill/${s.id}`}>{s.label}</Link></li>)}
          </ul>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <b className="ln-small">{t('lj.assigned.didItWork')}</b>
            <span className="ln-small">{t(`lj.assigned.outcome.${b.outcome}`)}</span>
            <WhyThis title={t('lj.assigned.didItWork')}>{t('lj.assigned.why')}</WhyThis>
          </div>
          {b.done < b.total && <Link className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} to={`/learn/skill/${b.skills.find(s => !s.mastered).id}`}>{t('lj.assigned.practise')}</Link>}
        </section>
      ))}
    </>
  );
}
