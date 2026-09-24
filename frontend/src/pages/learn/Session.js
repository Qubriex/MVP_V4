// src/pages/learn/Session.js — /learn/session
// ─────────────────────────────────────────────────────────────────────────────
// THE LEARNING SESSION, voice first. RECEIVE (context loaded) → BUILD
// (instruction cycle) → RETURN (mastery confirmed, advance).
//
// Professor Qubirex's turns are spoken aloud (browser TTS) with the native-
// language caption and an English line under it. The learner answers by
// voice (on-device recognition, or recorded audio transcribed by the server)
// or by typing, switchable at any time. The side panel keeps the transcript —
// every message can be replayed — and a Board tab for the diagrams and code
// TEACH sends with its turns. TEACH still decides when a mastery check is
// due; "I'm ready for the check" asks it to set one now.
//
// Desktop: stage + side panel. Phone (≤900px): full-screen stage, the panel
// becomes a bottom sheet (see learner.css).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Mic, Keyboard, RotateCcw, Pause, Play, Volume2, Award } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, speechTag } from '../../context/UiLangContext';
import api, { getOr } from '../../utils/api';
import { useSpeechInput, useSpeechOutput, hasVoiceFor } from '../../utils/voice';
import { MOCK_SESSION_START, MOCK_PROFILE, MOCK_LEARNER_DASHBOARD } from '../../utils/learnerMockData';
import MermaidDiagram from '../../components/learn/MermaidDiagram';

const APPROACH_NAMES = { native_concept: 'Native concept', analogy: 'Analogy', worked_example: 'Worked example', decomposition: 'Building blocks', socratic: 'Socratic' };
const LANG_LABEL = { telugu: 'తెలుగు', hindi: 'हिंदी' };
const RATES = [0.8, 1, 1.2];
const WAVE = [8, 14, 22, 30, 18, 26, 34, 20, 12, 24, 32, 16, 10, 22, 28, 14, 20, 30, 24, 12, 18, 26, 16, 10, 20, 14, 8, 12];

let nextId = 0;
const withId = (m) => ({ id: `m${nextId += 1}`, ...m });
const fromHistory = (h) => withId({ role: h.role, content: h.content, type: h.message_type || h.type, caption_en: h.caption_en, mermaid: h.mermaid, code: h.code, input_mode: h.input_mode });

