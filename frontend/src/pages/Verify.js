// src/pages/Verify.js — /verify and /verify/:id — the public verifier (v4.3 §10).
// Anyone can check that a Capability Passport is authentic; nobody can fish
// for data. The holder's name and contact are never shown. Three truths stay
// separate: the proof (authentic and unaltered), the evidence level L (how
// strongly each skill was assessed) and the assurance level A (how sure
// Qubirex is the learner produced the answer). Labels are computed now.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Search, UserCheck } from 'lucide-react';
import api from '../utils/api';
import PublicShell, { BackHome } from '../components/public/PublicShell';
import QrScanner from '../components/public/QrScanner';
import { useUiLang, LANG_CODE } from '../context/UiLangContext';

import { LABEL, FRESH, freshBand } from '../components/learn/evidenceText';
import { CodeTag } from '../components/shared/Popover';

// Dates in the interface language (te-IN, hi-IN, en-IN).
const useFmtDate = () => { const { lang } = useUiLang(); return (iso) => (iso ? new Date(iso).toLocaleDateString(`${LANG_CODE[lang] || 'en'}-IN`, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'); };

// The sample Passport from the Home page and the live demo (never on the server).
const DEMO_ID = 'QBX-DEMO-0000';
const DEMO = {
  status: 'valid', sample: true, evidence_id: DEMO_ID, issuer: 'did:web:qubirex.in', version: 2, valid_until: '2028-03-14T00:00:00Z', label_function: 'qep:label_v1',
  target: { title: 'Python + SQL for Data Roles', version: 2, language: 'telugu', commissionedBy: '[Institution name]' },
  skills_public: true,
  skills: [
    { skill_id: 'd1', name: 'SQL joins', nameKey: 'home.s1', label: 'Confirmed', evidence: 'L2', assurance: 'A3', freshness: 0.95, last_demonstrated: '2026-09-21', theta: 0.75 },
    { skill_id: 'd2', name: 'SQL aggregation', nameKey: 'home.s2', label: 'Confirmed', evidence: 'L2', assurance: 'A2', freshness: 0.9, last_demonstrated: '2026-09-24', theta: 0.75 },
    { skill_id: 'd3', name: 'Python functions', nameKey: 'home.s3', label: 'Partial', evidence: 'L2', assurance: 'A2', freshness: 0.55, last_demonstrated: '2026-06-26', theta: 0.7 }
  ]
};

function Limits() {
  const { t } = useUiLang();
  return (
    <section className="ln-card" style={{ gap: 8 }} aria-labelledby="limits-title">
      <h2 id="limits-title" className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('verify.limitsTitle')}</h2>
      <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
        <div className="ln-col" style={{ gap: 6 }}><span className="ln-kicker">{t('verify.can')}</span>{[1, 2, 3].map(i => <span key={i} className="ln-small"><span className="pb-yes">{t('common.yes')}</span>{t(`verify.can${i}`)}</span>)}</div>
        <div className="ln-col" style={{ gap: 6 }}><span className="ln-kicker">{t('verify.cannot')}</span>{[1, 2, 3].map(i => <span key={i} className="ln-small"><span className="pb-no">{t('common.no')}</span>{t(`verify.cannot${i}`)}</span>)}</div>
      </div>
    </section>
  );
}

function NameCheck({ id }) {
  const { t } = useUiLang();
  const [name, setName] = useState('');
  const [res, setRes] = useState(null);
  const check = async (e) => {
    e.preventDefault(); setRes(null);
    if (id === DEMO_ID) { setRes({ match: /lakshmi/i.test(name) && /rao/i.test(name) }); return; }
    try { setRes((await api.post(`/verify/${encodeURIComponent(id)}/name-check`, { name })).data); } catch (err) { setRes({ error: err.response?.data?.error?.message || t('verify.nameFailed') }); }
  };
  return (
    <section className="ln-card" style={{ gap: 8 }}>
      <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}><UserCheck size={17} aria-hidden="true" /> {t('verify.nameTitle')}</h2>
      <form className="ln-row ln-wrap" style={{ gap: 8 }} onSubmit={check}>
        <label htmlFor="vname" className="ln-sr">{t('verify.nameLabel')}</label>
        <input id="vname" className="ln-input" style={{ flex: 1, minWidth: 200 }} placeholder={t('verify.nameLabel')} value={name} onChange={e => setName(e.target.value)} />
        <button type="submit" className="ln-btn" disabled={name.trim().split(/\s+/).length < 2}>{t('verify.nameCheck')}</button>
      </form>
      {res && (res.error ? <span className="ln-small ln-error">{res.error}</span> : <span className={`ln-tag ${res.match ? 'ln-tag-success' : 'ln-tag-warning'}`} style={{ alignSelf: 'flex-start' }}>{res.match ? t('verify.match') : t('verify.noMatch')}</span>)}
      <span className="ln-xs ln-muted">{t('verify.nameNote')}</span>
    </section>
  );
}

const STATUS = ['malformed', 'not_found', 'revoked', 'expired', 'signature_invalid', 'rate_limited'];

export default function Verify() {
  const { t } = useUiLang();
  const fmtDate = useFmtDate();
  const { id } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(id || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) { setResult(null); return; }
    if (id.toUpperCase() === DEMO_ID) { setResult(DEMO); return; }
    setLoading(true);
    api.get(`/verify/${encodeURIComponent(id)}`)
      .then(r => setResult(r.data))
      .catch(e => setResult(e.response?.status === 429 ? { status: 'rate_limited' } : e.response?.data?.status ? e.response.data : { status: e.response ? 'not_found' : 'offline' }))
      .finally(() => setLoading(false));
  }, [id]);

  const submit = (e) => { e.preventDefault(); if (input.trim()) navigate(`/verify/${input.trim().toUpperCase()}`); };
  const bad = result && result.status !== 'valid';

  return (
    <PublicShell>
      <div className="ln-col" style={{ gap: 20, width: '100%' }}>
        <BackHome />
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{t('verify.title')}</h1>
          <span className="ln-sub">{t('verify.sub')}</span>
        </div>
        <form className="ln-row" style={{ gap: 10 }} onSubmit={submit}>
          <label className="ln-sr" htmlFor="eid">{t('verify.idLabel')}</label>
          <input id="eid" className="ln-input" style={{ flex: 1, minHeight: 48, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }} placeholder="QBX-XXXXXXXXXXXX" value={input} onChange={e => setInput(e.target.value)} />
          <button type="submit" className="ln-btn ln-btn-primary" style={{ minHeight: 48 }}><Search size={16} aria-hidden="true" />{t('verify.verify')}</button>
        </form>
        <div className="ln-row ln-wrap" style={{ gap: 10, alignItems: 'flex-start' }}><span className="ln-small ln-muted" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{t('verify.or')}</span><QrScanner onCode={(code) => { setInput(code); navigate(`/verify/${code}`); }} /></div>

        {loading && <div className="ln-card ln-muted" role="status">{t('verify.checking')}</div>}
        {!loading && bad && (
          <div className="ln-card" role="alert" style={{ gap: 6, borderColor: 'var(--status-danger)' }}>
            <strong className="ln-row" style={{ gap: 8 }}><ShieldAlert size={18} aria-hidden="true" />{t(`verify.st.${STATUS.includes(result.status) ? result.status : 'offline'}`)}</strong>
            <span className="ln-muted">{t(`verify.st.${STATUS.includes(result.status) ? result.status : 'offline'}.d`)}</span>
          </div>
        )}
        {!loading && result?.status === 'valid' && (
          <>
            <section className="ln-card" style={{ gap: 10 }}>
              <div className="ln-between ln-wrap" style={{ gap: 10 }}>
                <strong className="ln-row" style={{ gap: 8, fontSize: 'var(--fs-h3)' }}><ShieldCheck size={20} aria-hidden="true" color="var(--status-success)" />{t('verify.authentic')}</strong>
                <span className="ln-tag ln-tag-lg ln-tag-success">{t('verify.validUntil', { date: fmtDate(result.valid_until) })}</span>
              </div>
              <span className="ln-small ln-muted">{t('verify.authenticNote')}</span>
              <dl className="ln-grid ln-g-2" style={{ gap: 8, margin: 0 }}>
                <div><dt className="ln-xs ln-muted">{t('verify.idLabel')}</dt><dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>{result.evidence_id}</dd></div>
                <div><dt className="ln-xs ln-muted">{t('verify.programme')}</dt><dd style={{ margin: 0 }}>{result.sample ? t('home.sampleProgramme') : result.target?.title} (v{result.target?.version}) · {t(`lang.${result.target?.language}`)}</dd></div>
                <div><dt className="ln-xs ln-muted">{t('verify.commissioned')}</dt><dd style={{ margin: 0 }}>{result.target?.commissionedBy}</dd></div>
                <div><dt className="ln-xs ln-muted">{t('verify.issuer')}</dt><dd style={{ margin: 0 }}>{result.issuer} · v{result.version}</dd></div>
              </dl>
            </section>
            <section className="ln-col" style={{ gap: 10 }}>
              <h2 className="ln-h2">{t('verify.skills')}</h2>
              {!result.skills_public ? <div className="ln-card ln-muted">{t('verify.private')}</div> : result.skills.map(s => (
                <div key={s.skill_id} className="ln-card" style={{ gap: 8 }}>
                  <div className="ln-between ln-wrap" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{s.nameKey ? t(s.nameKey) : s.name}</span>
                    <span className={`ln-tag ln-tag-lg ${(LABEL[s.label] || LABEL.none).cls}`}>{t(`label.${(s.label || 'none').toLowerCase()}`)}</span>
                  </div>
                  <div className="ln-row ln-wrap ln-small" style={{ gap: 8 }}>
                    {s.evidence && <CodeTag code={s.evidence} label={t(`level.${s.evidence}`)} />}
                    {s.assurance && <CodeTag code={s.assurance} label={t(`assure.${s.assurance}`)} />}
                    <span className={`ln-tag ${FRESH[freshBand(s.freshness || 0)][1]}`}>{t(FRESH[freshBand(s.freshness || 0)][0])}</span><span className="ln-muted">{t('verify.skillLine', { date: fmtDate(s.last_demonstrated) })}</span>
                  </div>
                </div>
              ))}
              {result.sample && <div className="ln-note">{t('verify.sampleNote')}</div>}
              <p className="ln-xs ln-muted">{t('verify.labelsNote', { fn: result.label_function })}</p>
            </section>
            <NameCheck id={result.evidence_id} />
          </>
        )}
        <Limits />
        <nav className="ln-row ln-wrap ln-xs" style={{ gap: 14 }} aria-label={t('verify.dev')}>
          <span className="ln-muted">{t('page.verify.didWebQubirexT', { t: t('verify.statusLists') })}</span>
          <a className="ln-link" href="/api/verify/jwks.json" target="_blank" rel="noopener">{t('verify.keys')}</a>
          <Link className="ln-link" to="/employer/verify-bulk">{t('verify.bulk')}</Link>
        </nav>
      </div>
    </PublicShell>
  );
}
