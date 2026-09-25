// src/pages/inst/StaffInvite.js — /institution/invite/:token
// A professor (or admin/viewer) opens the invite link, sees who invited them
// and to what, sets a password, and continues to profile setup.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { StaffAside } from './StaffLogin';

const ROLE = { admin: 'Admin', professor: 'Professor', viewer: 'Viewer' };

export default function StaffInvite() {
  const { token } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/auth/staff/invite/${token}`).then(r => setInvite(r.data)).catch(e => setError(e.response?.data?.error || 'This invite link is invalid or has expired.'));
  }, [token]);

  const accept = async (e) => {
    e.preventDefault();
    setError('');
    if (pw.length < 10) return setError('Use at least 10 characters.');
    if (pw !== pw2) return setError('The two passwords don’t match.');
    setBusy(true);
    try {
      const res = await api.post(`/auth/staff/invite/${token}/accept`, { password: pw });
      login(res.data.token, { ...res.data.staff, institution_name: res.data.institution?.name }, 'institution');
      navigate('/institution/welcome');
    } catch (err) {
      setError(err.response?.data?.error || 'Couldn’t set up your account.');
    }
    setBusy(false);
  };

  return (
    <div className="ln-login">
      <StaffAside />
      <div className="ln-login-main">
        <form className="ln-login-form" onSubmit={accept}>
          <div className="ln-col" style={{ gap: 6 }}>
            <h2 style={{ fontSize: 32 }}>Set up your account</h2>
            {invite && <p className="ln-muted">Invited{invite.invited_by ? ` by ${invite.invited_by}` : ''} to {invite.institution_name}{invite.department ? ` · ${invite.department}` : ''}</p>}
          </div>
          {error && <div className="ln-error" role="alert">{error}</div>}
          {!invite && !error && <p className="ln-muted">Checking your invite…</p>}
          {!invite && error && <Link to="/login" className="ln-link">← Back to sign in</Link>}
          {invite && (
            <>
              <div className="ln-field"><label className="ln-label" htmlFor="iem">Work email</label><input id="iem" className="ln-input" style={{ minHeight: 48 }} value={invite.email} readOnly autoComplete="username" /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="np">Create password</label><input id="np" className="ln-input" style={{ minHeight: 48 }} type="password" autoComplete="new-password" placeholder="At least 10 characters" value={pw} onChange={e => setPw(e.target.value)} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="cp">Confirm password</label><input id="cp" className="ln-input" style={{ minHeight: 48 }} type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} required /></div>
              <span className="ln-small ln-muted">
                Link expires {new Date(invite.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Role: <b style={{ color: 'var(--color-text)' }}>{ROLE[invite.role]}</b>
                {invite.cohorts.length > 0 && ` · ${invite.cohorts.length} cohort${invite.cohorts.length > 1 ? 's' : ''} assigned`}
              </span>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 16 }} disabled={busy}>{busy ? 'Setting up…' : 'Continue to profile setup →'}</button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
