// src/pages/admin/Quality.js — /admin/quality — where the evaluator and the
// instruction struggle (nodes by attempts) and the calibration register
// (v4.3 Appendix A.1): every tunable group, its stage, how it is fitted and
// the data that triggers fitting.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';

export default function AdminQuality() {
  const [q, setQ] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/admin/quality-report').then(r => setQ(r.data)).catch(e => setError(errMsg(e))); }, []);
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">Evaluator quality</h1><span className="ln-sub">{q?.note || 'Loading…'}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <h2 className="ln-h2" style={{ fontSize: 18 }}>Hardest nodes</h2>
      <div className="ln-tablewrap" style={{ marginBottom: 24 }}>
        <table className="ln-table">
          <thead><tr><th>Node</th><th>Cluster</th><th>Learners</th><th>Avg attempts</th><th>Avg mastery</th><th>Confidence</th></tr></thead>
          <tbody>
            {q && q.node_difficulty_ranking.length === 0 && <tr><td colSpan={6} className="ln-muted">No attempts yet.</td></tr>}
            {(q?.node_difficulty_ranking || []).slice(0, 25).map(n => (
              <tr key={n.skill_node_id}><td style={{ fontWeight: 600 }}>{n.node_label}</td><td>{n.cluster_label}</td><td>{n.learners_attempted}</td>
                <td>{n.avg_attempts?.toFixed(1)}</td><td>{n.avg_mastery != null ? `${Math.round(n.avg_mastery * 100)}%` : '—'}</td><td>{n.avg_confidence != null ? n.avg_confidence.toFixed(2) : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="ln-h2" style={{ fontSize: 18 }}>Calibration register</h2>
      <div className="ln-tablewrap">
        <table className="ln-table">
          <thead><tr><th>Parameters</th><th>Stage</th><th>Fitting method</th><th>Fit when</th><th>Source</th></tr></thead>
          <tbody>{(q?.calibration_register || []).map(g => (
            <tr key={g.group}><td style={{ fontWeight: 600 }}>{g.group}</td><td><span className="ln-tag ln-tag-neutral">{g.stage}</span></td><td className="ln-small">{g.method}</td><td className="ln-small">{g.trigger}</td>
              <td><span className={`ln-tag ${g.overriddenBySecureConfig ? 'ln-tag-success' : 'ln-tag-warning'}`}>{g.overriddenBySecureConfig ? 'secure-config' : 'repo prior'}</span></td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
