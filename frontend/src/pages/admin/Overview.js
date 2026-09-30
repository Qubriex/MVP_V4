// src/pages/admin/Overview.js — /admin/overview — platform counts and institutions.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';

const STATS = [['institutions', 'Institutions'], ['learners', 'Learners'], ['active_engagements', 'Active cohorts'], ['sessions_total', 'Sessions'], ['checks_passed', 'Checks passed'], ['checks_failed', 'Checks not yet passed'], ['mastery_logs_produced', 'Mastery Logs']];

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [insts, setInsts] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(e => setError(errMsg(e)));
    api.get('/admin/institutions').then(r => setInsts(r.data)).catch(() => {});
  }, []);
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Overview</h1><span className="ln-sub">Across every institution on Qubirex.</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-grid ln-g-4" style={{ gap: 12, marginBottom: 20 }}>
        {STATS.map(([k, label]) => (
          <div key={k} className="ln-card ln-card-sm"><span className="ln-xs ln-muted">{label}</span><b style={{ fontSize: 26 }}>{stats ? stats[k] ?? 0 : '…'}</b></div>
        ))}
        <div className="ln-card ln-card-sm"><span className="ln-xs ln-muted">Average mastery</span><b style={{ fontSize: 26 }}>{stats?.avg_mastery != null ? `${Math.round(stats.avg_mastery * 100)}%` : '—'}</b></div>
      </div>
      <div className="ln-tablewrap">
        <table className="ln-table">
          <thead><tr><th>Institution</th><th>City</th><th>Cohorts</th><th>Learners</th><th>Joined</th></tr></thead>
          <tbody>{insts.map(i => <tr key={i.id}><td style={{ fontWeight: 600 }}>{i.name}</td><td>{i.city || '—'}</td><td>{i.engagement_count}</td><td>{i.learner_count}</td><td className="ln-small ln-muted">{i.created_at ? new Date(i.created_at).toLocaleDateString() : '—'}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
