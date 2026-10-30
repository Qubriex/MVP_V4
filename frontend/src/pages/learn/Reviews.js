// src/pages/learn/Reviews.js — /learn/reviews
// Spaced reviews and rechecks (v4.3 §8, §7.8). A review is a short question on
// a skill you mastered earlier; every review, pass or fail, is a dated
// demonstration on your passport. A recheck is a fresh question your
// professor asked for after reviewing an earlier answer. ?warmup=1 runs the
// session warm-ups (up to 2 due reviews) and then returns to the lesson.
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RotateCcw, CalendarClock, CheckCircle2, Flame, Timer } from 'lucide-react';
import { WhyThis } from '../../components/shared/Popover';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import AnswerBox from '../../components/learn/AnswerBox';
import { fmtDate } from '../../components/learn/evidenceText';

import { useUiLang } from '../../context/UiLangContext';
import LearningLangPicker from '../../components/learn/LearningLangPicker';
export default function Reviews() {
  const { t } = useUiLang();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const warmup = params.get('warmup') === '1';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null); // { node_id, node_label, kind, instance_id, question }
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [done, setDone] = useState(0);

  const load = useCallback(() => api.get('/learner/reviews/due').then(r => setData(r.data)).catch(e => setError(errMsg(e, t('learn.reviews.couldNotLoadReviews')))), []);
  useEffect(() => { load(); }, [load]);

  const start = async (item) => {
    setError(''); setOutcome(null); setBusy(true);
    try {
      const r = await api.post(`/learner/reviews/${item.node_id}/start`);
      setActive({ ...item, instance_id: r.data.instance_id, question: r.data.question, kind: r.data.kind });
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };

  const answer = async (text, provenance, clear) => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/learner/reviews/instances/${active.instance_id}/answer`, { answer: text, provenance });
      if (r.data.result === 'hold') {
        setOutcome({ kind: 'hold', text: t('learn.reviews.needsOwnWordsPasted') });
      } else {
        clear();
        setOutcome({ kind: r.data.passed ? 'pass' : 'fail', feedback: r.data.feedback, next: r.data.next_review_at, provisional: r.data.provisional });
        setActive(null);
        setDone(d => d + 1);
        load();
      }
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };

  const due = data?.due || [];
  const warmupsLeft = warmup ? due.filter(d => (data?.warmups || []).includes(d.node_id)).length : 0;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{warmup ? t('learn.reviews.warmUp') : t('learn.reviews.reviews')}</h1>
          <span className="ln-sub">{warmup ? t('learn.reviews.twoMinutesEarlierSkills') : t('learn.reviews.shortQuestionsKeepSkills')}</span>
        </div>
        <LearningLangPicker onChange={load} />
        {warmup && <button type="button" className="ln-btn ln-btn-primary" onClick={() => navigate('/learn/session', { state: { from: '/learn/reviews' } })}>{warmupsLeft ? t('learn.reviews.skipLesson') : t('learn.reviews.continueLesson')}</button>}
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {!warmup && data && (
        <div className="ln-card ln-card-sm ln-row ln-wrap" style={{ gap: 14 }} data-review-facts>
          <span className="ln-row ln-small" style={{ gap: 6 }}><Timer size={16} aria-hidden="true" />{t('lj.reviews.time')}</span>
          <span className="ln-row ln-small" style={{ gap: 6 }}><Flame size={16} aria-hidden="true" />{data.streak?.days ? t('lj.reviews.streak', { n: data.streak.days }) : t('lj.reviews.noStreak')}</span>
          <WhyThis title={t('lj.reviews.whyTitle')}>{t('lj.reviews.why')}</WhyThis>
          <WhyThis title={t('lj.reviews.skipTitle')} label={t('lj.reviews.skipTitle')}>{t('lj.reviews.skip')}</WhyThis>
        </div>
      )}

      {outcome && (
        <div className={`ln-card ${outcome.kind === 'pass' ? 'ln-card-warm' : ''}`} role="status" style={{ gap: 6 }}>
          {outcome.kind === 'hold' ? <strong>{outcome.text}</strong> : (
            <>
              <strong className="ln-row" style={{ gap: 8 }}>{outcome.kind === 'pass' ? <><CheckCircle2 size={18} aria-hidden="true" />{t('learn.reviews.wellDoneReviewPassed')}</> : t('learn.reviews.notQuiteYetWe')}</strong>
              {outcome.feedback && <span>{outcome.feedback}</span>}
              {outcome.provisional && <span className="ln-small ln-muted">{t('learn.reviews.professorWillDoubleCheck')}</span>}
              {outcome.next && <span className="ln-small ln-muted">{t('learn.reviews.nextReviewSkillFmtdate', { fmtDate: fmtDate(outcome.next) })}</span>}
            </>
          )}
        </div>
      )}

      {active ? (
        <section className="ln-card" style={{ gap: 14 }} aria-label={t('learn.reviews.reviewQuestion')}>
          <div className="ln-between ln-wrap"><span className="ln-kicker">{active.kind === 'recheck' ? t('learn.reviews.recheck') : t('learn.reviews.review')} · {active.node_label}</span>
            <button type="button" className="ln-link" onClick={() => setActive(null)}>{t('learn.reviews.backList')}</button></div>
          <p className="ln-indic" style={{ fontSize: 'var(--fs-h3)', lineHeight: 1.6 }}>{active.question}</p>
          <AnswerBox onSubmit={answer} busy={busy} />
        </section>
      ) : (
        <>
          <section className="ln-col" style={{ gap: 12 }}>
            <h2 className="ln-h2">{t('learn.reviews.dueNow')}{' '} {due.length > 0 && <span className="ln-tag ln-tag-accent">{due.length}</span>}</h2>
            {!data && !error && [0, 1, 2].map(i => (
              <div key={i} className="ln-card ln-skeleton" aria-hidden="true" style={{ height: 76 }} />
            ))}
            {data && due.length === 0 && <div className="ln-card ln-muted">{t('learn.reviews.nothingDue')}{' '} {done > 0 ? t('learn.reviews.niceWorkToday') : t('learn.reviews.reviewsAppearHere3')}</div>}
            {due.map(item => (
              <div key={`${item.kind}-${item.node_id}`} className="ln-card ln-between ln-wrap" style={{ gap: 12 }}>
                <div className="ln-col" style={{ gap: 4 }}>
                  <span style={{ fontWeight: 600 }}>{item.node_label}</span>
                  <span className="ln-small ln-muted">{item.kind === 'recheck' ? t('learn.reviews.professorAskedFreshQuestion') : `${item.cluster_label} · ${t('learn.reviews.dueOn', { date: fmtDate(item.due_at) })}${item.last_result === 'fail' ? ' ' + t('learn.reviews.retry') : ''}`}</span>
                </div>
                <button type="button" className="ln-btn ln-btn-primary" onClick={() => start(item)} disabled={busy}><RotateCcw size={16} aria-hidden="true" />{item.open_instance ? t('learn.reviews.continue') : t('learn.reviews.start')}</button>
              </div>
            ))}
          </section>
          {data?.upcoming?.length > 0 && (
            <section className="ln-col" style={{ gap: 10 }}>
              <h2 className="ln-h2">{t('learn.reviews.comingUp')}</h2>
              <div className="ln-card ln-col" style={{ gap: 8 }}>
                {data.upcoming.map(u => (
                  <div key={u.node_id} className="ln-between"><span>{u.node_label}</span><span className="ln-small ln-muted ln-row" style={{ gap: 6 }}><CalendarClock size={14} aria-hidden="true" />{fmtDate(u.due_at)}</span></div>
                ))}
              </div>
            </section>
          )}
          <p className="ln-small ln-muted">{t('learn.reviews.passportShowsHowFresh')}{' '} <Link className="ln-link" to="/learn/passport">{t('learn.reviews.openPassport')}</Link></p>
        </>
      )}
    </>
  );
}
