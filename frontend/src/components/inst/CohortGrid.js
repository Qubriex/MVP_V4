// src/components/inst/CohortGrid.js — the cohort × skill grid (v4.3 canvas
// I3): one row per student, one cell per skill cluster, readiness band and
// the live light; filters, CSV, and a drawer that says in plain words why a
// student is not ready yet, with a one-click bridge programme.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import Drawer from '../shared/Drawer';
import { HowCounted } from '../shared/Popover';
import { SmallSample } from '../shared/SampleSize';
import { LoadingRows } from '../shared/EmptyState';
import { BandPill, BandBar } from '../shared/ui';
import { Select } from '../shared/ui';

import { useUiLang } from '../../context/UiLangContext';
const LIGHT = { green: ['var(--ok)', 'inst.cohortGrid.light.learningWell'], yellow: ['var(--warn)', 'inst.cohortGrid.light.needsANudge'], red: ['var(--danger)', 'inst.cohortGrid.light.needsHelp'] };
const shade = (pct) => (pct >= 100 ? 'var(--status-success-bg)' : pct > 0 ? 'var(--status-info-bg)' : 'transparent');

function WhyDrawer({ cohortId, student, canBridge, onClose }) {
  const { t } = useUiLang();
  const { data: w, error } = useCachedGet(`/institution/engagements/${cohortId}/students/${student.el_id}/why`);
  const bridgeHref = w && `/institution/bridges?new=1&cohort=${cohortId}&students=${student.el_id}&nodes=${w.suggested_bridge.map(s => s.id).join(',')}`;
  return (
    <Drawer title={student.name} onClose={onClose} width={440}>
      {error && <div className="ln-error">{errMsg(error, t('inst.cohortGrid.couldnTLoad'))}</div>}
      {!w && !error && <LoadingRows />}
      {w && (
        <div className="ln-col" style={{ gap: 14 }}>
          <div className="ln-row" style={{ gap: 10 }}><BandPill band={w.band} /><b style={{ fontSize: 'var(--fs-h2)' }}>{w.readiness}</b><span className="ln-small ln-muted">{w.role ? t('inst.cohortGrid.forRole', { role: w.role }) : ''}</span></div>
          <section className="ln-col" style={{ gap: 6 }}>
            <h3 className="ln-label">{w.band === 'ready' ? t('inst.cohortGrid.whyReady') : t('inst.cohortGrid.whyNotReadyYet')}</h3>
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{w.reasons.map(r => <li key={r}>{r}</li>)}</ul>
          </section>
          {w.missing_skills.length > 0 && (
            <section className="ln-col" style={{ gap: 6 }}><h3 className="ln-label">{t('inst.cohortGrid.skillsStillVerify')}</h3>
              <div className="ln-row ln-wrap" style={{ gap: 6 }}>{w.missing_skills.map(s => <span key={s} className="ln-chip">{s}</span>)}</div></section>
          )}
          {w.stuck.length > 0 && (
            <section className="ln-col" style={{ gap: 6 }}><h3 className="ln-label">{t('inst.cohortGrid.tookSeveralTries')}</h3>
              {w.stuck.map(s => <span key={s.skill} className="ln-small">{t('inst.cohortGrid.skillLoopsExplanations', { skill: s.skill, loops: s.loops })}</span>)}</section>
          )}
          {canBridge && w.suggested_bridge.length > 0 && <Link to={bridgeHref} className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start', whiteSpace: 'normal', textAlign: 'left', height: 'auto', paddingBlock: 10 }}>{t('inst.cohortGrid.startBridgeJoin', { join: w.suggested_bridge.map(s => s.label).join(', ') })}</Link>}
          <HowCounted>{t('inst.cohortGrid.readinessComparesSkillsStudent')}</HowCounted>
        </div>
      )}
    </Drawer>
  );
}

export default function CohortGrid({ c, canBridge }) {
  const { t } = useUiLang();
  const { data, error } = useCachedGet(`/institution/engagements/${c.id}/grid`);
  const [q, setQ] = useState('');
  const [band, setBand] = useState('all');
  const [light, setLight] = useState('all');
  const [open, setOpen] = useState(null);
  const rows = useMemo(() => (data?.students || []).filter(s =>
    (band === 'all' || s.band === band) && (light === 'all' || s.light === light)
    && (!q || `${s.name} ${s.learner_ref}`.toLowerCase().includes(q.toLowerCase()))), [data, q, band, light]);
  const csv = async () => {
    const r = await api.get(`/institution/engagements/${c.id}/grid.csv`, { responseType: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(r.data); a.download = `readiness-${c.join_code}.csv`; a.click();
  };
  if (error && !data) return <div className="ln-error">{errMsg(error, t('inst.cohortGrid.couldnTLoadGrid'))}</div>;
  if (!data) return <LoadingRows rows={5} />;
  const { counts, total, top_gap: gap } = data.summary;
  return (
    <section className="ln-card" style={{ gap: 14, padding: 0, overflow: 'hidden' }}>
      <div className="ln-col" style={{ gap: 10, padding: '16px 18px 0' }}>
        <div className="ln-between ln-wrap" style={{ gap: 10 }}>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <div style={{ minWidth: 260, flex: 1 }}><BandBar counts={counts} onSelect={(b) => setBand(band === b ? 'all' : b)} /></div>
            <SmallSample n={total} />
          </div>
          <button type="button" className="ln-btn ln-btn-sm" onClick={csv}><Download size={14} aria-hidden="true" />CSV</button>
        </div>
        {gap && canBridge && (
          <div className="ln-note ln-row ln-wrap" style={{ gap: 10 }}>
            <span className="ln-small"><b>{gap.skill}</b> {' '}{t('inst.cohortGrid.whatMostNearlyReady', { students: gap.students })}</span>
            <Link to={`/institution/bridges?new=1&cohort=${c.id}`} className="ln-link ln-small">{t('inst.cohortGrid.createBridgeProgramme')}</Link>
          </div>
        )}
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <label className="ln-row sk-search" style={{ gap: 6 }}><Search size={14} aria-hidden="true" /><span className="ln-sr">{t('inst.cohortGrid.searchStudents')}</span>
            <input className="ln-input" style={{ minHeight: 34, width: 200 }} value={q} onChange={e => setQ(e.target.value)} placeholder={t('inst.cohortGrid.searchNameRef')} /></label>
          <Select style={{ minHeight: 34, width: 160 }} aria-label={t('inst.cohortGrid.readiness')} value={band} onChange={e => setBand(e.target.value)}>
            <option value="all">{t('inst.cohortGrid.allReadiness')}</option><option value="ready">{t('inst.cohortGrid.ready')}</option><option value="nearly">{t('inst.cohortGrid.nearlyReady')}</option><option value="building">{t('inst.cohortGrid.building')}</option></Select>
          <Select style={{ minHeight: 34, width: 160 }} aria-label={t('inst.cohortGrid.statusLight')} value={light} onChange={e => setLight(e.target.value)}>
            <option value="all">{t('inst.cohortGrid.anyStatus')}</option><option value="green">{t('inst.cohortGrid.learningWell')}</option><option value="yellow">{t('inst.cohortGrid.needsNudge')}</option><option value="red">{t('inst.cohortGrid.needsHelp')}</option></Select>
          <span className="ln-xs ln-muted">{t('inst.cohortGrid.lengthLength2', { length: rows.length, length2: data.students.length })}</span>
        </div>
      </div>
      <div className="ln-tablewrap"><table className="ln-table" style={{ margin: '0 18px 12px', width: 'calc(100% - 36px)' }}>
        <thead><tr><th>{t('inst.cohortGrid.student')}</th><th>{t('inst.cohortGrid.readiness')}</th>{data.clusters.map(cl => <th key={cl.id} title={t('inst.cohortGrid.nodesSkills', { nodes: cl.nodes })}>{cl.label}</th>)}<th>{t('inst.cohortGrid.status')}</th><th /></tr></thead>
        <tbody>{rows.map(s => (
          <tr key={s.el_id}>
            <td><b style={{ fontWeight: 600 }}>{s.name}</b> <span className="ln-xs ln-muted">{s.learner_ref}</span></td>
            <td><BandPill band={s.band} score={s.readiness} /></td>
            {s.cells.map((pct, i) => <td key={data.clusters[i].id} style={{ background: shade(pct), textAlign: 'center' }} className="ln-small">{pct}%</td>)}
            <td>{s.light ? <span className="ln-row" style={{ gap: 6 }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 9, background: LIGHT[s.light][0] }} /><span className="ln-xs">{t(LIGHT[s.light][1])}</span></span> : '—'}</td>
            <td><button type="button" className="ln-btn ln-btn-sm" onClick={() => setOpen(s)}>{s.band === 'ready' ? t('inst.cohortGrid.whyReady') : t('inst.cohortGrid.whyNotReady')}</button></td>
          </tr>
        ))}</tbody></table></div>
      <div style={{ padding: '0 18px 16px' }}><HowCounted>{t('inst.cohortGrid.eachSkillAreaCell')}</HowCounted></div>
      {open && <WhyDrawer cohortId={c.id} student={open} canBridge={canBridge} onClose={() => setOpen(null)} />}
    </section>
  );
}
