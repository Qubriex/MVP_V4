// src/components/inst/CommandCentre.js — the top of the institution Home
// (v4.3 canvas I1): command box, setup checklist, action cards with "Why
// this?", the MoU scoreboard, readiness bands, board report and AI time.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, FileText, Pencil, Clock } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { Bar } from '../learn/ui';
import CommandBox from '../shared/CommandBox';
import { WhyThis, HowCounted } from '../shared/Popover';
import { SmallSample, TooFew } from '../shared/SampleSize';

const TONE = { quiet: 'ln-tag-warning', stuck: 'ln-tag-accent', nearly: 'ln-tag-info', reviews: 'ln-tag-info', requests: 'ln-tag-success' };

function TargetForm({ sb, onDone }) {
  const [pct, setPct] = useState(sb.target_pct ?? 70);
  const [label, setLabel] = useState(sb.label || 'Students placed');
  const [date, setDate] = useState(sb.due || '');
  const [msg, setMsg] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/institution/settings/mou-target', { pct, label, date }); onDone(); } catch (err) { setMsg(errMsg(err, 'Couldn’t save the target.')); }
  };
  return (
    <form className="ln-col" style={{ gap: 10 }} onSubmit={save}>
      <div className="ln-grid ln-g-3" style={{ gap: 10 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="mou-pct">Target %</label><input id="mou-pct" type="number" min="1" max="100" className="ln-input" value={pct} onChange={e => setPct(e.target.value)} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="mou-label">What counts</label><input id="mou-label" className="ln-input" value={label} onChange={e => setLabel(e.target.value)} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="mou-date">By</label><input id="mou-date" type="date" className="ln-input" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      {msg && <span className="ln-small ln-error" role="alert">{msg}</span>}
      <div className="ln-row" style={{ gap: 8 }}><button type="submit" className="ln-btn ln-btn-primary ln-btn-sm">Save target</button><button type="button" className="ln-btn ln-btn-sm" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

export default function CommandCentre({ role }) {
  const { data, reload } = useCachedGet('/institution/command-centre');
  const [editing, setEditing] = useState(false);
  if (!data) return <CommandBox side="staff" />;
  const { cards, scoreboard: sb, setup, ai_time: ai, readiness: rd } = data;
  const setupLeft = setup.filter(s => !s.done).length;
  const done = () => { setEditing(false); dropCached('/institution/command-centre'); reload(); };

  return (
    <>
      <CommandBox side="staff" placeholder="Ask about your students — for example, who is nearly ready in CSE-A?" />

      {setupLeft > 0 && (
        <section className="ln-card ln-card-warm" style={{ gap: 10 }} aria-label="Setup checklist">
          <div className="ln-between"><h2 className="ln-h2">Getting started</h2><span className="ln-small ln-muted">{setup.length - setupLeft} of {setup.length} done</span></div>
          {setup.map(s => (
            <div key={s.key} className="ln-row" style={{ gap: 10 }}>
              {s.done ? <CheckCircle2 size={18} style={{ color: "var(--status-success)" }} aria-label="Done" /> : <Circle size={18} aria-label="Not done" />}
              {s.done ? <span className="ln-small ln-muted" style={{ textDecoration: 'line-through' }}>{s.label}</span> : <Link to={s.href} className="ln-link ln-small">{s.label} →</Link>}
            </div>
          ))}
        </section>
      )}

      {cards.length > 0 && (
        <section className="ln-col" style={{ gap: 12 }}>
          <h2 className="ln-h2">Do this next</h2>
          <div className="ln-grid ln-g-3" style={{ gap: 14 }}>
            {cards.map(c => (
              <div key={c.kind} className="ln-card" style={{ padding: 18, borderRadius: 'var(--radius-lg)', gap: 8 }}>
                <div className="ln-row" style={{ gap: 10 }}><span className={`ln-tag ${TONE[c.kind] || 'ln-tag-info'}`}>{c.count}</span><span style={{ fontSize: 15, fontWeight: 600 }}>{c.title}</span></div>
                <span className="ln-small">{c.body}</span>
                <div className="ln-between ln-wrap" style={{ gap: 8 }}>
                  <Link to={c.href} className="ln-link" style={{ fontSize: 13 }}>{c.cta} →</Link>
                  <WhyThis title="Why this?">{c.why}</WhyThis>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="ln-grid ln-g-3" style={{ gap: 16 }}>
        <section className="ln-card" style={{ gap: 10 }} aria-label="Placement target">
          <div className="ln-between"><span className="ln-kicker">MoU scoreboard</span>
            {role === 'admin' && !editing && <button type="button" className="ln-btn ln-btn-sm" onClick={() => setEditing(true)}><Pencil size={13} aria-hidden="true" />{sb.target_pct ? 'Edit' : 'Set target'}</button>}</div>
          {editing ? <TargetForm sb={sb} onDone={done} /> : (
            <>
              <div className="ln-row" style={{ gap: 8, alignItems: 'baseline' }}><span className="ln-stat">{sb.placed_pct}%</span><span className="ln-small ln-muted">{sb.label.toLowerCase()}{sb.target_pct ? ` · target ${sb.target_pct}%` : ''}</span></div>
              <Bar pct={sb.target_pct ? Math.min(100, (sb.placed_pct / sb.target_pct) * 100) : sb.placed_pct} variant="ln-bar-good" label={`${sb.placed_pct}% of target`} />
              <span className="ln-xs ln-muted">{sb.placed} placed · {sb.ready} ready now · {sb.total} students{sb.due ? ` · due ${new Date(sb.due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
              <HowCounted>Placed = students with a recorded placement on the Placements page, divided by students in your cohorts. Ready = readiness 80 or more on verified skills.</HowCounted>
            </>
          )}
        </section>

        <section className="ln-card" style={{ gap: 10 }} aria-label="Readiness">
          <div className="ln-between"><span className="ln-kicker">Readiness</span><SmallSample n={rd.total} /></div>
          <TooFew n={rd.total}>
            {[['Ready', rd.ready, 'ln-bar-good'], ['Nearly ready', rd.nearly, ''], ['Building', rd.building, '']].map(([label, n, v]) => (
              <div key={label} className="ln-row" style={{ gap: 10 }}>
                <span className="ln-small" style={{ width: 96 }}>{label}</span>
                <div style={{ flex: 1 }}><Bar pct={rd.total ? (n / rd.total) * 100 : 0} variant={v} label={`${label}: ${n}`} /></div>
                <b style={{ width: 28, textAlign: 'right' }}>{n}</b>
              </div>
            ))}
          </TooFew>
          <HowCounted>Readiness is the match between a student’s verified skills and the best-fitting job role, from 0 to 100. Ready is 80 or more, Nearly ready 60–79, Building under 60.</HowCounted>
        </section>

        <section className="ln-card" style={{ gap: 10 }} aria-label="Reports and AI time">
          <span className="ln-kicker">Board report</span>
          <span className="ln-small">One page for your board or principal: cohorts, readiness, placements.</span>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <Link to="/institution/board-report?lang=en" className="ln-btn ln-btn-sm"><FileText size={14} aria-hidden="true" />English</Link>
            <Link to="/institution/board-report?lang=te" className="ln-btn ln-btn-sm ln-indic"><FileText size={14} aria-hidden="true" />తెలుగు</Link>
          </div>
          <div className="ln-row" style={{ gap: 8, marginTop: 6 }}><Clock size={15} aria-hidden="true" /><span className="ln-small"><b>{ai.minutes} min</b> of AI time this month · {ai.calls} calls{ai.voice_clips ? ` · ${ai.voice_clips} voice clips` : ''}</span></div>
          <HowCounted>Time the AI spent teaching, checking and answering for your students since the 1st of this month.</HowCounted>
        </section>
      </div>
    </>
  );
}
