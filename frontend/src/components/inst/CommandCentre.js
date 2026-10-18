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
import { BandBar } from '../shared/ui';
import BandDrawer from './BandDrawer';

import { useUiLang } from '../../context/UiLangContext';
const TONE = { quiet: 'ln-tag-warning', stuck: 'ln-tag-accent', nearly: 'ln-tag-info', reviews: 'ln-tag-info', requests: 'ln-tag-success' };

function TargetForm({ sb, onDone }) {
  const { t } = useUiLang();
  const [pct, setPct] = useState(sb.target_pct ?? 70);
  const [label, setLabel] = useState(sb.label || t('inst.commandCentre.studentsPlaced'));
  const [date, setDate] = useState(sb.due || '');
  const [msg, setMsg] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/institution/settings/mou-target', { pct, label, date }); onDone(); } catch (err) { setMsg(errMsg(err, t('inst.commandCentre.couldnTSaveTarget'))); }
  };
  return (
    <form className="ln-col" style={{ gap: 10 }} onSubmit={save}>
      <div className="ln-grid ln-g-3" style={{ gap: 10 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="mou-pct">{t('inst.commandCentre.target')}</label><input id="mou-pct" type="number" min="1" max="100" className="ln-input" value={pct} onChange={e => setPct(e.target.value)} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="mou-label">{t('inst.commandCentre.whatCounts')}</label><input id="mou-label" className="ln-input" value={label} onChange={e => setLabel(e.target.value)} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="mou-date">By</label><input id="mou-date" type="date" className="ln-input" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      {msg && <span className="ln-small ln-error" role="alert">{msg}</span>}
      <div className="ln-row" style={{ gap: 8 }}><button type="submit" className="ln-btn ln-btn-primary ln-btn-sm">{t('inst.commandCentre.saveTarget')}</button><button type="button" className="ln-btn ln-btn-sm" onClick={onDone}>{t('inst.commandCentre.cancel')}</button></div>
    </form>
  );
}

export default function CommandCentre({ role }) {
  const { t, fmtDate } = useUiLang();
  const [drill, setDrill] = useState(null);
  const onBand = (b) => setDrill(b);
  const { data, reload } = useCachedGet('/institution/command-centre');
  const [editing, setEditing] = useState(false);
  if (!data) return <CommandBox side="staff" />;
  const { cards, scoreboard: sb, setup, ai_time: ai, readiness: rd } = data;
  const setupLeft = setup.filter(s => !s.done).length;
  const done = () => { setEditing(false); dropCached('/institution/command-centre'); reload(); };

  return (
    <>
      <CommandBox side="staff" placeholder={t('inst.commandCentre.askAboutStudentsExample')} />

      {setupLeft > 0 && (
        <section className="ln-card ln-card-warm" style={{ gap: 10 }} aria-label={t('inst.commandCentre.setupChecklist')}>
          <div className="ln-between"><h2 className="ln-h2">{t('inst.commandCentre.gettingStarted')}</h2><span className="ln-small ln-muted">{t('inst.commandCentre.valueLengthDone', { value: setup.length - setupLeft, length: setup.length })}</span></div>
          {setup.map(s => (
            <div key={s.key} className="ln-row" style={{ gap: 10 }}>
              {s.done ? <CheckCircle2 size={18} style={{ color: "var(--status-success)" }} aria-label={t('inst.commandCentre.done')} /> : <Circle size={18} aria-label={t('inst.commandCentre.notDone')} />}
              {s.done ? <span className="ln-small ln-muted" style={{ textDecoration: 'line-through' }}>{s.label}</span> : <Link to={s.href} className="ln-link ln-small">{s.label} →</Link>}
            </div>
          ))}
        </section>
      )}

      {cards.length > 0 && (
        <section className="ln-col" style={{ gap: 12 }}>
          <h2 className="ln-h2">{t('inst.commandCentre.doNext')}</h2>
          <div className="ln-grid ln-g-3" style={{ gap: 14 }}>
            {cards.map(c => (
              <div key={c.kind} className="ln-card" style={{ padding: 18, borderRadius: 'var(--radius-lg)', gap: 8 }}>
                <div className="ln-row" style={{ gap: 10 }}><span className={`ln-tag ${TONE[c.kind] || 'ln-tag-info'}`}>{c.count}</span><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{c.title}</span></div>
                <span className="ln-small">{c.body}</span>
                <div className="ln-between ln-wrap" style={{ gap: 8 }}>
                  <Link to={c.href} className="ln-link" style={{ fontSize: 'var(--fs-small)' }}>{c.cta} →</Link>
                  <WhyThis title={t('inst.commandCentre.whyThis')}>{c.why}</WhyThis>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="ln-grid ln-g-3" style={{ gap: 16 }}>
        <section className="ln-card" style={{ gap: 10 }} aria-label={t('inst.commandCentre.placementTarget')}>
          <div className="ln-between"><span className="ln-kicker">{t('inst.commandCentre.mouScoreboard')}</span>
            {role === 'admin' && !editing && <button type="button" className="ln-btn ln-btn-sm" onClick={() => setEditing(true)}><Pencil size={13} aria-hidden="true" />{sb.target_pct ? t('inst.commandCentre.edit') : t('inst.commandCentre.setTarget')}</button>}</div>
          {editing ? <TargetForm sb={sb} onDone={done} /> : (
            <>
              <div className="ln-row" style={{ gap: 8, alignItems: 'baseline' }}><span className="ln-stat">{sb.placed_pct}%</span><span className="ln-small ln-muted">{sb.label.toLowerCase()}{sb.target_pct ? ` · ${t('inst.commandCentre.targetPct', { pct: sb.target_pct })}` : ''}</span></div>
              <Bar pct={sb.target_pct ? Math.min(100, (sb.placed_pct / sb.target_pct) * 100) : sb.placed_pct} variant="ln-bar-good" label={t('inst.commandCentre.placedPctTarget', { placed_pct: sb.placed_pct })} />
              <span className="ln-xs ln-muted">{t('inst.commandCentre.placedPlacedReadyReady', { placed: sb.placed, ready: sb.ready, total: sb.total })}{sb.due ? ` · ${t('inst.commandCentre.dueOn', { date: fmtDate(sb.due) })}` : ''}</span>
              <HowCounted>{t('inst.commandCentre.placedStudentsRecordedPlacement')}</HowCounted>
            </>
          )}
        </section>

        <section className="ln-card" style={{ gap: 10 }} aria-label={t('inst.commandCentre.readiness')}>
          <div className="ln-between"><span className="ln-kicker">{t('inst.commandCentre.readiness')}</span><SmallSample n={rd.total} /></div>
          <TooFew n={rd.total}>
            <BandBar counts={{ ready: rd.ready, nearly: rd.nearly, building: rd.building }} onSelect={onBand} />
          </TooFew>
          <HowCounted>{t('inst.commandCentre.readinessMatchBetweenStudent')}</HowCounted>
        </section>

        <section className="ln-card" style={{ gap: 10 }} aria-label={t('inst.commandCentre.reportsAiTime')}>
          <span className="ln-kicker">{t('inst.commandCentre.boardReport')}</span>
          <span className="ln-small">{t('inst.commandCentre.onePageBoardPrincipal')}</span>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <Link to="/institution/board-report?lang=en" className="ln-btn ln-btn-sm"><FileText size={14} aria-hidden="true" />{t('inst.commandCentre.english')}</Link>
            <Link to="/institution/board-report?lang=te" className="ln-btn ln-btn-sm ln-indic" lang="te"><FileText size={14} aria-hidden="true" />తెలుగు</Link>
            <Link to="/institution/board-report?lang=hi" className="ln-btn ln-btn-sm ln-indic" lang="hi"><FileText size={14} aria-hidden="true" />हिंदी</Link>
          </div>
          <div className="ln-row" style={{ gap: 8, marginTop: 6 }}><Clock size={15} aria-hidden="true" /><span className="ln-small"><b>{t('inst.commandCentre.minutesMin', { minutes: ai.minutes })}</b> {' '}{t('inst.commandCentre.aiTimeMonthCalls', { calls: ai.calls })}{ai.voice_clips ? ` · ${t('inst.commandCentre.voiceClips', { n: ai.voice_clips })}` : ''}</span></div>
          <HowCounted>{t('inst.commandCentre.timeAiSpentTeaching')}</HowCounted>
        </section>
      </div>
      {drill && <BandDrawer band={drill} onClose={() => setDrill(null)} />}
    </>
  );
}
