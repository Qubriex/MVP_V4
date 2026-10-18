// src/pages/inst/Team.js — /institution/team (admin)
// Invite professors and viewers by email, set their role and cohorts, resend
// invites (also a password-reset link for active staff) and disable accounts.
// Email delivery isn't wired up yet, so each invite link is shown to copy.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Avatar, ROLE_LABEL, useStaff } from '../../components/inst/InstitutionLayout';
import CopyLink from '../../components/inst/CopyLink';
import { errMsg } from '../../utils/errors';
import { Select } from '../../components/shared/ui';

import { useUiLang } from '../../context/UiLangContext';
const STATUS = { active: ['inst.team.status.active', 'ln-tag-success'], invited: ['inst.team.status.invited', 'ln-tag-info'], expired: ['inst.team.status.expired', 'ln-tag-warning'], disabled: ['inst.team.status.disabled', 'ln-tag-neutral'] };

function CohortPicker({ cohorts, value, onChange }) {
  const { t } = useUiLang();
  return (
    <div className="ln-row ln-wrap" style={{ gap: 6 }}>
      {cohorts.length === 0 && <span className="ln-small ln-muted">{t('inst.team.noCohortsYet')}</span>}
      {cohorts.map(c => {
        const on = value.includes(c.id);
        return <button key={c.id} type="button" className="ln-pilltab" style={{ minHeight: 34, fontSize: 'var(--fs-small)' }} aria-pressed={on} aria-selected={on}
          onClick={() => onChange(on ? value.filter(x => x !== c.id) : [...value, c.id])}>{c.title}</button>;
      })}
    </div>
  );
}

