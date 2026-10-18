// src/components/public/HeroDemo.js — the home-page hero sample: tap to hear
// Professor Qubirex explain a skill in Telugu (browser voice, with a waveform
// and Telugu + English captions), then watch the sample Passport turn the
// skills it just practised to Confirmed. Nothing is sent anywhere. Under
// prefers-reduced-motion the bars stay still and the Passport changes at once.
import React, { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';
import { CodeTag } from '../shared/Popover';
import { demoSpeak, demoStop } from '../../utils/demoVoice';

// One short explanation, in caption-sized pieces (Telugu, then English).
const LINES = [
  ['React లో component అంటే ఒక చిన్న భాగం.', 'In React, a component is one small piece.'],
  ['ఒక బటన్ గురించి ఆలోచించండి — ఒకసారి రాస్తే, ఎక్కడైనా వాడొచ్చు.', 'Think of a button — write it once, use it anywhere.'],
  ['ఇప్పుడు మీరే ఒకటి రాయండి.', 'Now write one yourself.']
];
const SKILLS = [['home.s1', 'A3', true], ['home.s2', 'A2', true], ['home.s3', 'A2', false]];
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function HeroDemo() {
  const { t } = useUiLang();
  const [state, setState] = useState('idle'); // idle | playing | done
  const [line, setLine] = useState(-1);
  const [confirmed, setConfirmed] = useState(0); // how many skills show Confirmed
  const [note, setNote] = useState('');
  const timers = useRef([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => { clear(); demoStop(); }, []);

  const finish = () => {
    clear(); setState('done'); setLine(LINES.length - 1);
    const toConfirm = SKILLS.filter(s => s[2]).length;
    if (reduced()) { setConfirmed(toConfirm); return; }
    for (let i = 1; i <= toConfirm; i += 1) timers.current.push(setTimeout(() => setConfirmed(i), i * 600));
  };
  const play = async () => {
    if (state === 'playing') { demoStop(); finish(); return; }
    clear(); setConfirmed(0); setNote(''); setState('playing'); setLine(0);
    // Captions advance on a steady beat whether or not the device can speak.
    LINES.forEach((_, i) => { if (i) timers.current.push(setTimeout(() => setLine(i), i * 2600)); });
    const res = await demoSpeak(LINES.map(l => l[0]).join(' '), 'te-IN');
    if (res !== 'done') {
      setNote(t('hero.noVoice'));
      timers.current.push(setTimeout(finish, LINES.length * 2600));
    } else finish();
  };

  return (
    <article className="ln-card pb-herodemo" style={{ gap: 12 }} aria-label={t('home.sampleLabel')}>
      <div className="ln-between"><span className="ln-kicker">{t('hero.kicker')}</span><span className="ln-tag ln-tag-neutral">{t('common.demoData')}</span></div>
      <div className="ln-row" style={{ gap: 12 }}>
        <button type="button" className="pb-play" onClick={play} aria-pressed={state === 'playing'}
          aria-label={state === 'playing' ? t('hero.stop') : t('hero.play')}>
          {state === 'playing' ? <Square size={18} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
        </button>
        <div className={`pb-wave ${state === 'playing' ? 'is-on' : ''}`} aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <span key={i} style={{ animationDelay: `${(i % 6) * 0.12}s` }} />)}</div>
      </div>
      <div className="pb-captions" aria-live="polite">
        {line < 0 ? <span className="ln-small ln-muted">{t('hero.tapToHear')}</span> : (
          <>
            <span className="ln-indic" lang="te" style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{LINES[line][0]}</span>
            <span className="ln-small ln-muted" lang="en">{LINES[line][1]}</span>
          </>
        )}
      </div>
      {note && <span className="ln-xs ln-muted" role="status">{note}</span>}
      <hr className="pb-rule" />
      <b style={{ fontSize: 'var(--fs-h3)' }}>{t('home.sampleProgramme')}</b>
      {SKILLS.map(([k, a], i) => {
        const ok = i < confirmed;
        return (
          <div key={k} className="ln-between ln-small ln-wrap" style={{ gap: 6 }}><span>{t(k)}</span>
            <span className="ln-row ln-wrap" style={{ gap: 4, justifyContent: 'flex-end' }}>
              <span className={`ln-tag ${ok ? 'ln-tag-success pb-pop' : 'ln-tag-info'}`}>{ok ? t('label.confirmed') : t('label.partial')}</span>
              <CodeTag code="L2" label={t('level.L2')} /><CodeTag code={a} label={t(`assure.${a}`)} />
            </span>
          </div>
        );
      })}
      <span className="ln-xs ln-muted" role="status">{state === 'done' ? t('hero.confirmedNote') : t('home.sampleNote')}</span>
    </article>
  );
}
