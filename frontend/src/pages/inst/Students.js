// src/pages/inst/Students.js — /institution/students
// One place for student access: filter by cohort and access state, select
// students, and resend invites, reset PINs, move them between cohorts or
// remove access. Clicking a row opens its login details and access history.
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, KeyRound } from 'lucide-react';
import api from '../../utils/api';
import { useStaff } from '../../components/inst/InstitutionLayout';
import AccessResults from '../../components/inst/AccessResults';

export const ACCESS = { active: 'Active', invited: 'Invited', never_signed_in: 'Never signed in', locked: 'Locked', removed: 'Removed' };
const FILTERS = [['all', 'All'], ['active', 'Active'], ['invited', 'Invited'], ['never_signed_in', 'Never signed in'], ['locked', 'Locked'], ['removed', 'Removed'], ['reset_requested', 'PIN reset requested']];
const EVENT = {
  invited: 'Invited', invite_resent: 'Invite resent', pin_set: 'PIN set', pin_reset: 'PIN reset', slip_issued: 'Printed slip issued',
  signed_in: 'Signed in', locked: 'Locked after wrong PINs', removed: 'Access removed', restored: 'Access restored', moved: 'Moved', pin_reset_requested: 'Asked for a PIN reset'
};
const when = (t) => (t ? new Date(t.replace(' ', 'T') + (t.includes('Z') || t.includes('+') ? '' : 'Z')).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

export function AccessTag({ state }) {
  return <span className={`ln-tag ln-tag-lg in-state-${state}`}>{ACCESS[state]}</span>;
}

// Confirm dialogs for actions that need a choice (move target, reset delivery).
function ActionModal({ action, count, cohorts, onCancel, onConfirm }) {
  const [target, setTarget] = useState(cohorts[0]?.id || '');
  const [delivery, setDelivery] = useState('slips');
  const title = { move: `Move ${count} student${count > 1 ? 's' : ''}`, reset_pin: `Reset PIN for ${count} student${count > 1 ? 's' : ''}`, remove: `Remove access for ${count} student${count > 1 ? 's' : ''}` }[action];
  return (
    <div className="in-modal-scrim" role="dialog" aria-modal="true" aria-labelledby="am-title" onClick={onCancel}>
      <div className="ln-card in-modal" onClick={e => e.stopPropagation()}>
        <h2 id="am-title" className="ln-h2">{title}</h2>
        {action === 'move' && (
          <div className="ln-field"><label className="ln-label" htmlFor="mv">Move to</label>
            <select id="mv" className="ln-select" value={target} onChange={e => setTarget(e.target.value)}>{cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            <span className="ln-xs ln-muted">Same programme: progress is kept. Different programme: the student starts its pathway; their earlier mastery record is kept.</span></div>
        )}
        {action === 'reset_pin' && (
          <div className="ln-col" style={{ gap: 10 }}>
            <label className="in-radio"><input type="radio" name="dl" checked={delivery === 'slips'} onChange={() => setDelivery('slips')} /><div className="ln-col"><b>One-time PIN on a printed slip</b><span className="ln-small ln-muted">Shown once here. The student picks a new PIN when they sign in.</span></div></label>
            <label className="in-radio"><input type="radio" name="dl" checked={delivery === 'email'} onChange={() => setDelivery('email')} /><div className="ln-col"><b>New invite link</b><span className="ln-small ln-muted">The student sets their own PIN from the link. Students without email get a slip.</span></div></label>
            <span className="ln-xs ln-muted">Resetting also unlocks students locked out after wrong PINs.</span>
          </div>
        )}
        {action === 'remove' && <span className="ln-small">They are signed out and can’t sign in to this cohort. Their mastery record is kept, and you can restore access later.</span>}
        <div className="ln-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="ln-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="ln-btn ln-btn-primary" onClick={() => onConfirm({ target_engagement_id: target, delivery })}>{action === 'remove' ? 'Remove access' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Students() {
  const { role } = useStaff();
  const canManage = role !== 'viewer';
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const cohortId = params.get('engagement_id') || '';
  const nodeId = params.get('node_id') || '';
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const load = useCallback(() => {
    const p = new URLSearchParams({ status });
    if (cohortId) p.set('engagement_id', cohortId);
    if (nodeId) p.set('node_id', nodeId);
    if (q.trim()) p.set('q', q.trim());
    return api.get(`/institution/students?${p}`).then(r => setData(r.data)).catch(e => setError(e.response?.data?.error || 'Couldn’t load students.'));
  }, [status, cohortId, nodeId, q]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
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
    } catch (e) { setError(e.response?.data?.error || 'That didn’t work.'); }
  };
  const ask = (action, ids) => (['move', 'reset_pin', 'remove'].includes(action) ? setModal({ action, ids }) : run(action, ids));

  const rows = data?.rows || [];
  const allOn = rows.length > 0 && rows.every(r => selected.includes(r.el_id));
  const toggle = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">Students &amp; access</h1>
          <span className="ln-sub">One place to add students, give them access to a cohort, reset PINs and remove access.</span>
        </div>
        {canManage && <Link to={`/institution/students/add${cohortId ? `?cohort=${cohortId}` : ''}`} className="ln-btn ln-btn-primary"><Plus size={16} aria-hidden="true" />Add students</Link>}
      </header>

      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>Cohort</span>
          <select value={cohortId} onChange={e => setParam('engagement_id', e.target.value)}><option value="">All my cohorts</option>{cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        </label>
        <label className="ln-search"><Search size={18} aria-hidden="true" /><input aria-label="Search students" placeholder="Name, ref or email" value={q} onChange={e => setQ(e.target.value)} /></label>
        {nodeId && <button type="button" className="ln-btn ln-btn-sm" onClick={() => setParam('node_id', '')}>Showing students on one node ×</button>}
      </div>
      <div className="ln-pilltabs" role="tablist" aria-label="Access status">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" role="tab" className="ln-pilltab" aria-selected={status === id} onClick={() => setParam('status', id === 'all' ? '' : id)}>
            {label} <span className="ln-tag ln-tag-neutral" style={{ marginLeft: 4 }}>{data?.counts?.[id] ?? 0}</span>
          </button>
        ))}
      </div>

      {canManage && selected.length > 0 && (
        <div className="in-bulkbar" role="toolbar" aria-label="Actions for selected students">
          <b>{selected.length} selected</b>
          <span style={{ flex: 1 }} />
          <button type="button" className="ln-btn" onClick={() => ask('resend_invite', selected)}>Resend invite</button>
          <button type="button" className="ln-btn" onClick={() => ask('reset_pin', selected)}>Reset PINs</button>
          <button type="button" className="ln-btn" onClick={() => ask('move', selected)} disabled={cohorts.length < 2}>Move to cohort</button>
          {status === 'removed'
            ? <button type="button" className="ln-btn" onClick={() => ask('restore', selected)}>Restore access</button>
            : <button type="button" className="ln-btn in-danger" onClick={() => ask('remove', selected)}>Remove access</button>}
        </div>
      )}
      {error && <div className="ln-error" role="alert">{error}</div>}
      {results && (
        <div className="ln-col" style={{ gap: 8 }}>
          <div className="ln-between"><span className="ln-small" role="status">Done for {results.done} student{results.done === 1 ? '' : 's'}.</span><button type="button" className="ln-link" onClick={() => setResults(null)}>Dismiss</button></div>
          <AccessResults invites={results.invites} slips={results.slips} skipped={results.skipped} />
        </div>
      )}

      <div className="in-roster">
        <section className="ln-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
          <div className="ln-tablewrap">
            <table className="ln-table">
              <thead><tr style={{ background: 'var(--color-bg-alt)' }}>
                {canManage && <th style={{ paddingLeft: 16, width: 36 }}><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSelected(allOn ? [] : rows.map(r => r.el_id))} /></th>}
                <th style={canManage ? {} : { paddingLeft: 16 }}>Student</th><th>Cohort</th><th>Access</th><th>Last sign-in</th><th>Progress</th>
              </tr></thead>
              <tbody>
                {!data && <tr><td colSpan={6} style={{ paddingLeft: 16 }} className="ln-muted">Loading…</td></tr>}
                {data && rows.length === 0 && <tr><td colSpan={6} style={{ paddingLeft: 16 }} className="ln-muted">No students here.{canManage && ' Use “Add students” to give a cohort access.'}</td></tr>}
                {rows.map(r => (
                  <tr key={r.el_id} className={detail?.el_id === r.el_id ? 'is-selected' : ''} onClick={() => openDetail(r.el_id)}>
                    {canManage && <td style={{ paddingLeft: 16 }} onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.includes(r.el_id)} onChange={() => toggle(r.el_id)} /></td>}
                    <td style={canManage ? {} : { paddingLeft: 16 }}>
                      <button type="button" className="ln-col" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); openDetail(r.el_id); }}>
                        <b style={{ fontWeight: 600 }}>{r.name}</b><span className="ln-xs ln-muted">{r.learner_ref}</span>
                      </button>
                    </td>
                    <td className="ln-small">{r.cohort_title}</td>
                    <td><div className="ln-row" style={{ gap: 6 }}><AccessTag state={r.access} />{r.reset_requested && <span title="Asked for a PIN reset"><KeyRound size={15} color="var(--status-info)" aria-label="PIN reset requested" /></span>}</div></td>
                    <td className="ln-small">{r.last_login_at ? when(r.last_login_at) : '—'}</td>
                    <td className="ln-small">{r.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside aria-label="Student access detail" className="ln-card" style={{ gap: 16, position: 'sticky', top: 24 }}>
          {!detail ? <span className="ln-small ln-muted">Select a student to see their login details and access history.</span> : (
            <>
              <div className="ln-col" style={{ gap: 2 }}><span style={{ fontSize: 18, fontWeight: 600 }}>{detail.name}</span><span className="ln-small ln-muted">{detail.learner_ref} · {detail.cohort_title}</span></div>
              <div className="ln-tile" style={{ gap: 8, padding: 14 }}>
                <span className="ln-kicker">Login details</span>
                <div className="ln-between ln-small"><span className="ln-muted">Join code</span><b className="in-code">{detail.join_code}</b></div>
                <div className="ln-between ln-small"><span className="ln-muted">PIN</span><span style={{ textAlign: 'right' }}>{detail.pin_status}</span></div>
                <div className="ln-between ln-small"><span className="ln-muted">Delivery</span><span>{{ email: 'Email invite', slip: 'Printed slip', existing_pin: 'Existing PIN' }[detail.delivery] || '—'}</span></div>
                <div className="ln-between ln-small"><span className="ln-muted">Email</span><span>{detail.email || '—'}</span></div>
                <div className="ln-between ln-small"><span className="ln-muted">Status</span><AccessTag state={detail.access} /></div>
              </div>
              <div className="ln-col" style={{ gap: 10 }}>
                <span className="ln-kicker">Access history</span>
                <div className="in-timeline">
                  {detail.history.length === 0 && <span className="ln-small ln-muted">Nothing recorded yet.</span>}
                  {detail.history.map((h, i) => (
                    <div key={i}><div className="ln-col"><span className="ln-small">{EVENT[h.event] || h.event}{h.detail ? ` — ${h.detail}` : ''}{h.actor_name ? ` · by ${h.actor_name}` : ''}</span><span className="ln-xs ln-muted">{when(h.created_at)}</span></div></div>
                  ))}
                </div>
              </div>
              {canManage && (
                <div className="ln-col" style={{ gap: 8 }}>
                  {detail.access !== 'removed' && <button type="button" className="ln-btn" onClick={() => ask('reset_pin', [detail.el_id])}>Reset PIN</button>}
                  {detail.access === 'invited' && <button type="button" className="ln-btn" onClick={() => ask('resend_invite', [detail.el_id])}>Resend invite</button>}
                  {cohorts.length > 1 && <button type="button" className="ln-btn" onClick={() => ask('move', [detail.el_id])}>Move to another cohort</button>}
                  {detail.access === 'removed'
                    ? <button type="button" className="ln-btn" onClick={() => ask('restore', [detail.el_id])}>Restore access</button>
                    : <button type="button" className="ln-btn" style={{ color: 'var(--status-danger)' }} onClick={() => ask('remove', [detail.el_id])}>Remove access</button>}
                  <span className="ln-xs ln-muted">Removing access signs the student out and blocks sign-in. Their mastery record is kept.</span>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {modal && (
        <ActionModal action={modal.action} count={modal.ids.length}
          cohorts={cohorts.filter(c => !(modal.action === 'move' && modal.ids.length === 1 && detail && c.id === detail.engagement_id))}
          onCancel={() => setModal(null)} onConfirm={(extra) => run(modal.action, modal.ids, extra)} />
      )}
    </>
  );
}
