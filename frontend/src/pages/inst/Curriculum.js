// src/pages/inst/Curriculum.js — /institution/curriculum
// How well a cohort's pathway matches what employers ask for in JDs: each
// skill marked covered / partly / missing, with where it's taught, how the
// cohort is doing on it, what to do, and how many students asked for it.
// JD shares are sample data; coverage and mastery are live.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import api from '../../utils/api';
import { SampleBadge } from '../../components/learn/ui';
import { useStaff } from '../../components/inst/InstitutionLayout';

export const COVER = { covered: ['✓ ', 'ln-tag-success'], partly: ['◐ ', 'ln-tag-info'], missing: ['+ ', 'ln-tag-accent'] };

export default function Curriculum() {
  const { role } = useStaff();
  const navigate = useNavigate();
  const [cohortId, setCohortId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/institution/insights/curriculum${cohortId ? `?engagement_id=${cohortId}` : ''}`)
      .then(r => { setData(r.data); if (!cohortId && r.data.cohort) setCohortId(r.data.cohort.id); })
      .catch(e => setError(e.response?.data?.error || 'Couldn’t load curriculum insight.'));
  }, [cohortId]); // eslint-disable-line

  const exportCsv = () => {
    const rows = [['skill', 'share_of_jds', 'trend', 'coverage', 'where', 'cohort_mastery', 'suggestion', 'requested_by_students'],
      ...data.skills.map(s => [s.name, s.share, s.trend, s.coverage, s.where, s.mastery_note, s.suggestion, s.requested_by])];
    const csv = rows.map(r => r.map(v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'curriculum-vs-market.csv'; a.click();
  };
  // Draft a module: open the new-cohort brief with the topic pre-filled.
  const draftModule = (t) => navigate('/institution/cohorts/new', { state: { draft: `Elective module: ${t.name}.\nLearning order: ${t.steps.join(' → ')}.\n${t.why}` } });

  if (error) return <div className="ln-error">{error}</div>;
  if (!data) return <p className="ln-muted">Loading…</p>;
  if (data.empty) return <><h1 className="ln-title">Curriculum vs market</h1><div className="ln-card ln-muted">No cohorts in your scope yet.</div></>;
  const k = data.kpis;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">Curriculum vs market</h1>
          <span className="ln-sub">How well what you teach matches what employers ask for in current job descriptions.</span>
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 10 }}><SampleBadge /><span className="ln-small ln-muted">JD figures: sample feed</span></div>
      </header>

      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>Cohort</span>
          <select value={cohortId} onChange={e => setCohortId(e.target.value)}>{data.cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <span className="ln-small ln-muted">Curriculum: <b style={{ color: 'var(--color-text)' }}>{data.cohort.ct_title} v{data.cohort.ct_version}</b> · {data.pathway_nodes} skill nodes · JDs: fresher and 0–2 yr roles, last 90 days</span>
      </div>

      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">JDs analysed</span><span className="ln-stat">{k.jds_analysed.toLocaleString('en-IN')}</span><span className="ln-xs ln-muted">Sample figure</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Curriculum–market fit</span><span className="ln-stat">{k.fit_pct}%</span><span className="ln-xs ln-muted">Weighted by how often JDs ask</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Asked for, not taught</span><span className="ln-stat">{k.missing_count} skills</span><span className="ln-xs ln-muted">{k.missing_rising} of them rising</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Taught, rarely asked</span><span className="ln-stat">{k.rare_count} topic{k.rare_count === 1 ? '' : 's'}</span><span className="ln-xs ln-muted">{k.rare_count ? `About ${k.rare_hours} h of pathway` : 'Nothing flagged'}</span></div>
      </div>

      <section className="ln-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ln-between" style={{ padding: '18px 18px 4px' }}><h2 className="ln-h2">Skill-by-skill coverage</h2><button type="button" className="ln-btn ln-btn-sm" onClick={exportCsv}><Download size={14} aria-hidden="true" />Export</button></div>
        <div className="ln-tablewrap">
          <table className="ln-table" style={{ margin: '0 18px 12px', width: 'calc(100% - 36px)' }}>
            <thead><tr><th>Skill in JDs</th><th>Share of JDs</th><th>Trend</th><th>In your curriculum</th><th>Your students’ mastery</th><th>Asked by students</th><th>Suggested</th></tr></thead>
            <tbody>
              {data.skills.map(s => (
                <tr key={s.key}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td><div className="ln-row" style={{ gap: 8 }}><div className="ln-bar" style={{ width: 80 }}><span style={{ width: `${s.share}%` }} /></div><span className="ln-small">{s.share}%</span></div></td>
                  <td className="ln-small">{s.trend}</td>
                  <td><span className={`ln-tag ln-tag-lg ${COVER[s.coverage][1]}`}>{COVER[s.coverage][0]}{s.where}</span></td>
                  <td className="ln-small">{s.mastery_note}</td>
                  <td className="ln-small">{s.requested_by ? `${s.requested_by} student${s.requested_by > 1 ? 's' : ''}` : '—'}</td>
                  <td><span className={`ln-tag ${s.suggestion === 'Keep' ? 'ln-tag-neutral' : s.suggestion === 'Extend' ? 'ln-tag-info' : 'ln-tag-accent'}`}>{s.suggestion}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ln-grid ln-g-2">
        <section className="ln-card" style={{ gap: 12 }}>
          <h2 className="ln-h2">Emerging topics worth an elective</h2>
          {data.topics.length === 0 && <span className="ln-small ln-muted">Your pathway already covers the emerging topics we track.</span>}
          {data.topics.map(t => (
            <div key={t.id} className="ln-tile ln-between" style={{ padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <div className="ln-col" style={{ gap: 4 }}><b>{t.name} <span className="ln-tag ln-tag-success" style={{ marginLeft: 4 }}>{t.growth}</span></b><span className="ln-small">{t.why}</span></div>
              {role === 'admin' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => draftModule(t)}>Draft module</button>}
            </div>
          ))}
        </section>
        <section className="ln-card" style={{ gap: 12 }}>
          <h2 className="ln-h2">Taught, but rarely asked for</h2>
          <span className="ln-small ln-muted">Candidates to shorten, not necessarily remove.</span>
          {data.rare.length === 0 && <span className="ln-small ln-muted">None of the topics we track as rarely asked for (jQuery, PHP basics, Bootstrap theming, Flash, Visual Basic) are in this pathway.</span>}
          {data.rare.map(r => <div key={r.name} className="ln-between ln-small"><span style={{ fontWeight: 600 }}>{r.name}</span><span className="ln-muted">{r.share}% of JDs · {r.hours} h in pathway</span></div>)}
        </section>
      </div>
    </>
  );
}
