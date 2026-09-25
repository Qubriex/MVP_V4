// src/pages/inst/Cohorts.js — /institution/cohorts
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../../utils/api';
import { Bar } from '../../components/learn/ui';
import { useStaff } from '../../components/inst/InstitutionLayout';

export const COHORT_STATUS = { active: ['Active', 'ln-tag-success'], setup: ['Setting up', 'ln-tag-warning'], completed: ['Completed', 'ln-tag-neutral'], on_hold: ['On hold', 'ln-tag-warning'] };

export default function Cohorts() {
  const { role } = useStaff();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/institution/engagements').then(r => setRows(r.data)).catch(e => setError(e.response?.data?.error || 'Couldn’t load cohorts.')); }, []);

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">Cohorts</h1>
          <span className="ln-sub">{role === 'professor' ? 'The cohorts assigned to you.' : 'Every cohort in your institution.'}</span>
        </div>
        {role === 'admin' && <Link to="/institution/cohorts/new" className="ln-btn ln-btn-primary"><Plus size={16} aria-hidden="true" />New cohort</Link>}
      </header>
      {error && <div className="ln-error">{error}</div>}
      {rows && rows.length === 0 && <div className="ln-card ln-muted">{role === 'admin' ? 'No cohorts yet. Create one to set up a pathway and add students.' : 'No cohorts are assigned to you yet.'}</div>}
      <div className="ln-grid ln-g-2" style={{ gap: 16 }}>
        {(rows || []).map(c => (
          <Link key={c.id} to={`/institution/cohorts/${c.id}`} className="ln-card ln-card-link" style={{ gap: 12 }}>
            <div className="ln-between" style={{ alignItems: 'flex-start' }}>
              <div className="ln-col" style={{ gap: 2 }}><span style={{ fontSize: 17, fontWeight: 600 }}>{c.title}</span>
                <span className="ln-small ln-muted">{c.ct_title} v{c.ct_version} · {c.language === 'hindi' ? 'Hindi' : 'Telugu'} · {c.total_nodes} skill nodes</span></div>
              <span className={`ln-tag ln-tag-lg ${(COHORT_STATUS[c.status] || COHORT_STATUS.setup)[1]}`}>{(COHORT_STATUS[c.status] || COHORT_STATUS.setup)[0]}</span>
            </div>
            <Bar pct={c.avg_progress} variant="ln-bar-vivid" label={`Average progress ${c.avg_progress}%`} />
            <div className="ln-between ln-small ln-wrap">
              <span>{c.learner_count} students · {c.avg_progress}% average progress</span>
              <span>Join code <b className="in-code">{c.join_code}</b></span>
            </div>
            {c.professors.length > 0 && <span className="ln-xs ln-muted">Professors: {c.professors.map(p => [p.title, p.name].filter(Boolean).join(' ') + (p.cohort_role === 'lead' ? ' (lead)' : '')).join(', ')}</span>}
          </Link>
        ))}
      </div>
    </>
  );
}
