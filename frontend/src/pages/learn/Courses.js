// src/pages/learn/Courses.js — /learn/courses: two clear parts.
//   My college programme: the path the college set, with a link to it.
//   Explore topics: every course as its own path (Python, Java, …), with My
//   topics first: the courses this learner picked, each with its progress
//   and next lesson. Draft courses say they still need faculty review.
import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, School, ArrowRight, Clock, Layers } from 'lucide-react';
import { useCachedGet } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { LoadingRows } from '../../components/shared/EmptyState';
import { useUiLang } from '../../context/UiLangContext';
import LearningLangPicker from '../../components/learn/LearningLangPicker';

function CourseCard({ c }) {
  const { t } = useUiLang();
  return (
    <article className="ln-card lj-course" data-course={c.id}>
      <div className="ln-between" style={{ gap: 8, alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 4, minWidth: 0 }}>
          <b style={{ fontSize: 'var(--fs-h3)' }}>{c.title}</b>
          <span className="ln-xs ln-muted ln-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className="ln-row" style={{ gap: 4 }}><Layers size={13} aria-hidden="true" />{t('lj.courses.shape', { m: c.modules, l: c.lessons })}</span>
            <span className="ln-row" style={{ gap: 4 }}><Clock size={13} aria-hidden="true" />{t('lj.courses.hours', { h: c.hours })}</span>
            <span>{c.level}</span>
          </span>
        </div>
        {c.status === 'draft' && <span className="ln-tag ln-tag-warning">{t('lj.courses.draft')}</span>}
        {c.added && <span className="ln-tag ln-tag-info">{t('lj.courses.inMyTopics')}</span>}
      </div>
      <p className="ln-small" style={{ margin: 0 }}>{c.summary}</p>
      {c.added && (
        <div className="ln-col" style={{ gap: 4 }}>
          <div className="ln-bar" role="progressbar" aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('lj.courses.progress', { title: c.title })}><span style={{ width: `${c.pct}%` }} /></div>
          <span className="ln-xs ln-muted">{t('lj.courses.pct', { pct: c.pct })}</span>
        </div>
      )}
      <Link className="ln-btn ln-btn-sm" to={`/learn/courses/${c.id}`} style={{ alignSelf: 'flex-start' }}>
        {c.added ? t('lj.courses.open') : t('lj.courses.see')}<ArrowRight size={14} aria-hidden="true" />
      </Link>
    </article>
  );
}

export default function Courses() {
  const { t } = useUiLang();
  const { data, error, reload } = useCachedGet('/learner/courses');
  if (error && !data) return <div className="ln-error">{errMsg(error)}</div>;
  if (!data) return <LoadingRows rows={4} />;
  const mine = data.courses.filter(c => c.added);
  const ready = data.courses.filter(c => !c.added && c.status !== 'draft');
  const drafts = data.courses.filter(c => !c.added && c.status === 'draft');
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{t('lj.courses.title')}</h1>
          <span className="ln-sub">{t('lj.courses.sub')}</span>
        </div>
        <LearningLangPicker onChange={reload} />
      </header>

      <section className="ln-card ln-card-warm ln-between ln-wrap" style={{ gap: 10 }} aria-label={t('lj.courses.programme')}>
        <span className="ln-row" style={{ gap: 10 }}><School size={20} aria-hidden="true" /><span className="ln-col" style={{ gap: 2 }}><b>{t('lj.courses.programme')}</b><span className="ln-small">{t('lj.courses.programmeSub')}</span></span></span>
        <Link className="ln-btn ln-btn-sm" to="/learn/record" state={{ from: '/learn/courses' }}>{t('lj.courses.openProgramme')}</Link>
      </section>

      {mine.length > 0 && (
        <section className="ln-col" style={{ gap: 12 }} aria-label={t('lj.courses.mine')} data-my-topics>
          <h2 className="ln-h2">{t('lj.courses.mine')}</h2>
          <div className="ln-grid ln-g-2" style={{ gap: 14 }}>{mine.map(c => <CourseCard key={c.id} c={c} />)}</div>
        </section>
      )}

      <section className="ln-col" style={{ gap: 12 }} aria-label={t('lj.courses.explore')}>
        <h2 className="ln-h2 ln-row" style={{ gap: 8 }}><BookOpen size={20} aria-hidden="true" />{t('lj.courses.explore')}</h2>
        <span className="ln-small ln-muted">{t('lj.courses.exploreSub')}</span>
        <div className="ln-grid ln-g-2" style={{ gap: 14 }}>{ready.map(c => <CourseCard key={c.id} c={c} />)}</div>
      </section>

      {drafts.length > 0 && (
        <section className="ln-col" style={{ gap: 12 }} aria-label={t('lj.courses.drafts')}>
          <h2 className="ln-h2">{t('lj.courses.drafts')}</h2>
          <span className="ln-small ln-muted">{t('lj.courses.draftsSub')}</span>
          <div className="ln-grid ln-g-2" style={{ gap: 14 }}>{drafts.map(c => <CourseCard key={c.id} c={c} />)}</div>
        </section>
      )}
    </>
  );
}
