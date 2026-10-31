// src/pages/public/Topics.js — /topics ("See our topics") and
// /topics/sample/:lessonId (the free sample lesson of a course).
// Public, no sign-in: every course with its modules, lessons and hours, and
// one free sample per course, readable in English, Telugu or Hindi.
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import api from '../../utils/api';
import PublicShell from '../../components/public/PublicShell';
import LessonReadout from '../../components/learn/LessonReadout';
import { useUiLang } from '../../context/UiLangContext';

const LANGS = [['english', 'lang.english'], ['telugu', 'lang.telugu'], ['hindi', 'lang.hindi']];
const uiToLearning = { english: 'english', telugu: 'telugu', hindi: 'hindi' };

function LangButtons({ value, onChange }) {
  const { t } = useUiLang();
  return (
    <div className="ln-row ln-wrap" style={{ gap: 6 }} role="group" aria-label={t('pub.topics.readIn')}>
      {LANGS.map(([v, key]) => <button key={v} type="button" className={`ln-btn ln-btn-sm ${value === v ? 'ln-btn-primary' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)} data-lang={v}>{t(key)}</button>)}
    </div>
  );
}

export function TopicSample() {
  const { t, lang: ui } = useUiLang();
  const { lessonId } = useParams();
  const [language, setLanguage] = useState(uiToLearning[ui] || 'english');
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setD(null); setError('');
    api.get(`/catalog/sample/${lessonId}?language=${language}`).then(r => setD(r.data)).catch(() => setError(t('pub.topics.sampleMissing')));
  }, [lessonId, language]); // eslint-disable-line
  return (
    <PublicShell>
      <Link to="/topics" className="ln-link ln-small ln-row" style={{ gap: 4 }}><ArrowLeft size={14} aria-hidden="true" />{t('pub.topics.all')}</Link>
      {error && <div className="ln-error">{error}</div>}
      {d && (
        <>
          <header className="ln-col" style={{ gap: 6 }}>
            <span className="pb-kicker">{t('pub.topics.freeSample')} · {d.course.title}</span>
            <h1 className="ln-title">{t('lj.course.lessonN', { m: d.module_n, n: d.n })} · {d.title}</h1>
            <LangButtons value={language} onChange={setLanguage} />
          </header>
          {d.parts ? <LessonReadout parts={d.parts} /> : <div className="ln-note">{t('lj.lesson.notInLanguage', { lang: t(LANGS.find(l => l[0] === language)[1]) })}</div>}
          <section className="ln-card ln-card-warm" style={{ gap: 8 }}>
            <b>{t('pub.topics.moreTitle')}</b>
            <span className="ln-small">{t('pub.topics.moreText')}</span>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <Link to="/learner-login" className="ln-btn ln-btn-primary ln-btn-sm">{t('pub.topics.startLearning')}</Link>
              <Link to="/colleges" className="ln-btn ln-btn-sm">{t('pub.topics.forColleges')}</Link>
            </div>
          </section>
        </>
      )}
    </PublicShell>
  );
}

export default function Topics() {
  const { t, lang: ui } = useUiLang();
  const [language, setLanguage] = useState(uiToLearning[ui] || 'english');
  const [courses, setCourses] = useState(null);
  useEffect(() => { api.get(`/catalog?language=${language}`).then(r => setCourses(r.data.courses)).catch(() => setCourses([])); }, [language]);
  return (
    <PublicShell>
      <header className="ln-col" style={{ gap: 8 }}>
        <span className="pb-kicker">{t('pub.topics.kicker')}</span>
        <h1 className="ln-title">{t('pub.topics.title')}</h1>
        <span className="ln-sub">{t('pub.topics.sub')}</span>
        <LangButtons value={language} onChange={setLanguage} />
      </header>
      {!courses && <span className="ln-muted">{t('pub.topics.loading')}</span>}
      <section className="ln-grid ln-g-2" style={{ gap: 16 }}>
        {(courses || []).map(c => {
          const lessons = c.modules.reduce((a, m) => a + m.lessons.length, 0);
          return (
            <article key={c.id} className="ln-card" style={{ gap: 10 }} data-public-course={c.id}>
              <div className="ln-between"><b style={{ fontSize: 'var(--fs-h3)' }}>{c.title}</b>
                {c.status === 'draft' ? <span className="ln-tag ln-tag-warning">{t('lj.courses.draft')}</span> : <span className="ln-tag ln-tag-success">{t('pub.topics.ready')}</span>}</div>
              <span className="ln-small">{c.summary}</span>
              <span className="ln-xs ln-muted">{t('lj.courses.shape', { m: c.modules.length, l: lessons })} · {t('lj.courses.hours', { h: c.hours })} · {c.level}</span>
              <ol className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 2 }}>
                {c.modules.map(m => <li key={m.id}>{m.title}{m.lessons.length ? ` (${m.lessons.length})` : ''}</li>)}
              </ol>
              {c.sample_lesson_id
                ? <Link to={`/topics/sample/${c.sample_lesson_id}`} className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }} data-sample-link>
                    <BookOpen size={14} aria-hidden="true" />{t('pub.topics.trySample')}</Link>
                : <span className="ln-xs ln-muted" style={{ marginTop: 'auto' }}>{t('pub.topics.sampleSoon')}</span>}
            </article>
          );
        })}
      </section>
      <p className="ln-xs ln-muted">{t('pub.topics.howChecked')}</p>
    </PublicShell>
  );
}
