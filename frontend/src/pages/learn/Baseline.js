// src/pages/learn/Baseline.js — /learn/baseline, the starting check.
// About two short questions per skill group (around 15 minutes), by voice or
// typing. No marks: it only decides where the learner starts, and the end
// screen says why ("Why we start you here"). It can be skipped; the screen
// says what that means.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleDashed, Circle, SkipForward, Play } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import AnswerBox from '../../components/learn/AnswerBox';
import { useUiLang } from '../../context/UiLangContext';
import { Skeleton } from '../../components/shared/ui';

const GROUP_ICON = { known: CheckCircle2, some: CircleDashed, new: Circle };

export default function Baseline() {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmSkip, setConfirmSkip] = useState(false);

  useEffect(() => { api.get('/learner/baseline').then(r => setState(r.data)).catch(e => setError(errMsg(e))); }, []);
  const call = async (fn) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(errMsg(e)); } setBusy(false); };
  const start = () => call(async () => { const r = await api.post('/learner/baseline/start'); setState(r.data); setI(Object.keys(r.data.answers || {}).length); });
  const finish = () => call(async () => { const r = await api.post('/learner/baseline/finish'); setState(s => ({ ...s, ...r.data })); });
  const skip = () => call(async () => { const r = await api.post('/learner/baseline/skip'); setState(s => ({ ...s, ...r.data })); });
  const answer = (text, provenance, clear) => call(async () => {
    await api.post('/learner/baseline/answer', { key: state.items[i].key, answer: text });
    clear();
    if (i + 1 < state.items.length) setI(i + 1); else await finish();
  });
  const pass = () => call(async () => {
    await api.post('/learner/baseline/answer', { key: state.items[i].key, answer: '' });
    if (i + 1 < state.items.length) setI(i + 1); else await finish();
  });

  if (!state) return error ? <div className="ln-error" role="alert">{error}</div> : <Skeleton lines={5} card />;

  if (state.status === 'done' || state.status === 'skipped') {
    const p = state.placement;
    return (
      <div className="ui-narrow ln-col" style={{ gap: 16 }}>
        <header className="ln-col" style={{ gap: 6 }}>
          <span className="ln-kicker">{t('lj.baseline.kicker')}</span>
          <h1 className="ln-title">{p.skipped ? t('lj.baseline.skippedTitle') : t('lj.baseline.doneTitle')}</h1>
        </header>
        <section className="ln-card ln-col" style={{ gap: 10 }} aria-labelledby="why-here">
          <h2 id="why-here" className="ln-h2">{t('lj.baseline.whyHere')}</h2>
          <p style={{ margin: 0 }}>{p.skipped ? t('lj.baseline.whySkipped') : p.known_groups?.length ? t('lj.baseline.whyKnown', { groups: p.known_groups.join(', '), start: p.start_group }) : t('lj.baseline.whyNew')}</p>
          <ul className="lj-groups">
            {(p.groups || []).map(g => {
              const Icon = GROUP_ICON[g.status] || Circle;
              return <li key={g.id}><Icon size={18} aria-hidden="true" /><span>{g.label}</span><span className="ln-small ln-muted">{t(`lj.baseline.group.${g.status}`)}</span></li>;
            })}
          </ul>
          <p className="ln-small ln-muted" style={{ margin: 0 }}>{t('lj.baseline.canChange')}</p>
        </section>
        <section className="ln-card ln-card-warm ln-between ln-wrap" style={{ gap: 12 }}>
          <div className="ln-col" style={{ gap: 4 }}>
            <span className="ln-kicker">{t('lj.startHere')}</span>
            <b>{p.start_label}</b>
            <span className="ln-small ln-muted">{p.start_group}</span>
          </div>
          <button type="button" className="ln-btn ln-btn-primary" onClick={() => navigate('/learn/session', { state: { from: '/learn/dashboard' } })}><Play size={16} aria-hidden="true" />{t('lj.baseline.firstLesson')}</button>
        </section>
      </div>
    );
  }

  if (state.status === 'not_started') {
    return (
      <div className="ui-narrow ln-col" style={{ gap: 16 }}>
        <header className="ln-col" style={{ gap: 6 }}>
          <span className="ln-kicker">{t('lj.baseline.kicker')}</span>
          <h1 className="ln-title">{t('lj.baseline.title')}</h1>
          <p className="ln-sub" style={{ margin: 0 }}>{t('lj.baseline.sub')}</p>
        </header>
        <section className="ln-card ln-col" style={{ gap: 8 }}>
          <span>{t('lj.baseline.what1')}</span>
          <span>{t('lj.baseline.what2')}</span>
          <span>{t('lj.baseline.what3')}</span>
        </section>
        {error && <div className="ln-error" role="alert">{error}</div>}
        <div className="ln-row ln-wrap" style={{ gap: 10 }}>
          <button type="button" className="ln-btn ln-btn-primary" onClick={start} disabled={busy} data-baseline-start><Play size={16} aria-hidden="true" />{t('lj.baseline.start')}</button>
          <button type="button" className="ln-btn" onClick={() => setConfirmSkip(true)} disabled={busy} data-baseline-skip><SkipForward size={16} aria-hidden="true" />{t('lj.baseline.skip')}</button>
        </div>
        {confirmSkip && (
          <section className="ln-card ln-col" style={{ gap: 8 }} role="alertdialog" aria-label={t('lj.baseline.skip')}>
            <b>{t('lj.baseline.skipTitle')}</b>
            <span className="ln-small">{t('lj.baseline.skipConsequence')}</span>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <button type="button" className="ln-btn ln-btn-primary" onClick={skip} disabled={busy} data-baseline-skip-confirm>{t('lj.baseline.skipConfirm')}</button>
              <button type="button" className="ln-btn" onClick={() => setConfirmSkip(false)}>{t('lj.baseline.takeIt')}</button>
            </div>
          </section>
        )}
        <Link className="ln-link ln-small" to="/learn/dashboard">{t('lj.backHome')}</Link>
      </div>
    );
  }

  const item = state.items[i];
  return (
    <div className="ui-narrow ln-col" style={{ gap: 16 }}>
      <header className="ln-col" style={{ gap: 6 }}>
        <span className="ln-kicker">{t('lj.baseline.progress', { n: i + 1, total: state.items.length })} · {item.group}</span>
        <div className="ln-bar" role="progressbar" aria-valuenow={i} aria-valuemin={0} aria-valuemax={state.items.length} aria-label={t('lj.baseline.kicker')}><span style={{ width: `${(i / state.items.length) * 100}%` }} /></div>
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      <section className="ln-card ln-col" style={{ gap: 12 }} aria-label={t('lj.baseline.question')}>
        <span className="ln-small ln-muted">{item.skill}</span>
        <p className="ln-indic" style={{ fontSize: 'var(--fs-h3)', lineHeight: 1.6, margin: 0 }} data-baseline-question>{item.question}</p>
        <AnswerBox onSubmit={answer} busy={busy} submitLabel={t('lj.baseline.next')} />
        <button type="button" className="ln-link ln-small" style={{ alignSelf: 'flex-start' }} onClick={pass} disabled={busy}>{t('lj.baseline.dontKnow')}</button>
      </section>
    </div>
  );
}