export default function Session() {
  const { user } = useAuth();
  const { t } = useUiLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const language = user?.language || 'telugu';
  const bcp47 = speechTag(language);

  const [sessionId, setSessionId] = useState(null);
  const [nodeLabel, setNodeLabel] = useState('');
  const [clusterLabel, setClusterLabel] = useState('');
  const [nodePos, setNodePos] = useState(null);
  const [approach, setApproach] = useState('native_concept');
  const [loopCount, setLoopCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [phase, setPhase] = useState('instruction'); // instruction | mastery_check | result
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(params.get('mode') === 'type' ? 'typing' : 'voice');
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState('transcript');
  const [boardSeen, setBoardSeen] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showEnglish, setShowEnglish] = useState(true);
  const [rate, setRate] = useState(1);
  const [voiceVariant, setVoiceVariant] = useState('A');
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const endRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const speech = useSpeechOutput({ lang: bcp47, rate, variant: voiceVariant });

  // ── Load session, voice preferences and node position ──────────────────────
  const startSession = useCallback(async () => {
    setBusy(true); setError(''); setResult(null); setPhase('instruction');
    let data;
    try {
      const res = await api.post('/learner/session/start');
      if (!res.data || !res.data.session_id) throw new Error('unexpected response shape');
      data = res.data;
    } catch (e) {
      data = MOCK_SESSION_START; // dev fallback — no backend reachable
    }
    setSessionId(data.session_id);
    setNodeLabel(data.node_label || '');
    setClusterLabel(data.cluster_label || '');
    setApproach(data.approach || 'native_concept');
    setLoopCount(data.loop_count || 0);
    const history = (data.history || []).map(fromHistory);
    setMessages(history);
    const last = [...history].reverse().find(m => m.role === 'ai');
    if (last?.type === 'mastery_check') setPhase('mastery_check');
    setBusy(false);
    if (last && modeRef.current === 'voice') speech.speak(last.content, last.id);
  }, [speech]);

  useEffect(() => {
    startSession();
    getOr('/learner/profile', MOCK_PROFILE, d => d && d.voice_prefs).then(p => {
      const v = p.voice_prefs || {};
      setShowEnglish(v.showEnglishCaptions !== false);
      if (RATES.includes(v.rate)) setRate(v.rate);
      if (v.voice) setVoiceVariant(v.voice);
      if (v.startInVoice === false && !params.get('mode')) setMode('typing');
    });
    getOr('/learner/dashboard', MOCK_LEARNER_DASHBOARD, d => d && typeof d.total_nodes !== 'undefined')
      .then(d => d.current_node_index && setNodePos({ i: d.current_node_index, n: d.total_nodes }));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  // Session timer + active-time heartbeat (counts only while the tab is visible).
  useEffect(() => {
    const tick = setInterval(() => { if (document.visibilityState === 'visible') setElapsed(s => s + 1); }, 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!sessionId || sessionId.startsWith('demo')) return undefined;
    const beat = setInterval(() => {
      if (document.visibilityState === 'visible') api.post('/learner/session/heartbeat', { session_id: sessionId, minutes: 1 }).catch(() => {});
    }, 60000);
    return () => clearInterval(beat);
  }, [sessionId]);

  // ── Turn handling ───────────────────────────────────────────────────────────
  const applyResponse = useCallback((data) => {
    const ai = withId({ role: 'ai', content: data.message, caption_en: data.caption_en, mermaid: data.mermaid, code: data.code });
    if (data.result === 'advance') {
      ai.type = 'advance_trigger';
      setResult(data);
      setPhase('result');
    } else if (data.result === 'loop') {
      ai.type = 'loop_trigger';
      setLoopCount(data.loop_count);
      if (data.next_approach) setApproach(data.next_approach);
      setPhase('instruction');
    } else {
      ai.type = data.decision === 'CHECK' ? 'mastery_check' : 'instruction';
      if (data.approach) setApproach(data.approach);
      setPhase(data.decision === 'CHECK' ? 'mastery_check' : 'instruction');
    }
    setMessages(prev => [...prev, ai]);
    if (modeRef.current === 'voice') speech.speak(ai.content, ai.id);
  }, [speech]);

  const send = useCallback(async (content, inputMode, { requestCheck = false } = {}) => {
    const text = (content || '').trim();
    if ((!text && !requestCheck) || busy) return;
    speech.stop();
    setError('');
    setMessages(prev => [...prev, withId({ role: 'learner', content: text || t('session.ready'), type: 'response', input_mode: inputMode })]);
    setBusy(true);
    try {
      const res = await api.post('/learner/session/message', { content: text, session_id: sessionId, input_mode: inputMode, request_check: requestCheck });
      if (!res.data || !res.data.message) throw new Error('unexpected response shape');
      applyResponse(res.data);
    } catch (e) {
      setError('Couldn’t reach Professor Qubirex. Check your connection and try again.');
    }
    setBusy(false);
  }, [busy, sessionId, speech, applyResponse, t]);

  const sendAudio = useCallback(async (blob) => {
    setTranscribing(true); setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('audio', blob, 'answer.webm');
      if (sessionId) form.append('session_id', sessionId);
      const res = await api.post('/learner/session/voice', form);
      if (!res.data || !res.data.message) throw new Error('unexpected response shape');
      setMessages(prev => [...prev, withId({ role: 'learner', content: res.data.transcript, type: 'response', input_mode: 'voice' })]);
      applyResponse(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Couldn’t hear that. Try again, or type your answer.');
    }
    setTranscribing(false); setBusy(false);
  }, [sessionId, applyResponse]);

  const mic = useSpeechInput({ lang: bcp47, onFinal: (text) => send(text, 'voice'), onAudio: sendAudio });

  const toggleMic = () => {
    if (mic.listening) { mic.stop(); return; }
    speech.stop();
    setMode('voice');
    mic.start();
  };
  const toggleTyping = () => {
    if (mode === 'typing') { setMode('voice'); return; }
    if (mic.listening) mic.stop();
    speech.stop();
    setMode('typing');
  };
  const submitDraft = () => { const text = draft; setDraft(''); send(text, 'text'); };

  // ── Derived view state ─────────────────────────────────────────────────────
  const lastAi = useMemo(() => [...messages].reverse().find(m => m.role === 'ai'), [messages]);
  const board = useMemo(() => messages.filter(m => m.mermaid || m.code), [messages]);
  const boardNew = tab !== 'board' && board.length > boardSeen;
  useEffect(() => { if (tab === 'board') setBoardSeen(board.length); }, [tab, board.length]);

  const orb = mic.listening ? 'listening' : busy ? 'thinking' : speech.speakingId ? 'speaking' : mode === 'typing' ? 'typing' : phase === 'mastery_check' ? 'yourTurn' : 'idle';
  const orbLabel = { listening: t('session.listening'), thinking: transcribing ? 'Transcribing…' : t('session.thinking'), speaking: t('session.speaking'), typing: t('session.typing'), yourTurn: t('session.yourTurn'), idle: t('session.idle') }[orb];
  const noVoice = speech.supported && !hasVoiceFor(bcp47);
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const langName = LANG_LABEL[language] || language;
  const liveCaption = mic.listening && mic.interim ? mic.interim : lastAi?.content;

  const endSession = () => { speech.stop(); if (mic.listening) mic.stop(); navigate('/learn/dashboard'); };

  return (
    <div className="ln-session">
      <header className="ln-session-head">
        <Link to="/learn/dashboard" className="ln-btn ln-btn-sm ln-hide-phone" onClick={() => speech.stop()}><ArrowLeft size={16} aria-hidden="true" />{t('nav.home')}</Link>
        <Link to="/learn/dashboard" className="ln-roundbtn ln-show-phone" aria-label="Back to home" onClick={() => speech.stop()}><ArrowLeft size={18} aria-hidden="true" /></Link>
        <div className="ln-col" style={{ flex: 1, minWidth: 0 }}>
          <span className="ln-session-title" style={{ fontSize: 17, fontWeight: 600 }}>{nodeLabel || '…'}</span>
          <span className="ln-small ln-session-sub-desk" style={{ opacity: 0.75 }}>
            {clusterLabel}{nodePos ? ` · Node ${nodePos.i} of ${nodePos.n}` : ''}
          </span>
          <span className="ln-session-sub-phone ln-indic">{[APPROACH_NAMES[approach], langName, loopCount > 0 && `Loop ${loopCount}`].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          <span className="ln-tag ln-tag-lg ln-tag-info ln-hide-phone">Approach: {APPROACH_NAMES[approach] || approach}</span>
          <span className="ln-tag ln-tag-lg ln-tag-accent ln-indic ln-hide-phone">{langName}</span>
          {loopCount > 0 && <span className="ln-tag ln-tag-lg ln-tag-warning ln-hide-phone">Loop {loopCount}</span>}
          <span className="ln-row ln-small" style={{ gap: 6, opacity: 0.75 }} aria-label={`Session time ${clock}`}><Clock size={16} aria-hidden="true" />{clock}</span>
          <button type="button" className="ln-btn ln-btn-sm ln-hide-phone ln-indic" onClick={endSession}>{t('session.end')}</button>
        </div>
      </header>

      <div className="ln-session-body">
        <section className="ln-stage" aria-label="Voice stage">
          {phase === 'mastery_check' && (
            <div className="ln-banner-check ln-indic" role="status"><Award size={18} aria-hidden="true" /><span>{t('session.check')}</span></div>
          )}

          <div className="ln-col ln-stage-main" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, width: '100%' }}>
            <div className={`ln-orb-ring is-${orb}`}><div><div className="ln-orb" /></div></div>
            <div className="ln-col" style={{ alignItems: 'center', gap: 4 }}>
              <span className="ln-kicker" style={{ color: 'var(--accent-400)' }}>Professor Qubirex</span>
              <span className="ln-indic" style={{ fontSize: 15, color: 'var(--stage-muted)' }} aria-live="polite">{orbLabel}</span>
            </div>
            <div className={`ln-wave ${orb === 'speaking' || orb === 'listening' ? 'is-on' : ''} ${orb === 'listening' ? 'is-listening' : ''}`} aria-hidden="true">
              {WAVE.map((h, i) => <span key={i} style={{ '--h': `${h}px`, animationDelay: `${(i % 7) * 0.09}s` }} />)}
            </div>

            {phase === 'result' ? (
              <div className="ln-col ln-indic" style={{ alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <p className="ln-caption-te">{lastAi?.content}</p>
                {result?.programme_complete ? (
                  <>
                    <strong style={{ fontSize: 22, color: 'var(--stage-listen)' }}>{t('session.complete')}</strong>
                    <Link to="/learn/record" className="ln-btn ln-btn-amber">See your capability record</Link>
                  </>
                ) : (
                  <>
                    <strong style={{ fontSize: 20, color: 'var(--stage-listen)' }}>✓ {t('session.advance')}</strong>
                    <span style={{ color: 'var(--stage-muted)' }}>{t('session.nextSkill')}: <b style={{ color: 'var(--stage-text)' }}>{result?.next_node?.label}</b></span>
                    <button type="button" className="ln-btn ln-btn-amber" onClick={() => startSession()}>{t('session.next')} →</button>
                  </>
                )}
              </div>
            ) : (
              <div className="ln-col" style={{ gap: 10, alignItems: 'center', width: '100%' }}>
                <p lang={bcp47} className="ln-caption-te" aria-live="polite">{liveCaption || (busy ? '' : '…')}</p>
                {showEnglish && !mic.listening && lastAi?.caption_en && <p className="ln-caption-en">{lastAi.caption_en}</p>}
                {noVoice && orb !== 'listening' && <p className="ln-caption-en" style={{ fontSize: 12 }}>This device has no {langName} voice installed, so replies show as captions only.</p>}
              </div>
            )}
          </div>

          {(error || mic.error) && <div className="ln-banner-check" role="alert" style={{ borderColor: 'var(--status-danger)', color: '#F5C8BD' }}>{error || mic.error}</div>}

          {mode === 'typing' && phase !== 'result' && (
            <div className="ln-typebar">
              <label htmlFor="typed" className="ln-sr">Type your answer</label>
              <textarea id="typed" rows={2} value={draft} disabled={busy} autoFocus
                placeholder={t('session.typeHere')}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitDraft(); } }} />
              <button type="button" className="ln-btn ln-btn-amber ln-indic" style={{ borderRadius: 'var(--radius-lg)' }} onClick={submitDraft} disabled={busy || !draft.trim()}>{t('session.send')}</button>
            </div>
          )}

          {phase !== 'result' && (
            <div className="ln-row ln-stage-controls" style={{ gap: 18, justifyContent: 'center' }}>
              <button type="button" className="ln-roundbtn" aria-label="Replay last answer" disabled={!lastAi || !speech.supported} onClick={() => lastAi && speech.speak(lastAi.content, lastAi.id)}><RotateCcw size={20} aria-hidden="true" /></button>
              <button type="button" className="ln-roundbtn ln-hide-stage-phone" aria-label={`Playback speed ${rate}×, change`} onClick={() => setRate(r => RATES[(RATES.indexOf(r) + 1) % RATES.length])}>{rate.toFixed(1)}×</button>
              <div className="ln-col" style={{ alignItems: 'center', gap: 8 }}>
                <button type="button" className={`ln-mic ${mic.listening ? 'is-listening' : ''}`} onClick={toggleMic} disabled={(busy && !mic.listening) || !mic.supported}
                  aria-label={mic.listening ? t('session.tapStop') : t('session.tapSpeak')} aria-pressed={mic.listening}>
                  <Mic size={30} aria-hidden="true" />
                </button>
                <span className="ln-small ln-indic" style={{ color: 'var(--stage-muted)' }}>{mic.listening ? t('session.tapStop') : t('session.tapSpeak')}</span>
              </div>
              <button type="button" className="ln-roundbtn ln-hide-stage-phone" aria-label={speech.paused ? 'Resume voice' : 'Pause voice'} disabled={!speech.speakingId}
                onClick={() => (speech.paused ? speech.resume() : speech.pause())}>
                {speech.paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}
              </button>
              <button type="button" className="ln-roundbtn" aria-label="Switch to typing" aria-pressed={mode === 'typing'} onClick={toggleTyping}><Keyboard size={20} aria-hidden="true" /></button>
            </div>
          )}
        </section>

        <aside className={`ln-sidepanel ${sheetOpen ? 'is-open' : ''}`} aria-label="Transcript and board">
          <button type="button" className="ln-sheet-handle" onClick={() => setSheetOpen(o => !o)} aria-label={sheetOpen ? 'Hide transcript' : 'Show transcript and board'} aria-expanded={sheetOpen} />
          <div className="ln-tabs" role="tablist" style={{ padding: '6px 20px 0' }}>
            <button type="button" role="tab" className="ln-tab ln-indic" aria-selected={tab === 'transcript'} onClick={() => { setTab('transcript'); setSheetOpen(true); }}>{t('session.transcript')}</button>
            <button type="button" role="tab" className="ln-tab ln-indic" aria-selected={tab === 'board'} onClick={() => { setTab('board'); setSheetOpen(true); }}>
              {t('session.board')}{board.length > 0 && ` · ${board.length}`}{boardNew && <span className="ln-sr"> (new)</span>}
              {boardNew && <span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 99, background: 'var(--accent-700)', marginLeft: 6, verticalAlign: 'middle' }} />}
            </button>
          </div>

          <div className="ln-sidepanel-scroll" role="tabpanel">
            {tab === 'transcript' ? (
              <>
                {messages.map(m => {
                  const you = m.role === 'learner';
                  const now = speech.speakingId === m.id;
                  const cls = now ? 'is-now' : m.type === 'mastery_check' ? 'is-check' : m.type === 'advance_trigger' ? 'is-advance' : '';
                  return (
                    <div key={m.id} className={`ln-msg ${you ? 'is-you' : ''}`}>
                      <span className="ln-msg-who">{you ? `You · ${m.input_mode === 'voice' ? 'spoken' : 'typed'}` : `Professor Qubirex${now ? ' · speaking' : ''}`}</span>
                      <div className={`ln-bubble ${cls}`} lang={bcp47}>
                        {m.content}
                        {!you && showEnglish && m.caption_en && <span className="ln-bubble-en" lang="en">{m.caption_en}</span>}
                      </div>
                      {speech.supported && (
                        <button type="button" className="ln-play" onClick={() => (now ? speech.stop() : speech.speak(m.content, m.id))}>
                          <Volume2 size={14} aria-hidden="true" />{now ? 'Stop' : 'Play'}
                        </button>
                      )}
                    </div>
                  );
                })}
                {busy && <div className="ln-msg"><span className="ln-msg-who">Professor Qubirex</span><div className="ln-bubble"><span className="ln-typing-dots" aria-label="Thinking"><span /><span /><span /></span></div></div>}
                <div ref={endRef} />
              </>
            ) : (
              <>
                <span className="ln-small ln-muted">Diagrams and code the professor shares appear here.</span>
                {board.length === 0 && <div className="ln-tile ln-small ln-muted" style={{ padding: 20, textAlign: 'center' }}>Nothing on the board yet.</div>}
                {[...board].reverse().map(m => (
                  <div key={m.id} className="ln-col" style={{ gap: 10 }}>
                    {m.mermaid && <MermaidDiagram source={m.mermaid} />}
                    {m.code && <pre className="ln-board-code"><code>{m.code}</code></pre>}
                  </div>
                ))}
              </>
            )}
          </div>

          {phase !== 'result' && (
            <div style={{ boxSizing: 'border-box', padding: '16px 20px 20px', borderTop: '1px solid var(--color-border)' }} className="ln-col ln-panel-foot">
              <button type="button" className="ln-btn ln-btn-primary ln-btn-block ln-indic" style={{ minHeight: 48, fontSize: 15, marginBottom: 10 }}
                disabled={busy || phase === 'mastery_check'} onClick={() => send('', mode === 'voice' ? 'voice' : 'text', { requestCheck: true })}>
                {t('session.ready')}
              </button>
              <span className="ln-xs ln-muted ln-panel-note" style={{ textAlign: 'center' }}>
                {mic.onDevice ? 'Your browser turns speech into text; only the text is sent.' : 'Voice is transcribed on the server and kept with this session only.'}
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
