// src/pages/inst/Bridges.js — /institution/bridges and /institution/bridges/:id
// (v4.3 canvas I8). A bridge programme is short extra practice on the skills
// holding students back, with a re-test date; "Did it work?" compares each
// student's skills and readiness then and now.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, CheckCircle2 } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { useStaff } from '../../components/inst/InstitutionLayout';
import Crumbs from '../../components/inst/Crumbs';
import EmptyState from '../../components/shared/EmptyState';
import { HowCounted } from '../../components/shared/Popover';
import { SmallSample } from '../../components/shared/SampleSize';
import { Select } from '../../components/shared/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const day = (s) => (s ? new Date(s).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function NewBridge({ onCreated, onCancel }) {
  const { t } = useUiLang();
  const [params] = useSearchParams();
  const { data: cohorts } = useCachedGet('/institution/engagements');
  const [cohortId, setCohortId] = useState(params.get('cohort') || '');
  const [c, setC] = useState(null);
  const [nodes, setNodes] = useState(() => new Set((params.get('nodes') || '').split(',').filter(Boolean)));
  const [scope, setScope] = useState(params.get('students') ? 'students' : 'cohort');
  const [students, setStudents] = useState(() => new Set((params.get('students') || '').split(',').filter(Boolean)));
  const [title, setTitle] = useState('');
  const [retest, setRetest] = useState(inDays(14));
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id); }, [cohorts, cohortId]);
  useEffect(() => {
    if (!cohortId) return;
    setC(null);
    api.get(`/institution/engagements/${cohortId}`).then(r => setC(r.data)).catch(() => setMsg(t('inst.bridges.couldnTLoadCohort')));
  }, [cohortId]);
  const toggle = (set, setter, id) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const r = await api.post('/institution/bridges', { engagement_id: cohortId, node_ids: [...nodes], scope, el_ids: [...students], retest_at: retest, title: title || undefined, note: note || undefined });
      onCreated(r.data.id);
    } catch (err) { setMsg(errMsg(err, t('inst.bridges.couldnTStartBridge'))); setBusy(false); }
  };
  const learners = (c?.learners || []).filter(l => l.access !== 'removed');
  return (
    <form className="ui-narrow ln-card" style={{ gap: 16 }} onSubmit={submit}>
      <h2 className="ln-h2">{t('inst.bridges.startBridgeProgramme')}</h2>
      <span className="ln-small ln-muted">{t('inst.bridges.pickSkillsStrengthenWho')}</span>
      <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="br-cohort">{t('inst.bridges.cohort')}</label>
          <Select id="br-cohort" value={cohortId} onChange={e => { setCohortId(e.target.value); setNodes(new Set()); setStudents(new Set()); }}>
            {(cohorts || []).map(x => <option key={x.id} value={x.id}>{x.title}</option>)}
          </Select></div>
        <div className="ln-field"><label className="ln-label" htmlFor="br-retest">{t('inst.bridges.reTest')}</label><input id="br-retest" type="date" className="ln-input" value={retest} min={inDays(1)} onChange={e => setRetest(e.target.value)} required /></div>
      </div>
      <fieldset className="ln-col" style={{ gap: 8, border: 0, padding: 0 }}>
        <legend className="ln-label">{t('inst.bridges.skillsStrengthen')}</legend>
        {!c && <span className="ln-small ln-muted">{t('inst.bridges.loadingSkills')}</span>}
        {c?.clusters.map(cl => (
          <div key={cl.id} className="ln-col" style={{ gap: 4 }}>
            <span className="ln-xs ln-muted">{cl.label}</span>
            <div className="ln-row ln-wrap" style={{ gap: 6 }}>
              {cl.nodes.map(n => (
                <label key={n.id} className="ln-check ln-chip" style={{ padding: '4px 10px' }}>
                  <input type="checkbox" checked={nodes.has(n.id)} onChange={() => toggle(nodes, setNodes, n.id)} />{n.node_label}
                  <span className="ln-xs ln-muted">{t('inst.bridges.masteredPctDone', { mastered_pct: n.mastered_pct })}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <fieldset className="ln-col" style={{ gap: 8, border: 0, padding: 0 }}>
        <legend className="ln-label">{t('inst.bridges.who')}</legend>
        <div className="ln-row ln-wrap" style={{ gap: 16 }}>
          <label className="ln-check"><input type="radio" name="scope" checked={scope === 'cohort'} onChange={() => setScope('cohort')} />{t('inst.bridges.wholeCohortLength', { length: learners.length })}</label>
          <label className="ln-check"><input type="radio" name="scope" checked={scope === 'students'} onChange={() => setScope('students')} />{t('inst.bridges.chosenStudents')}{scope === 'students' ? ` (${students.size})` : ''}</label>
        </div>
        {scope === 'students' && (
          <div className="ln-grid ln-g-3" style={{ gap: 6, maxHeight: 240, overflow: 'auto' }}>
            {learners.map(l => <label key={l.el_id} className="ln-check ln-small"><input type="checkbox" checked={students.has(l.el_id)} onChange={() => toggle(students, setStudents, l.el_id)} />{l.name}</label>)}
          </div>
        )}
      </fieldset>
      <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="br-title">{t('inst.bridges.nameOptional')}</label><input id="br-title" className="ln-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('inst.bridges.exampleSqlJoinsCatch')} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="br-note">{t('inst.bridges.noteStudentsOptional')}</label><input id="br-note" className="ln-input" value={note} onChange={e => setNote(e.target.value)} placeholder={t('inst.bridges.twoShortSessionsDay')} /></div>
      </div>
      {msg && <div className="ln-error" role="alert">{msg}</div>}
      <div className="ln-row" style={{ gap: 8 }}>
        <button type="submit" className="ln-btn ln-btn-primary" disabled={busy || !nodes.size || (scope === 'students' && !students.size)}>{busy ? t('inst.bridges.starting') : t('inst.bridges.startBridgeProgramme2')}</button>
        <button type="button" className="ln-btn" onClick={onCancel}>{t('inst.bridges.cancel')}</button>
      </div>
    </form>
  );
}

export function BridgeList() {
  const { t } = useUiLang();
  const { role } = useStaff();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data, error } = useCachedGet('/institution/bridges');
  const creating = params.get('new') === '1';
  const canEdit = role !== 'viewer';
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('inst.bridges.bridgeProgrammes')}</h1>
          <span className="ln-sub">{t('inst.bridges.shortExtraPracticeSkills')}</span></div>
        {canEdit && !creating && <button type="button" className="ln-btn ln-btn-primary" onClick={() => setParams({ new: '1' })}><Plus size={16} aria-hidden="true" />{t('inst.bridges.newBridgeProgramme')}</button>}
      </header>
      {creating && canEdit && <NewBridge onCreated={(id) => { dropCached('/institution/bridges'); navigate(`/institution/bridges/${id}`); }} onCancel={() => setParams({})} />}
      {error && !data && <div className="ln-error">{errMsg(error, t('inst.bridges.couldnTLoadBridge'))}</div>}
      {data && data.length === 0 && !creating && (
        <EmptyState title={t('inst.bridges.noBridgeProgrammesYet')} text={t('inst.bridges.whenStudentsNearlyReady')} action={canEdit ? <button type="button" className="ln-btn ln-btn-primary" onClick={() => setParams({ new: '1' })}>{t('inst.bridges.startOne')}</button> : null} />
      )}
      {data && data.length > 0 && (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>{t('inst.bridges.programme')}</th><th>{t('inst.bridges.cohort')}</th><th>{t('inst.bridges.skills')}</th><th>{t('inst.bridges.students')}</th><th>{t('inst.bridges.reTest2')}</th><th>{t('inst.bridges.status')}</th></tr></thead>
          <tbody>{data.map(b => (
            <tr key={b.id}>
              <td><Link to={`/institution/bridges/${b.id}`} className="ln-link">{b.title}</Link></td>
              <td className="ln-small">{b.cohort}</td>
              <td className="ln-small">{b.skills.join(', ')}</td>
              <td>{b.students}</td>
              <td className="ln-small">{day(b.retest_at)}</td>
              <td><span className={`ln-tag ${b.status === 'open' ? 'ln-tag-info' : 'ln-tag-success'}`}>{b.status === 'open' ? t('inst.bridges.running') : t('inst.bridges.closed')}</span></td>
            </tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}

export function BridgeDetail() {
  const { t } = useUiLang();
  const { id } = useParams();
  const { role } = useStaff();
  const { data: b, error, reload } = useCachedGet(`/institution/bridges/${id}`);
  const [msg, setMsg] = useState('');
  const avgUp = useMemo(() => (b?.result.readiness_now != null && b?.result.readiness_before != null ? b.result.readiness_now - b.result.readiness_before : null), [b]);
  if (error && !b) return <div className="ln-error">{errMsg(error, t('inst.bridges.couldnTLoadBridge2'))}</div>;
  if (!b) return <p className="ln-muted">{t('inst.bridges.loading')}</p>;
  const close = async () => {
    try { await api.post(`/institution/bridges/${id}/close`); dropCached('/institution/bridges'); reload(); } catch (e) { setMsg(errMsg(e, t('inst.bridges.couldnTClose'))); }
  };
  const r = b.result;
  return (
    <>
      <Crumbs items={[{ label: 'Bridge programmes', to: '/institution/bridges' }, { label: b.title }]} />
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{b.title}</h1>
          <span className="ln-sub">{t('inst.bridges.titleJoinStartedDay', { title: b.cohort.title, join: b.skills.map(s => s.label).join(', '), day: day(b.created_at), day2: day(b.retest_at) })}</span></div>
        {role !== 'viewer' && b.status === 'open' && <button type="button" className="ln-btn" onClick={close}>{t('inst.bridges.closeProgramme')}</button>}
      </header>
      {msg && <div className="ln-error">{msg}</div>}
      <section className={`ln-card ${r.retest_due ? '' : 'ln-card-warm'}`} style={{ gap: 10 }}>
        <div className="ln-between"><h2 className="ln-h2">{t('inst.bridges.didWork')}</h2><SmallSample n={r.assigned} /></div>
        <b style={{ fontSize: 'var(--fs-h3)' }}>{r.verdict}</b>
        <div className="ln-grid ln-g-4" style={{ gap: 12 }}>
          <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{r.assigned}</b><span className="ln-xs ln-muted">{t('inst.bridges.students2')}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{r.improved}</b><span className="ln-xs ln-muted">{t('inst.bridges.improved')}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{r.completed}</b><span className="ln-xs ln-muted">{t('inst.bridges.holdEveryBridgeSkill')}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{r.readiness_before ?? '—'} → {r.readiness_now ?? '—'}</b><span className="ln-xs ln-muted">{t('inst.bridges.averageReadiness')}{avgUp ? ` (${avgUp > 0 ? '+' : ''}${avgUp})` : ''}</span></div>
        </div>
        <HowCounted>{t('inst.bridges.eachStudentWeSaved')}</HowCounted>
      </section>
      <div className="ln-tablewrap"><table className="ln-table">
        <thead><tr><th>{t('inst.bridges.student')}</th><th>{t('inst.bridges.bridgeSkills')}</th><th>{t('inst.bridges.newlyVerified')}</th><th>{t('inst.bridges.readinessThenNow')}</th><th>{t('inst.bridges.bandNow')}</th></tr></thead>
        <tbody>{b.students.map(s => (
          <tr key={s.el_id}>
            <td><b style={{ fontWeight: 600 }}>{s.name}</b> <span className="ln-xs ln-muted">{s.learner_ref}</span></td>
            <td style={{ whiteSpace: 'nowrap' }}>{t('inst.bridges.skillsBeforeSkillsNow', { skills_before: s.skills_before, skills_now: s.skills_now, skills_total: s.skills_total })}{s.skills_now === s.skills_total && <CheckCircle2 size={14} style={{ color: 'var(--status-success)', marginLeft: 6, verticalAlign: -2 }} aria-label={t('inst.bridges.allDone')} />}</td>
            <td className="ln-small">{s.newly_mastered.join(', ') || '—'}</td>
            <td>{s.readiness_before ?? '—'} → {s.readiness_now ?? '—'}</td>
            <td className="ln-small">{s.band_now || '—'}</td>
          </tr>
        ))}</tbody></table></div>
    </>
  );
}
