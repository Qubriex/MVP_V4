// src/pages/learn/Interview.js — /learn/market/:jobId/interview
// Voice interview practice for one saved JD: five questions in the learner's
// language, each answered by voice or typing, with a line of feedback after
// each answer. Practice only — nothing here is stored or counts as mastery.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mic, Keyboard, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiLang, speechTag } from '../../context/UiLangContext';
import api, { getOr } from '../../utils/api';
import { useSpeechInput, useSpeechOutput } from '../../utils/voice';
import { MOCK_JOB_DETAIL } from '../../utils/learnerMockData';

export default function Interview() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t } = useUiLang();
  const bcp47 = speechTag(user?.language || 'telugu');
  const [job, setJob] = useState(null);
  const [turns, setTurns] = useState([]);
  const [meta, setMeta] = useState({ question_number: null, total: 5, done: false, caption_en: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const speech = useSpeechOutput({ lang: bcp47 });
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  const ask = useCallback(async (nextTurns) => {
    setBusy(true); setError('');
    try {
      const res = await api.post(`/market/jobs/${jobId}/interview`, { turns: nextTurns });
      if (!res.data?.text) throw new Error('empty');
      setTurns([...nextTurns, { role: 'interviewer', text: res.data.text }]);
      setMeta(res.data);
      speech.speak(res.data.text, 'q');
    } catch (e) {
      setError('The practice interviewer is unavailable right now. Try again in a moment.');
    }
    setBusy(false);
  }, [jobId, speech]);

  useEffect(() => {
    getOr(`/market/jobs/${jobId}`, MOCK_JOB_DETAIL, d => d && d.job).then(d => setJob(d.job));
    ask([]);
  }, [jobId]);

  const answer = (text) => {
    const clean = (text || '').trim();
    if (!clean || busy) return;
    speech.stop();
    ask([...turnsRef.current, { role: 'candidate', text: clean }]);
  };
  const transcribe = async (blob) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'answer.webm');
      const res = await api.post('/learner/transcribe', form);
      setBusy(false);
      answer(res.data.transcript);
    } catch (e) {
      setBusy(false);
      setError('Couldn’t hear that. Try again, or type your answer.');
    }
  };
  const mic = useSpeechInput({ lang: bcp47, onFinal: answer, onAudio: transcribe });
  const last = [...turns].reverse().find(x => x.role === 'interviewer');

  return (
    <>
      <Link to={`/learn/market/${jobId}`} className="ln-link" style={{ alignSelf: 'flex-start' }}>← Back to the JD</Link>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">Interview practice</h1>
          <span className="ln-sub">{job ? `${job.title} · ${job.company_type}` : '…'} · Practice only — answers are not saved.</span>
        </div>
        {meta.question_number && <span className="ln-tag ln-tag-lg ln-tag-accent">Question {meta.question_number} of {meta.total}</span>}
      </header>

      <section className="ln-card ln-card-dark" style={{ alignItems: 'center', gap: 20, padding: '36px 24px' }}>
        <div className={`ln-orb-ring is-${mic.listening ? 'listening' : speech.speakingId ? 'speaking' : 'idle'}`} style={{ width: 160, height: 160 }}>
          <div style={{ width: 118, height: 118 }}><div className="ln-orb" style={{ width: 80, height: 80 }} /></div>
        </div>
        <p lang={bcp47} className="ln-caption-te" aria-live="polite">{mic.listening && mic.interim ? mic.interim : busy ? '…' : last?.text}</p>
        {!mic.listening && meta.caption_en && <p className="ln-caption-en">{meta.caption_en}</p>}
        {(error || mic.error) && <div className="ln-banner-check" role="alert" style={{ borderColor: 'var(--status-danger)', color: '#F5C8BD' }}>{error || mic.error}</div>}

        {meta.done ? (
          <button type="button" className="ln-btn ln-btn-amber" onClick={() => { setTurns([]); ask([]); }}><RotateCcw size={18} aria-hidden="true" />Practise again</button>
        ) : (
          <>
            {typing && (
              <div className="ln-typebar" style={{ maxWidth: 760 }}>
                <label htmlFor="ans" className="ln-sr">Type your answer</label>
                <textarea id="ans" rows={2} value={draft} disabled={busy} placeholder={t('session.typeHere')} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); answer(draft); setDraft(''); } }} />
                <button type="button" className="ln-btn ln-btn-amber ln-indic" onClick={() => { answer(draft); setDraft(''); }} disabled={busy || !draft.trim()}>{t('session.send')}</button>
              </div>
            )}
            <div className="ln-row" style={{ gap: 18 }}>
              <button type="button" className="ln-roundbtn" aria-label="Replay question" disabled={!last} onClick={() => last && speech.speak(last.text, 'q')}><RotateCcw size={20} aria-hidden="true" /></button>
              <button type="button" className={`ln-mic ${mic.listening ? 'is-listening' : ''}`} disabled={(busy && !mic.listening) || !mic.supported}
                aria-label={mic.listening ? t('session.tapStop') : t('session.tapSpeak')} aria-pressed={mic.listening}
                onClick={() => (mic.listening ? mic.stop() : (speech.stop(), mic.start()))}><Mic size={30} aria-hidden="true" /></button>
              <button type="button" className="ln-roundbtn" aria-label="Switch to typing" aria-pressed={typing} onClick={() => setTyping(v => !v)}><Keyboard size={20} aria-hidden="true" /></button>
            </div>
          </>
        )}
      </section>

      {turns.length > 0 && (
        <section className="ln-card">
          <h2 className="ln-h2">Transcript</h2>
          {turns.map((x, i) => (
            <div key={i} className={`ln-msg ${x.role === 'candidate' ? 'is-you' : ''}`}>
              <span className="ln-msg-who">{x.role === 'candidate' ? 'You' : 'Interviewer'}</span>
              <div className="ln-bubble" lang={bcp47} style={{ maxWidth: 640 }}>{x.text}</div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
