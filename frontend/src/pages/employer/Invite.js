// src/pages/employer/Invite.js — /employer/invite/:token — a colleague
// accepts an invite, sets a password and lands in the portal.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { EmployerAside } from './Login';

export default function EmployerInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [inv, setInv] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/auth/employer/invite/${token}`).then(r => { setInv(r.data); setName(r.data.name || ''); }).catch(e => setError(errMsg(e)));
  }, [token]);

  const accept = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.post(`/auth/employer/invite/${token}/accept`, { name, password });
      login(r.data.token, { email: inv.email, name }, 'employer');
      navigate('/employer/home');
    } catch (err) { setError(errMsg(err)); }
    setBusy(false);
  };

  return (
    <div className="ln-login">
      <EmployerAside />
      <div className="ln-login-main">
        <div className="ln-login-form">
          {!inv ? (
            <div className="ln-col" style={{ gap: 12 }}>
              <h2 style={{ fontSize: 28 }}>Join your team</h2>
              {error ? <div className="ln-error" role="alert">{error}</div> : <p className="ln-muted">Checking your invite…</p>}
              <Link to="/employer/login" className="ln-link">Go to sign in</Link>
            </div>
          ) : (
            <form className="ln-col" style={{ gap: 16 }} onSubmit={accept}>
              <div className="ln-col" style={{ gap: 6 }}><h2 style={{ fontSize: 30 }}>Join {inv.employer_name}</h2>
                <p className="ln-muted">You were invited as a <b>{inv.role}</b> ({inv.email}).</p></div>
              {error && <div className="ln-error" role="alert">{error}</div>}
              <div className="ln-field"><label className="ln-label" htmlFor="nm">Your name</label><input id="nm" className="ln-input" value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="pw">Choose a password</label><input id="pw" className="ln-input" type="password" autoComplete="new-password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} required />
                <span className="ln-xs ln-muted">At least 10 characters.</span></div>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52 }} disabled={busy}>{busy ? 'Setting up…' : 'Accept and continue'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
