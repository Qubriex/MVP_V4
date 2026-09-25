// src/pages/LearnerInvite.js — /learner-invite/:token
// A student opens the invite link from their institution, sees their cohort
// and join code, and sets their own 6-digit PIN. Nobody else ever sees it.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import PhoenixMark from '../components/PhoenixMark';

export default function LearnerInvite() {
  const { token } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/auth/learner/invite/${token}`).then(r => setInvite(r.data)).catch(e => setError(e.response?.data?.error || 'This invite link is invalid or has expired.'));
  }, [token]);

  const accept = async (e) => {
    e.preventDefault(); setError('');
    if (!/^\d{6}$/.test(pin)) return setError('Your PIN must be exactly 6 digits.');
    if (pin !== pin2) return setError('The two PINs don’t match.');
    setBusy(true);
    try {
      const res = await api.post(`/auth/learner/invite/${token}/accept`, { pin });
      login(res.data.token, res.data.learner, 'learner');
      navigate('/learn/welcome');
    } catch (err) { setError(err.response?.data?.error || 'Couldn’t set your PIN.'); }
    setBusy(false);
  };

  return (
    <div className="ln-login">
      <aside className="ln-login-aside">
        <span className="ln-brand" style={{ fontSize: 24, padding: 0 }}><PhoenixMark size={36} />Qubirex</span>
        <div className="ln-col ln-hide-phone" style={{ gap: 20 }}>
          <h1 style={{ fontSize: 'clamp(32px, 3vw + 10px, 48px)' }}>Welcome. Let’s set up your sign-in.</h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 460 }}>Choose a PIN only you know. You’ll use it with your learner reference and your cohort’s join code.</p>
        </div>
        <span className="ln-small ln-hide-phone" style={{ color: 'var(--stage-muted)' }}>Receive. Build. Return.</span>
      </aside>
      <div className="ln-login-main">
        <form className="ln-login-form" onSubmit={accept}>
          <h2 style={{ fontSize: 32, fontFamily: 'var(--font-display)' }}>Set your PIN</h2>
          {error && <div className="ln-error" role="alert">{error}</div>}
          {!invite && !error && <p className="ln-muted">Checking your invite…</p>}
          {!invite && error && <Link to="/learner-login" className="ln-link">Go to learner sign in</Link>}
          {invite && (
            <>
              <div className="ln-card" style={{ padding: 16, gap: 6, borderRadius: 'var(--radius-lg)' }}>
                <b>{invite.name}</b>
                <span className="ln-small ln-muted">{invite.cohort_title} · {invite.institution_name}</span>
                <span className="ln-small">Learner reference: <b className="in-code">{invite.learner_ref}</b></span>
                <span className="ln-small">Join code: <b className="in-code">{invite.join_code}</b></span>
                <span className="ln-xs ln-muted">Write these down — you’ll need them to sign in.</span>
              </div>
              <div className="ln-field"><label className="ln-label" htmlFor="p1">New 6-digit PIN</label>
                <input id="p1" className="ln-input" style={{ minHeight: 48, fontSize: 18, letterSpacing: '0.3em' }} type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="p2">Type it again</label>
                <input id="p2" className="ln-input" style={{ minHeight: 48, fontSize: 18, letterSpacing: '0.3em' }} type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} required /></div>
              <button type="submit" className="ln-btn ln-btn-primary ln-btn-block" style={{ minHeight: 52, fontSize: 16 }} disabled={busy}>{busy ? 'Saving…' : 'Set PIN and start'}</button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
