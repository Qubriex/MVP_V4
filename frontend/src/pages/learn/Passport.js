// src/pages/learn/Passport.js — /learn/passport
// The Capability Passport (v4.3 §9). It signs facts, never labels: the labels
// here are computed today from dated demonstrations and change as skills are
// shown again or go stale. The label, evidence level (L) and assurance level
// (A) are separate truths and are shown separately. Journey metrics (loops,
// time, attempts) are never part of it.
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Printer, ShieldCheck, RefreshCw, ExternalLink } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { Bar } from '../../components/learn/ui';
import AnswerBox from '../../components/learn/AnswerBox';
import { LABEL, LEVEL, ASSURANCE, MISSING, fmtDate } from '../../components/learn/evidenceText';

function SkillLine({ s }) {
  const [open, setOpen] = useState(false);
  const lab = LABEL[s.label] || LABEL.none;
  return (
    <div className="ln-card" style={{ gap: 10 }}>
      <div className="ln-between ln-wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div className="ln-col" style={{ gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{s.name}</span>
          <div className="ln-row ln-wrap" style={{ gap: 6 }}>
            <span className={`ln-tag ln-tag-lg ${lab.cls}`}>{lab.text}</span>
            {s.evidence && <span className="ln-tag ln-tag-neutral" title="How strongly the skill was assessed">{LEVEL[s.evidence]}</span>}
            {s.assurance && <span className="ln-tag ln-tag-neutral" title="How sure Qubirex is that the answer was yours">{ASSURANCE[s.assurance]}</span>}
          </div>
        </div>
        <div className="ln-col" style={{ gap: 4, minWidth: 180 }}>
          <span className="ln-xs ln-muted">Freshness {Math.round((s.freshness || 0) * 100)}% · last shown {fmtDate(s.last_demonstrated)}</span>
          <Bar pct={(s.freshness || 0) * 100} variant={s.freshness >= 0.85 ? 'ln-bar-good' : ''} label={`Freshness ${Math.round((s.freshness || 0) * 100)}%`} />
        </div>
      </div>
      <button type="button" className="ln-link" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide details' : s.label === 'Confirmed' ? 'Details' : 'How to reach Confirmed'}</button>
      {open && (
        <div className="ln-col" style={{ gap: 10 }}>
          {s.nodes.map(n => (
            <div key={n.node_id} className="ln-tile ln-col" style={{ gap: 6 }}>
              <div className="ln-between ln-wrap"><span style={{ fontWeight: 600 }}>{n.node}</span><span className={`ln-tag ${(LABEL[n.label] || LABEL.none).cls}`}>{(LABEL[n.label] || LABEL.none).text}</span></div>
              {n.missing_for_confirmed?.length > 0
                ? <ul className="ln-small" style={{ margin: 0, paddingLeft: 18 }}>{n.missing_for_confirmed.map(m => <li key={m}>{MISSING[m] || m}</li>)}</ul>
                : <span className="ln-small ln-muted">Everything Confirmed needs is in place.</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Passport() {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renewItem, setRenewItem] = useState(null);

  const load = useCallback(() => api.get('/learner/passport').then(r => setP(r.data)).catch(e => setError(errMsg(e, 'Could not load your passport.'))), []);
  useEffect(() => { load(); }, [load]);

  const share = async (on) => { setBusy(true); try { setP((await api.post('/learner/passport/share', { public: on })).data); } catch (e) { setError(errMsg(e)); } setBusy(false); };
  const renew = async () => { setBusy(true); setError(''); try { setP((await api.post('/learner/passport/renew')).data); } catch (e) { setError(errMsg(e)); } setBusy(false); };
  const answerRenewal = async (text, provenance, clear) => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/learner/reviews/instances/${renewItem.instance_id}/answer`, { answer: text, provenance });
      if (r.data.result === 'hold') setError('Answer in your own words — pasted text is not counted.');
      else { clear(); setRenewItem(null); await load(); }
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  const copy = () => { navigator.clipboard?.writeText(p.evidence_id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  if (!p) return <>{error ? <div className="ln-error">{error}</div> : <div className="ln-card ln-muted">Loading…</div>}</>;

  return (
    <>
      <header className="ln-pagehead in-no-print">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">Capability Passport</h1>
          <span className="ln-sub">Signed facts about what you have shown. Labels are worked out today from those facts.</span>
        </div>
        {p.issued && <button type="button" className="ln-btn" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print</button>}
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}

      {!p.issued ? (
        <div className="ln-card" style={{ gap: 8 }}>
          <strong>Not issued yet</strong>
          <span>Your passport is issued when your institution produces your Mastery Log. {p.eligible_skills ? `You already have ${p.eligible_skills} skill${p.eligible_skills === 1 ? '' : 's'} that will appear on it.` : 'Master your first node to start it.'}</span>
        </div>
      ) : (
        <section className="ln-card ln-card-dark" style={{ gap: 12 }}>
          <div className="ln-between ln-wrap" style={{ gap: 12 }}>
            <div className="ln-col" style={{ gap: 4 }}>
              <span className="ln-kicker" style={{ color: 'var(--accent-400)' }}>Evidence ID</span>
              <span className="ln-row" style={{ gap: 10 }}><b style={{ fontSize: 22, letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>{p.evidence_id}</b>
                <button type="button" className="ln-btn ln-btn-sm ln-btn-ghost-dark in-no-print" onClick={copy}><Copy size={14} aria-hidden="true" />{copied ? 'Copied' : 'Copy'}</button></span>
            </div>
            <span className={`ln-tag ln-tag-lg ${p.status === 'valid' ? 'ln-tag-success' : 'ln-tag-warning'}`}><ShieldCheck size={14} aria-hidden="true" />{p.status === 'valid' ? 'Valid' : p.status}</span>
          </div>
          <span className="ln-small" style={{ color: 'var(--stage-muted)' }}>Version {p.version} · valid {fmtDate(p.valid_from)} – {fmtDate(p.valid_until)}</span>
          <label className="ln-toggle-row in-no-print" style={{ gap: 10 }}>
            <input type="checkbox" checked={!!p.public} disabled={busy} onChange={e => share(e.target.checked)} />
            <span>Let anyone with this Evidence ID see my skill details. Off: they only see that the passport is authentic.</span>
          </label>
          <a className="ln-link in-no-print" href={`/verify/${p.evidence_id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-400)' }}>Open the public check <ExternalLink size={13} aria-hidden="true" /></a>
        </section>
      )}

      <section className="ln-col" style={{ gap: 12 }}>
        <h2 className="ln-h2">Skills</h2>
        {p.skills.length === 0 && <div className="ln-card ln-muted">No mastered skills yet.</div>}
        {p.skills.map(s => <SkillLine key={s.skill_id} s={s} />)}
        <p className="ln-small ln-muted">{p.note || 'Labels are computed from dated demonstrations.'} Reviews keep skills fresh — <Link className="ln-link" to="/learn/reviews">see reviews due</Link>.</p>
      </section>

      {p.issued && (
        <section className="ln-card in-no-print" style={{ gap: 12 }}>
          <div className="ln-between ln-wrap" style={{ gap: 10 }}>
            <div className="ln-col" style={{ gap: 4 }}><strong>Renewal</strong><span className="ln-small ln-muted">A short test — one question per skill — renews your passport for another 18 months. Two tries per skill, then a 7-day wait.</span></div>
            {!p.renewal && <button type="button" className="ln-btn ln-btn-outline-accent" onClick={renew} disabled={busy}><RefreshCw size={16} aria-hidden="true" />Start renewal</button>}
          </div>
          {p.renewal && (
            <div className="ln-col" style={{ gap: 10 }}>
              {p.renewal.items.map(it => (
                <div key={it.instance_id} className="ln-tile ln-col" style={{ gap: 8 }}>
                  <div className="ln-between ln-wrap"><span style={{ fontWeight: 600 }}>{it.name}</span>{it.answered ? <span className="ln-tag ln-tag-success">Answered</span> : <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => setRenewItem(it)}>Answer</button>}</div>
                  {renewItem?.instance_id === it.instance_id && (<><p className="ln-indic" style={{ fontSize: 16 }}>{it.question}</p><AnswerBox onSubmit={answerRenewal} busy={busy} /></>)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
