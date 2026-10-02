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

const day = (t) => (t ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const stamp = (t) => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

function Student({ s, from, to }) {
  return (
    <article className="in-report-student">
      <div className="ln-between ln-wrap" style={{ alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 2 }}>
          <h2 className="ln-h2">{s.name}</h2>
          <span className="ln-small ln-muted">{s.learner_ref} · {day(from)} to {day(to)}</span>
        </div>
        <span className={`ln-tag ${s.parent_share.allowed ? 'ln-tag-success' : 'ln-tag-warning'}`} title={s.parent_share.rule}>
          {s.parent_share.allowed ? <ShieldCheck size={14} aria-hidden="true" /> : <ShieldAlert size={14} aria-hidden="true" />}
          {s.parent_share.allowed ? ' Consent on file to share with a parent' : ' No consent yet to share with a parent'}
        </span>
      </div>
      <p className="ln-tile" style={{ padding: 14, margin: 0, lineHeight: 1.6 }}>{s.plain_summary}</p>
      <span className="ln-xs ln-muted">{s.parent_share.rule}</span>

      <h3 className="ln-h3">Attendance and active time</h3>
      <table><tbody>
        <tr><th>Enrolled</th><td>{day(s.enrolled_at)}</td><th>Started learning</th><td>{stamp(s.started_at)}</td></tr>
        <tr><th>Last active</th><td>{stamp(s.last_active_at)}</td><th>Days practised (period)</th><td>{s.days_active}</td></tr>
        <tr><th>Sessions (period)</th><td>{s.sessions}</td><th>Active minutes (period)</th><td>{s.active_minutes}</td></tr>
        <tr><th>Skills mastered</th><td>{s.nodes_mastered_total} of {s.total_nodes} ({s.nodes_mastered_in_range} in period)</td><th>Current skill</th><td>{s.completed ? 'Pathway completed' : s.current_skill || '—'}</td></tr>
      </tbody></table>

      <h3 className="ln-h3">Readiness over time</h3>
      {s.readiness.timeline.length === 0 ? <span className="ln-small ln-muted">No data for this period.</span> : (
        <table><thead><tr><th>Month end</th><th>Job match</th><th>Band</th></tr></thead>
          <tbody>{s.readiness.timeline.map(r => <tr key={r.date}><td>{day(r.date)}</td><td>{r.match}%</td><td>{r.band}</td></tr>)}</tbody></table>
      )}
      {s.readiness.role && (
        <span className="ln-small">
          Best-fitting role: <b>{s.readiness.role}</b> ({s.readiness.match}% match, verified skills only).{' '}
          {s.readiness.below_requirements.length ? <>Below the role’s requirements: <b>{s.readiness.below_requirements.join(', ')}</b>.</> : 'Meets every required skill.'}
          <span className="ln-xs ln-muted"> Job descriptions are from the sample market feed.</span>
        </span>
      )}

      <h3 className="ln-h3">Skills passed</h3>
      {s.skills_mastered.length === 0 ? <span className="ln-small ln-muted">None yet.</span> : (
        <table><thead><tr><th>Skill</th><th>Cluster</th><th>Mastered on</th><th>Evidence level</th></tr></thead>
          <tbody>{s.skills_mastered.map(k => <tr key={k.skill}><td>{k.skill}{k.provisional ? ' (being double-checked)' : ''}</td><td>{k.cluster}</td><td>{day(k.mastered_at)}</td><td>{k.evidence_level || '—'}</td></tr>)}</tbody></table>
      )}

      <h3 className="ln-h3">Skills where the student was stuck</h3>
      {s.skills_stuck.length === 0 ? <span className="ln-small ln-muted">None.</span> : (
        <table><thead><tr><th>Skill</th><th>Loops</th></tr></thead><tbody>{s.skills_stuck.map(k => <tr key={k.skill}><td>{k.skill}</td><td>{k.loops}</td></tr>)}</tbody></table>
      )}
      {s.skills_not_started > 0 && <span className="ln-small">{s.skills_not_started} skill{s.skills_not_started === 1 ? '' : 's'} not started yet.</span>}

      <h3 className="ln-h3">Missed spaced reviews</h3>
      {s.missed_reviews.length === 0 ? <span className="ln-small ln-muted">None.</span> : (
        <table><thead><tr><th>Skill</th><th>Was due</th></tr></thead><tbody>{s.missed_reviews.map(r => <tr key={r.skill}><td>{r.skill}</td><td>{day(r.due_at)}</td></tr>)}</tbody></table>
      )}

      <h3 className="ln-h3">Practical and Day-One results</h3>
      {s.practical_results.length === 0 ? <span className="ln-small ln-muted">None recorded.</span> : (
        <table><thead><tr><th>Task</th><th>Skill</th><th>Date</th><th>Result</th></tr></thead>
          <tbody>{s.practical_results.map((d, i) => <tr key={i}><td>{d.kind}</td><td>{d.skill}</td><td>{day(d.date)}</td><td>{d.passed ? 'Passed' : 'Not passed'}{d.level ? ` · ${d.level}` : ''}</td></tr>)}</tbody></table>
      )}

      <h3 className="ln-h3">Employer access</h3>
      {s.employer_access.length === 0 ? <span className="ln-small ln-muted">No employer has been given access.</span> : (
        <table><thead><tr><th>Employer</th><th>Access given</th><th>Stage reached</th><th>Withdrawn</th></tr></thead>
          <tbody>{s.employer_access.map((e, i) => <tr key={i}><td>{e.employer}</td><td>{day(e.granted_at)}</td><td>{e.stage || 'Not recorded'}</td><td>{e.withdrawn_at ? day(e.withdrawn_at) : '—'}</td></tr>)}</tbody></table>
      )}
      <span className="ln-xs ln-muted">This report never includes what the student said in sessions or how answers were marked.</span>
    </article>
  );
}

export default function EvidenceReport() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/institution/engagements/${id}/evidence-report?${params.toString()}`).then(r => setData(r.data)).catch(e => setError(errMsg(e, 'Couldn’t build the report.')));
  }, [id, params]);

  return (
    <>
      <div className="in-no-print"><Crumbs items={[{ label: 'Cohorts', to: '/institution/cohorts' }, { label: data?.engagement.title || 'Cohort', to: `/institution/cohorts/${id}?tab=Students` }, { label: 'Evidence report' }]} /></div>
      <header className="ln-pagehead in-no-print">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">Student evidence report</h1>
          <span className="ln-sub">{data ? `${data.engagement.title} · ${data.students.length} student${data.students.length === 1 ? '' : 's'} · ${day(data.from)} to ${day(data.to)}` : 'Preparing…'}</span>
        </div>
        {data && <button type="button" className="ln-btn ln-btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Save as PDF</button>}
      </header>
      {data && (
        <div className="ln-note in-no-print">
          Before sharing with a parent: for a minor, a guardian consent must be on file; for an adult, only with the student’s consent (level 2). Each student’s page shows whether that consent exists.
          This report was recorded in each student’s access history.
        </div>
      )}
      {error && <div className="ln-error">{error}</div>}
      {!data && !error && <p className="ln-muted">Preparing the report…</p>}
      {data && (
        <div className="in-report in-print">
          <span className="ln-xs ln-muted">{data.engagement.title} · generated {stamp(data.generated_at)}</span>
          {data.students.map(s => <Student key={s.el_id} s={s} from={data.from} to={data.to} />)}
        </div>
      )}
    </>
  );
}
