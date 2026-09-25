// src/pages/inst/Team.js — /institution/team (admin)
// Invite professors and viewers by email, set their role and cohorts, resend
// invites (also a password-reset link for active staff) and disable accounts.
// Email delivery isn't wired up yet, so each invite link is shown to copy.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Avatar, ROLE_LABEL, useStaff } from '../../components/inst/InstitutionLayout';
import CopyLink from '../../components/inst/CopyLink';

const STATUS = { active: ['Active', 'ln-tag-success'], invited: ['Invited', 'ln-tag-info'], expired: ['Expired', 'ln-tag-warning'], disabled: ['Disabled', 'ln-tag-neutral'] };

function CohortPicker({ cohorts, value, onChange }) {
  return (
    <div className="ln-row ln-wrap" style={{ gap: 6 }}>
      {cohorts.length === 0 && <span className="ln-small ln-muted">No cohorts yet.</span>}
      {cohorts.map(c => {
        const on = value.includes(c.id);
        return <button key={c.id} type="button" className="ln-pilltab" style={{ minHeight: 34, fontSize: 13 }} aria-pressed={on} aria-selected={on}
          onClick={() => onChange(on ? value.filter(x => x !== c.id) : [...value, c.id])}>{c.title}</button>;
      })}
    </div>
  );
}

