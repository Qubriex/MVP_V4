// src/components/DemoBar.js — the bar on every page while a visitor is in
// the working demo (/demo). Its own colour (teal), never the brand red or the
// developer purple. It says this is sample data and when the sandbox resets,
// switches to another sample person in the same sandbox (to see both sides of
// one action), opens the guided story and the Demo inbox (messages that would
// have been sent), resets the sandbox, and exits. It sits above the learner's
// phone tab bar (styles/ui.css), like the developer bar.
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlaskConical, ListChecks, Inbox, RotateCcw, LogOut, Mail, MessageCircle, CheckCircle2, Circle, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUiLang } from '../context/UiLangContext';
import Drawer from './shared/Drawer';
import api from '../utils/api';
import { PERSONAS, STORY, readDemo, switchPersona, resetDemo, exitDemo, forgetDemo } from '../utils/demoAccess';

const left = (iso) => Math.max(0, new Date(iso).getTime() - Date.now());

function Countdown({ endsAt }) {
  const { t } = useUiLang();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(id); }, []);
  const ms = left(endsAt);
  return <>{t('demo2.bar.resetsIn', { h: Math.floor(ms / 3600000), m: Math.floor((ms % 3600000) / 60000) })}</>;
}

// Outline the control a story step is about, once the page has drawn it.
function highlight(selector) {
  if (!selector) return;
  let tries = 0;
  const find = () => {
    const el = document.querySelector(selector);
    if (el) {
      document.querySelectorAll('.tour-on').forEach(x => x.classList.remove('tour-on'));
      el.classList.add('tour-on');
      el.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      setTimeout(() => el.classList.remove('tour-on'), 6000);
    } else if (tries++ < 20) setTimeout(find, 250);
  };
  setTimeout(find, 300);
}

