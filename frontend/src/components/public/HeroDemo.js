// src/components/public/HeroDemo.js — the home-page hero sample: tap Play to
// hear Professor Qubirex explain a skill (a recording of the server's teaching
// voice shipped with the site, else the live voice, so it plays on every
// device), with a waveform and captions that follow the audio; then watch
// the sample Passport turn the skills it just practised to Confirmed. Play / Pause / Replay, a loading state, and a clear message —
// never silence — if the voice can't play. Under prefers-reduced-motion the
// bars stay still and the Passport changes at once.
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';
import { CodeTag } from '../shared/Popover';
import { demoSpeak, demoStop } from '../../utils/demoVoice';

// The same text the server speaks (backend api/routes/shared.js SAMPLE_LESSON),
// in caption-sized pieces with an English gloss.
const LESSON = {
  telugu: { bcp47: 'te-IN', lines: [
    ['React లో component అంటే ఒక చిన్న భాగం.', 'In React, a component is one small piece.'],
    ['ఒక బటన్ గురించి ఆలోచించండి — ఒకసారి రాస్తే, ఎక్కడైనా వాడొచ్చు.', 'Think of a button — write it once, use it anywhere.'],
    ['ఇప్పుడు మీరే ఒకటి రాయండి.', 'Now write one yourself.']
  ] },
  hindi: { bcp47: 'hi-IN', lines: [
    ['React में component एक छोटा हिस्सा है।', 'In React, a component is one small piece.'],
    ['एक बटन के बारे में सोचिए — एक बार लिखो, कहीं भी इस्तेमाल करो।', 'Think of a button — write it once, use it anywhere.'],
    ['अब आप ख़ुद एक लिखिए।', 'Now write one yourself.']
  ] }
};
const SKILLS = [['home.s1', 'A3', true], ['home.s2', 'A2', true], ['home.s3', 'A2', false]];
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Which caption is showing at a point in the audio, by each line's share of the text.
const lineAt = (lines, frac) => {
  const total = lines.reduce((n, l) => n + l[0].length, 0);
  let acc = 0;
  for (let i = 0; i < lines.length; i += 1) { acc += lines[i][0].length / total; if (frac < acc) return i; }
  return lines.length - 1;
};

export default function HeroDemo() {
  const { t, lang } = useUiLang();
  const language = lang === 'hindi' ? 'hindi' : 'telugu';
  const { lines, bcp47 } = LESSON[language];
  const [state, setState] = useState('idle'); // idle | loading | playing | paused | done
  const [line, setLine] = useState(-1);
  const [confirmed, setConfirmed] = useState(0);
  const [note, setNote] = useState('');
  const audio = useRef(null);
  const timers = useRef([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const dropAudio = () => { if (audio.current) { audio.current.pause(); URL.revokeObjectURL(audio.current.src); audio.current = null; } };
  useEffect(() => () => { clear(); demoStop(); dropAudio(); }, []);
  // A new language needs its own recording.
  useEffect(() => { clear(); demoStop(); dropAudio(); setState('idle'); setLine(-1); setNote(''); }, [language]);

  const finish = () => {
    clear(); setState('done'); setLine(lines.length - 1);
    const toConfirm = SKILLS.filter(s => s[2]).length;
    if (reduced()) { setConfirmed(toConfirm); return; }
    for (let i = 1; i <= toConfirm; i += 1) timers.current.push(setTimeout(() => setConfirmed(i), i * 600));
  };

  // Last resort: the browser's own voice, else captions on a steady beat.
  const fallback = async () => {
    setState('playing'); setLine(0);
    lines.forEach((_, i) => { if (i) timers.current.push(setTimeout(() => setLine(i), i * 2600)); });
    const res = await demoSpeak(lines.map(l => l[0]).join(' '), bcp47);
    if (res === 'done') { finish(); return; }
    setNote(t('hero.noVoice'));
    timers.current.push(setTimeout(finish, lines.length * 2600));
  };

  const start = async () => {
    clear(); setConfirmed(0); setNote('');
    if (audio.current) { audio.current.currentTime = 0; await audio.current.play().catch(() => {}); setState('playing'); return; }
    setState('loading');
    try {
      // The recording shipped with the site first (scripts/record-sample-lesson.js),
      // then the server's live voice.
      const shipped = await fetch('/audio/sample-lesson.json').then(x => (x.ok ? x.json() : null)).catch(() => null);
      let r = shipped?.[language] ? await fetch(shipped[language]).catch(() => null) : null;
      if (!r?.ok || !/^audio\//.test(r.headers.get('content-type') || '')) r = await fetch(`${process.env.REACT_APP_API_BASE_URL || '/api'}/sample-lesson?lang=${language}`);
      if (!r.ok) throw new Error(String(r.status));
      const a = new Audio(URL.createObjectURL(await r.blob()));
      a.addEventListener('timeupdate', () => { if (a.duration) setLine(lineAt(lines, a.currentTime / a.duration)); });
      a.addEventListener('ended', finish);
      audio.current = a;
      setLine(0);
    } catch {
      dropAudio();
      await fallback();
      return;
    }
    // A slow first load can outlast the browser's "user tapped" window; the
    // audio is ready then, so one more tap plays it.
    try { await audio.current.play(); setState('playing'); } catch { setState('paused'); setNote(t('hero.tapAgain')); }
  };

  const onButton = () => {
    if (state === 'loading') return;
    if (state === 'playing') {
      if (audio.current) { audio.current.pause(); setState('paused'); } else { demoStop(); finish(); }
      return;
    }
    if (state === 'paused' && audio.current) { setNote(''); audio.current.play().catch(() => {}); setState('playing'); return; }
    start();
  };

  const Icon = state === 'loading' ? Loader2 : state === 'playing' ? Pause : state === 'done' ? RotateCcw : Play;
  const label = state === 'loading' ? t('hero.loading') : state === 'playing' ? t('hero.pause') : state === 'done' ? t('hero.replay') : state === 'paused' ? t('hero.resume') : t('hero.play');
  return (
    <article className="ln-card pb-herodemo" style={{ gap: 12 }} aria-label={t('home.sampleLabel')}>
      <div className="ln-between"><span className="ln-kicker">{t('hero.kicker')}</span><span className="ln-tag ln-tag-neutral">{t('common.demoData')}</span></div>
      <div className="ln-row" style={{ gap: 12 }}>
        <button type="button" className={`pb-play ${state === 'loading' ? 'is-loading' : ''}`} onClick={onButton} aria-label={label} title={label} aria-busy={state === 'loading'}>
          <Icon size={20} aria-hidden="true" />
        </button>
        <div className={`pb-wave ${state === 'playing' ? 'is-on' : ''}`} aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <span key={i} style={{ animationDelay: `${(i % 6) * 0.12}s` }} />)}</div>
      </div>
      <div className="pb-captions" aria-live="polite">
        {state === 'loading' ? <span className="ln-small ln-muted">{t('hero.loading')}</span>
          : line < 0 ? <span className="ln-small ln-muted">{t(language === 'hindi' ? 'hero.tapToHearHi' : 'hero.tapToHear')}</span> : (
            <>
              <span className="ln-indic" lang={language === 'hindi' ? 'hi' : 'te'} style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{lines[line][0]}</span>
              {lang === 'english' && <span className="ln-small ln-muted" lang="en">{lines[line][1]}</span>}
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
