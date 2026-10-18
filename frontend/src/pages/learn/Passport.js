// src/pages/learn/Passport.js — /learn/passport
// The Capability Passport (v4.3 §9). It signs facts, never labels: the labels
// here are computed today from dated demonstrations and change as skills are
// shown again or go stale. The label, evidence level (L) and assurance level
// (A) are separate truths and are shown separately. Journey metrics (loops,
// time, attempts) are never part of it.
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Printer, ShieldCheck, RefreshCw, ExternalLink, Share2 } from 'lucide-react';
import QrCode from '../../components/shared/QrCode';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { Tooltip } from '../../components/shared/ui';
import AnswerBox from '../../components/learn/AnswerBox';
import { LABEL, LEVEL, ASSURANCE, MISSING, FRESH, freshBand, fmtDate } from '../../components/learn/evidenceText';

import { useUiLang } from '../../context/UiLangContext';
import { CodeTag } from '../../components/shared/Popover';
function SkillLine({ s }) {
  const { t } = useUiLang();
  const [open, setOpen] = useState(false);
  const lab = LABEL[s.label] || LABEL.none;
  return (
    <div className="ln-card" style={{ gap: 10 }}>
      <div className="ln-between ln-wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-h3)' }}>{s.name}</span>
          <div className="ln-row ln-wrap" style={{ gap: 6 }}>
            <span className={`ln-tag ln-tag-lg ${lab.cls}`}>{t(lab.text)}</span>
            {s.evidence && <CodeTag code={s.evidence} label={t(LEVEL[s.evidence])} />}
            {s.assurance && <CodeTag code={s.assurance} label={t(ASSURANCE[s.assurance])} />}
          </div>
        </div>
        <div className="ln-col" style={{ gap: 4, minWidth: 180 }}>
          <span className="ln-row ln-wrap ln-xs ln-muted" style={{ gap: 6 }}>
            <Tooltip text={t('learn.passport.freshnessRound', { round: Math.round((s.freshness || 0) * 100) })}><span className={`ln-tag ${FRESH[freshBand(s.freshness || 0)][1]}`} tabIndex={0}>{t(FRESH[freshBand(s.freshness || 0)][0])}</span></Tooltip>
            {t('learn.passport.lastShown', { date: fmtDate(s.last_demonstrated) })}
          </span>
        </div>
      </div>
      <button type="button" className="ln-link" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? t('learn.passport.hideDetails') : s.label === 'Confirmed' ? t('learn.passport.details') : t('learn.passport.howToReachConfirmed')}</button>
      {open && (
        <div className="ln-col" style={{ gap: 10 }}>
          {s.nodes.map(n => (
            <div key={n.node_id} className="ln-tile ln-col" style={{ gap: 6 }}>
              <div className="ln-between ln-wrap"><span style={{ fontWeight: 600 }}>{n.node}</span><span className={`ln-tag ${(LABEL[n.label] || LABEL.none).cls}`}>{t((LABEL[n.label] || LABEL.none).text)}</span></div>
              {n.missing_for_confirmed?.length > 0
                ? <ul className="ln-small" style={{ margin: 0, paddingLeft: 18 }}>{n.missing_for_confirmed.map(m => <li key={m}>{MISSING[m] ? t(MISSING[m]) : m}</li>)}</ul>
                : <span className="ln-small ln-muted">{t('learn.passport.everythingConfirmedNeedsPlace')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Passport() {
  const { t } = useUiLang();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renewItem, setRenewItem] = useState(null);

  const load = useCallback(() => api.get('/learner/passport').then(r => setP(r.data)).catch(e => setError(errMsg(e, t('learn.passport.couldNotLoadPassport')))), []);
  useEffect(() => { load(); }, [load]);

  const share = async (on) => { setBusy(true); try { setP((await api.post('/learner/passport/share', { public: on })).data); } catch (e) { setError(errMsg(e)); } setBusy(false); };
  const renew = async () => { setBusy(true); setError(''); try { setP((await api.post('/learner/passport/renew')).data); } catch (e) { setError(errMsg(e)); } setBusy(false); };
  const answerRenewal = async (text, provenance, clear) => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/learner/reviews/instances/${renewItem.instance_id}/answer`, { answer: text, provenance });
      if (r.data.result === 'hold') setError(t('learn.passport.answerOwnWordsPasted'));
      else { clear(); setRenewItem(null); await load(); }
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  const copy = () => { navigator.clipboard?.writeText(p.evidence_id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const link = p?.evidence_id ? `${window.location.origin}/verify/${p.evidence_id}` : '';
  const shareLink = async () => {
    const text = `My Capability Passport — check it here: ${link}`;
    if (navigator.share) { try { await navigator.share({ title: t('learn.passport.capabilityPassport'), text, url: link }); return; } catch { /* closed */ } }
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  if (!p) return <>{error ? <div className="ln-error">{error}</div> : <div className="ln-card ln-muted">{t('learn.passport.loading')}</div>}</>;

  return (
    <>
      <header className="ln-pagehead in-no-print">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{t('learn.passport.capabilityPassport')}</h1>
          <span className="ln-sub">{t('learn.passport.signedFactsAboutWhat')}</span>
        </div>
        {p.issued && <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <button type="button" className="ln-btn" onClick={shareLink}><Share2 size={16} aria-hidden="true" />{t('learn.passport.shareLink')}</button>
          <button type="button" className="ln-btn" onClick={() => window.print()} title={t('learn.passport.printsOnePageSkills')}><Printer size={16} aria-hidden="true" />{t('learn.passport.onePagePdf')}</button>
        </div>}
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}

      {!p.issued ? (
        <div className="ln-card" style={{ gap: 8 }}>
          <strong>{t('learn.passport.notIssuedYet')}</strong>
          <span>{t('learn.passport.passportIssuedWhenInstitution')}{' '} {p.eligible_skills ? t('learn.passport.alreadyHave', { n: p.eligible_skills }) : t('learn.passport.masterFirstNodeStart')}</span>
        </div>
      ) : (
        <section className="ln-card ln-card-dark" style={{ gap: 12 }}>
          <div className="ln-between ln-wrap" style={{ gap: 12 }}>
            <div className="ln-col" style={{ gap: 4 }}>
              <span className="ln-kicker" style={{ color: 'var(--accent-400)' }}>{t('learn.passport.evidenceId')}</span>
              <span className="ln-row" style={{ gap: 10 }}><b style={{ fontSize: 'var(--fs-h2)', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>{p.evidence_id}</b>
                <button type="button" className="ln-btn ln-btn-sm ln-btn-ghost-dark in-no-print" onClick={copy}><Copy size={14} aria-hidden="true" />{copied ? t('learn.passport.copied') : t('learn.passport.copy')}</button></span>
            </div>
            <div className="ln-row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span className={`ln-tag ln-tag-lg ${p.status === 'valid' ? 'ln-tag-success' : 'ln-tag-warning'}`}><ShieldCheck size={14} aria-hidden="true" />{p.status === 'valid' ? t('learn.passport.valid') : p.status}</span>
              <QrCode value={link} size={96} label={t('learn.passport.qrCodeScanCheck')} />
            </div>
          </div>
          <span className="ln-small" style={{ color: 'var(--stage-muted)' }}>{t('learn.passport.versionVersionValidFmtdate', { version: p.version, fmtDate: fmtDate(p.valid_from), fmtDate2: fmtDate(p.valid_until) })}</span>
          <label className="ln-toggle-row in-no-print" style={{ gap: 10, justifyContent: 'flex-start' }}>
            <input type="checkbox" style={{ flexShrink: 0 }} checked={!!p.public} disabled={busy} onChange={e => share(e.target.checked)} />
            <span>{t('learn.passport.letAnyoneEvidenceId')}</span>
          </label>
          <a className="ln-link in-no-print" href={`/verify/${p.evidence_id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-400)', alignSelf: 'flex-start', display: 'inline-flex', gap: 4, alignItems: 'center' }}>{t('learn.passport.openPublicCheck')}{' '} <ExternalLink size={13} aria-hidden="true" /></a>
        </section>
      )}

      <section className="ln-col" style={{ gap: 12 }}>
        <h2 className="ln-h2">{t('learn.passport.skills')}</h2>
        {p.skills.length === 0 && <div className="ln-card ln-muted">{t('learn.passport.noMasteredSkillsYet')}</div>}
        {p.skills.map(s => <SkillLine key={s.skill_id} s={s} />)}
        <p className="ln-small ln-muted">{p.note || t('learn.passport.labelsComputedFromDated')} {' '}{t('learn.passport.reviewsKeepSkillsFresh')}{' '} <Link className="ln-link" to="/learn/reviews">{t('learn.passport.seeReviewsDue')}</Link>.</p>
      </section>

      {p.issued && (
        <section className="ln-card in-no-print" style={{ gap: 12 }}>
          <div className="ln-between ln-wrap" style={{ gap: 10 }}>
            <div className="ln-col" style={{ gap: 4 }}><strong>{t('learn.passport.renewal')}</strong><span className="ln-small ln-muted">{t('learn.passport.shortTestOneQuestion')}</span></div>
            {!p.renewal && <button type="button" className="ln-btn ln-btn-outline-accent" onClick={renew} disabled={busy}><RefreshCw size={16} aria-hidden="true" />{t('learn.passport.startRenewal')}</button>}
          </div>
          {p.renewal && (
            <div className="ln-col" style={{ gap: 10 }}>
              {p.renewal.items.map(it => (
                <div key={it.instance_id} className="ln-tile ln-col" style={{ gap: 8 }}>
                  <div className="ln-between ln-wrap"><span style={{ fontWeight: 600 }}>{it.name}</span>{it.answered ? <span className="ln-tag ln-tag-success">{t('learn.passport.answered')}</span> : <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => setRenewItem(it)}>{t('learn.passport.answer')}</button>}</div>
                  {renewItem?.instance_id === it.instance_id && (<><p className="ln-indic" style={{ fontSize: 'var(--fs-h3)' }}>{it.question}</p><AnswerBox onSubmit={answerRenewal} busy={busy} /></>)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
