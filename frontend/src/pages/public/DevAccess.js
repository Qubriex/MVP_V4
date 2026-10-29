// src/pages/public/DevAccess.js — /dev "Developer access": for the founder
// and the testing team. Enter the passcode once, then open any side as a
// seeded test account in one click. Only exists where the deployment sets
// DEV_LOGIN_ENABLED=true; elsewhere the API answers 404 and this page sends
// you home like any unknown address.
import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap, Building2, BookOpen, Briefcase, ShieldCheck, Globe, RotateCcw, FastForward, BadgeCheck, Info, LogIn, KeyRound } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useUiLang } from '../../context/UiLangContext';
import { DEV_CARDS, openDevAccount } from '../../utils/devAccess';

const ICONS = { learner_te: GraduationCap, learner_hi: GraduationCap, learner_new: GraduationCap, college_admin: Building2, professor: BookOpen, employer_verified: Briefcase, employer_pending: Briefcase, admin: ShieldCheck };
const errText = (e, fallback) => e?.response?.data?.error?.message || fallback;

function Unlock({ onDone }) {
  const { t } = useUiLang();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.post('/dev/unlock', { passcode }); setPasscode(''); onDone(); } catch (err) { setError(errText(err, t('devx.unlockFailed'))); }
    setBusy(false);
  };
  return (
    <form className="ln-card ln-col" style={{ gap: 12, maxWidth: 440 }} onSubmit={submit}>
      <label htmlFor="dev-pass" className="ln-label ln-row" style={{ gap: 8 }}><KeyRound size={16} aria-hidden="true" />{t('devx.passcode')}</label>
      <input id="dev-pass" className="ln-input" type="password" autoComplete="off" value={passcode} onChange={e => setPasscode(e.target.value)} required />
      {error && <p className="ln-small" role="alert" style={{ color: 'var(--color-danger)', margin: 0 }}>{error}</p>}
      <button type="submit" className="ln-btn ln-btn-primary" disabled={busy || !passcode}>{busy ? t('devx.checking') : t('devx.enter')}</button>
      <p className="ln-xs ln-muted" style={{ margin: 0 }}>{t('devx.unlockNote')}</p>
    </form>
  );
}

