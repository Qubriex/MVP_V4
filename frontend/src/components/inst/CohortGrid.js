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

const BAND_TAG = { ready: 'ln-tag-success', nearly: 'ln-tag-info', building: 'ln-tag-warning' };
const LIGHT = { green: ['#16a34a', 'Learning well'], yellow: ['#d97706', 'Needs a nudge'], red: ['#dc2626', 'Needs help'] };
const shade = (pct) => (pct >= 100 ? 'var(--status-success-bg)' : pct > 0 ? 'var(--status-info-bg, #e0f2fe)' : 'transparent');

function WhyDrawer({ cohortId, student, canBridge, onClose }) {
  const { data: w, error } = useCachedGet(`/institution/engagements/${cohortId}/students/${student.el_id}/why`);
  const bridgeHref = w && `/institution/bridges?new=1&cohort=${cohortId}&students=${student.el_id}&nodes=${w.suggested_bridge.map(s => s.id).join(',')}`;
  return (
    <Drawer title={student.name} onClose={onClose} width={440}>
      {error && <div className="ln-error">{errMsg(error, 'Couldn’t load.')}</div>}
      {!w && !error && <LoadingRows />}
      {w && (
        <div className="ln-col" style={{ gap: 14 }}>
          <div className="ln-row" style={{ gap: 10 }}><span className={`ln-tag ln-tag-lg ${BAND_TAG[w.band]}`}>{w.band_label}</span><b style={{ fontSize: 22 }}>{w.readiness}</b><span className="ln-small ln-muted">{w.role ? `for ${w.role}` : ''}</span></div>
          <section className="ln-col" style={{ gap: 6 }}>
            <h3 className="ln-label">{w.band === 'ready' ? 'Why ready' : 'Why not ready yet'}</h3>
            <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{w.reasons.map(r => <li key={r}>{r}</li>)}</ul>
          </section>
          {w.missing_skills.length > 0 && (
            <section className="ln-col" style={{ gap: 6 }}><h3 className="ln-label">Skills still to verify</h3>
              <div className="ln-row ln-wrap" style={{ gap: 6 }}>{w.missing_skills.map(s => <span key={s} className="ln-chip">{s}</span>)}</div></section>
          )}
          {w.stuck.length > 0 && (
            <section className="ln-col" style={{ gap: 6 }}><h3 className="ln-label">Took several tries</h3>
              {w.stuck.map(s => <span key={s.skill} className="ln-small">{s.skill} · {s.loops} explanations</span>)}</section>
          )}
          {canBridge && w.suggested_bridge.length > 0 && <Link to={bridgeHref} className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start', whiteSpace: 'normal', textAlign: 'left', height: 'auto', paddingBlock: 10 }}>Start a bridge on {w.suggested_bridge.map(s => s.label).join(', ')}</Link>}
          <HowCounted>Readiness compares the skills this student has verified with what the best-fitting job role asks for. Only skills passed in a check count, not time spent.</HowCounted>
        </div>
      )}
    </Drawer>
  );
}

export default function CohortGrid({ c, canBridge }) {
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
  if (error && !data) return <div className="ln-error">{errMsg(error, 'Couldn’t load the grid.')}</div>;
  if (!data) return <LoadingRows rows={5} />;
  const { counts, total, top_gap: gap } = data.summary;
  return (
    <section className="ln-card" style={{ gap: 14, padding: 0, overflow: 'hidden' }}>
      <div className="ln-col" style={{ gap: 10, padding: '16px 18px 0' }}>
        <div className="ln-between ln-wrap" style={{ gap: 10 }}>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <span className="ln-tag ln-tag-success">Ready {counts.ready}</span><span className="ln-tag ln-tag-info">Nearly ready {counts.nearly}</span><span className="ln-tag ln-tag-warning">Building {counts.building}</span>
            <SmallSample n={total} />
          </div>
          <button type="button" className="ln-btn ln-btn-sm" onClick={csv}><Download size={14} aria-hidden="true" />CSV</button>
        </div>
        {gap && canBridge && (
          <div className="ln-note ln-row ln-wrap" style={{ gap: 10 }}>
            <span className="ln-small"><b>{gap.skill}</b> is what most nearly-ready students still need ({gap.students}).</span>
            <Link to={`/institution/bridges?new=1&cohort=${c.id}`} className="ln-link ln-small">Create bridge programme →</Link>
          </div>
        )}
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <label className="ln-row sk-search" style={{ gap: 6 }}><Search size={14} aria-hidden="true" /><span className="ln-sr">Search students</span>
            <input className="ln-input" style={{ minHeight: 34, width: 200 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or ref" /></label>
          <select className="ln-select" style={{ minHeight: 34, width: 160 }} aria-label="Readiness" value={band} onChange={e => setBand(e.target.value)}>
            <option value="all">All readiness</option><option value="ready">Ready</option><option value="nearly">Nearly ready</option><option value="building">Building</option></select>
          <select className="ln-select" style={{ minHeight: 34, width: 160 }} aria-label="Status light" value={light} onChange={e => setLight(e.target.value)}>
            <option value="all">Any status</option><option value="green">Learning well</option><option value="yellow">Needs a nudge</option><option value="red">Needs help</option></select>
          <span className="ln-xs ln-muted">{rows.length} of {data.students.length}</span>
        </div>
      </div>
      <div className="ln-tablewrap"><table className="ln-table" style={{ margin: '0 18px 12px', width: 'calc(100% - 36px)' }}>
        <thead><tr><th>Student</th><th>Readiness</th>{data.clusters.map(cl => <th key={cl.id} title={`${cl.nodes} skills`}>{cl.label}</th>)}<th>Status</th><th /></tr></thead>
        <tbody>{rows.map(s => (
          <tr key={s.el_id}>
            <td><b style={{ fontWeight: 600 }}>{s.name}</b> <span className="ln-xs ln-muted">{s.learner_ref}</span></td>
            <td><span className={`ln-tag ${BAND_TAG[s.band]}`}>{s.readiness} · {s.band_label}</span></td>
            {s.cells.map((pct, i) => <td key={data.clusters[i].id} style={{ background: shade(pct), textAlign: 'center' }} className="ln-small">{pct}%</td>)}
            <td>{s.light ? <span className="ln-row" style={{ gap: 6 }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 9, background: LIGHT[s.light][0] }} /><span className="ln-xs">{LIGHT[s.light][1]}</span></span> : '—'}</td>
            <td><button type="button" className="ln-btn ln-btn-sm" onClick={() => setOpen(s)}>{s.band === 'ready' ? 'Why ready' : 'Why not ready?'}</button></td>
          </tr>
        ))}</tbody></table></div>
      <div style={{ padding: '0 18px 16px' }}><HowCounted>Each skill-area cell is the share of its skills the student has verified. Readiness is the match with the best-fitting job role on verified skills: Ready 80+, Nearly ready 60–79, Building under 60.</HowCounted></div>
      {open && <WhyDrawer cohortId={c.id} student={open} canBridge={canBridge} onClose={() => setOpen(null)} />}
    </section>
  );
}
