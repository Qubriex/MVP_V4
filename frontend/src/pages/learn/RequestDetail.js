// src/pages/learn/RequestDetail.js — /learn/requests/:id: one employer request
// or one application.
//   A request: who is asking and for which role, the interview promise first,
//   a yes/no for each item (skills, labels, Day-One, résumé, name, contact —
//   name and contact off by default), how long they may see it, then Approve
//   selected, Decline or Ask a question. Every decision is listed.
//   An application or an approved request: the status so far (Applied →
//   Shortlisted → Interview (date) → Offer) and Withdraw.
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Handshake, MessageCircleQuestion, X, Check, LogOut } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';
import { PageHeader, Skeleton, Select } from '../../components/shared/ui';
import Switch from '../../components/shared/ui/Switch';
import { StatusWord } from '../../components/learn/journey';
import { fmtDate } from '../../components/learn/evidenceText';

const OPEN = ['access_granted', 'applied', 'shortlisted', 'interview', 'dayone', 'offer', 'hired', 'hold'];

export default function RequestDetail() {
  const { t } = useUiLang();
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [items, setItems] = useState(new Set());
  const [days, setDays] = useState('90');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const take = (r) => { setD(r.data); setItems(new Set((r.data.default_on || []).filter(k => r.data.asked.includes(k)))); };
  useEffect(() => { api.get(`/learner/requests/${id}`).then(take).catch(e => setError(errMsg(e))); }, [id]);
  const decide = async (decision) => {
    setBusy(true); setError(''); setDone('');
    try {
      const r = await api.post(`/learner/requests/${id}/decide`, { decision, items: [...items], expires_days: Number(days), note: question });
      setD(r.data); setAsking(false); setQuestion('');
      setDone(t(`lj.request.done.${decision}`));
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  const withdraw = async () => {
    setBusy(true); setError('');
    try { await api.post(`/learner/requests/${id}/withdraw`); take(await api.get(`/learner/requests/${id}`)); setDone(t('lj.request.done.withdraw')); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  if (!d) return error ? <div className="ln-error" role="alert">{error}</div> : <Skeleton lines={5} card />;
  const isRequest = d.stage === 'requested';
  const toggle = (k, on) => setItems(s => { const n = new Set(s); if (on) n.add(k); else n.delete(k); return n; });
  return (
    <div className="ui-narrow ln-col" style={{ gap: 16 }}>
      <PageHeader title={d.source === 'apply' ? t('lj.request.appTitle', { role: d.role_title }) : t('lj.request.title', { employer: d.employer })}
        subtitle={`${d.employer} · ${d.role_title}${d.city ? ` · ${d.city}` : ''}`} crumbs={[{ label: t('nav.jobs'), to: '/learn/jobs' }, { label: d.role_title }]} />
      {d.interview_promised && <div className="ln-card ln-card-warm ln-row" style={{ gap: 8 }}><Handshake size={20} aria-hidden="true" /><b>{t('lj.request.promise')}</b></div>}
      <div className="ln-row ln-wrap" style={{ gap: 8 }}><StatusWord stage={d.stage} />{d.employer_verified && <span className="ln-tag ln-tag-success">{t('lj.request.verified')}</span>}
        {d.interview_at && <span className="ln-small">{t('lj.request.interviewOn', { date: fmtDate(d.interview_at) })}</span>}</div>
      {done && <div className="ln-card" role="status">{done}</div>}
      {error && <div className="ln-error" role="alert">{error}</div>}

      {isRequest && (
        <section className="ln-card ln-col" style={{ gap: 10 }} aria-labelledby="items-h">
          <b id="items-h">{t('lj.request.choose')}</b>
          {d.asked.map(k => (
            <Switch key={k} checked={items.has(k)} onChange={on => toggle(k, on)}>
              <span className="ln-col" style={{ gap: 2 }}><span>{t(`lj.share.${k}`)}</span><span className="ln-xs ln-muted">{t(`lj.shareHelp.${k}`)}</span></span>
            </Switch>
          ))}
          <label className="ln-label" htmlFor="exp">{t('lj.request.howLong')}</label>
          <Select id="exp" value={days} onChange={e => setDays(e.target.value)}>{(d.expiry_days || [30, 60, 90]).map(n => <option key={n} value={String(n)}>{t('lj.request.days', { n })}</option>)}</Select>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => decide('approve')} disabled={busy || !items.size} data-decide="approve"><Check size={16} aria-hidden="true" />{t('lj.request.approve', { n: items.size })}</button>
            <button type="button" className="ln-btn" onClick={() => decide('decline')} disabled={busy}><X size={16} aria-hidden="true" />{t('lj.request.decline')}</button>
            <button type="button" className="ln-btn" onClick={() => setAsking(a => !a)} aria-expanded={asking}><MessageCircleQuestion size={16} aria-hidden="true" />{t('lj.request.ask')}</button>
          </div>
          {asking && (
            <div className="ln-col" style={{ gap: 6 }}>
              <textarea className="ln-textarea" rows={3} value={question} onChange={e => setQuestion(e.target.value)} aria-label={t('lj.request.ask')} placeholder={t('lj.request.askPlaceholder')} />
              <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={() => decide('question')} disabled={busy || question.trim().length < 3}>{t('lj.request.sendQuestion')}</button>
            </div>
          )}
          <span className="ln-xs ln-muted">{t('lj.request.privacy')}</span>
        </section>
      )}

      {!isRequest && (
        <section className="ln-card ln-col" style={{ gap: 8 }} aria-labelledby="status-h">
          <b id="status-h">{t('lj.request.statusSoFar')}</b>
          <ol className="lj-timeline">
            {(d.history.length ? d.history : [{ stage: d.stage, at: d.updated_at }]).map((h, i) => (
              <li key={i}><StatusWord stage={h.stage} /> <span className="ln-small ln-muted">{fmtDate(h.at)}{h.interview_at ? ` · ${t('lj.request.interviewOn', { date: fmtDate(h.interview_at) })}` : ''}</span></li>
            ))}
          </ol>
          {d.shared?.length > 0 && <span className="ln-small">{t('lj.request.youShared')} {d.shared.map(k => t(`lj.share.${k}`)).join(', ')}{d.expires_at ? ` · ${t('lj.request.until', { date: fmtDate(d.expires_at) })}` : ''}</span>}
          {d.access_expired && <span className="ln-small">{t('lj.request.expired')}</span>}
          {OPEN.includes(d.stage) && d.stage !== 'hired' && <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={withdraw} disabled={busy}><LogOut size={16} aria-hidden="true" />{t('lj.request.withdraw')}</button>}
        </section>
      )}

      {d.decisions?.length > 0 && (
        <section className="ln-card ln-col" style={{ gap: 6 }} aria-labelledby="dec-h">
          <b id="dec-h">{t('lj.request.decisions')}</b>
          {d.decisions.map((x, i) => (
            <span key={i} className="ln-small">{fmtDate(x.at)} · {t(`lj.request.decision.${x.decision}`)}{x.granted?.length ? `: ${x.granted.map(k => t(`lj.share.${k}`)).join(', ')}` : ''}{x.note ? ` — “${x.note}”` : ''}</span>
          ))}
        </section>
      )}
      <Link className="ln-link ln-small" to="/learn/jobs">{t('lj.request.back')}</Link>
    </div>
  );
}