function Tools({ sampleEvidenceId, onChanged }) {
  const { t, fmtDate } = useUiLang();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [build, setBuild] = useState(null);
  useEffect(() => { api.get('/dev/build-info').then(r => setBuild(r.data)).catch(() => {}); }, []);

  const reset = async () => {
    setBusy('reset'); setNote('');
    try { await api.post('/dev/reset-test-data', { confirm: true }); setNote(t('devx.resetDone')); onChanged(); } catch (e) { setNote(errText(e, t('devx.toolFailed'))); }
    setBusy(''); setConfirming(false);
  };
  const skip = async () => {
    setBusy('skip'); setNote('');
    try {
      const { data } = await api.post('/dev/skip-waits', {});
      setNote(t('devx.skipDone', { employers: data.done.employers_verified, locks: data.done.pin_locks_cleared + data.done.login_failures_cleared, reviews: data.done.reviews_due_now }));
      onChanged();
    } catch (e) { setNote(errText(e, t('devx.toolFailed'))); }
    setBusy('');
  };

  return (
    <section className="ln-col" style={{ gap: 12 }} aria-labelledby="dev-tools">
      <h2 id="dev-tools" className="ln-h2">{t('devx.tools')}</h2>
      <div className="dx-tools">
        <div className="ln-card ln-col" style={{ gap: 8 }}>
          <b className="ln-row" style={{ gap: 8 }}><RotateCcw size={18} aria-hidden="true" />{t('devx.reset')}</b>
          <span className="ln-small ln-muted">{t('devx.resetText')}</span>
          {confirming ? (
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <button type="button" className="ln-btn ln-btn-primary" onClick={reset} disabled={busy === 'reset'}>{busy === 'reset' ? t('devx.working') : t('devx.resetConfirm')}</button>
              <button type="button" className="ln-btn" onClick={() => setConfirming(false)}>{t('devx.cancel')}</button>
            </div>
          ) : <button type="button" className="ln-btn" onClick={() => setConfirming(true)}>{t('devx.reset')}</button>}
        </div>
        <div className="ln-card ln-col" style={{ gap: 8 }}>
          <b className="ln-row" style={{ gap: 8 }}><FastForward size={18} aria-hidden="true" />{t('devx.skip')}</b>
          <span className="ln-small ln-muted">{t('devx.skipText')}</span>
          <button type="button" className="ln-btn" onClick={skip} disabled={busy === 'skip'}>{busy === 'skip' ? t('devx.working') : t('devx.skip')}</button>
        </div>
        <div className="ln-card ln-col" style={{ gap: 8 }}>
          <b className="ln-row" style={{ gap: 8 }}><BadgeCheck size={18} aria-hidden="true" />{t('devx.passport')}</b>
          <span className="ln-small ln-muted">{sampleEvidenceId ? t('devx.passportText') : t('devx.passportNone')}</span>
          <a className="ln-btn" href={`/verify/${sampleEvidenceId || 'QBX-DEMO-0000'}`} target="_blank" rel="noopener noreferrer">{t('devx.passportOpen')}</a>
        </div>
        <div className="ln-card ln-col" style={{ gap: 6 }}>
          <b className="ln-row" style={{ gap: 8 }}><Info size={18} aria-hidden="true" />{t('devx.build')}</b>
          {build ? (
            <dl className="dx-build ln-small">
              <dt>{t('devx.version')}</dt><dd>{build.version}</dd>
              <dt>{t('devx.commit')}</dt><dd><code>{build.commit || '—'}</code>{build.branch ? ` · ${build.branch}` : ''}</dd>
              <dt>{t('devx.deployed')}</dt><dd>{build.built_at ? fmtDate(build.built_at, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd>
              <dt>{t('devx.environment')}</dt><dd>{build.environment}{build.region ? ` · ${build.region}` : ''}</dd>
              <dt>{t('devx.ai')}</dt><dd>{build.ai}</dd>
            </dl>
          ) : <span className="ln-small ln-muted">{t('devx.loading')}</span>}
        </div>
      </div>
      {note && <p className="ln-small" role="status" style={{ margin: 0 }}>{note}</p>}
    </section>
  );
}

export default function DevAccess() {
  const { t, setLang, fmtDate } = useUiLang();
  const { login, logout, token } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | off | locked | open
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await api.get('/dev/status');
      if (!s.data?.unlocked) { setState('locked'); return; }
      const a = await api.get('/dev/accounts');
      setData(a.data); setState('open');
    } catch (e) {
      setState(e?.response?.status === 401 ? 'locked' : 'off');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (key) => {
    setBusy(key); setError('');
    try { await openDevAccount(key, { login, navigate }); } catch (e) { setError(errText(e, t('devx.openFailed'))); setBusy(''); }
  };
  const openPublic = () => {
    if (token) logout();
    setLang('english');
    navigate('/');
  };

  if (state === 'off') return <Navigate to="/" replace />;
  const ready = new Map((data?.accounts || []).map(a => [a.key, a]));
  return (
    <div className="dx-page">
      <header className="dx-head">
        <BrandLogo height={36} tagline={false} />
        <span className="dx-badge">{t('devx.badge')}</span>
      </header>
      <main className="dx-main ln-col" style={{ gap: 20 }}>
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{t('devx.title')}</h1>
          <p className="ln-sub" style={{ margin: 0 }}>{t('devx.sub')}</p>
        </div>
        {state === 'loading' && <p className="ln-small ln-muted">{t('devx.loading')}</p>}
        {state === 'locked' && <Unlock onDone={load} />}
        {state === 'open' && (
          <>
            <p className="ln-xs ln-muted" style={{ margin: 0 }}>{t('devx.unlockedUntil', { time: fmtDate(data.unlock_expires_at, { timeStyle: 'short' }) })}</p>
            {error && <p className="ln-small" role="alert" style={{ color: 'var(--color-danger)', margin: 0 }}>{error}</p>}
            <section className="dx-cards" aria-label={t('devx.cardsLabel')}>
              {DEV_CARDS.map(c => {
                const Icon = ICONS[c.key];
                const a = ready.get(c.key);
                return (
                  <article key={c.key} className="ln-card ln-col dx-card" style={{ gap: 6 }}>
                    <b className="ln-row" style={{ gap: 8 }}><Icon size={18} aria-hidden="true" />{t(c.label)}</b>
                    <span className="ln-xs ln-muted">{a?.ready ? [a.name, a.detail].filter(Boolean).join(' · ') : t('devx.notSeeded')}</span>
                    <code className="ln-xs ln-muted">{c.home}</code>
                    <button type="button" className="ln-btn ln-btn-primary" onClick={() => open(c.key)} disabled={!a?.ready || !!busy}>
                      <LogIn size={16} aria-hidden="true" />{busy === c.key ? t('devx.opening') : t('devx.open')}
                    </button>
                  </article>
                );
              })}
              <article className="ln-card ln-col dx-card" style={{ gap: 6 }}>
                <b className="ln-row" style={{ gap: 8 }}><Globe size={18} aria-hidden="true" />{t('devx.card.public')}</b>
                <span className="ln-xs ln-muted">{t('devx.publicText')}</span>
                <code className="ln-xs ln-muted">/</code>
                <button type="button" className="ln-btn" onClick={openPublic}><LogIn size={16} aria-hidden="true" />{t('devx.open')}</button>
              </article>
            </section>
            <Tools sampleEvidenceId={data.sample_evidence_id} onChanged={load} />
          </>
        )}
      </main>
    </div>
  );
}
