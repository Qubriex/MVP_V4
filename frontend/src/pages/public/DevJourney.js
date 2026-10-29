// src/pages/public/DevJourney.js — /dev/journey: the learner path as a
// checklist for testers. Each step says what to look for and opens the stage
// account that shows it; the ticks and notes stay in this browser only.
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useUiLang } from '../../context/UiLangContext';
import { JOURNEY_STEPS, openDevAccount, openInviteLink } from '../../utils/devAccess';

const STORE = 'qbx_dev_journey_checklist';
const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } };
const writeStore = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private window: ticks are not kept */ } };

export default function DevJourney() {
  const { t } = useUiLang();
  const auth = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [marks, setMarks] = useState(readStore);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dev/status').then(r => setState(r.data?.unlocked ? 'open' : 'locked')).catch(() => setState('off'));
  }, []);
  const update = (id, patch) => setMarks(m => { const next = { ...m, [id]: { ...m[id], ...patch } }; writeStore(next); return next; });
  const open = async (step) => {
    setBusy(step.id); setError('');
    try {
      if (step.invite) await openInviteLink({ logout: auth.logout, navigate, token: auth.token });
      else if (auth.dev?.account_key === step.account) navigate(step.to);
      else await openDevAccount(step.account, { login: auth.login, navigate }, step.to);
    } catch (e) { setError(e?.response?.data?.error?.message || t('devx.openFailed')); setBusy(''); }
  };

  if (state === 'off') return <Navigate to="/" replace />;
  if (state === 'locked') return <Navigate to="/dev" replace />;
  const done = JOURNEY_STEPS.filter(s => marks[s.id]?.done).length;
  return (
    <div className="dx-page">
      <header className="dx-head">
        <BrandLogo height={36} tagline={false} />
        <span className="dx-badge">{t('devx.badge')}</span>
      </header>
      <main className="dx-main ln-col" style={{ gap: 16 }}>
        <Link to="/dev" className="ln-link ln-row" style={{ gap: 6 }}><ArrowLeft size={16} aria-hidden="true" />{t('devx.journey.back')}</Link>
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{t('devx.journey.checklistTitle')}</h1>
          <p className="ln-sub" style={{ margin: 0 }}>{t('devx.journey.checklistSub')}</p>
          <p className="ln-small" role="status" style={{ margin: 0 }}>{t('devx.journey.progress', { done, total: JOURNEY_STEPS.length })}</p>
        </div>
        {error && <p className="ln-small" role="alert" style={{ color: 'var(--color-danger)', margin: 0 }}>{error}</p>}
        <ol className="dx-checklist">
          {JOURNEY_STEPS.map((step, i) => {
            const m = marks[step.id] || {};
            return (
              <li key={step.id} className={`ln-card dx-step ${m.done ? 'is-done' : ''}`} data-step={step.id}>
                <label className="dx-step-tick">
                  <input type="checkbox" checked={!!m.done} onChange={e => update(step.id, { done: e.target.checked })} />
                  <span className="ln-sr">{t('devx.journey.tick')}</span>
                </label>
                <div className="ln-col" style={{ gap: 4, minWidth: 0, flex: 1 }}>
                  <b>{i + 1}. {t(`devx.step.${step.id}`)}</b>
                  <span className="ln-small ln-muted">{t(`devx.stepHint.${step.id}`)}</span>
                  <input className="ln-input dx-step-note" value={m.note || ''} placeholder={t('devx.journey.notePlaceholder')} aria-label={t('devx.journey.note')}
                    onChange={e => update(step.id, { note: e.target.value })} />
                </div>
                <button type="button" className="ln-btn ln-btn-sm" onClick={() => open(step)} disabled={!!busy}>
                  <ExternalLink size={14} aria-hidden="true" />{busy === step.id ? t('devx.opening') : t('devx.journey.openStep')}
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { writeStore({}); setMarks({}); }}>{t('devx.journey.clear')}</button>
      </main>
    </div>
  );
}
