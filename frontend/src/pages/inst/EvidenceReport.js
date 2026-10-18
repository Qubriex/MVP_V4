// src/pages/inst/EvidenceReport.js — /institution/cohorts/:id/report?from=&to=&el_ids=
// The student evidence report management uses to answer a parent: one page
// per student with attendance, skills passed or stuck, missed reviews,
// practical and Day-One results, employer access, readiness over time and a
// plain-language summary of which skills were below the role's requirements.
// "Save as PDF" prints it (one student per page). Opening it is recorded in
// each student's access history.
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../../utils/api';
import Crumbs from '../../components/inst/Crumbs';
import { errMsg } from '../../utils/errors';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const day = (t) => (t ? new Date(t).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const stamp = (t) => (t ? new Date(t).toLocaleString(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

function Student({ s, from, to }) {
  const { t } = useUiLang();
  return (
    <article className="in-report-student">
      <div className="ln-between ln-wrap" style={{ alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 2 }}>
          <h2 className="ln-h2">{s.name}</h2>
          <span className="ln-small ln-muted">{t('inst.evidenceReport.learnerRefDayDay2', { learner_ref: s.learner_ref, day: day(from), day2: day(to) })}</span>
        </div>
        <span className={`ln-tag ${s.parent_share.allowed ? 'ln-tag-success' : 'ln-tag-warning'}`} title={s.parent_share.rule}>
          {s.parent_share.allowed ? <ShieldCheck size={14} aria-hidden="true" /> : <ShieldAlert size={14} aria-hidden="true" />}
          {s.parent_share.allowed ? t('inst.evidenceReport.consentFileShareParent') : t('inst.evidenceReport.noConsentYetShare')}
        </span>
      </div>
      <p className="ln-tile" style={{ padding: 14, margin: 0, lineHeight: 1.6 }}>{s.plain_summary}</p>
      <span className="ln-xs ln-muted">{s.parent_share.rule}</span>

      <h3 className="ln-h3">{t('inst.evidenceReport.attendanceActiveTime')}</h3>
      <table><tbody>
        <tr><th>{t('inst.evidenceReport.enrolled')}</th><td>{day(s.enrolled_at)}</td><th>{t('inst.evidenceReport.startedLearning')}</th><td>{stamp(s.started_at)}</td></tr>
        <tr><th>{t('inst.evidenceReport.lastActive')}</th><td>{stamp(s.last_active_at)}</td><th>{t('inst.evidenceReport.daysPractisedPeriod')}</th><td>{s.days_active}</td></tr>
        <tr><th>{t('inst.evidenceReport.sessionsPeriod')}</th><td>{s.sessions}</td><th>{t('inst.evidenceReport.activeMinutesPeriod')}</th><td>{s.active_minutes}</td></tr>
        <tr><th>{t('inst.evidenceReport.skillsMastered')}</th><td>{t('inst.evidenceReport.nodesMasteredTotalTotal', { nodes_mastered_total: s.nodes_mastered_total, total_nodes: s.total_nodes, nodes_mastered_in_range: s.nodes_mastered_in_range })}</td><th>{t('inst.evidenceReport.currentSkill')}</th><td>{s.completed ? t('inst.evidenceReport.pathwayCompleted') : s.current_skill || '—'}</td></tr>
      </tbody></table>

      <h3 className="ln-h3">{t('inst.evidenceReport.readinessOverTime')}</h3>
      {s.readiness.timeline.length === 0 ? <span className="ln-small ln-muted">{t('inst.evidenceReport.noDataPeriod')}</span> : (
        <table><thead><tr><th>{t('inst.evidenceReport.monthEnd')}</th><th>{t('inst.evidenceReport.jobMatch')}</th><th>{t('inst.evidenceReport.band')}</th></tr></thead>
          <tbody>{s.readiness.timeline.map(r => <tr key={r.date}><td>{day(r.date)}</td><td>{r.match}%</td><td>{r.band}</td></tr>)}</tbody></table>
      )}
      {s.readiness.role && (
        <span className="ln-small">
          {t('inst.evidenceReport.bestFittingRole')}{' '} <b>{s.readiness.role}</b> {' '}{t('inst.evidenceReport.matchMatchVerifiedSkills', { match: s.readiness.match })}{' '}
          {s.readiness.below_requirements.length ? <>{t('inst.evidenceReport.belowRoleSRequirements')}{' '} <b>{s.readiness.below_requirements.join(', ')}</b>.</> : t('inst.evidenceReport.meetsEveryRequiredSkill')}
          <span className="ln-xs ln-muted"> {' '}{t('inst.evidenceReport.jobDescriptionsFromSample')}</span>
        </span>
      )}

      <h3 className="ln-h3">{t('inst.evidenceReport.skillsPassed')}</h3>
      {s.skills_mastered.length === 0 ? <span className="ln-small ln-muted">{t('inst.evidenceReport.noneYet')}</span> : (
        <table><thead><tr><th>{t('inst.evidenceReport.skill')}</th><th>{t('inst.evidenceReport.cluster')}</th><th>{t('inst.evidenceReport.masteredOn')}</th><th>{t('inst.evidenceReport.evidenceLevel')}</th></tr></thead>
          <tbody>{s.skills_mastered.map(k => <tr key={k.skill}><td>{k.skill}{k.provisional ? t('inst.evidenceReport.beingDoubleChecked') : ''}</td><td>{k.cluster}</td><td>{day(k.mastered_at)}</td><td>{k.evidence_level || '—'}</td></tr>)}</tbody></table>
      )}

      <h3 className="ln-h3">{t('inst.evidenceReport.skillsWhereStudentWas')}</h3>
      {s.skills_stuck.length === 0 ? <span className="ln-small ln-muted">{t('inst.evidenceReport.none')}</span> : (
        <table><thead><tr><th>{t('inst.evidenceReport.skill')}</th><th>{t('inst.evidenceReport.loops')}</th></tr></thead><tbody>{s.skills_stuck.map(k => <tr key={k.skill}><td>{k.skill}</td><td>{k.loops}</td></tr>)}</tbody></table>
      )}
      {s.skills_not_started > 0 && <span className="ln-small">{t('inst.evidenceReport.skillsNotStartedSkill', { skills_not_started: s.skills_not_started })}</span>}

      <h3 className="ln-h3">{t('inst.evidenceReport.missedSpacedReviews')}</h3>
      {s.missed_reviews.length === 0 ? <span className="ln-small ln-muted">{t('inst.evidenceReport.none')}</span> : (
        <table><thead><tr><th>{t('inst.evidenceReport.skill')}</th><th>{t('inst.evidenceReport.wasDue')}</th></tr></thead><tbody>{s.missed_reviews.map(r => <tr key={r.skill}><td>{r.skill}</td><td>{day(r.due_at)}</td></tr>)}</tbody></table>
      )}

      <h3 className="ln-h3">{t('inst.evidenceReport.practicalDayOneResults')}</h3>
      {s.practical_results.length === 0 ? <span className="ln-small ln-muted">{t('inst.evidenceReport.noneRecorded')}</span> : (
        <table><thead><tr><th>{t('inst.evidenceReport.task')}</th><th>{t('inst.evidenceReport.skill')}</th><th>{t('inst.evidenceReport.date')}</th><th>{t('inst.evidenceReport.result')}</th></tr></thead>
          <tbody>{s.practical_results.map((d, i) => <tr key={i}><td>{d.kind}</td><td>{d.skill}</td><td>{day(d.date)}</td><td>{d.passed ? t('inst.evidenceReport.passed') : t('inst.evidenceReport.notPassed')}{d.level ? ` · ${d.level}` : ''}</td></tr>)}</tbody></table>
      )}

      <h3 className="ln-h3">{t('inst.evidenceReport.employerAccess')}</h3>
      {s.employer_access.length === 0 ? <span className="ln-small ln-muted">{t('inst.evidenceReport.noEmployerHasBeen')}</span> : (
        <table><thead><tr><th>{t('inst.evidenceReport.employer')}</th><th>{t('inst.evidenceReport.accessGiven')}</th><th>{t('inst.evidenceReport.stageReached')}</th><th>{t('inst.evidenceReport.withdrawn')}</th></tr></thead>
          <tbody>{s.employer_access.map((e, i) => <tr key={i}><td>{e.employer}</td><td>{day(e.granted_at)}</td><td>{e.stage || t('inst.evidenceReport.notRecorded')}</td><td>{e.withdrawn_at ? day(e.withdrawn_at) : '—'}</td></tr>)}</tbody></table>
      )}
      <span className="ln-xs ln-muted">{t('inst.evidenceReport.reportNeverIncludesWhat')}</span>
    </article>
  );
}

export default function EvidenceReport() {
  const { t } = useUiLang();
  const { id } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/institution/engagements/${id}/evidence-report?${params.toString()}`).then(r => setData(r.data)).catch(e => setError(errMsg(e, t('inst.evidenceReport.couldnTBuildReport'))));
  }, [id, params]);

  return (
    <>
      <div className="in-no-print"><Crumbs items={[{ label: 'Cohorts', to: '/institution/cohorts' }, { label: data?.engagement.title || 'Cohort', to: `/institution/cohorts/${id}?tab=Students` }, { label: 'Evidence report' }]} /></div>
      <header className="ln-pagehead in-no-print">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{t('inst.evidenceReport.studentEvidenceReport')}</h1>
          <span className="ln-sub">{data ? `${data.engagement.title} · ${t('inst.evidenceReport.studentsRange', { n: data.students.length, from: day(data.from), to: day(data.to) })}` : t('inst.evidenceReport.preparing')}</span>
        </div>
        {data && <button type="button" className="ln-btn ln-btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />{t('inst.evidenceReport.saveAsPdf')}</button>}
      </header>
      {data && (
        <div className="ln-note in-no-print">
          {t('inst.evidenceReport.beforeSharingParentMinor')}
        </div>
      )}
      {error && <div className="ln-error">{error}</div>}
      {!data && !error && <p className="ln-muted">{t('inst.evidenceReport.preparingReport')}</p>}
      {data && (
        <div className="in-report in-print">
          <span className="ln-xs ln-muted">{t('inst.evidenceReport.titleGeneratedStamp', { title: data.engagement.title, stamp: stamp(data.generated_at) })}</span>
          {data.students.map(s => <Student key={s.el_id} s={s} from={data.from} to={data.to} />)}
        </div>
      )}
    </>
  );
}
