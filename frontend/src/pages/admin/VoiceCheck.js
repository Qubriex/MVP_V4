// src/pages/admin/VoiceCheck.js — /admin/voice: why the voice works or not.
// For every voice key (slot and fingerprint, never the key) and engine (Cloud
// Text-to-Speech Chirp 3 HD in Telugu, Hindi and English; each Gemini speech
// model): working or not, Google's reason and what to do. A Play test per
// language speaks one sentence through the real chain and shows which engine
// and key answered and how long the first audio took.
import React, { useEffect, useRef, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';

export default function VoiceCheck() {
  const { t } = useUiLang();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [plays, setPlays] = useState({});
  const audio = useRef(null);
  const load = (fresh = false) => {
    setBusy(true);
    api.get(`/admin/voice-check${fresh ? '?fresh=1' : ''}`, { timeout: 120000 })
      .then(r => { setD(r.data); setError(''); }).catch(e => setError(errMsg(e))).finally(() => setBusy(false));
  };
  useEffect(() => { load(); }, []);
  const play = async (language) => {
    setPlays(p => ({ ...p, [language]: { busy: true } }));
    const r = await api.post('/admin/voice-check/play', { language }, { timeout: 90000 }).then(x => x.data).catch(e => ({ ok: false, error: errMsg(e) }));
    setPlays(p => ({ ...p, [language]: r }));
    if (r.ok && r.audio) {
      if (!audio.current) audio.current = new Audio();
      audio.current.src = `data:${r.mime};base64,${r.audio}`;
      audio.current.play().catch(() => {});
    }
  };

  const v = d?.voice;
  return (
    <div className="ln-col" style={{ gap: 16 }}>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{t('adm.voice.title')}</h1>
          <span className="ln-sub">{t('adm.voice.sub')}</span>
        </div>
        <button type="button" className="ln-btn" onClick={() => load(true)} disabled={busy}><RefreshCw size={16} aria-hidden="true" />{busy ? t('adm.voice.checking') : t('adm.voice.checkAgain')}</button>
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {v && (
        <section className="ln-card ln-col" style={{ gap: 6 }} data-voice-summary={v.voice}>
          <b>{v.voice === 'server' ? t('adm.voice.working', { engine: v.engine, slot: v.slot }) : v.voice === 'off' ? t('adm.voice.off') : t('adm.voice.notWorking')}</b>
          {(v.todo || []).length > 0 && (
            <div className="ln-col" style={{ gap: 4 }}>
              <span className="ln-small ln-muted">{t('adm.voice.todo')}</span>
              <ul className="ln-small" style={{ margin: 0 }}>{v.todo.map(x => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
        </section>
      )}
      <section className="ln-card ln-col" style={{ gap: 10 }}>
        <b>{t('adm.voice.play')}</b>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          {['telugu', 'hindi', 'english'].map(l => (
            <div key={l} className="ln-col" style={{ gap: 4, minWidth: 180 }} data-play={l}>
              <button type="button" className="ln-btn" onClick={() => play(l)} disabled={plays[l]?.busy}><Play size={14} aria-hidden="true" />{t(`lang.${l}`)}</button>
              {plays[l] && !plays[l].busy && (
                <span className="ln-xs">{plays[l].ok ? t('adm.voice.played', { engine: plays[l].engine, slot: plays[l].slot ?? '—', ms: plays[l].ms }) : t('adm.voice.playFailed', { reason: plays[l].reason || plays[l].status || plays[l].error || '—' })}</span>
              )}
            </div>
          ))}
        </div>
      </section>
      {d?.keys && (
        <section className="ln-card ln-col" style={{ gap: 8 }}>
          <b>{t('adm.voice.keys')}</b>
          <div className="ln-tablewrap"><table className="ln-table">
            <thead><tr><th>{t('adm.voice.slot')}</th><th>{t('adm.voice.role')}</th><th>{t('adm.voice.fingerprint')}</th><th>{t('adm.voice.status')}</th><th>{t('adm.voice.lastError')}</th></tr></thead>
            <tbody>{d.keys.slots.map(s => (
              <tr key={s.slot} data-key-slot={s.slot} data-key-status={s.status}><td>{s.slot}</td><td>{d.keys.roles[s.slot]}</td><td><code>{s.fingerprint || '—'}</code></td><td>{s.status}{s.until ? ` · ${new Date(s.until).toLocaleTimeString()}` : ''}</td><td className="ln-small">{s.last_error ? `${s.last_error} · ${s.last_error_at ? new Date(s.last_error_at).toLocaleString() : ''}` : '—'}</td></tr>
            ))}</tbody>
          </table></div>
          <span className="ln-xs ln-muted">{t('adm.voice.failovers', { n: d.keys.failovers_24h, slot: d.keys.last_served?.slot ?? '—' })}</span>
        </section>
      )}
      {(v?.slots || []).map(s => (
        <section key={s.slot} className="ln-card ln-col" style={{ gap: 8 }} data-voice-slot={s.slot}>
          <b>{t('adm.voice.slotTitle', { slot: s.slot, fp: s.fingerprint })}</b>
          <div className="ln-tablewrap"><table className="ln-table">
            <thead><tr><th>{t('adm.voice.engine')}</th><th>{t('adm.voice.result')}</th><th>{t('adm.voice.reason')}</th><th>{t('adm.voice.whatToDo')}</th></tr></thead>
            <tbody>{s.engines.map(e => (
              <tr key={`${e.engine}:${e.language}`} data-engine={e.engine} data-ok={e.ok ? 'yes' : 'no'}>
                <td className="ln-small"><code>{e.engine}</code></td>
                <td>{e.ok ? <span className="ln-tag ln-tag-success">{t('adm.voice.ok', { ms: e.ms })}</span> : <span className="ln-tag ln-tag-warning">{e.status || '—'}</span>}</td>
                <td className="ln-small">{e.reason || '—'}</td>
                <td className="ln-small">{e.ok ? '' : e.todo}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      ))}
    </div>
  );
}
