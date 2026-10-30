// src/pages/learn/Course.js — /learn/courses/:courseId: one course in order.
// Summary, hours and level; modules as an accordion (Module 3 · Functions),
// each with its numbered lessons and their status (Not started, In progress,
// Known, Done, Confirmed), the module test, the project and the module's
// progress. Add to my topics, Start Module 1 / Continue. Any lesson can be
// started; the one before it is suggested, never locked.
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Circle, CircleDot, ClipboardCheck, Hammer, Plus, Play, ChevronDown, ShieldCheck } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { LoadingRows } from '../../components/shared/EmptyState';
import { useUiLang } from '../../context/UiLangContext';
import { usePageCrumbs } from '../../components/learn/BackBar';
import LearningLangPicker from '../../components/learn/LearningLangPicker';

const STATUS_ICON = { not_started: Circle, in_progress: CircleDot, known: CheckCircle2, done: CheckCircle2, confirmed: ShieldCheck };
const STATUS_TAG = { not_started: 'ln-tag-neutral', in_progress: 'ln-tag-info', known: 'ln-tag-success', done: 'ln-tag-success', confirmed: 'ln-tag-success' };

export default function CoursePage() {
  const { t } = useUiLang();
  const { courseId } = useParams();
  const { data: c, error, reload } = useCachedGet(`/learner/courses/${courseId}`);
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState('');
  usePageCrumbs(c ? [{ key: 'nav.courses', to: '/learn/courses' }, { label: c.title }] : null);
  if (error && !c) return <div className="ln-error">{errMsg(error)}</div>;
  if (!c) return <LoadingRows rows={5} />;
  const p = c.progress;
  const firstModule = c.modules[0];
  const nextId = p.last_lesson_id && p.lessons[p.last_lesson_id]?.status === 'in_progress' ? p.last_lesson_id : p.next_lesson_id;
  const openId = open || c.modules.find(m => m.lessons.some(l => l.id === nextId))?.id || firstModule?.id;
  const add = async () => {
    try { await api.post(`/learner/courses/${c.id}/add`); dropCached('/learner/courses'); reload(); setMsg(t('lj.course.added')); } catch (e) { setMsg(errMsg(e)); }
  };
  const from = `/learn/courses/${c.id}`;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4, minWidth: 0 }}>
          <h1 className="ln-title">{c.title}</h1>
          <span className="ln-sub">{c.summary}</span>
          <span className="ln-small ln-muted">{t('lj.courses.shape', { m: c.modules.length, l: c.modules.reduce((a, m) => a + m.lessons.length, 0) })} · {t('lj.courses.hours', { h: c.hours })} · {c.level}</span>
        </div>
        <div className="ln-col" style={{ gap: 8, alignItems: 'flex-end' }}>
          <LearningLangPicker onChange={reload} />
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            {!p.added && <button type="button" className="ln-btn" onClick={add} data-add-course><Plus size={16} aria-hidden="true" />{t('lj.course.add')}</button>}
            {nextId && <Link className="ln-btn ln-btn-primary" to={`/learn/lesson/${nextId}`} state={{ from }} data-continue>
              <Play size={16} aria-hidden="true" />{p.done ? t('lj.course.continue') : t('lj.course.startModule1')}</Link>}
          </div>
        </div>
      </header>
      {c.status === 'draft' && <div className="ln-note" role="note">{t('lj.courses.draftNote')}</div>}
      {msg && <div className="ln-note" role="status">{msg}</div>}

      <section className="ln-card ln-col" style={{ gap: 6 }} aria-label={t('lj.course.progress')}>
        <div className="ln-between"><b>{t('lj.course.progress')}</b><span className="ln-small">{t('lj.course.done', { n: p.done, total: p.total })}</span></div>
        <div className="ln-bar" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('lj.course.progress')}><span style={{ width: `${p.pct}%` }} /></div>
      </section>

      <section className="ln-col" style={{ gap: 10 }} aria-label={t('lj.course.modules')}>
        {c.modules.map(m => {
          const mp = p.modules[m.id] || {};
          const isOpen = openId === m.id;
          return (
            <article key={m.id} className={`ln-card lj-module ${isOpen ? 'is-open' : ''}`} data-module={m.id}>
              <button type="button" className="lj-module-head" onClick={() => setOpen(isOpen ? '-' : m.id)} aria-expanded={isOpen}>
                <span className="lj-module-n">{t('lj.course.moduleN', { n: m.n })}</span>
                <span className="ln-col" style={{ gap: 2, flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <b>{m.title}</b>
                  <span className="ln-xs ln-muted">{t('lj.course.moduleProgress', { done: mp.lessons_done || 0, total: mp.lessons_total || m.lessons.length })}{mp.completed ? ` · ${t('lj.course.onPassport')}` : ''}</span>
                </span>
                {mp.completed && <ShieldCheck size={18} aria-hidden="true" style={{ color: 'var(--status-success)' }} />}
                <ChevronDown size={18} aria-hidden="true" className="lj-chev" />
              </button>
              {isOpen && (
                <div className="ln-col" style={{ gap: 6 }}>
                  {m.summary && <p className="ln-small" style={{ margin: 0 }}>{m.summary}</p>}
                  <ol className="lj-lessons">
                    {m.lessons.map(l => {
                      const st = p.lessons[l.id]?.status || 'not_started';
                      const Icon = STATUS_ICON[st];
                      return (
                        <li key={l.id} data-lesson={l.id} data-status={st}>
                          <Icon size={18} aria-hidden="true" className={`lj-st is-${st}`} />
                          <Link to={`/learn/lesson/${l.id}`} state={{ from }} className="ln-link">{t('lj.course.lessonN', { m: m.n, n: l.n })} · {l.title}</Link>
                          <span className={`ln-tag ${STATUS_TAG[st]}`}>{t(`lj.status.${st}`)}</span>
                          <span className="ln-xs ln-muted">{t('lj.course.minutes', { n: l.minutes })}</span>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="lj-module-end">
                    {m.has_test && <Link className="ln-btn ln-btn-sm" to={`/learn/modules/${m.id}/test`} state={{ from }} data-module-test>
                      <ClipboardCheck size={14} aria-hidden="true" />{t('lj.course.moduleTest')}{mp.test_passed ? ' ✓' : ''}</Link>}
                    {m.has_project && <Link className="ln-btn ln-btn-sm" to={`/learn/modules/${m.id}/project`} state={{ from }} data-module-project>
                      <Hammer size={14} aria-hidden="true" />{t('lj.course.project')}{mp.project_passed ? ' ✓' : ''}</Link>}
                    <span className="ln-xs ln-muted">{t('lj.course.moduleEnd')}</span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </>
  );
}
