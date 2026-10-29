// src/pages/learn/Apply.js — /learn/apply/:roleId, applying to an employer's
// role on Qubirex: a confirmation that lists exactly what is shared, then
// Send. Status afterwards: Applied → Shortlisted → Interview → Offer, with
// Withdraw always there (Jobs & applications). Outside job posts keep "I applied".
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Send, ShieldCheck } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';
import { PageHeader, Skeleton } from '../../components/shared/ui';
import { StatusWord } from '../../components/learn/journey';

export default function Apply() {
  const { t } = useUiLang();
  const { roleId } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/learner/apply/${roleId}`).then(r => setD(r.data)).catch(e => setError(errMsg(e))); }, [roleId]);
  const send = async () => {
    setBusy(true); setError('');
    try { const r = await api.post(`/learner/apply/${roleId}`, { confirm: true }); navigate(`/learn/requests/${r.data.id}`); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  if (!d) return error ? <div className="ln-error" role="alert">{error}</div> : <Skeleton lines={5} card />;
  const already = d.current && !['withdrawn', 'declined', 'requested', 'watching'].includes(d.current.stage);
  return (
    <div className="ui-narrow ln-col" style={{ gap: 16 }}>
      <PageHeader title={t('lj.apply.title', { role: d.role.title })} subtitle={`${d.role.employer}${d.role.city ? ` · ${d.role.city}` : ''}`} crumbs={[{ label: t('nav.jobs'), to: '/learn/jobs' }, { label: d.role.title }]} />
      {d.role.interview_promise && <div className="ln-card ln-card-warm"><b>{t('lj.apply.promise')}</b></div>}
      {already ? (
        <div className="ln-card ln-col" style={{ gap: 6 }}><span>{t('lj.apply.already')}</span><StatusWord stage={d.current.stage} />
          <Link className="ln-link" to={`/learn/requests/${d.current.id}`}>{t('lj.apply.seeStatus')}</Link></div>
      ) : (
        <>
          <section className="ln-card ln-col" style={{ gap: 8 }} aria-labelledby="shared">
            <b id="shared" className="ln-row" style={{ gap: 8 }}><ShieldCheck size={18} aria-hidden="true" />{t('lj.apply.whatShared')}</b>
            <ul className="lj-steps">{d.shares.map(s => <li key={s}>{t(`lj.share.${s}`)}{s === 'skills' && d.evidence_id ? ` (${d.evidence_id})` : ''}{s === 'name' ? `: ${d.name}` : ''}</li>)}</ul>
            <span className="ln-small ln-muted">{t('lj.apply.notShared')}</span>
            <span className="ln-small ln-muted">{t('lj.apply.withdrawAny')}</span>
          </section>
          <label className="ln-row" style={{ gap: 8 }}><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />{t('lj.apply.confirm')}</label>
          {error && <div className="ln-error" role="alert">{error}</div>}
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <button type="button" className="ln-btn ln-btn-primary" onClick={send} disabled={!ok || busy}><Send size={16} aria-hidden="true" />{busy ? t('lj.sending') : t('lj.apply.send')}</button>
            <Link className="ln-btn" to="/learn/jobs">{t('lj.cancel')}</Link>
          </div>
        </>
      )}
    </div>
  );
}