function EditModal({ member, cohorts, onClose, onSaved }) {
  const [role, setRole] = useState(member.role);
  const [department, setDepartment] = useState(member.department || '');
  const [ids, setIds] = useState(member.cohorts.map(c => c.id));
  const [error, setError] = useState('');
  const save = async (status) => {
    try {
      const res = await api.put(`/institution/team/${member.id}`, { role, department, engagement_ids: ids, ...(status ? { status } : {}) });
      onSaved(res.data);
    } catch (e) { setError(e.response?.data?.error || 'Couldn’t save.'); }
  };
  return (
    <div className="in-modal-scrim" role="dialog" aria-modal="true" aria-labelledby="edit-title" onClick={onClose}>
      <div className="ln-card in-modal" onClick={e => e.stopPropagation()}>
        <h2 id="edit-title" className="ln-h2">{member.name || member.email}</h2>
        <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
          <div className="ln-field"><label className="ln-label" htmlFor="er">Role</label>
            <select id="er" className="ln-select" value={role} onChange={e => setRole(e.target.value)}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="ln-field"><label className="ln-label" htmlFor="ed">Department</label><input id="ed" className="ln-input" value={department} onChange={e => setDepartment(e.target.value)} /></div>
        </div>
        <div className="ln-col" style={{ gap: 8 }}><span className="ln-label">Cohorts</span>
          {role === 'admin' ? <span className="ln-small ln-muted">Admins see every cohort.</span> : <CohortPicker cohorts={cohorts} value={ids} onChange={setIds} />}
        </div>
        {error && <div className="ln-error" role="alert">{error}</div>}
        <div className="ln-between ln-wrap" style={{ gap: 10 }}>
          {member.status === 'disabled'
            ? <button type="button" className="ln-btn" onClick={() => save('active')}>Re-enable account</button>
            : <button type="button" className="ln-btn" style={{ color: 'var(--status-danger)' }} onClick={() => save('disabled')}>Disable account</button>}
          <div className="ln-row" style={{ gap: 8 }}>
            <button type="button" className="ln-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => save()}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const { me } = useStaff();
  const [team, setTeam] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [form, setForm] = useState({ email: '', name: '', department: '', role: 'professor', engagement_ids: [] });
  const [links, setLinks] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/institution/team').then(r => setTeam(r.data)).catch(e => setError(e.response?.data?.error || 'Couldn’t load the team.'));
  useEffect(() => { load(); api.get('/institution/engagements').then(r => setCohorts(r.data)).catch(() => {}); }, []);

  const invite = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    try {
      const res = await api.post('/institution/team/invites', form);
      setLinks(l => ({ ...l, [res.data.id]: res.data.invite_url }));
      setMessage(`Invite created for ${form.email}. Email delivery isn’t switched on yet — copy the link below and send it to them.`);
      setForm(f => ({ ...f, email: '', name: '' }));
      load();
    } catch (err) { setError(err.response?.data?.error || 'Couldn’t send the invite.'); }
  };
  const resend = async (m) => {
    try {
      const res = await api.post(`/institution/team/${m.id}/resend`);
      setLinks(l => ({ ...l, [m.id]: res.data.invite_url }));
      setMessage(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Couldn’t resend.'); }
  };

  return (
    <>
      <header className="ln-col" style={{ gap: 4 }}>
        <h1 className="ln-title">Team &amp; roles</h1>
        <span className="ln-sub">Invite professors by email. Each gets their own login and sees only the cohorts you assign.</span>
      </header>

      <form className="ln-card" style={{ gap: 14, padding: 18, borderRadius: 'var(--radius-lg)' }} onSubmit={invite}>
        <div className="ln-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div className="ln-field"><label className="ln-label" htmlFor="ie">Email</label><input id="ie" className="ln-input" type="email" placeholder="name@college.edu.in" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="in">Name <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>· optional</span></label><input id="in" className="ln-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="idp">Department</label><input id="idp" className="ln-input" placeholder="e.g. CSE" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="irl">Role</label>
            <select id="irl" className="ln-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <button type="submit" className="ln-btn ln-btn-primary">Send invite</button>
        </div>
        {form.role !== 'admin' && (
          <div className="ln-col" style={{ gap: 8 }}><span className="ln-label">Cohorts {form.role === 'viewer' && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>· viewers can read every cohort</span>}</span>
            <CohortPicker cohorts={cohorts} value={form.engagement_ids} onChange={v => setForm({ ...form, engagement_ids: v })} /></div>
        )}
      </form>
      {message && <div className="ln-note" role="status">{message}</div>}
      {error && <div className="ln-error" role="alert">{error}</div>}

      <section className="ln-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
        <div className="ln-tablewrap">
          <table className="ln-table">
            <thead><tr style={{ background: 'var(--color-bg-alt)' }}><th style={{ paddingLeft: 18 }}>Name</th><th>Role</th><th>Department</th><th>Cohorts</th><th>Status</th><th style={{ textAlign: 'right', paddingRight: 18 }}>Actions</th></tr></thead>
            <tbody>
              {!team && <tr><td colSpan={6} style={{ paddingLeft: 18 }} className="ln-muted">Loading…</td></tr>}
              {(team || []).map(m => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td style={{ paddingLeft: 18 }}><div className="ln-row" style={{ gap: 10 }}><Avatar person={m} size={32} /><div className="ln-col"><b style={{ fontWeight: 600 }}>{[m.title, m.name].filter(Boolean).join(' ') || '—'}</b><span className="ln-xs ln-muted">{m.email}</span></div></div></td>
                    <td>{ROLE_LABEL[m.role]}</td>
                    <td>{m.department || '—'}</td>
                    <td className="ln-small">{m.role === 'admin' ? 'All' : m.role === 'viewer' ? 'All (read-only)' : m.cohorts.map(c => c.title).join(', ') || '—'}</td>
                    <td><span className={`ln-tag ln-tag-lg ${STATUS[m.status][1]}`}>{STATUS[m.status][0]}</span></td>
                    <td style={{ textAlign: 'right', paddingRight: 18, whiteSpace: 'nowrap' }}>
                      {m.status !== 'active' && m.status !== 'disabled' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => resend(m)}>Resend invite</button>}
                      {m.status === 'active' && m.id !== me?.id && (
                        <button type="button" className="ln-btn ln-btn-sm" title="Creates a link to set a new password; their current password stops working"
                          onClick={() => window.confirm(`Create a password reset link for ${m.name || m.email}? Their current password stops working.`) && resend(m)}>Reset password</button>
                      )}{' '}
                      <button type="button" className="ln-btn ln-btn-sm" onClick={() => setEditing(m)}>Edit</button>
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
        <div className="ln-tile" style={{ padding: 18, gap: 8 }}><b style={{ fontSize: 15 }}>Admin</b><span className="ln-small" style={{ lineHeight: 1.55 }}>All cohorts and students. Invites staff, sets up cohorts and capability targets, produces and exports mastery logs.</span></div>
        <div className="ln-tile" style={{ padding: 18, gap: 8 }}><b style={{ fontSize: 15 }}>Professor</b><span className="ln-small" style={{ lineHeight: 1.55 }}>Assigned cohorts only. Adds and removes students, resets PINs, views progress, insights and mastery logs.</span></div>
        <div className="ln-tile" style={{ padding: 18, gap: 8 }}><b style={{ fontSize: 15 }}>Viewer</b><span className="ln-small" style={{ lineHeight: 1.55 }}>Read-only, for placement officers or HODs who need reports but don’t manage students.</span></div>
      </section>

      {editing && <EditModal member={editing} cohorts={cohorts} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}
