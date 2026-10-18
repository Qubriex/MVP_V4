// src/pages/admin/Quality.js — /admin/quality — where the evaluator and the
// instruction struggle (nodes by attempts) and the calibration register
// (v4.3 Appendix A.1): every tunable group, its stage, how it is fitted and
// the data that triggers fitting.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';

import { useUiLang } from '../../context/UiLangContext';
export default function AdminQuality() {
  const { t } = useUiLang();
  const [q, setQ] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/admin/quality-report').then(r => setQ(r.data)).catch(e => setError(errMsg(e))); }, []);
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('adm.quality.evaluatorQuality')}</h1><span className="ln-sub">{q?.note || t('adm.quality.loading')}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('adm.quality.speedFailuresLast7')}</h2>
      <span className="ln-small ln-muted">{t('adm.quality.targetsHerVoiceStarts')}</span>
      <div className="ln-tablewrap" style={{ marginBottom: 12 }}>
        <table className="ln-table">
          <thead><tr><th>{t('adm.quality.task')}</th><th>{t('adm.quality.calls')}</th><th>{t('adm.quality.median')}</th><th>{t('adm.quality.90thPercentile')}</th><th>{t('adm.quality.target')}</th><th>{t('adm.quality.failed')}</th><th>{t('adm.quality.cutOff')}</th><th>{t('adm.quality.maxTokensOut')}</th></tr></thead>
          <tbody>
            {q && q.speed.length === 0 && <tr><td colSpan={8} className="ln-muted">{t('adm.quality.noCallsLast7')}</td></tr>}
            {(q?.speed || []).map(t => {
              const slow = t.target_ms && t.p50_ms > t.target_ms;
              return (
                <tr key={t.task}><td style={{ fontWeight: 600 }}>{t.task}</td><td>{t.calls}</td><td>{(t.p50_ms / 1000).toFixed(1)} s</td><td>{(t.p90_ms / 1000).toFixed(1)} s</td>
                  <td>{t.target_ms ? <span className={`ln-tag ${slow ? 'ln-tag-warning' : 'ln-tag-success'}`}>{slow ? '⚠ ' : '✓ '}{t.target_ms / 1000} s</span> : '—'}</td>
                  <td>{t.failed || 0}</td><td>{t.truncated || 0}</td><td>{t.max_tokens_out ?? '—'}</td></tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('adm.quality.whichVoiceEngineAnswered')}</h2>
      <div className="ln-tablewrap" style={{ marginBottom: 24 }}>
        <table className="ln-table">
          <thead><tr><th>{t('adm.quality.engine')}</th><th>{t('adm.quality.status')}</th><th>{t('adm.quality.calls')}</th><th>{t('adm.quality.average')}</th></tr></thead>
          <tbody>
            {q && q.voice_engines.length === 0 && <tr><td colSpan={4} className="ln-muted">{t('adm.quality.noVoiceCallsLast')}</td></tr>}
            {(q?.voice_engines || []).map((e, i) => <tr key={i}><td style={{ fontWeight: 600 }}>{e.engine}</td><td>{e.status}</td><td>{e.calls}</td><td>{(e.avg_ms / 1000).toFixed(1)} s</td></tr>)}
          </tbody>
        </table>
      </div>
      <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('adm.quality.hardestNodes')}</h2>
      <div className="ln-tablewrap" style={{ marginBottom: 24 }}>
        <table className="ln-table">
          <thead><tr><th>{t('adm.quality.node')}</th><th>{t('adm.quality.cluster')}</th><th>{t('adm.quality.learners')}</th><th>{t('adm.quality.avgAttempts')}</th><th>{t('adm.quality.avgMastery')}</th><th>{t('adm.quality.confidence')}</th></tr></thead>
          <tbody>
            {q && q.node_difficulty_ranking.length === 0 && <tr><td colSpan={6} className="ln-muted">{t('adm.quality.noAttemptsYet')}</td></tr>}
            {(q?.node_difficulty_ranking || []).slice(0, 25).map(n => (
              <tr key={n.skill_node_id}><td style={{ fontWeight: 600 }}>{n.node_label}</td><td>{n.cluster_label}</td><td>{n.learners_attempted}</td>
                <td>{n.avg_attempts?.toFixed(1)}</td><td>{n.avg_mastery != null ? `${Math.round(n.avg_mastery * 100)}%` : '—'}</td><td>{n.avg_confidence != null ? n.avg_confidence.toFixed(2) : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('adm.quality.calibrationRegister')}</h2>
      <div className="ln-tablewrap">
        <table className="ln-table">
          <thead><tr><th>{t('adm.quality.parameters')}</th><th>{t('adm.quality.stage')}</th><th>{t('adm.quality.fittingMethod')}</th><th>{t('adm.quality.fitWhen')}</th><th>{t('adm.quality.source')}</th></tr></thead>
          <tbody>{(q?.calibration_register || []).map(g => (
            <tr key={g.group}><td style={{ fontWeight: 600 }}>{g.group}</td><td><span className="ln-tag ln-tag-neutral">{g.stage}</span></td><td className="ln-small">{g.method}</td><td className="ln-small">{g.trigger}</td>
              <td><span className={`ln-tag ${g.overriddenBySecureConfig ? 'ln-tag-success' : 'ln-tag-warning'}`}>{g.overriddenBySecureConfig ? t('adm.quality.secureConfig') : t('adm.quality.repoPrior')}</span></td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
