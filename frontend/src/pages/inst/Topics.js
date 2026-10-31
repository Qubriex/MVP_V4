// src/pages/inst/Topics.js — /institution/topics
// The topic catalog for a college: every course (Course → Module → Lesson),
// hours, how students are checked, how many of our students are on it, and for
// each lesson its review state per language (English / Telugu / Hindi) and the
// 👍/👎 feedback learners gave. Open a lesson to read it in any language; a
// professor or admin marks it Reviewed (learners of this college then see
// "Reviewed by [college] faculty") or suggests an edit.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ThumbsUp, ThumbsDown, Check, ExternalLink } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useStaff } from '../../components/inst/InstitutionLayout';
import { useUiLang } from '../../context/UiLangContext';
import { LoadingRows } from '../../components/shared/EmptyState';
import LessonReadout from '../../components/learn/LessonReadout';

const LANGS = [['english', 'en', 'lang.english'], ['telugu', 'te', 'lang.telugu'], ['hindi', 'hi', 'lang.hindi']];

function ReviewPanel({ lessonId, canReview, onChanged }) {
  const { t } = useUiLang();
  const [language, setLanguage] = useState('english');
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [suggest, setSuggest] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api.get(`/institution/topics/lessons/${lessonId}?language=${language}`).then(r => setD(r.data)).catch(e => setError(errMsg(e, t('inst.topics.loadFail'))));
  useEffect(() => { setD(null); load(); }, [lessonId, language]); // eslint-disable-line

  const send = (status) => api.post(`/institution/topics/lessons/${lessonId}/review`, { language, status, suggestion: suggest })
    .then(() => { setMsg(t(status === 'reviewed' ? 'inst.topics.markedReviewed' : 'inst.topics.suggestionSent')); setSuggest(''); load(); onChanged(); })
    .catch(e => setMsg(errMsg(e, t('inst.topics.saveFail'))));

  const code = LANGS.find(l => l[0] === language)[1];
  return (
    <section className="ln-card ln-col" style={{ gap: 12 }} data-review-panel={lessonId}>
      <div className="ln-row ln-wrap" style={{ gap: 6 }} role="group" aria-label={t('inst.topics.readIn')}>
        <span className="ln-small ln-muted">{t('inst.topics.readIn')}</span>
        {LANGS.map(([v, , key]) => (
          <button key={v} type="button" className={`ln-btn ln-btn-sm ${language === v ? 'ln-btn-primary' : ''}`} aria-pressed={language === v} onClick={() => setLanguage(v)} data-review-lang={v}>{t(key)}</button>
        ))}
      </div>
      {error && <div className="ln-error">{error}</div>}
      {!d && !error && <LoadingRows rows={3} />}
      {d && (
        <>
          <b style={{ fontSize: 'var(--fs-h3)' }}>{t('lj.course.lessonN', { m: d.lesson.module_n, n: d.lesson.n })} · {d.lesson.title}</b>
          {!d.lesson.parts
            ? <div className="ln-note">{t('lj.lesson.notInLanguage', { lang: t(LANGS.find(l => l[0] === language)[2]) })}</div>
            : <LessonReadout parts={d.lesson.parts} solution={d.lesson.task_solution}
                checkQuestions={(d.lesson.check_questions || []).map(q => q[code] || q.en)} />}
          {canReview && d.lesson.parts && (
            <div className="ln-col" style={{ gap: 8 }}>
              <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => send('reviewed')} data-mark-reviewed>
                <Check size={16} aria-hidden="true" />{t('inst.topics.markReviewed', { lang: t(LANGS.find(l => l[0] === language)[2]) })}</button>
              <label className="ln-col" style={{ gap: 4 }}>
                <span className="ln-small">{t('inst.topics.suggestLabel')}</span>
                <textarea className="ln-input" rows={3} value={suggest} onChange={e => setSuggest(e.target.value)} data-suggest-text />
              </label>
              <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} disabled={!suggest.trim()} onClick={() => send('suggested')} data-suggest>{t('inst.topics.suggestEdit')}</button>
            </div>
          )}
          {msg && <div className="ln-note" role="status">{msg}</div>}
          <div className="ln-col" style={{ gap: 6 }}>
            <b className="ln-small">{t('inst.topics.feedback')}</b>
            {d.feedback.length === 0 && <span className="ln-small ln-muted">{t('inst.topics.noFeedback')}</span>}
            {d.feedback.map((f, i) => (
              <span key={i} className="ln-small">{f.vote > 0 ? '👍' : '👎'} {f.part ? `${f.part} · ` : ''}{f.comment || ''} <span className="ln-xs ln-muted">{f.language || ''}</span></span>
            ))}
          </div>
          {d.reviews.length > 0 && (
            <div className="ln-col" style={{ gap: 6 }}>
              <b className="ln-small">{t('inst.topics.history')}</b>
              {d.reviews.map((r, i) => <span key={i} className="ln-small">{t(r.status === 'reviewed' ? 'inst.topics.statusReviewed' : 'inst.topics.statusSuggested')} · {r.language}{r.suggestion ? ` — ${r.suggestion}` : ''}</span>)}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function Topics() {
  const { t } = useUiLang();
  const { role } = useStaff();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');
  const [openCourse, setOpenCourse] = useState('python');
  const [openLesson, setOpenLesson] = useState(null);
  const canReview = role === 'admin' || role === 'professor';
  const load = () => api.get('/institution/topics').then(r => setCourses(r.data.courses)).catch(e => setError(errMsg(e, t('inst.topics.loadFail'))));
  useEffect(() => { load(); }, []); // eslint-disable-line

  if (error) return <div className="ln-error">{error}</div>;
  if (!courses) return <LoadingRows rows={5} />;
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{t('inst.topics.title')}</h1>
          <span className="ln-sub">{t('inst.topics.sub')}</span>
        </div>
        <a className="ln-btn ln-btn-sm" href="/topics" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" />{t('inst.topics.publicPage')}</a>
      </header>
      <div className="ln-col" style={{ gap: 12 }}>
        {courses.map(c => {
          const open = openCourse === c.id;
          const lessons = c.modules.reduce((a, m) => a + m.lessons.length, 0);
          return (
            <article key={c.id} className="ln-card ln-col" style={{ gap: 10 }} data-topic-course={c.id}>
              <button type="button" className="lj-module-head" onClick={() => setOpenCourse(open ? null : c.id)} aria-expanded={open}>
                <span className="ln-col" style={{ gap: 2, flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <b>{c.title} {c.status === 'draft' && <span className="ln-tag ln-tag-warning">{t('lj.courses.draft')}</span>}</b>
                  <span className="ln-xs ln-muted">{t('lj.courses.shape', { m: c.modules.length, l: lessons })} · {t('lj.courses.hours', { h: c.hours })} · {t('inst.topics.students', { n: c.students })}</span>
                </span>
                <ChevronDown size={18} aria-hidden="true" className="lj-chev" />
              </button>
              {open && (
                <div className="ln-col" style={{ gap: 10 }}>
                  <span className="ln-small">{c.summary}</span>
                  <span className="ln-xs ln-muted">{t('inst.topics.checkedBy')}</span>
                  {c.status === 'draft' && <div className="ln-note">{t('lj.courses.draftNote')}</div>}
                  {c.modules.map(m => (
                    <div key={m.id} className="ln-col" style={{ gap: 6 }}>
                      <b className="ln-small">{t('lj.course.moduleN', { n: m.n })} · {m.title}</b>
                      {m.lessons.length === 0 && <span className="ln-xs ln-muted">{m.summary}</span>}
                      <ul className="lj-lessons">
                        {m.lessons.map(l => (
                          <li key={l.id} data-topic-lesson={l.id} style={{ flexWrap: 'wrap' }}>
                            <button type="button" className="ln-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => setOpenLesson(openLesson === l.id ? null : l.id)} aria-expanded={openLesson === l.id}>
                              {t('lj.course.lessonN', { m: m.n, n: l.n })} · {l.title}</button>
                            <span className="ln-row" style={{ gap: 4 }}>
                              {LANGS.map(([v, code]) => <span key={v} className={`ln-tag ${l.reviewed[v] ? 'ln-tag-success' : ''}`} title={t(l.reviewed[v] ? 'inst.topics.statusReviewed' : 'inst.topics.notReviewed')}>{code.toUpperCase()}{l.reviewed[v] ? ' ✓' : ''}</span>)}
                            </span>
                            <span className="ln-xs ln-muted ln-row" style={{ gap: 6 }}>
                              <ThumbsUp size={12} aria-hidden="true" /><span data-up={l.feedback.up}>{l.feedback.up}</span><ThumbsDown size={12} aria-hidden="true" /><span data-down={l.feedback.down}>{l.feedback.down}</span>
                              {l.suggestions > 0 && ` · ${t('inst.topics.suggestionsN', { n: l.suggestions })}`}
                            </span>
                            {openLesson === l.id && <div style={{ flexBasis: '100%' }}><ReviewPanel lessonId={l.id} canReview={canReview} onChanged={load} /></div>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="ln-xs ln-muted">{t('inst.topics.programmeNote')} <Link className="ln-link" to="/institution/cohorts/new">{t('inst.topics.newCohort')}</Link></p>
    </>
  );
}
