// src/pages/inst/Review.js — /institution/review — faculty review (v4.3 §7.8).
// Queue: blind review — the question, the student's answer and the rubric;
// never the AI score, and the student is named only after you submit.
// Calibration: weighted κ per node between faculty and the evaluator on the
// random calibration sample (n ≥ 20, lower ≥ 0.50, point ≥ 0.60 → calibrated).
// Load: minutes per week forecast against the contracted review time.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useStaff } from '../../components/inst/InstitutionLayout';

const BAND_TEXT = { '0.0-0.49': 'Weak (0–0.49)', '0.5-0.69': 'Partial (0.5–0.69)', '0.7-0.89': 'Good (0.7–0.89)', '0.9-1.0': 'Excellent (0.9–1.0)' };
const CAL = { calibrated: ['Calibrated', 'ln-tag-success'], rubric_under_review: ['Rubric under review', 'ln-tag-warning'], sampling: ['Sampling', 'ln-tag-neutral'] };

function ReviewCard({ item, onDone, canDecide }) {
  const [verdict, setVerdict] = useState('');
  const [band, setBand] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(Date.now());
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/institution/review-queue/${item.id}/verdict`, { verdict, band, notes, seconds_spent: Math.round((Date.now() - started.current) / 1000) });
      onDone(r.data);
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  return (
    <article className="ln-card" style={{ gap: 12 }}>
      <div className="ln-between ln-wrap"><span className="ln-kicker">{item.cluster} · {item.node}</span><span className="ln-xs ln-muted">{item.purpose} · {new Date(item.created_at).toLocaleDateString()}</span></div>
      <div className="ln-col" style={{ gap: 4 }}><span className="ln-xs ln-muted">Question</span><p style={{ margin: 0, lineHeight: 1.6 }}>{item.question || '—'}</p></div>
      <div className="ln-col" style={{ gap: 4 }}><span className="ln-xs ln-muted">Student answer (student hidden until you submit)</span>
        <blockquote style={{ margin: 0, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.answer || '—'}</blockquote></div>
      <details><summary className="ln-small" style={{ cursor: 'pointer' }}>Rubric</summary>
        <div className="ln-grid ln-g-2" style={{ gap: 10, marginTop: 8 }}>
          <div><b className="ln-small">Passing criteria</b><ul className="ln-small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{item.rubric.passing.map(c => <li key={c}>{c}</li>)}</ul></div>
          <div><b className="ln-small">Failing indicators</b><ul className="ln-small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{item.rubric.failing.map(c => <li key={c}>{c}</li>)}</ul></div>
        </div>
      </details>
      {canDecide ? (
        <div className="ln-col" style={{ gap: 10 }}>
          <div className="ln-row ln-wrap" style={{ gap: 8 }} role="group" aria-label="Verdict">
            <button type="button" className={`ln-btn ${verdict === 'pass' ? 'ln-btn-primary' : ''}`} aria-pressed={verdict === 'pass'} onClick={() => setVerdict('pass')}><CheckCircle2 size={16} aria-hidden="true" />Pass</button>
            <button type="button" className={`ln-btn ${verdict === 'fail' ? 'ln-btn-primary' : ''}`} aria-pressed={verdict === 'fail'} onClick={() => setVerdict('fail')}><XCircle size={16} aria-hidden="true" />Not yet</button>
          </div>
          <div className="ln-row ln-wrap" style={{ gap: 6 }} role="group" aria-label="Band">
            {item.bands.map(b => <button key={b} type="button" className={`ln-chip ${band === b ? 'ln-tag-accent' : ''}`} aria-pressed={band === b} onClick={() => setBand(b)}>{BAND_TEXT[b]}</button>)}
          </div>
          <textarea className="ln-textarea" rows={2} placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          {error && <div className="ln-error">{error}</div>}
          <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!verdict || !band || busy} onClick={submit}>{busy ? 'Saving…' : 'Submit review'}</button>
        </div>
      ) : <span className="ln-small ln-muted">Viewers can read the queue; professors and admins decide.</span>}
    </article>
  );
}

export default function Review() {
  const { role } = useStaff();
  const [tab, setTab] = useState('queue');
  const [cohorts, setCohorts] = useState([]);
  const [cohortId, setCohortId] = useState('');
  const [queue, setQueue] = useState(null);
  const [cal, setCal] = useState(null);
  const [load, setLoad] = useState(null);
  const [done, setDone] = useState([]);
  const [contract, setContract] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.get('/institution/engagements').then(r => { setCohorts(r.data); if (r.data[0]) setCohortId(r.data[0].id); }).catch(e => setError(errMsg(e))); }, []);
  const refresh = useCallback(() => {
    if (!cohortId) return;
    api.get(`/institution/review-queue?engagement_id=${cohortId}`).then(r => setQueue(r.data)).catch(e => setError(errMsg(e)));
    api.get(`/institution/calibration?engagement_id=${cohortId}`).then(r => setCal(r.data)).catch(() => {});
    api.get(`/institution/review-load?engagement_id=${cohortId}`).then(r => setLoad(r.data)).catch(() => {});
  }, [cohortId]);
  useEffect(() => { refresh(); }, [refresh]);

  const saveContract = async () => {
    try { await api.put('/institution/review-contract', { review_minutes_per_100: Number(contract) }); setContract(''); refresh(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title">Faculty review</h1>
          <span className="ln-sub">Blind review of checks the evaluator was unsure about, plus a random sample that tells you how far to trust it.</span>
        </div>
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>Cohort</span>
          <select value={cohortId} onChange={e => setCohortId(e.target.value)}>{cohorts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <div className="ln-pilltabs" role="tablist">
          {[['queue', `Queue${queue ? ` · ${queue.items.length}` : ''}`], ['calibration', 'Calibration'], ['load', 'Review load']].map(([id, label]) => (
            <button key={id} type="button" role="tab" className="ln-pilltab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'queue' && (
        <section className="ln-col" style={{ gap: 14 }}>
          {queue?.cap_reached && <div className="ln-note">This week’s contracted review time is used up. Only priority items (persistence, authenticity, weak viva, borderline) are shown; the random sample waits.</div>}
          {done.map(d => (
            <div key={d.item.id} className="ln-card ln-card-sm" role="status" style={{ gap: 4 }}>
              <span><b>Saved.</b> {d.item.node} — {d.item.learner ? `${d.item.learner.name} (${d.item.learner.learner_ref})` : ''}</span>
              <span className="ln-small ln-muted">{d.outcome.recheck ? 'You disagreed with a pass: the student will get a fresh question on this skill.' : d.outcome.lifted ? 'Agreed on a calibrated node: the evidence is now faculty-confirmed (L3).' : d.outcome.provisionalCleared ? 'Agreed: the provisional pass is now final.' : 'Recorded.'}</span>
            </div>
          ))}
          {queue && queue.items.length === 0 && <div className="ln-card ln-muted">Nothing to review for this cohort right now.</div>}
          {(queue?.items || []).map(item => (
            <ReviewCard key={item.id} item={item} canDecide={role !== 'viewer'} onDone={(r) => { setDone(d => [r, ...d].slice(0, 5)); refresh(); }} />
          ))}
          <span className="ln-xs ln-muted">About {queue?.minutes_per_review || 2} minutes per review. Every reviewed answer can become a gold example for this node (with the student’s consent).</span>
        </section>
      )}

      {tab === 'calibration' && cal && (
        <section className="ln-card" style={{ gap: 12 }}>
          <span className="ln-small ln-muted">Agreement between faculty bands and the evaluator on the random calibration sample only (decision reviews are never used). Rule: n ≥ {cal.rule.min_n}, lower bound ≥ {cal.rule.min_lower} and κ ≥ {cal.rule.min_point} → calibrated; faculty-agreed passes on calibrated nodes become L3 evidence.</span>
          <div className="ln-tablewrap"><table className="ln-table">
            <thead><tr><th>Node</th><th>Reviews</th><th>Weighted κ</th><th>90% interval</th><th>Status</th></tr></thead>
            <tbody>{cal.nodes.map(n => (
              <tr key={n.node_id}><td>{n.node}<span className="ln-xs ln-muted" style={{ display: 'block' }}>{n.cluster}</span></td><td>{n.n}</td>
                <td>{n.kappa == null ? '—' : n.kappa.toFixed(2)}</td><td>{n.lower == null ? '—' : `${n.lower.toFixed(2)} – ${n.upper.toFixed(2)}`}</td>
                <td><span className={`ln-tag ${CAL[n.status][1]}`}>{CAL[n.status][0]}</span></td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {tab === 'load' && load && (
        <section className="ln-grid ln-g-2" style={{ gap: 16 }}>
          <div className="ln-card" style={{ gap: 10 }}>
            <span className="ln-kicker">Forecast</span>
            <span className="ln-stat">{load.forecast_minutes_per_week} min / week</span>
            <span className="ln-small ln-muted">{load.learners} students × {load.nodes} nodes over {load.weeks} weeks ≈ {load.expected_checks_per_week} checks a week; {Math.round(load.decision_rate * 100)}% need a decision review ({load.decision_rate_source === 'prior' ? 'starting estimate' : 'measured'}), plus the calibration sample.</span>
            <span className="ln-small">Contracted: <b>{load.contracted_minutes_per_week == null ? 'not set' : `${load.contracted_minutes_per_week} min / week`}</b> · used this week: {load.minutes_used_this_week} min · open items: {load.open_items}</span>
            <div className={load.over_contract ? 'ln-error' : 'ln-note'}>{load.advice}</div>
          </div>
          {role === 'admin' && (
            <div className="ln-card" style={{ gap: 10 }}>
              <span className="ln-kicker">Contracted review time</span>
              <span className="ln-small ln-muted">Minutes of faculty review per 100 students per week, as agreed in the engagement contract.</span>
              <div className="ln-row" style={{ gap: 8 }}>
                <input className="ln-input" type="number" min="0" placeholder={load.contracted_minutes_per_100 != null ? `Now ${load.contracted_minutes_per_100}` : 'e.g. 120'} value={contract} onChange={e => setContract(e.target.value)} aria-label="Minutes per 100 students per week" />
                <button type="button" className="ln-btn ln-btn-primary" disabled={contract === ''} onClick={saveContract}>Save</button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