function EditModal({ member, cohorts, onClose, onSaved }) {
  const { t } = useUiLang();
  const [role, setRole] = useState(member.role);
  const [department, setDepartment] = useState(member.department || '');
  const [ids, setIds] = useState(member.cohorts.map(c => c.id));
  const [error, setError] = useState('');
  const save = async (status) => {
    try {
      const res = await api.put(`/institution/team/${member.id}`, { role, department, engagement_ids: ids, ...(status ? { status } : {}) });
      onSaved(res.data);
    } catch (e) { setError(errMsg(e, t('inst.team.couldnTSave'))); }
  };
  return (
    <div className="in-modal-scrim" role="dialog" aria-modal="true" aria-labelledby="edit-title" onClick={onClose}>
      <div className="ln-card in-modal" onClick={e => e.stopPropagation()}>
        <h2 id="edit-title" className="ln-h2">{member.name || member.email}</h2>
        <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
          <div className="ln-field"><label className="ln-label" htmlFor="er">{t('inst.team.role')}</label>
            <Select id="er" value={role} onChange={e => setRole(e.target.value)}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></div>
          <div className="ln-field"><label className="ln-label" htmlFor="ed">{t('inst.team.department')}</label><input id="ed" className="ln-input" value={department} onChange={e => setDepartment(e.target.value)} /></div>
        </div>
        <div className="ln-col" style={{ gap: 8 }}><span className="ln-label">{t('inst.team.cohorts')}</span>
          {role === 'admin' ? <span className="ln-small ln-muted">{t('inst.team.adminsSeeEveryCohort')}</span> : <CohortPicker cohorts={cohorts} value={ids} onChange={setIds} />}
        </div>
        {error && <div className="ln-error" role="alert">{error}</div>}
        <div className="ln-between ln-wrap" style={{ gap: 10 }}>
          {member.status === 'disabled'
            ? <button type="button" className="ln-btn" onClick={() => save('active')}>{t('inst.team.reEnableAccount')}</button>
            : <button type="button" className="ln-btn" style={{ color: 'var(--status-danger)' }} onClick={() => save('disabled')}>{t('inst.team.disableAccount')}</button>}
          <div className="ln-row" style={{ gap: 8 }}>
            <button type="button" className="ln-btn" onClick={onClose}>{t('inst.team.cancel')}</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => save()}>{t('inst.team.save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const { t } = useUiLang();
  const { me } = useStaff();
  const [team, setTeam] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [form, setForm] = useState({ email: '', name: '', department: '', role: 'professor', engagement_ids: [] });
  const [links, setLinks] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/institution/team').then(r => setTeam(r.data)).catch(e => setError(errMsg(e, t('inst.team.couldnTLoadTeam'))));
  useEffect(() => { load(); api.get('/institution/engagements').then(r => setCohorts(r.data)).catch(() => {}); }, []);

  const invite = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    try {
      const res = await api.post('/institution/team/invites', form);
      setLinks(l => ({ ...l, [res.data.id]: res.data.invite_url }));
      setMessage(t('inst.team.inviteCreatedEmailEmail', { email: form.email }));
      setForm(f => ({ ...f, email: '', name: '' }));
      load();
    } catch (err) { setError(errMsg(err, t('inst.team.couldnTSendInvite'))); }
  };
  const resend = async (m) => {
    try {
      const res = await api.post(`/institution/team/${m.id}/resend`);
      setLinks(l => ({ ...l, [m.id]: res.data.invite_url }));
      setMessage(res.data.message);
      load();
    } catch (err) { setError(errMsg(err, t('inst.team.couldnTResend'))); }
  };

  return (
    <>
      <header className="ln-col" style={{ gap: 4 }}>
        <h1 className="ln-title">{t('inst.team.teamRoles')}</h1>
        <span className="ln-sub">{t('inst.team.inviteProfessorsByEmail')}</span>
      </header>

      <form className="ln-card" style={{ gap: 14, padding: 18, borderRadius: 'var(--radius-lg)' }} onSubmit={invite}>
        <div className="ln-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div className="ln-field"><label className="ln-label" htmlFor="ie">{t('inst.team.email')}</label><input id="ie" className="ln-input" type="email" placeholder="name@college.edu.in" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="in">{t('inst.team.name')}{' '} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{t('inst.team.optional')}</span></label><input id="in" className="ln-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="idp">{t('inst.team.department')}</label><input id="idp" className="ln-input" placeholder={t('inst.team.egDept')} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="irl">{t('inst.team.role')}</label>
            <Select id="irl" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></div>
          <button type="submit" className="ln-btn ln-btn-primary">{t('inst.team.sendInvite')}</button>
        </div>
        {form.role !== 'admin' && (
          <div className="ln-col" style={{ gap: 8 }}><span className="ln-label">{t('inst.team.cohorts')}{' '} {form.role === 'viewer' && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{t('inst.team.viewersCanReadEvery')}</span>}</span>
            <CohortPicker cohorts={cohorts} value={form.engagement_ids} onChange={v => setForm({ ...form, engagement_ids: v })} /></div>
        )}
      </form>
      {message && <div className="ln-note" role="status">{message}</div>}
      {error && <div className="ln-error" role="alert">{error}</div>}

      <section className="ln-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
        <div className="ln-tablewrap">
          <table className="ln-table">
            <thead><tr style={{ background: 'var(--color-bg-alt)' }}><th style={{ paddingLeft: 18 }}>{t('inst.team.name')}</th><th>{t('inst.team.role')}</th><th>{t('inst.team.department')}</th><th>{t('inst.team.cohorts')}</th><th>{t('inst.team.status')}</th><th style={{ textAlign: 'right', paddingRight: 18 }}>{t('inst.team.actions')}</th></tr></thead>
            <tbody>
              {!team && <tr><td colSpan={6} style={{ paddingLeft: 18 }} className="ln-muted">{t('inst.team.loading')}</td></tr>}
              {(team || []).map(m => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td style={{ paddingLeft: 18 }}><div className="ln-row" style={{ gap: 10 }}><Avatar person={m} size={32} /><div className="ln-col"><b style={{ fontWeight: 600 }}>{[m.title, m.name].filter(Boolean).join(' ') || '—'}</b><span className="ln-xs ln-muted">{m.email}</span></div></div></td>
                    <td>{t(ROLE_LABEL[m.role])}</td>
                    <td>{m.department || '—'}</td>
                    <td className="ln-small">{m.role === 'admin' ? t('inst.team.all') : m.role === 'viewer' ? t('inst.team.allReadOnly') : m.cohorts.map(c => c.title).join(', ') || '—'}</td>
                    <td><span className={`ln-tag ln-tag-lg ${STATUS[m.status][1]}`}>{t(STATUS[m.status][0])}</span></td>
                    <td style={{ textAlign: 'right', paddingRight: 18, whiteSpace: 'nowrap' }}>
                      {m.status !== 'active' && m.status !== 'disabled' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => resend(m)}>{t('inst.team.resendInvite')}</button>}
                      {m.status === 'active' && m.id !== me?.id && (
                        <button type="button" className="ln-btn ln-btn-sm" title={t('inst.team.createsLinkSetNew')}
                          onClick={() => window.confirm(t('inst.team.resetConfirm', { name: m.name || m.email })) && resend(m)}>{t('inst.team.resetPassword')}</button>
                      )}{' '}
                      <button type="button" className="ln-btn ln-btn-sm" onClick={() => setEditing(m)}>{t('inst.team.edit')}</button>
                    </td>
                  </tr>
                  {links[m.id] && <tr><td colSpan={6} style={{ paddingLeft: 18, paddingRight: 18 }}><CopyLink url={links[m.id]} /></td></tr>}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ln-grid ln-g-3" style={{ gap: 14 }}>
        <div className="ln-tile" style={{ padding: 18, gap: 8 }}><b style={{ fontSize: 'var(--fs-body)' }}>{t('inst.team.admin')}</b><span className="ln-small" style={{ lineHeight: 1.55 }}>{t('inst.team.allCohortsStudentsInvites')}</span></div>
        <div className="ln-tile" style={{ padding: 18, gap: 8 }}><b style={{ fontSize: 'var(--fs-body)' }}>{t('inst.team.professor')}</b><span className="ln-small" style={{ lineHeight: 1.55 }}>{t('inst.team.assignedCohortsOnlyAdds')}</span></div>
        <div className="ln-tile" style={{ padding: 18, gap: 8 }}><b style={{ fontSize: 'var(--fs-body)' }}>{t('inst.team.viewer')}</b><span className="ln-small" style={{ lineHeight: 1.55 }}>{t('inst.team.readOnlyPlacementOfficers')}</span></div>
      </section>

      {editing && <EditModal member={editing} cohorts={cohorts} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}
