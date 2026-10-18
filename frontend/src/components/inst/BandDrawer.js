// Drill-down: click a readiness band (college Home) to list those students
// across the cohorts in your scope, with a link into each cohort's grid.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import Drawer from '../shared/Drawer';
import { BandPill, Skeleton } from '../shared/ui';
import EmptyState from '../shared/EmptyState';
import { useUiLang } from '../../context/UiLangContext';

export default function BandDrawer({ band, onClose }) {
  const { t } = useUiLang();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const cohorts = (await api.get('/institution/engagements')).data || [];
      const lists = await Promise.all(cohorts.map(c => api.get(`/institution/engagements/${c.id}/grid`).then(r => r.data.students.map(s => ({ ...s, cohort: c }))).catch(() => [])));
      if (live) setRows(lists.flat().filter(s => s.band === band).sort((a, b) => b.readiness - a.readiness));
    })().catch(() => live && setRows([]));
    return () => { live = false; };
  }, [band]);
  return (
    <Drawer title={t(`band.${band}`)} onClose={onClose} width={440}>
      {!rows ? <Skeleton lines={5} /> : rows.length === 0 ? <EmptyState title={t('inst.band.none')} /> : (
        <ul className="ln-col" style={{ gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map(s => (
            <li key={s.el_id}>
              <Link to={`/institution/cohorts/${s.cohort.id}?tab=Readiness`} className="ln-tile ln-card-link ui-card-hover ln-between" style={{ flexDirection: 'row', padding: '10px 12px', alignItems: 'center', gap: 10 }}>
                <span className="ln-col" style={{ gap: 2, minWidth: 0 }}><b>{s.name}</b><span className="ln-xs ln-muted">{s.cohort.title} · {s.learner_ref}</span></span>
                <BandPill band={s.band} score={s.readiness} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
