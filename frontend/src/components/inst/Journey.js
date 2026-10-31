// src/components/inst/Journey.js — the learner journey as the college sees it:
// a stage tag per student, stage counts for a cohort, the "Stuck at check"
// list and the help requests students send after a check that did not pass.
// Hiring stages are the student's own and show as Ready (see core/journey/college.js).
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang, uiLocale } from '../../context/UiLangContext';

const day = (s) => (s ? new Date(s).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' }) : '—');
const TONE = { S4: 'ln-tag-warning', S5: 'ln-tag-success', S6: 'ln-tag-info', S7: 'ln-tag-success', S11: 'ln-tag-success', S12: 'ln-tag-warning' };
const ORDER = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S11', 'S12'];

export function StageTag({ stage }) {
  const { t } = useUiLang();
  if (!stage) return <span className="ln-xs ln-muted">—</span>;
  return <span className={`ln-tag ${TONE[stage] || 'ln-tag-neutral'}`} data-stage={stage}>{t(`devx.stage.${stage}`)}</span>;
}

/** How many students are at each stage. */
export function StageCounts({ counts }) {
  const { t } = useUiLang();
  const list = ORDER.filter(s => counts?.[s]);
  if (!list.length) return null;
  return (
    <div className="ln-col" style={{ gap: 8 }} data-stage-counts>
      <b>{t('lj.inst.stagesTitle')}</b>
      <div className="ln-row ln-wrap" style={{ gap: 8 }}>{list.map(s => <span key={s} className="ln-row" style={{ gap: 4 }}><StageTag stage={s} /><b className="ln-small">{counts[s]}</b></span>)}</div>
    </div>
  );
}

/** Students whose last check on a skill has not passed yet, most tries first. */
export function StuckList({ engagementId, limit = 8 }) {
  const { t } = useUiLang();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get(`/institution/students-stuck${engagementId ? `?engagement_id=${engagementId}` : ''}`).then(r => setRows(r.data.rows)).catch(() => setRows([]));
  }, [engagementId]);
  if (!rows) return null;
  return (
    <section className="ln-card" style={{ gap: 10 }} aria-label={t('lj.inst.stuckTitle')} data-stuck>
      <div className="ln-col" style={{ gap: 2 }}><h2 className="ln-h2">{t('lj.inst.stuckTitle')}</h2><span className="ln-small ln-muted">{t('lj.inst.stuckSub')}</span></div>
      {rows.length === 0 ? <span className="ln-small ln-muted">{t('lj.inst.stuckNone')}</span> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>{t('inst.students.student')}</th><th>{t('lj.inst.skill')}</th><th>{t('lj.inst.tries')}</th><th>{t('lj.inst.lastTry')}</th><th /></tr></thead>
          <tbody>{rows.slice(0, limit).map(r => (
            <tr key={`${r.el_id}-${r.node_id}`}>
              <td><b style={{ fontWeight: 600 }}>{r.name}</b> <span className="ln-xs ln-muted">{r.learner_ref}</span></td>
              <td className="ln-small">{r.node_label}</td>
              <td className="ln-small">{r.failed_tries}</td>
              <td className="ln-small">{day(r.last_try)}</td>
              <td>{r.asked_for_help && <Link to="/institution/review?tab=help" className="ln-tag ln-tag-warning"><LifeBuoy size={12} aria-hidden="true" />{t('lj.inst.askedHelp')}</Link>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {rows.length > limit && <span className="ln-xs ln-muted">{t('lj.inst.stuckMore', { n: rows.length - limit })}</span>}
    </section>
  );
}

/** "Ask my professor" requests: who, which skill, how many tries, and a reply box. */
export function HelpRequests({ canAnswer }) {
  const { t } = useUiLang();
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState(null);
  const [reply, setReply] = useState({});
  const [error, setError] = useState('');
  const load = useCallback(() => api.get(`/institution/help-requests?status=${status}`).then(r => setItems(r.data.items)).catch(e => setError(errMsg(e))), [status]);
  useEffect(() => { load(); }, [load]);
  const send = async (id) => {
    setError('');
    try { await api.post(`/institution/help-requests/${id}/answer`, { reply: reply[id] }); setReply(r => ({ ...r, [id]: '' })); load(); } catch (e) { setError(errMsg(e)); }
  };
  return (
    <section className="ln-col" style={{ gap: 12 }} data-help-requests>
      <div className="ln-pilltabs" role="tablist" aria-label={t('lj.inst.helpTitle')}>
        {[['open', 'lj.inst.helpOpen'], ['answered', 'lj.inst.helpAnswered']].map(([id, key]) => <button key={id} type="button" role="tab" className="ln-pilltab" aria-selected={status === id} onClick={() => setStatus(id)}>{t(key)}</button>)}
      </div>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {items && items.length === 0 && <div className="ln-card ln-muted">{status === 'open' ? t('lj.inst.helpNone') : t('lj.inst.helpNoneAnswered')}</div>}
      {(items || []).map(h => (
        <article key={h.id} className="ln-card" style={{ gap: 8 }}>
          <div className="ln-between ln-wrap" style={{ gap: 8 }}>
            <b>{h.name} <span className="ln-xs ln-muted">{h.learner_ref} · {h.cohort_title}</span></b>
            <span className="ln-small ln-muted">{day(h.created_at)}</span>
          </div>
          <span className="ln-small">{t('lj.inst.helpAbout', { skill: h.node_label, n: h.failed_tries })}</span>
          {h.message && <blockquote className="ln-small" style={{ margin: 0, paddingLeft: 10, borderLeft: '3px solid var(--color-border)' }}>{h.message}</blockquote>}
          {h.status === 'answered'
            ? <span className="ln-small"><b>{t('lj.inst.youReplied')}</b> {h.reply}</span>
            : canAnswer && (
              <div className="ln-col" style={{ gap: 6 }}>
                <textarea className="ln-textarea" rows={2} value={reply[h.id] || ''} onChange={e => setReply(r => ({ ...r, [h.id]: e.target.value }))} aria-label={t('lj.inst.replyTo', { name: h.name })} placeholder={t('lj.inst.replyHint')} />
                <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!(reply[h.id] || '').trim()} onClick={() => send(h.id)}>{t('lj.inst.sendReply')}</button>
              </div>
            )}
        </article>
      ))}
    </section>
  );
}
