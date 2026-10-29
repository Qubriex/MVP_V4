// src/pages/learn/NotificationPrefs.js — /learn/notifications: which messages
// arrive, per event and per channel (in the app, WhatsApp, email). Required
// ones (a decision is needed, or a result) always arrive in the app.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';
import { PageHeader, Skeleton } from '../../components/shared/ui';

const CHANNELS = ['in_app', 'whatsapp', 'email'];

export default function NotificationPrefs() {
  const { t } = useUiLang();
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  useEffect(() => { api.get('/learner/notification-prefs').then(r => setPrefs(r.data.prefs)).catch(e => setError(errMsg(e))); }, []);
  const set = async (event, channel, on) => {
    setSaved('');
    try { const r = await api.put('/learner/notification-prefs', { prefs: [{ event, channels: { [channel]: on } }] }); setPrefs(r.data.prefs); setSaved(t('lj.notify.saved')); } catch (e) { setError(errMsg(e)); }
  };
  return (
    <>
      <PageHeader title={t('lj.notify.title')} subtitle={t('lj.notify.sub')} crumbs={[{ label: t('nav.settings'), to: '/learn/settings' }, { label: t('lj.notify.title') }]} />
      {error && <div className="ln-error" role="alert">{error}</div>}
      {!prefs && !error && <Skeleton lines={6} card />}
      {prefs && (
        <div className="ln-card" style={{ overflowX: 'auto' }}>
          <table className="lj-prefs">
            <thead><tr><th scope="col">{t('lj.notify.event')}</th>{CHANNELS.map(c => <th key={c} scope="col">{t(`lj.notify.channel.${c}`)}</th>)}</tr></thead>
            <tbody>
              {prefs.map(p => (
                <tr key={p.event}>
                  <th scope="row"><span className="ln-col"><span>{t(`lj.notify.ev.${p.event}`)}</span><span className="ln-xs ln-muted">{t(`lj.notify.evHelp.${p.event}`)}</span></span></th>
                  {CHANNELS.map(c => {
                    const req = p.required.includes(c);
                    return (
                      <td key={c}>
                        <input type="checkbox" checked={!!p.channels[c]} disabled={req} onChange={e => set(p.event, c, e.target.checked)}
                          aria-label={`${t(`lj.notify.ev.${p.event}`)}: ${t(`lj.notify.channel.${c}`)}`} />
                        {req && <span className="ln-xs ln-muted"> {t('lj.notify.required')}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {saved && <p className="ln-small" role="status">{saved}</p>}
      <p className="ln-small ln-muted">{t('lj.notify.note')}</p>
    </>
  );
}
