// src/pages/learn/Passport.js — /learn/passport
// The Capability Passport (v4.3 §9). It signs facts, never labels: the labels
// here are computed today from dated demonstrations and change as skills are
// shown again or go stale. The label, evidence level (L) and assurance level
// (A) are separate truths and are shown separately. Journey metrics (loops,
// time, attempts) are never part of it.
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Printer, ShieldCheck, RefreshCw, ExternalLink, Share2, Image as ImageIcon, LayoutGrid, List, PartyPopper } from 'lucide-react';
import QrCode from '../../components/shared/QrCode';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { Tooltip, Switch, Select, useToast } from '../../components/shared/ui';
import { useAuth } from '../../context/AuthContext';
import { downloadShareCard } from '../../utils/shareCard';
import AnswerBox from '../../components/learn/AnswerBox';
import { LABEL, LEVEL, ASSURANCE, MISSING, FRESH, freshBand, fmtDate } from '../../components/learn/evidenceText';

import { useUiLang } from '../../context/UiLangContext';
import { CodeTag } from '../../components/shared/Popover';
import { LoadingRows } from '../../components/shared/EmptyState';
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

// Filters and sorting for the skill list.
const FILTERS = [['all', 'learn.passport.f.all'], ['Confirmed', 'label.confirmed'], ['Partial', 'label.partial'], ['none', 'label.none']];
const labelOf = (s) => (s.label === 'Confirmed' || s.label === 'Partial' ? s.label : 'none');
const SORTS = {
  label: (a, b) => ['Confirmed', 'Partial', 'none'].indexOf(labelOf(a)) - ['Confirmed', 'Partial', 'none'].indexOf(labelOf(b)) || a.name.localeCompare(b.name),
  fresh: (a, b) => (b.freshness || 0) - (a.freshness || 0),
  recent: (a, b) => String(b.last_demonstrated || '').localeCompare(String(a.last_demonstrated || '')),
  name: (a, b) => a.name.localeCompare(b.name)
};
const SEEN_KEY = 'qubirex_seen_confirmed';

