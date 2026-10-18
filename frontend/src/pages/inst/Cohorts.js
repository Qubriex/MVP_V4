// src/pages/inst/Cohorts.js — /institution/cohorts
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../../utils/api';
import { Bar } from '../../components/learn/ui';
import { useStaff } from '../../components/inst/InstitutionLayout';
import { errMsg } from '../../utils/errors';

import { useUiLang } from '../../context/UiLangContext';
export const COHORT_STATUS = { active: ['inst.cohorts.cohortStatus.active', 'ln-tag-success'], setup: ['inst.cohorts.cohortStatus.settingUp', 'ln-tag-warning'], completed: ['inst.cohorts.cohortStatus.completed', 'ln-tag-neutral'], on_hold: ['inst.cohorts.cohortStatus.onHold', 'ln-tag-warning'] };

export default function Cohorts() {
  const { t } = useUiLang();
  const { role } = useStaff();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/institution/engagements').then(r => setRows(r.data)).catch(e => setError(errMsg(e, t('inst.cohorts.couldnTLoadCohorts')))); }, []);

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{t('inst.cohorts.cohorts')}</h1>
          <span className="ln-sub">{role === 'professor' ? t('inst.cohorts.cohortsAssigned') : t('inst.cohorts.everyCohortInstitution')}</span>
        </div>
        {role === 'admin' && <Link to="/institution/cohorts/new" className="ln-btn ln-btn-primary"><Plus size={16} aria-hidden="true" />{t('inst.cohorts.newCohort')}</Link>}
      </header>
      {error && <div className="ln-error">{error}</div>}
      {rows && rows.length === 0 && <div className="ln-card ln-muted">{role === 'admin' ? t('inst.cohorts.noCohortsYetCreate') : t('inst.cohorts.noCohortsAssignedYet')}</div>}
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        {(rows || []).map(c => (
          <Link key={c.id} to={`/institution/cohorts/${c.id}`} className="ln-card ln-card-link" style={{ gap: 12 }}>
            <div className="ln-between" style={{ alignItems: 'flex-start' }}>
              <div className="ln-col" style={{ gap: 2 }}><span style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{c.title}</span>
                <span className="ln-small ln-muted">{c.ct_title} v{c.ct_version} · {c.language === 'hindi' ? t('inst.cohorts.hindi') : t('inst.cohorts.telugu')} {' '}{t('inst.cohorts.totalNodesSkillNodes', { total_nodes: c.total_nodes })}</span></div>
              <span className={`ln-tag ln-tag-lg ${(COHORT_STATUS[c.status] || COHORT_STATUS.setup)[1]}`}>{t((COHORT_STATUS[c.status] || COHORT_STATUS.setup)[0])}</span>
            </div>
            <Bar pct={c.avg_progress} variant="ln-bar-vivid" label={t('inst.cohorts.averageProgressAvgProgress', { avg_progress: c.avg_progress })} />
            <div className="ln-between ln-small ln-wrap">
              <span>{t('inst.cohorts.learnerCountStudentsAvg', { learner_count: c.learner_count, avg_progress: c.avg_progress })}</span>
              <span>{t('inst.cohorts.joinCode')}{' '} <b className="in-code">{c.join_code}</b></span>
            </div>
            {c.professors.length > 0 && <span className="ln-xs ln-muted">{t('inst.cohorts.professors')}{' '} {c.professors.map(p => [p.title, p.name].filter(Boolean).join(' ') + (p.cohort_role === 'lead' ? ' ' + t('inst.cohorts.lead') : '')).join(', ')}</span>}
          </Link>
        ))}
      </div>
    </>
  );
}
