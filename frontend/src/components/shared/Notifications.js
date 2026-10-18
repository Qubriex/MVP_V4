// src/components/shared/Notifications.js — the bell and its panel (v4.3
// shared kit 3). Unread dot, "Mark all read", and which channels also carry
// them (email now; WhatsApp and SMS once a provider is connected).
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../../utils/api';
import Drawer from './Drawer';

import { useUiLang } from '../../context/UiLangContext';
const ago = (t) => {
  if (!t) return '';
  const m = Math.round((Date.now() - Date.parse(String(t).replace(' ', 'T') + (/[Z+]/.test(String(t).slice(10)) ? '' : 'Z'))) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return m < 2880 ? 'Yesterday' : `${Math.floor(m / 1440)} days ago`;
};

export function useNotifications() {
  const [data, setData] = useState({ items: [], unread: 0, channels: { email: true } });
  const load = useCallback(() => api.get('/notifications').then(r => setData(r.data)).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 120000);
    return () => clearInterval(t);
  }, [load]);
  return { ...data, reload: load };
}

export function NotificationsPanel({ data, onClose, settingsHref }) {
  const { t } = useUiLang();
  const [channels, setChannels] = useState(data.channels || { email: true });
  const [editing, setEditing] = useState(false);
  const readAll = async () => { await api.post('/notifications/read-all').catch(() => {}); data.reload(); };
  const save = async (next) => { setChannels(next); await api.put('/notifications/channels', next).catch(() => {}); };
  return (
    <Drawer title={t('shared.notifications.notifications')} onClose={onClose}>
      <div className="ln-between"><span className="ln-small ln-muted">{data.unread ? t('shared.notifications.unreadN', { n: data.unread }) : t('shared.notifications.allCaughtUp')}</span>
        {data.unread > 0 && <button type="button" className="ln-link" onClick={readAll}>{t('shared.notifications.markAllRead')}</button>}</div>
      <div className="ln-col" style={{ gap: 2 }}>
        {data.items.length === 0 && <span className="ln-small ln-muted">{t('shared.notifications.nothingYet')}</span>}
        {data.items.map(n => (
          <Link key={n.id} to={n.href || '#'} className={`sk-note ${n.unread ? 'is-unread' : ''}`} onClick={onClose}>
            <span className="sk-note-dot" aria-hidden="true" />
            <span className="ln-col" style={{ gap: 2 }}><b>{n.title}</b>{n.body && <span className="ln-xs">{n.body}</span>}<span className="ln-xs ln-muted">{ago(n.created_at)}</span></span>
          </Link>
        ))}
      </div>
      <div className="sk-channels">
        <span className="ln-xs">{t('shared.notifications.weAlsoSendThese')}{channels.whatsapp ? t('shared.notifications.andWhatsapp') : ''}.</span>
        <button type="button" className="ln-link" style={{ fontSize: 'var(--fs-caption)' }} onClick={() => setEditing(e => !e)}>{t('shared.notifications.changeChannels')}</button>
        {editing && (
          <div className="ln-col" style={{ gap: 4, width: '100%' }}>
            <label className="ln-toggle-row"><span>{t('shared.notifications.email')}</span><input type="checkbox" checked={!!channels.email} onChange={e => save({ ...channels, email: e.target.checked })} /></label>
            <label className="ln-toggle-row"><span className="ln-col"><span>{t('shared.notifications.whatsapp')}</span><span className="ln-xs ln-muted">{t('shared.notifications.sentOnceInstitutionConnects')}</span></span><input type="checkbox" checked={!!channels.whatsapp} onChange={e => save({ ...channels, whatsapp: e.target.checked })} /></label>
            <label className="ln-toggle-row"><span className="ln-col"><span>SMS</span><span className="ln-xs ln-muted">{t('shared.notifications.sentOnceSmsProvider')}</span></span><input type="checkbox" checked={!!channels.sms} onChange={e => save({ ...channels, sms: e.target.checked })} /></label>
            {settingsHref && <Link to={settingsHref} className="ln-link ln-xs" onClick={onClose}>{t('shared.notifications.moreSettings')}</Link>}
          </div>
        )}
      </div>
    </Drawer>
  );
}

export function BellButton({ unread, onClick }) {
  const { t } = useUiLang();
  return (
    <button type="button" className="sk-iconbtn" onClick={onClick} aria-label={unread ? t('shared.notifications.ariaUnread', { n: unread }) : t('shared.notifications.notifications')}>
      <Bell size={18} aria-hidden="true" />{unread > 0 && <span className="sk-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
  );
}
