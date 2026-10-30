// src/components/learn/BackBar.js — the Back button and breadcrumb at the top
// of every learner page except Home (rendered once by LearnerLayout).
//   Home › Skill path › JavaScript Core › Array methods
// Back returns to where the learner came from: the page that opened this one
// (router state `from`, or ?from=), else the previous page in this visit,
// else the page's logical parent (a skill page → Skill path, a lesson → its
// course, a Passport skill → Passport). Pages name their own crumbs with
// usePageCrumbs([...]) when the trail has names only they know.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';

// path → [label key, parent path]. The first match wins.
const ROUTES = [
  [/^\/learn\/record$/, 'nav.path', '/learn/dashboard'],
  [/^\/learn\/skill\/[^/]+$/, 'nav.skill', '/learn/record'],
  [/^\/learn\/history$/, 'nav.history', '/learn/record'],
  [/^\/learn\/reviews$/, 'nav.reviews', '/learn/dashboard'],
  [/^\/learn\/assigned$/, 'nav.assigned', '/learn/dashboard'],
  [/^\/learn\/passport$/, 'nav.passport', '/learn/dashboard'],
  [/^\/learn\/readiness$/, 'nav.readiness', '/learn/passport'],
  [/^\/learn\/courses$/, 'nav.courses', '/learn/dashboard'],
  [/^\/learn\/courses\/[^/]+$/, 'nav.course', '/learn/courses'],
  [/^\/learn\/lesson\/[^/]+$/, 'nav.lesson', '/learn/courses'],
  [/^\/learn\/modules\/[^/]+\/(test|project)$/, 'nav.module', '/learn/courses'],
  [/^\/learn\/jobs$/, 'nav.jobs', '/learn/dashboard'],
  [/^\/learn\/market$/, 'nav.market', '/learn/jobs'],
  [/^\/learn\/market\/[^/]+\/interview$/, 'nav.interview', '/learn/market'],
  [/^\/learn\/market\/[^/]+$/, 'nav.jobPost', '/learn/market'],
  [/^\/learn\/topics$/, 'nav.topics', '/learn/jobs'],
  [/^\/learn\/apply\/[^/]+$/, 'nav.apply', '/learn/jobs'],
  [/^\/learn\/requests\/[^/]+$/, 'nav.request', '/learn/jobs'],
  [/^\/learn\/dayone$/, 'nav.dayone', '/learn/jobs'],
  [/^\/learn\/profile$/, 'nav.profile', '/learn/dashboard'],
  [/^\/learn\/resume$/, 'nav.resume', '/learn/profile'],
  [/^\/learn\/settings$/, 'nav.settings', '/learn/profile'],
  [/^\/learn\/notifications$/, 'nav.notifications', '/learn/settings'],
  [/^\/learn\/welcome$/, 'nav.welcome', '/learn/dashboard'],
  [/^\/learn\/baseline$/, 'nav.baseline', '/learn/dashboard']
];
const routeOf = (path) => ROUTES.find(([re]) => re.test(path)) || null;

/** The parent page for a path (for Back when there is no history). */
export function parentOf(path) {
  const r = routeOf(path);
  return r ? r[2] : '/learn/dashboard';
}

// The default trail: Home, then each parent up to this page.
function trailFor(path) {
  const out = [];
  let p = path;
  const seen = new Set();
  while (p && p !== '/learn/dashboard' && !seen.has(p)) {
    seen.add(p);
    const r = routeOf(p);
    if (!r) break;
    out.unshift({ key: r[1], to: p });
    p = r[2];
  }
  return [{ key: 'nav.home', to: '/learn/dashboard' }, ...out];
}

const CrumbsContext = createContext({ set: () => {} });

/** A page's own trail (names it knows), e.g. [{ label: 'Python', to: '/learn/courses/python' }, { label: 'Return values' }]. */
export function usePageCrumbs(crumbs) {
  const { set } = useContext(CrumbsContext);
  const key = JSON.stringify(crumbs || null);
  useEffect(() => { set(crumbs || null); return () => set(null); }, [key]);
}

/** Where Back goes: the opener, else the previous page, else the parent. */
export function useBack(fallback) {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    const from = location.state?.from || new URLSearchParams(location.search).get('from');
    if (from && from.startsWith('/learn')) navigate(from);
    else if ((window.history.state?.idx || 0) > 0) navigate(-1);
    else navigate(fallback || parentOf(location.pathname));
  };
}

export function CrumbsProvider({ children }) {
  const [crumbs, setCrumbs] = useState(null);
  const value = useMemo(() => ({ set: setCrumbs, crumbs }), [crumbs]);
  return <CrumbsContext.Provider value={value}>{children}</CrumbsContext.Provider>;
}

export default function BackBar() {
  const { t } = useUiLang();
  const location = useLocation();
  const { crumbs } = useContext(CrumbsContext);
  const back = useBack();
  if (location.pathname === '/learn/dashboard') return null;
  const page = crumbs
    ? [{ key: 'nav.home', to: '/learn/dashboard' }, ...crumbs]
    : trailFor(location.pathname);
  return (
    <div className="lj-backbar" data-backbar>
      <button type="button" className="lj-back" onClick={back} aria-label={t('nav.back')} data-back>
        <ArrowLeft size={18} aria-hidden="true" /><span className="lj-back-text">{t('nav.back')}</span>
      </button>
      <nav aria-label={t('ui.layout.breadcrumb')} className="lj-crumbs">
        {page.map((c, i) => {
          const label = c.label || t(c.key);
          const last = i === page.length - 1;
          return (
            <span key={`${c.to || ''}${i}`} className="ln-row" style={{ gap: 4, minWidth: 0 }}>
              {!last && c.to ? <Link to={c.to} className="ln-link ln-small">{label}</Link> : <span className="ln-small lj-crumb-now" aria-current="page">{label}</span>}
              {!last && <ChevronRight size={14} aria-hidden="true" />}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