export default function DemoBar() {
  const { t, fmtDate } = useUiLang();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [marker, setMarker] = useState(readDemo);
  const [me, setMe] = useState(null);
  const [panel, setPanel] = useState(null); // story | inbox
  const [inbox, setInbox] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const on = () => setMarker(readDemo());
    window.addEventListener('qubirex:demo', on);
    return () => window.removeEventListener('qubirex:demo', on);
  }, []);
  const load = useCallback(() => {
    if (!readDemo()) { setMe(null); return; }
    api.get('/demo/me').then(r => setMe(r.data)).catch(e => { if (e?.response?.status === 401) { forgetDemo(); setMe(null); } });
  }, []);
  // Refresh on every page change (story progress, inbox count) and each minute.
  useEffect(() => { load(); }, [load, marker, location.pathname]);
  useEffect(() => { if (!marker) return undefined; const id = setInterval(load, 60000); return () => clearInterval(id); }, [marker, load]);
  useEffect(() => {
    document.body.classList.toggle('has-demobar', !!(marker && me));
    return () => document.body.classList.remove('has-demobar');
  }, [marker, me]);
  useEffect(() => { if (panel === 'inbox') api.get('/demo/inbox').then(r => setInbox(r.data.messages)).catch(() => {}); }, [panel, me]);

  if (!marker || !me) return null;
  const ctx = { login: auth.login, logout: auth.logout, navigate };
  const act = async (fn) => { setBusy(true); try { await fn(); } catch { /* the bar reloads below */ } setBusy(false); load(); };
  const showMe = (s) => act(async () => {
    setPanel(null);
    if (me.persona !== s.who) await switchPersona(s.who, ctx);
    navigate(s.to(me));
    highlight(typeof s.mark === 'function' ? s.mark(me) : s.mark && `[data-demo="${s.mark}"]`);
  });
  const done = new Set(me.story || []);

  return (
    <>
      <div className="dm-bar" role="region" aria-label={t('demo2.bar.label')}>
        <span className="dm-bar-tag"><FlaskConical size={14} aria-hidden="true" />{t('demo2.bar.tag')}</span>
        <span className="dm-bar-info"><Countdown endsAt={me.ends_at} /></span>
        <select value={me.persona} disabled={busy} onChange={e => act(() => switchPersona(e.target.value, ctx))} aria-label={t('demo2.bar.switch')} title={t('demo2.bar.switch')}>
          {PERSONAS.map(p => <option key={p.key} value={p.key}>{t('demo2.bar.as', { name: t(`demo2.p.${p.key}.name`) })}</option>)}
        </select>
        <button type="button" onClick={() => setPanel('story')}><ListChecks size={14} aria-hidden="true" />{t('demo2.bar.story', { done: done.size, total: STORY.length })}</button>
        <button type="button" onClick={() => setPanel('inbox')}><Inbox size={14} aria-hidden="true" />{t('demo2.bar.inbox', { n: me.inbox_count })}</button>
        {confirmReset ? (
          <span className="ln-row" style={{ gap: 6 }}>
            <button type="button" onClick={() => { setConfirmReset(false); act(() => resetDemo(ctx)); }}>{t('demo2.bar.resetYes')}</button>
            <button type="button" onClick={() => setConfirmReset(false)}>{t('demo2.bar.cancel')}</button>
          </span>
        ) : <button type="button" onClick={() => setConfirmReset(true)}><RotateCcw size={14} aria-hidden="true" />{t('demo2.bar.reset')}</button>}
        <button type="button" className="dm-bar-exit" onClick={() => act(() => exitDemo(ctx))}><LogOut size={14} aria-hidden="true" />{t('demo2.bar.exit')}</button>
        {me.ai?.mode && me.ai.mode !== 'live' && <span className="dm-bar-note">{t(`demo2.ai.${me.ai.mode}`)}</span>}
      </div>

      {panel === 'story' && (
        <Drawer title={t('demo2.story.title')} onClose={() => setPanel(null)}>
          <p className="ln-small ln-muted" style={{ margin: 0 }}>{t('demo2.story.sub')}</p>
          <ol className="dm-story">
            {STORY.map((s, i) => (
              <li key={s.step} className={done.has(s.step) ? 'is-done' : ''}>
                <span className="dm-story-mark" aria-hidden="true">{done.has(s.step) ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
                <div className="ln-col" style={{ gap: 2, flex: 1 }}>
                  <b className="ln-small">{i + 1}. {t(`demo2.story.${s.step}`)}</b>
                  <span className="ln-xs ln-muted">{t(`demo2.story.${s.step}Text`)} · {t('demo2.story.as', { name: t(`demo2.p.${s.who}.name`) })}</span>
                  {done.has(s.step) && <span className="ln-xs" style={{ color: 'var(--ok)' }}>{t('demo2.story.doneLabel')}</span>}
                </div>
                <button type="button" className="ln-btn ln-btn-sm" onClick={() => showMe(s)} disabled={busy}><Eye size={14} aria-hidden="true" />{t('demo2.story.showMe')}</button>
              </li>
            ))}
          </ol>
          {me.sample_jd && <details className="ln-small"><summary>{t('demo2.story.sampleJd')}</summary><pre className="dm-jd">{me.sample_jd}</pre></details>}
        </Drawer>
      )}

      {panel === 'inbox' && (
        <Drawer title={t('demo2.inbox.title')} onClose={() => setPanel(null)}>
          <p className="ln-small ln-muted" style={{ margin: 0 }}>{t('demo2.inbox.sub')}</p>
          {!inbox.length && <p className="ln-small">{t('demo2.inbox.empty')}</p>}
          {inbox.map(m => (
            <article key={m.id} className="ln-card ln-card-sm" style={{ gap: 4 }}>
              <span className="ln-row ln-xs ln-muted" style={{ gap: 6 }}>
                {m.channel === 'whatsapp' ? <MessageCircle size={14} aria-hidden="true" /> : <Mail size={14} aria-hidden="true" />}
                {t(m.channel === 'whatsapp' ? 'demo2.inbox.whatsapp' : 'demo2.inbox.email', { to: m.recipient })} · {fmtDate(m.created_at, { timeStyle: 'short' })}
              </span>
              <b className="ln-small">{m.subject}</b>
              {m.body && <span className="ln-xs" style={{ whiteSpace: 'pre-wrap' }}>{m.body.slice(0, 600)}</span>}
            </article>
          ))}
        </Drawer>
      )}
    </>
  );
}