function SkillCell({ s }) {
  const { t } = useUiLang();
  const lab = LABEL[s.label] || LABEL.none;
  const fb = FRESH[freshBand(s.freshness || 0)];
  return (
    <div className="pp-cell">
      <span style={{ fontWeight: 600 }}>{s.name}</span>
      <span className="ln-row ln-wrap" style={{ gap: 6 }}>
        <span className={`ln-tag ${lab.cls}`}>{t(lab.text)}</span>
        <Tooltip text={t('learn.passport.freshnessRound', { round: Math.round((s.freshness || 0) * 100) })}><span className={`ln-tag ${fb[1]}`} tabIndex={0}>{t(fb[0])}</span></Tooltip>
      </span>
      <span className="ln-xs ln-muted">{t('learn.passport.lastShown', { date: fmtDate(s.last_demonstrated) })}</span>
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
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('label');
  const [view, setView] = useState(() => { try { return localStorage.getItem('qubirex_passport_view') || 'list'; } catch { return 'list'; } });
  const [celebrate, setCelebrate] = useState([]);
  const toast = useToast();
  const { user } = useAuth();
  useEffect(() => { try { localStorage.setItem('qubirex_passport_view', view); } catch { /* storage blocked */ } }, [view]);
  // Celebrate skills that reached Confirmed since this device last looked.
  useEffect(() => {
    if (!p?.skills) return;
    const now = p.skills.filter(s => s.label === 'Confirmed').map(s => s.skill_id);
    let seen = null;
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); } catch { /* storage blocked */ }
    if (Array.isArray(seen)) setCelebrate(p.skills.filter(s => s.label === 'Confirmed' && !seen.includes(s.skill_id)).map(s => s.name));
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(now)); } catch { /* storage blocked */ }
  }, [p]);

  const load = useCallback(() => api.get('/learner/passport').then(r => setP(r.data)).catch(e => setError(errMsg(e, t('learn.passport.couldNotLoadPassport')))), []);
  useEffect(() => { load(); }, [load]);

  const share = async (on) => { setBusy(true); try { setP((await api.post('/learner/passport/share', { public: on })).data); toast.success(on ? t('learn.passport.toastPublic') : t('learn.passport.toastPrivate')); } catch (e) { setError(errMsg(e)); } setBusy(false); };
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
    const text = t('learn.passport.shareText', { link });
    if (navigator.share) { try { await navigator.share({ title: t('learn.passport.capabilityPassport'), text, url: link }); return; } catch { /* closed */ } }
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); toast.success(t('learn.passport.linkCopied')); setTimeout(() => setCopied(false), 1500); });
  };
  const shareCard = async () => {
    const conf = p.skills.filter(s => s.label === 'Confirmed');
    try {
      await downloadShareCard({ title: t('learn.passport.capabilityPassport'), name: user?.name, evidenceId: p.evidence_id,
        confirmedLabel: t('label.confirmed'), partialLabel: t('label.partial'), confirmed: conf.length, partial: p.skills.filter(s => s.label === 'Partial').length,
        skills: conf.map(s => s.name), verifyLine: t('learn.passport.cardVerify', { url: `${window.location.host}/verify` }), tagline: 'Qubirex' });
      toast.success(t('learn.passport.cardSaved'));
    } catch { toast.error(t('learn.passport.cardFailed')); }
  };

  if (!p) return <>{error ? <div className="ln-error">{error}</div> : <LoadingRows rows={5} />}</>;

  return (
    <>
      <header className="ln-pagehead in-no-print">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">{t('learn.passport.capabilityPassport')}</h1>
          <span className="ln-sub">{t('learn.passport.signedFactsAboutWhat')}</span>
        </div>
        {p.issued && <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <button type="button" className="ln-btn" onClick={shareLink}><Share2 size={16} aria-hidden="true" />{t('learn.passport.shareLink')}</button>
          <button type="button" className="ln-btn" onClick={shareCard}><ImageIcon size={16} aria-hidden="true" />{t('learn.passport.shareCard')}</button>
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
          <Switch className="in-no-print" checked={!!p.public} disabled={busy} onChange={share}>{t('learn.passport.letAnyoneEvidenceId')}</Switch>
          <a className="ln-link in-no-print" href={`/verify/${p.evidence_id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-400)', alignSelf: 'flex-start', display: 'inline-flex', gap: 4, alignItems: 'center' }}>{t('learn.passport.openPublicCheck')}{' '} <ExternalLink size={13} aria-hidden="true" /></a>
        </section>
      )}

      <section className="ln-col" style={{ gap: 12 }}>
        {celebrate.length > 0 && (
          <div className="pp-celebrate" role="status">
            <PartyPopper size={26} aria-hidden="true" style={{ color: 'var(--ok)', flexShrink: 0 }} />
            <span className="ln-col" style={{ gap: 2 }}><b>{t('learn.passport.celebrateTitle')}</b><span className="ln-small">{t('learn.passport.celebrateText', { list: celebrate.join(', ') })}</span></span>
            <button type="button" className="ln-link" style={{ marginLeft: 'auto' }} onClick={() => setCelebrate([])}>{t('common.close')}</button>
          </div>
        )}
        <div className="ln-between ln-wrap" style={{ gap: 10 }}>
          <h2 className="ln-h2">{t('learn.passport.skills')}</h2>
          {p.skills.length > 0 && (
            <div className="ln-row ln-wrap in-no-print" style={{ gap: 8 }}>
              <Select aria-label={t('learn.passport.sortBy')} value={sort} onChange={e => setSort(e.target.value)} options={[['label', t('learn.passport.sort.label')], ['fresh', t('learn.passport.sort.fresh')], ['recent', t('learn.passport.sort.recent')], ['name', t('learn.passport.sort.name')]].map(([value, label]) => ({ value, label }))} />
              <div className="ui-chips" role="group" aria-label={t('learn.passport.layout')}>
                <button type="button" className="ui-chip" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={14} aria-hidden="true" />{t('learn.passport.viewList')}</button>
                <button type="button" className="ui-chip" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={14} aria-hidden="true" />{t('learn.passport.viewGrid')}</button>
              </div>
            </div>
          )}
        </div>
        {p.skills.length > 0 && (
          <div className="ui-chips in-no-print" role="group" aria-label={t('learn.passport.filterBy')}>
            {FILTERS.map(([id, key]) => {
              const n = id === 'all' ? p.skills.length : p.skills.filter(s => labelOf(s) === id).length;
              return <button key={id} type="button" className="ui-chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>{t(key)} <span aria-hidden="true">·</span> {n}</button>;
            })}
          </div>
        )}
        {p.skills.length === 0 && <div className="ln-card ln-muted">{t('learn.passport.noMasteredSkillsYet')}</div>}
        {(() => {
          const list = p.skills.filter(s => filter === 'all' || labelOf(s) === filter).sort(SORTS[sort]);
          if (p.skills.length && !list.length) return <div className="ln-card ln-muted">{t('learn.passport.noneInFilter')}</div>;
          return view === 'grid'
            ? <div className="pp-grid">{list.map(s => <SkillCell key={s.skill_id} s={s} />)}</div>
            : list.map(s => <SkillLine key={s.skill_id} s={s} />);
        })()}
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
