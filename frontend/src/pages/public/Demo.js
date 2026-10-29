// src/pages/public/Demo.js — /demo, "Try Qubirex as…": the working demo.
// The visitor picks a sample person and gets a private sandbox (a small sample
// college with students and employers, backend api/routes/demo.js) where every
// feature really works: real API, real data, real AI within limits. Nothing is
// sent anywhere and it deletes itself after a few hours. The old screen-only
// demo pages (/demo/learner, /demo/college, /demo/employer) redirect here.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Loader2, CheckCircle2, Info } from 'lucide-react';
import PublicShell, { BackHome } from '../../components/public/PublicShell';
import { useAuth } from '../../context/AuthContext';
import { useUiLang } from '../../context/UiLangContext';
import api from '../../utils/api';
import { PERSONAS, startDemo } from '../../utils/demoAccess';

const SETUP_STEPS = ['demo2.setup1', 'demo2.setup2', 'demo2.setup3', 'demo2.setup4'];
const TURNSTILE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '';

// Cloudflare Turnstile, only when the site key is set at build time.
function useTurnstile(ref) {
  const [token, setToken] = useState('');
  useEffect(() => {
    if (!TURNSTILE_KEY || !ref.current) return undefined;
    let id = null;
    const render = () => { if (window.turnstile && ref.current) id = window.turnstile.render(ref.current, { sitekey: TURNSTILE_KEY, callback: setToken }); };
    if (window.turnstile) render();
    else {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; s.async = true; s.onload = render;
      document.head.appendChild(s);
    }
    return () => { try { if (id != null) window.turnstile.remove(id); } catch { /* gone */ } };
  }, [ref]);
  return token;
}

function Setup() {
  const { t } = useUiLang();
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI(x => Math.min(x + 1, SETUP_STEPS.length - 1)), 450); return () => clearInterval(id); }, []);
  return (
    <div className="dm-setup" role="status" aria-live="polite">
      <Loader2 size={28} className="dm-spin" aria-hidden="true" />
      <b style={{ fontSize: 'var(--fs-h3)' }}>{t('demo2.settingUp')}</b>
      <ul className="ln-col" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
        {SETUP_STEPS.map((k, n) => (
          <li key={k} className="ln-row ln-small" style={{ gap: 8, opacity: n <= i ? 1 : 0.45 }}>
            {n < i ? <CheckCircle2 size={16} aria-hidden="true" /> : <span className="dm-dot" aria-hidden="true" />}{t(k)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Demo() {
  const { t } = useUiLang();
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const box = useRef(null);
  const turnstile = useTurnstile(box);

  useEffect(() => { api.get('/demo/status').then(r => setStatus(r.data)).catch(() => setStatus({ enabled: false })); }, []);

  const start = async (persona) => {
    setBusy(persona); setError('');
    try { await startDemo(persona, { login, logout, navigate }, turnstile ? { turnstile } : {}); } catch (e) {
      const msg = e?.response?.data?.error?.message;
      setError(msg || t('demo2.startFailed')); setBusy('');
    }
  };

  return (
    <PublicShell>
      <BackHome />
      <header className="ln-col" style={{ gap: 8 }}>
        <span className="pb-kicker">{t('nav.demo')}</span>
        <h1 className="ln-title">{t('demo2.title')}</h1>
        <span className="ln-sub">{t('demo2.sub')}</span>
      </header>
      {params.get('ended') && <p className="ln-card ln-small" role="status" style={{ margin: 0 }}>{t('demo2.ended')}</p>}
      {status && !status.enabled && <p className="ln-card ln-small" role="status" style={{ margin: 0 }}>{t('demo2.off')}</p>}
      {error && <p className="ln-small" role="alert" style={{ color: 'var(--color-danger)', margin: 0 }}>{error}</p>}
      {busy ? <Setup /> : (
        <section className="dm-personas" aria-label={t('demo2.peopleLabel')}>
          {PERSONAS.map(p => (
            <article key={p.key} className="ln-card dm-persona" style={{ gap: 8 }}>
              <div className="ln-row" style={{ gap: 12 }}>
                <span className={`dm-avatar dm-tone-${p.tone}`} aria-hidden="true">{p.initials}</span>
                <div className="ln-col" style={{ gap: 2 }}>
                  <b style={{ fontSize: 'var(--fs-h3)' }}>{t(`demo2.p.${p.key}.name`)}</b>
                  <span className="ln-small ln-muted">{t(`demo2.p.${p.key}.role`)}</span>
                </div>
              </div>
              <span className="pb-kicker">{t(`demo2.side.${p.side}`)}</span>
              <span className="ln-small">{t(`demo2.p.${p.key}.try`)}</span>
              <button type="button" className="ln-btn ln-btn-primary" style={{ marginTop: 'auto' }} disabled={!status?.enabled || (TURNSTILE_KEY && !turnstile)} onClick={() => start(p.key)}>
                <Play size={16} aria-hidden="true" />{t('demo2.start')}
              </button>
            </article>
          ))}
        </section>
      )}
      {TURNSTILE_KEY && <div ref={box} />}
      <section className="ln-card" style={{ gap: 8 }} aria-labelledby="dm-real">
        <b id="dm-real" className="ln-row" style={{ gap: 8 }}><Info size={18} aria-hidden="true" />{t('demo2.realTitle')}</b>
        <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          {['demo2.real1', 'demo2.real2', 'demo2.real3', 'demo2.real4', 'demo2.real5'].map(k => <li key={k}>{t(k)}</li>)}
        </ul>
        {status?.ai_mode && status.ai_mode !== 'live' && <span className="ln-xs ln-muted">{t(status.ai_mode === 'cached_no_key' ? 'demo2.cachedNoKey' : 'demo2.cachedDaily')}</span>}
      </section>
    </PublicShell>
  );
}
