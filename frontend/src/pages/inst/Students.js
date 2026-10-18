// src/pages/inst/Students.js — /institution/students
// One place for student access: filter by cohort and access state, select
// students, and resend invites, reset PINs, move them between cohorts or
// remove access. Clicking a row opens its login details and access history.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, KeyRound, Radio, Download, X } from 'lucide-react';
import Crumbs from '../../components/inst/Crumbs';
import DownloadDialog from '../../components/inst/DownloadDialog';
import { peekCached } from '../../utils/cachedGet';
import api from '../../utils/api';
import { useStaff } from '../../components/inst/InstitutionLayout';
import AccessResults from '../../components/inst/AccessResults';
import LearningCurve from '../../components/learn/LearningCurve';
import { errMsg } from '../../utils/errors';
import { Select } from '../../components/shared/ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
export const ACCESS = { active: 'inst.students.access.active', invited: 'inst.students.access.invited', never_signed_in: 'inst.students.access.neverSignedIn', locked: 'inst.students.access.locked', removed: 'inst.students.access.removed' };
const FILTERS = [['all', 'inst.students.filters.all'], ['active', 'inst.students.filters.active'], ['invited', 'inst.students.filters.invited'], ['never_signed_in', 'inst.students.filters.neverSignedIn'], ['locked', 'inst.students.filters.locked'], ['removed', 'inst.students.filters.removed'], ['reset_requested', 'inst.students.filters.pinResetRequested']];
const EVENT = {
  invited: 'inst.students.event.invited', invite_resent: 'inst.students.event.inviteResent', pin_set: 'inst.students.event.pinSet', pin_reset: 'inst.students.event.pinReset', slip_issued: 'inst.students.event.printedSlipIssued',
  signed_in: 'inst.students.event.signedIn', locked: 'inst.students.event.lockedAfterWrongPins', shared_account_suspected: 'inst.students.event.signedInFromTwo', data_exported: 'inst.students.event.dataDownloaded', removed: 'inst.students.event.accessRemoved', restored: 'inst.students.event.accessRestored', moved: 'inst.students.event.moved', pin_reset_requested: 'inst.students.event.askedForAPin'
};
const when = (t) => (t ? new Date(t.replace(' ', 'T') + (t.includes('Z') || t.includes('+') ? '' : 'Z')).toLocaleString(uiLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

export function AccessTag({ state }) {
  const { t } = useUiLang();
  return <span className={`ln-tag ln-tag-lg in-state-${state}`}>{t(ACCESS[state])}</span>;
}

// Confirm dialogs for actions that need a choice (move target, reset delivery).
function ActionModal({ action, count, cohorts, onCancel, onConfirm }) {
  const { t } = useUiLang();
  const [target, setTarget] = useState(cohorts[0]?.id || '');
  const [delivery, setDelivery] = useState('slips');
  const title = { move: t('inst.students.bulkMove', { n: count }), reset_pin: t('inst.students.bulkReset', { n: count }), remove: t('inst.students.bulkRemove', { n: count }) }[action];
  return (
    <div className="in-modal-scrim" role="dialog" aria-modal="true" aria-labelledby="am-title" onClick={onCancel}>
      <div className="ln-card in-modal" onClick={e => e.stopPropagation()}>
        <h2 id="am-title" className="ln-h2">{title}</h2>
        {action === 'move' && (
          <div className="ln-field"><label className="ln-label" htmlFor="mv">{t('inst.students.moveTo')}</label>
            <Select id="mv" value={target} onChange={e => setTarget(e.target.value)}>{cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
            <span className="ln-xs ln-muted">{t('inst.students.sameProgrammeProgressKept')}</span></div>
        )}
        {action === 'reset_pin' && (
          <div className="ln-col" style={{ gap: 10 }}>
            <label className="in-radio"><input type="radio" name="dl" checked={delivery === 'slips'} onChange={() => setDelivery('slips')} /><div className="ln-col"><b>{t('inst.students.oneTimePinPrinted')}</b><span className="ln-small ln-muted">{t('inst.students.shownOnceHereStudent')}</span></div></label>
            <label className="in-radio"><input type="radio" name="dl" checked={delivery === 'email'} onChange={() => setDelivery('email')} /><div className="ln-col"><b>{t('inst.students.newInviteLink')}</b><span className="ln-small ln-muted">{t('inst.students.studentSetsTheirOwn')}</span></div></label>
            <span className="ln-xs ln-muted">{t('inst.students.resettingAlsoUnlocksStudents')}</span>
          </div>
        )}
        {action === 'remove' && <span className="ln-small">{t('inst.students.theySignedOutCan')}</span>}
        <div className="ln-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="ln-btn" onClick={onCancel}>{t('inst.students.cancel')}</button>
          <button type="button" className="ln-btn ln-btn-primary" onClick={() => onConfirm({ target_engagement_id: target, delivery })}>{action === 'remove' ? t('inst.students.removeAccess') : t('inst.students.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

export default function Students() {
  const { t } = useUiLang();
  const { role } = useStaff();
  const canManage = role !== 'viewer';
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const cohortId = params.get('engagement_id') || '';
  const nodeId = params.get('node_id') || '';
  const nodeLabel = params.get('node_label') || '';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(null);
  const [download, setDownload] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(null);
  const [curve, setCurve] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  // Every status is fetched once and the tabs filter in the browser, so
  // switching All / Active / Invited… is instant. Search waits for a pause.
  const load = useCallback(() => {
    const p = new URLSearchParams({ status: 'all' });
    if (cohortId) p.set('engagement_id', cohortId);
    if (nodeId) p.set('node_id', nodeId);
    if (query) p.set('q', query);
    return api.get(`/institution/students?${p}`).then(r => setAll(r.data)).catch(e => setError(errMsg(e, t('inst.students.couldnTLoadStudents'))));
  }, [cohortId, nodeId, query]);

  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { load(); }, [load]);
  const data = useMemo(() => {
    if (!all) return null;
    const rows = status === 'all' ? all.rows : status === 'reset_requested' ? all.rows.filter(r => r.reset_requested) : all.rows.filter(r => r.access === status);
    return { counts: all.counts, rows };
  }, [all, status]);
  useEffect(() => { api.get('/institution/engagements').then(r => setCohorts(r.data)).catch(() => {}); }, []);
  useEffect(() => { setSelected([]); }, [status, cohortId, nodeId]);

  const openDetail = (elId) => api.get(`/institution/students/${elId}`).then(r => setDetail(r.data)).catch(() => {});

  const run = async (action, ids, extra = {}) => {
    setModal(null); setError('');
    try {
      const res = await api.post('/institution/students/actions', { action, el_ids: ids, ...extra });
      setResults(res.data);
      setSelected([]);
      await load();
      if (detail && ids.includes(detail.el_id)) openDetail(detail.el_id);
    } catch (e) { setError(errMsg(e, t('inst.students.didnTWork'))); }
  };
  const ask = (action, ids) => (['move', 'reset_pin', 'remove'].includes(action) ? setModal({ action, ids }) : run(action, ids));

  const rows = data?.rows || [];
  const allOn = rows.length > 0 && rows.every(r => selected.includes(r.el_id));
  const toggle = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const cohort = cohorts.find(c => c.id === cohortId);
  const cohortDetail = cohortId ? peekCached(`/institution/engagements/${cohortId}`) : null;
  const crumbs = cohortId ? [
    { label: t('inst.students.cohorts'), to: '/institution/cohorts' },
    { label: cohort?.title || t('inst.students.cohort'), to: `/institution/cohorts/${cohortId}?tab=${nodeId ? t('inst.students.overview') : t('inst.students.students')}` },
    ...(nodeId ? [{ label: nodeLabel || t('inst.students.oneSkillNode') }] : []),
    { label: t('inst.students.studentsAccess') }
  ] : null;

  return (
    <>
      {crumbs && <Crumbs items={crumbs} />}
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{t('inst.students.studentsAccess')}</h1>
          <span className="ln-sub">{nodeId ? t('inst.students.onNode', { name: nodeLabel || t('inst.students.thisNode') }) : t('inst.students.onePlaceAddStudents')}</span>
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          {cohortId && <Link to={`/institution/cohorts/${cohortId}/live`} className="ln-btn"><Radio size={16} aria-hidden="true" />{t('inst.students.live')}</Link>}
          {cohortId && cohort && <button type="button" className="ln-btn" onClick={() => setDownload(selected)}><Download size={16} aria-hidden="true" />{t('inst.students.downloadData')}</button>}
          {canManage && <Link to={`/institution/students/add${cohortId ? `?cohort=${cohortId}` : ''}`} className="ln-btn ln-btn-primary"><Plus size={16} aria-hidden="true" />{t('inst.students.addStudents')}</Link>}
        </div>
      </header>

      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>{t('inst.students.cohort')}</span>
          <Select value={cohortId} onChange={e => setParam('engagement_id', e.target.value)}><option value="">{t('inst.students.allMyCohorts')}</option>{cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
        </label>
        <label className="ln-search"><Search size={18} aria-hidden="true" /><input aria-label={t('inst.students.searchStudents')} placeholder={t('inst.students.nameRefEmail')} value={q} onChange={e => setQ(e.target.value)} /></label>
        {nodeId && <button type="button" className="ln-btn ln-btn-sm" onClick={() => { const p = new URLSearchParams(params); p.delete('node_id'); p.delete('node_label'); setParams(p, { replace: true }); }}>{t('inst.students.showingStudents')}{' '} {nodeLabel ? `“${nodeLabel}”` : t('inst.students.oneNode')} ×</button>}
      </div>
      <div className="ln-pilltabs" role="tablist" aria-label={t('inst.students.accessStatus')}>
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" role="tab" className="ln-pilltab" aria-selected={status === id} onClick={() => setParam('status', id === 'all' ? '' : id)}>
            {label} <span className="ln-tag ln-tag-neutral" style={{ marginLeft: 4 }}>{data?.counts?.[id] ?? 0}</span>
          </button>
        ))}
      </div>

      {canManage && selected.length > 0 && (
        <div className="in-bulkbar" role="toolbar" aria-label={t('inst.students.actionsSelectedStudents')}>
          <b>{t('inst.students.lengthSelected', { length: selected.length })}</b>
          <span style={{ flex: 1 }} />
          <button type="button" className="ln-btn" onClick={() => ask('resend_invite', selected)}>{t('inst.students.resendInvite')}</button>
          <button type="button" className="ln-btn" onClick={() => ask('reset_pin', selected)}>{t('inst.students.resetPins')}</button>
          <button type="button" className="ln-btn" onClick={() => ask('move', selected)} disabled={cohorts.length < 2}>{t('inst.students.moveCohort')}</button>
          {status === 'removed'
            ? <button type="button" className="ln-btn" onClick={() => ask('restore', selected)}>{t('inst.students.restoreAccess')}</button>
            : <button type="button" className="ln-btn in-danger" onClick={() => ask('remove', selected)}>{t('inst.students.removeAccess')}</button>}
        </div>
      )}
      {error && <div className="ln-error" role="alert">{error}</div>}
      {results && (
        <div className="ln-col" style={{ gap: 8 }}>
          <div className="ln-between"><span className="ln-small" role="status">{t('inst.students.doneDoneStudent', { done: results.done })}</span><button type="button" className="ln-link" onClick={() => setResults(null)}>{t('inst.students.dismiss')}</button></div>
          <AccessResults invites={results.invites} slips={results.slips} skipped={results.skipped} />
        </div>
      )}

      <div className="in-roster">
        <section className="ln-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
          <div className="ln-tablewrap">
            <table className="ln-table">
              <thead><tr style={{ background: 'var(--color-bg-alt)' }}>
                {canManage && <th style={{ paddingLeft: 16, width: 36 }}><input type="checkbox" aria-label={t('inst.students.selectAll')} checked={allOn} onChange={() => setSelected(allOn ? [] : rows.map(r => r.el_id))} /></th>}
                <th style={canManage ? {} : { paddingLeft: 16 }}>{t('inst.students.student')}</th><th>{t('inst.students.cohort')}</th><th>{t('inst.students.access')}</th><th>{t('inst.students.lastSign')}</th><th>{t('inst.students.progress')}</th>
              </tr></thead>
              <tbody>
                {!data && <tr><td colSpan={6} style={{ paddingLeft: 16 }} className="ln-muted">{t('inst.students.loading')}</td></tr>}
                {data && rows.length === 0 && <tr><td colSpan={6} style={{ paddingLeft: 16 }} className="ln-muted">{t('inst.students.noStudentsHere')}{canManage && t('inst.students.useAddStudentsGive')}</td></tr>}
                {rows.map(r => (
                  <tr key={r.el_id} className={detail?.el_id === r.el_id ? 'is-selected' : ''} onClick={() => openDetail(r.el_id)}>
                    {canManage && <td style={{ paddingLeft: 16 }} onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={t('inst.students.selectName', { name: r.name })} checked={selected.includes(r.el_id)} onChange={() => toggle(r.el_id)} /></td>}
                    <td style={canManage ? {} : { paddingLeft: 16 }}>
                      <button type="button" className="ln-col" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); openDetail(r.el_id); }}>
                        <b style={{ fontWeight: 600 }}>{r.name}</b><span className="ln-xs ln-muted">{r.learner_ref}</span>
                      </button>
                    </td>
                    <td className="ln-small">{r.cohort_title}</td>
                    <td><div className="ln-row" style={{ gap: 6 }}><AccessTag state={r.access} />{r.reset_requested && <span title={t('inst.students.askedPinReset')}><KeyRound size={15} color="var(--status-info)" aria-label={t('inst.students.pinResetRequested')} /></span>}</div></td>
                    <td className="ln-small">{r.last_login_at ? when(r.last_login_at) : '—'}</td>
                    <td className="ln-small">{r.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside aria-label={t('inst.students.studentAccessDetail')} className="ln-card" style={{ gap: 16, position: 'sticky', top: 24 }}>
          {!detail ? <span className="ln-small ln-muted">{t('inst.students.selectStudentSeeTheir')}</span> : (
            <>
              <div className="ln-between" style={{ alignItems: 'flex-start' }}>
                <div className="ln-col" style={{ gap: 2 }}><span style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{detail.name}</span><span className="ln-small ln-muted">{detail.learner_ref} · {detail.cohort_title}</span></div>
                <button type="button" className="ln-btn ln-btn-sm" onClick={() => setDetail(null)} aria-label={t('inst.students.closeStudentDetails')}><X size={14} aria-hidden="true" />{t('inst.students.close')}</button>
              </div>
              <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                <Link className="ln-btn ln-btn-sm" to={`/institution/cohorts/${detail.engagement_id}?tab=Pathway&student=${detail.el_id}`}>{t('inst.students.pathway')}</Link>
                <button type="button" className="ln-btn ln-btn-sm" onClick={() => { const c = cohorts.find(x => x.id === detail.engagement_id); if (c) setDownload({ cohort: c, ids: [detail.el_id] }); }}><Download size={14} aria-hidden="true" />{t('inst.students.downloadData')}</button>
              </div>
              <div className="ln-tile" style={{ gap: 8, padding: 14 }}>
                <span className="ln-kicker">{t('inst.students.loginDetails')}</span>
                <div className="ln-between ln-small"><span className="ln-muted">{t('inst.students.joinCode')}</span><b className="in-code">{detail.join_code}</b></div>
                <div className="ln-between ln-small"><span className="ln-muted">PIN</span><span style={{ textAlign: 'right' }}>{detail.pin_status}</span></div>
                <div className="ln-between ln-small"><span className="ln-muted">{t('inst.students.delivery')}</span><span>{{ email: t('inst.students.emailInvite'), slip: t('inst.students.printedSlip'), existing_pin: t('inst.students.existingPin') }[detail.delivery] || '—'}</span></div>
                <div className="ln-between ln-small"><span className="ln-muted">{t('inst.students.email')}</span><span>{detail.email || '—'}</span></div>
                <div className="ln-between ln-small"><span className="ln-muted">{t('inst.students.status')}</span><AccessTag state={detail.access} /></div>
              </div>
              <div className="ln-col" style={{ gap: 10 }}>
                <span className="ln-kicker">{t('inst.students.accessHistory')}</span>
                <div className="in-timeline">
                  {detail.history.length === 0 && <span className="ln-small ln-muted">{t('inst.students.nothingRecordedYet')}</span>}
                  {detail.history.map((h, i) => (
                    <div key={i}><div className="ln-col"><span className="ln-small">{EVENT[h.event] ? t(EVENT[h.event]) : h.event}{h.detail ? ` — ${h.detail}` : ''}{h.actor_name ? ` · by ${h.actor_name}` : ''}</span><span className="ln-xs ln-muted">{when(h.created_at)}</span></div></div>
                  ))}
                </div>
              </div>
              <button type="button" className="ln-btn" onClick={() => api.get(`/institution/students/${detail.el_id}/learning-curve`).then(r => setCurve(r.data)).catch(() => setCurve({ error: true }))}>{t('inst.students.learningCurve')}</button>
              {canManage && (
                <div className="ln-col" style={{ gap: 8 }}>
                  {detail.access !== 'removed' && <button type="button" className="ln-btn" onClick={() => ask('reset_pin', [detail.el_id])}>{t('inst.students.resetPin')}</button>}
                  {detail.access === 'invited' && <button type="button" className="ln-btn" onClick={() => ask('resend_invite', [detail.el_id])}>{t('inst.students.resendInvite')}</button>}
                  {cohorts.length > 1 && <button type="button" className="ln-btn" onClick={() => ask('move', [detail.el_id])}>{t('inst.students.moveAnotherCohort')}</button>}
                  {detail.access === 'removed'
                    ? <button type="button" className="ln-btn" onClick={() => ask('restore', [detail.el_id])}>{t('inst.students.restoreAccess')}</button>
                    : <button type="button" className="ln-btn" style={{ color: 'var(--status-danger)' }} onClick={() => ask('remove', [detail.el_id])}>{t('inst.students.removeAccess')}</button>}
                  <span className="ln-xs ln-muted">{t('inst.students.removingAccessSignsStudent')}</span>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {curve && (
        <div className="in-modal-scrim" role="dialog" aria-modal="true" aria-label={t('inst.students.learningCurve')} onClick={() => setCurve(null)}>
          <div className="ln-card in-modal" style={{ maxWidth: 720, width: '100%', gap: 14 }} onClick={e => e.stopPropagation()}>
            <div className="ln-between"><h2 className="ln-h2">{t('inst.students.learningCurve')}{curve.student ? ` · ${curve.student.name}` : ''}</h2><button type="button" className="ln-btn ln-btn-sm" onClick={() => setCurve(null)}>{t('inst.students.close')}</button></div>
            {curve.error ? <div className="ln-error">{t('inst.students.couldnTLoadLearning')}</div> : <LearningCurve data={curve} />}
            <span className="ln-xs ln-muted">{t('inst.students.loopsTimeAttemptsStay')}</span>
          </div>
        </div>
      )}

      {download && (() => {
        const dCohort = Array.isArray(download) ? cohort : download.cohort;
        const ids = Array.isArray(download) ? download : download.ids;
        const roster = (Array.isArray(download) ? (all?.rows || []) : (all?.rows || []).filter(r => r.engagement_id === dCohort.id))
          .filter(r => r.access !== 'removed' && r.engagement_id === dCohort.id);
        return <DownloadDialog cohort={{ ...dCohort, join_code: dCohort.join_code || cohortDetail?.join_code || 'cohort' }} students={roster} initial={ids.filter(id => roster.some(r => r.el_id === id))} onClose={() => setDownload(null)} />;
      })()}
      {modal && (
        <ActionModal action={modal.action} count={modal.ids.length}
          cohorts={cohorts.filter(c => !(modal.action === 'move' && modal.ids.length === 1 && detail && c.id === detail.engagement_id))}
          onCancel={() => setModal(null)} onConfirm={(extra) => run(modal.action, modal.ids, extra)} />
      )}
    </>
  );
}
