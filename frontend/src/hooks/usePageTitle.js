// src/hooks/usePageTitle.js — one document.title per route, in the selected
// interface language: "Page — Qubirex". RouteTitle (mounted once inside the
// router) picks the title from the path; a page can call usePageTitle(text)
// to set something more specific, such as a cohort or role name.
import { useEffect } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { useUiLang } from '../context/UiLangContext';

// Most specific first.
const TITLES = [
  ['/', 'title.home'], ['/pricing', 'title.pricing'], ['/learners', 'title.learners'], ['/colleges', 'title.colleges'], ['/employers', 'title.employers'],
  ['/demo', 'title.demo'], ['/demo/learner', 'title.demoLearner'], ['/demo/college', 'title.demoCollege'], ['/demo/employer', 'title.demoEmployer'],
  ['/signin', 'title.signin'], ['/legal/privacy', 'title.privacy'], ['/legal/terms', 'title.terms'], ['/legal/dpdp', 'title.dpdp'], ['/legal/grievance', 'title.grievance'],
  ['/login', 'title.staffLogin'], ['/institution/invite/:token', 'title.staffInvite'], ['/learner-login', 'title.learnerLogin'], ['/learner-invite/:token', 'title.learnerInvite'],
  ['/verify', 'title.verify'], ['/verify/:id', 'title.verifyResult'],
  ['/employer/login', 'title.employerLogin'], ['/employer/register', 'title.employerRegister'], ['/employer/invite/:token', 'title.employerInvite'], ['/admin/login', 'title.adminLogin'],
  ['/employer/home', 'title.emp.home'], ['/employer/company', 'title.emp.company'], ['/employer/team', 'title.emp.team'], ['/employer/api-keys', 'title.emp.apiKeys'],
  ['/employer/roles', 'title.emp.roles'], ['/employer/roles/:id', 'title.emp.role'], ['/employer/pipeline', 'title.emp.pipeline'], ['/employer/candidates/:id', 'title.emp.candidate'],
  ['/employer/sponsor', 'title.emp.sponsor'], ['/employer/colleges', 'title.emp.colleges'], ['/employer/verify-bulk', 'title.emp.bulk'], ['/employer/templates', 'title.emp.templates'], ['/employer/billing', 'title.emp.billing'],
  ['/admin/overview', 'title.adm.overview'], ['/admin/employers', 'title.adm.employers'], ['/admin/ontology', 'title.adm.ontology'], ['/admin/quality', 'title.adm.quality'],
  ['/institution/welcome', 'title.inst.welcome'], ['/institution/home', 'title.inst.home'], ['/institution/team', 'title.inst.team'], ['/institution/students', 'title.inst.students'],
  ['/institution/students/add', 'title.inst.addStudents'], ['/institution/cohorts', 'title.inst.cohorts'], ['/institution/cohorts/new', 'title.inst.newCohort'], ['/institution/cohorts/:id', 'title.inst.cohort'],
  ['/institution/cohorts/:id/live', 'title.inst.live'], ['/institution/cohorts/:id/report', 'title.inst.report'], ['/institution/curriculum', 'title.inst.curriculum'], ['/institution/benchmark', 'title.inst.benchmark'],
  ['/institution/review', 'title.inst.review'], ['/institution/bridges', 'title.inst.bridges'], ['/institution/bridges/:id', 'title.inst.bridge'], ['/institution/placements', 'title.inst.placements'],
  ['/institution/board-report', 'title.inst.boardReport'], ['/institution/profile', 'title.inst.profile'], ['/institution/mastery-log/:logId', 'title.inst.masteryLog'],
  ['/learn/session', 'title.learn.session'], ['/learn/dashboard', 'title.learn.home'], ['/learn/welcome', 'title.learn.welcome'], ['/learn/record', 'title.learn.record'], ['/learn/jobs', 'title.learn.jobs'],
  ['/learn/market', 'title.learn.market'], ['/learn/market/:jobId', 'title.learn.job'], ['/learn/market/:jobId/interview', 'title.learn.interview'], ['/learn/topics', 'title.learn.topics'],
  ['/learn/profile', 'title.learn.profile'], ['/learn/settings', 'title.learn.settings'], ['/learn/resume', 'title.learn.resume'], ['/learn/reviews', 'title.learn.reviews'], ['/learn/passport', 'title.learn.passport']
];

export function titleKeyFor(pathname) {
  const hit = TITLES.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  return hit ? hit[1] : null;
}

const set = (text) => { document.title = text ? `${text} — Qubirex` : 'Qubirex'; };

/** A page-specific title (already translated text). */
export default function usePageTitle(text) {
  useEffect(() => { if (text) set(text); }, [text]);
}

/** Mounted once inside the router: the title for the current route. */
export function RouteTitle() {
  const { pathname } = useLocation();
  const { t } = useUiLang();
  useEffect(() => {
    const key = titleKeyFor(pathname);
    set(key ? t(key) : '');
  }, [pathname, t]);
  return null;
}
