// src/pages/admin/Overview.js — /admin/overview — platform counts and institutions.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const STATS = [['institutions', 'adm.overview.stats.institutions'], ['learners', 'adm.overview.stats.learners'], ['active_engagements', 'adm.overview.stats.activeCohorts'], ['sessions_total', 'adm.overview.stats.sessions'], ['checks_passed', 'adm.overview.stats.checksPassed'], ['checks_failed', 'adm.overview.stats.checksNotYetPassed'], ['mastery_logs_produced', 'adm.overview.stats.masteryLogs']];

export default function AdminOverview() {
  const { t } = useUiLang();
  const [stats, setStats] = useState(null);
  const [insts, setInsts] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(e => setError(errMsg(e)));
    api.get('/admin/institutions').then(r => setInsts(r.data)).catch(() => {});
  }, []);
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('adm.overview.overview')}</h1><span className="ln-sub">{t('adm.overview.acrossEveryInstitutionQubirex')}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-grid ln-g-4" style={{ gap: 12, marginBottom: 20 }}>
        {STATS.map(([k, label]) => (
          <div key={k} className="ln-card ln-card-sm"><span className="ln-xs ln-muted">{t(label)}</span><b style={{ fontSize: 'var(--fs-h1)' }}>{stats ? stats[k] ?? 0 : '…'}</b></div>
        ))}
        <div className="ln-card ln-card-sm"><span className="ln-xs ln-muted">{t('adm.overview.averageMastery')}</span><b style={{ fontSize: 'var(--fs-h1)' }}>{stats?.avg_mastery != null ? `${Math.round(stats.avg_mastery * 100)}%` : '—'}</b></div>
      </div>
      <div className="ln-tablewrap">
        <table className="ln-table">
          <thead><tr><th>{t('adm.overview.institution')}</th><th>{t('adm.overview.city')}</th><th>{t('adm.overview.cohorts')}</th><th>{t('adm.overview.learners')}</th><th>{t('adm.overview.joined')}</th></tr></thead>
          <tbody>{insts.map(i => <tr key={i.id}><td style={{ fontWeight: 600 }}>{i.name}</td><td>{i.city || '—'}</td><td>{i.engagement_count}</td><td>{i.learner_count}</td><td className="ln-small ln-muted">{i.created_at ? new Date(i.created_at).toLocaleDateString(uiLocale()) : '—'}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
