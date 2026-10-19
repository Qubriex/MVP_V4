// src/pages/admin/Messages.js — /admin/messages — everything sent through
// Talk to us and Help → Contact. Mark each one answered or closed once you
// have replied (by email or WhatsApp to the address they gave).
import React, { useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { LoadingRows } from '../../components/shared/EmptyState';
import EmptyState from '../../components/shared/EmptyState';
import { useUiLang } from '../../context/UiLangContext';

const STATUS = [['open', 'adm.messages.status.open'], ['answered', 'adm.messages.status.answered'], ['closed', 'adm.messages.status.closed']];
const TYPE = { question: 'adm.messages.type.question', problem: 'adm.messages.type.problem', data_request: 'adm.messages.type.data', grievance: 'adm.messages.type.grievance' };

export default function AdminMessages() {
  const { t, fmtDate } = useUiLang();
  const [status, setStatus] = useState('open');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.get(`/admin/help-requests?status=${status}`).then(r => setData(r.data)).catch(e => setError(errMsg(e))), [status]);
  useEffect(() => { setData(null); load(); }, [load]);
  const move = async (id, to) => { setError(''); try { await api.post(`/admin/help-requests/${id}`, { status: to }); load(); } catch (e) { setError(errMsg(e)); } };
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('adm.messages.title')}</h1><span className="ln-sub">{t('adm.messages.sub')}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-pilltabs" role="tablist" style={{ marginBottom: 14 }}>
        {STATUS.map(([s, label]) => <button key={s} type="button" role="tab" className="ln-pilltab" aria-selected={status === s} onClick={() => setStatus(s)}>{t(label)}{data?.counts?.[s] ? ` · ${data.counts[s]}` : ''}</button>)}
      </div>
      {!data ? <LoadingRows rows={4} /> : data.requests.length === 0 ? <EmptyState icon={Mail} title={t('adm.messages.none')} /> : (
        <div className="ln-col" style={{ gap: 12 }}>
          {data.requests.map(m => (
            <article key={m.id} className="ln-card" style={{ gap: 8 }}>
              <div className="ln-between ln-wrap" style={{ gap: 8 }}>
                <span className="ln-row ln-wrap" style={{ gap: 6 }}><span className="ln-tag ln-tag-neutral">{t(TYPE[m.type] || TYPE.question)}</span><span className="ln-xs ln-muted">{t(`adm.messages.from.${m.actor_type === 'public' ? 'public' : 'user'}`)}</span></span>
                <span className="ln-xs ln-muted">{fmtDate(m.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <p className="ln-small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.message}</p>
              {m.reply_to && <span className="ln-small">{t('adm.messages.replyTo')} {/@/.test(m.reply_to) ? <a className="ln-link" href={`mailto:${m.reply_to}`}>{m.reply_to}</a> : <b>{m.reply_to}</b>}</span>}
              <div className="ln-row ln-wrap" style={{ gap: 8 }}>
                {status !== 'answered' && <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => move(m.id, 'answered')}>{t('adm.messages.markAnswered')}</button>}
                {status !== 'closed' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => move(m.id, 'closed')}>{t('adm.messages.close')}</button>}
                {status !== 'open' && <button type="button" className="ln-btn ln-btn-sm" onClick={() => move(m.id, 'open')}>{t('adm.messages.reopen')}</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
