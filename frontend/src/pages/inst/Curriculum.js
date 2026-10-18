// src/pages/inst/Curriculum.js — /institution/curriculum
// How well a cohort's pathway matches what employers ask for in JDs: each
// skill marked covered / partly / missing, with where it's taught, how the
// cohort is doing on it, what to do, and how many students asked for it.
// JD shares are sample data; coverage and mastery are live.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Upload } from 'lucide-react';
import api from '../../utils/api';
import { SampleBadge } from '../../components/learn/ui';
import { useStaff } from '../../components/inst/InstitutionLayout';
import { errMsg } from '../../utils/errors';
import { Select } from '../../components/shared/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
import { enumText } from '../../i18n/enums';
import { LoadingRows } from '../../components/shared/EmptyState';
export const COVER = { covered: ['✓ ', 'ln-tag-success'], partly: ['◐ ', 'ln-tag-info'], missing: ['+ ', 'ln-tag-accent'] };

export default function Curriculum() {
  const { t: tx } = useUiLang();
  const { role } = useStaff();
  const navigate = useNavigate();
  const [cohortId, setCohortId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/institution/insights/curriculum${cohortId ? `?engagement_id=${cohortId}` : ''}`)
      .then(r => { setData(r.data); if (!cohortId && r.data.cohort) setCohortId(r.data.cohort.id); })
      .catch(e => setError(errMsg(e, tx('inst.curriculum.couldnTLoadCurriculum'))));
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
  if (!data) return <LoadingRows rows={5} />;
  if (data.empty) return <><h1 className="ln-title">{tx('inst.curriculum.curriculumVsMarket')}</h1><div className="ln-card ln-muted">{tx('inst.curriculum.noCohortsScopeYet')}</div></>;
  const k = data.kpis;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{tx('inst.curriculum.curriculumVsMarket')}</h1>
          <span className="ln-sub">{tx('inst.curriculum.howWellWhatTeach')}</span>
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 10 }}>
          <SampleBadge /><span className="ln-small ln-muted">{tx('inst.curriculum.jdFiguresSampleFeed')}</span>
          {role === 'admin' && <Link to="/institution/cohorts/new" className="ln-btn ln-btn-primary"><Upload size={16} aria-hidden="true" />{tx('inst.curriculum.uploadCurriculum')}</Link>}
        </div>
      </header>

      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>{tx('inst.curriculum.cohort')}</span>
          <Select value={cohortId} onChange={e => setCohortId(e.target.value)}>{data.cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></label>
        <span className="ln-small ln-muted">{tx('inst.curriculum.curriculum')}{' '} <b style={{ color: 'var(--color-text)' }}>{data.cohort.ct_title} v{data.cohort.ct_version}</b> {' '}{tx('inst.curriculum.pathwayNodesSkillNodes', { pathway_nodes: data.pathway_nodes })}</span>
      </div>

      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{tx('inst.curriculum.jdsAnalysed')}</span><span className="ln-stat">{k.jds_analysed.toLocaleString(uiLocale())}</span><span className="ln-xs ln-muted">{tx('inst.curriculum.sampleFigure')}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{tx('inst.curriculum.curriculumMarketFit')}</span><span className="ln-stat">{k.fit_pct}%</span><span className="ln-xs ln-muted">{tx('inst.curriculum.weightedByHowOften')}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{tx('inst.curriculum.askedNotTaught')}</span><span className="ln-stat">{tx('inst.curriculum.missingCountSkills', { missing_count: k.missing_count })}</span><span className="ln-xs ln-muted">{tx('inst.curriculum.missingRisingThemRising', { missing_rising: k.missing_rising })}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{tx('inst.curriculum.taughtRarelyAsked')}</span><span className="ln-stat">{tx('inst.curriculum.rareCountTopic', { rare_count: k.rare_count })}</span><span className="ln-xs ln-muted">{k.rare_count ? tx('inst.curriculum.aboutHours', { h: k.rare_hours }) : tx('inst.curriculum.nothingFlagged')}</span></div>
      </div>

      {(() => {
        const gap = [...data.skills].filter(s => s.coverage !== 'covered').sort((a, b) => b.share - a.share)[0];
        if (!gap) return null;
        return (
          <section className="ln-card ln-card-warm" style={{ gap: 8 }} aria-label={tx('inst.curriculum.biggestGap')}>
            <span className="ln-kicker">{tx('inst.curriculum.biggestGap')}</span>
            <b style={{ fontSize: 'var(--fs-h3)' }}>{tx('inst.curriculum.nameAskedShareJob', { name: gap.name, share: gap.share })}{' '} {gap.coverage === 'partly' ? tx('inst.curriculum.onlyPartlyTaught') : tx('inst.curriculum.notTaughtYet')}.</b>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              {role !== 'viewer' && gap.coverage === 'partly' && <Link to={`/institution/bridges?new=1&cohort=${data.cohort.id}`} className="ln-btn ln-btn-primary ln-btn-sm">{tx('inst.curriculum.createBridgeProgramme')}</Link>}
              {role === 'admin' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => navigate('/institution/cohorts/new', { state: { draft: `Module: ${gap.name}.\nEmployers ask for it in ${gap.share}% of current job posts.` } })}>{tx('inst.curriculum.draftModule')}</button>}
            </div>
          </section>
        );
      })()}

      <section className="ln-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ln-between" style={{ padding: '18px 18px 4px' }}><h2 className="ln-h2">{tx('inst.curriculum.skillBySkillCoverage')}</h2><button type="button" className="ln-btn ln-btn-sm" onClick={exportCsv}><Download size={14} aria-hidden="true" />{tx('inst.curriculum.export')}</button></div>
        <div className="ln-tablewrap">
          <table className="ln-table" style={{ margin: '0 18px 12px', width: 'calc(100% - 36px)' }}>
            <thead><tr><th>{tx('inst.curriculum.skillJds')}</th><th>{tx('inst.curriculum.shareJds')}</th><th>{tx('inst.curriculum.trend')}</th><th>{tx('inst.curriculum.curriculum2')}</th><th>{tx('inst.curriculum.studentsMastery')}</th><th>{tx('inst.curriculum.askedByStudents')}</th><th>{tx('inst.curriculum.suggested')}</th></tr></thead>
            <tbody>
              {data.skills.map(s => (
                <tr key={s.key}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td><div className="ln-row" style={{ gap: 8 }}><div className="ln-bar" style={{ width: 80 }}><span style={{ width: `${s.share}%` }} /></div><span className="ln-small">{s.share}%</span></div></td>
                  <td className="ln-small">{enumText(tx, s.trend)}</td>
                  <td><span className={`ln-tag ln-tag-lg ${COVER[s.coverage][1]}`}>{COVER[s.coverage][0]}{enumText(tx, s.where)}</span></td>
                  <td className="ln-small">{enumText(tx, s.mastery_note)}</td>
                  <td className="ln-small">{s.requested_by ? (s.requested_by === 1 ? tx('inst.curriculum.oneStudent') : tx('inst.curriculum.nStudents', { n: s.requested_by })) : '—'}</td>
                  <td><span className={`ln-tag ${s.suggestion === 'Keep' ? 'ln-tag-neutral' : s.suggestion === 'Extend' ? 'ln-tag-info' : 'ln-tag-accent'}`}>{enumText(tx, s.suggestion)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ln-grid ln-g-2">
        <section className="ln-card" style={{ gap: 12 }}>
          <h2 className="ln-h2">{tx('inst.curriculum.emergingTopicsWorthElective')}</h2>
          {data.topics.length === 0 && <span className="ln-small ln-muted">{tx('inst.curriculum.pathwayAlreadyCoversEmerging')}</span>}
          {data.topics.map(t => (
            <div key={t.id} className="ln-tile ln-between" style={{ padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <div className="ln-col" style={{ gap: 4 }}><b>{t.name} <span className="ln-tag ln-tag-success" style={{ marginLeft: 4 }}>{enumText(tx, t.growth)}</span></b><span className="ln-small">{t.covered != null ? <>{t.desc} {tx('inst.curriculum.topicCoverage', { covered: t.covered, total: t.total, missing: t.missing.join(', ') })}</> : t.why}</span></div>
              {role === 'admin' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => draftModule(t)}>{tx('inst.curriculum.draftModule2')}</button>}
            </div>
          ))}
        </section>
        <section className="ln-card" style={{ gap: 12 }}>
          <h2 className="ln-h2">{tx('inst.curriculum.taughtButRarelyAsked')}</h2>
          <span className="ln-small ln-muted">{tx('inst.curriculum.candidatesShortenNotNecessarily')}</span>
          {data.rare.length === 0 && <span className="ln-small ln-muted">{tx('inst.curriculum.noneTopicsWeTrack')}</span>}
          {data.rare.map(r => <div key={r.name} className="ln-between ln-small"><span style={{ fontWeight: 600 }}>{r.name}</span><span className="ln-muted">{tx('inst.curriculum.shareJdsHoursH', { share: r.share, hours: r.hours })}</span></div>)}
        </section>
      </div>
    </>
  );
}
