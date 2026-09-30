// src/components/learn/AnswerBox.js
// Answer a review, recheck or renewal question (v4.3 §7.11, §19). Typing
// tracks pasted text; speaking fills an editable transcript that must be
// submitted explicitly. Only the counts go to the server as provenance.
import React, { useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { speechTag } from '../../context/UiLangContext';
import { useSpeechInput } from '../../utils/voice';
import { newTracker, recordPaste, provenanceFor } from '../../utils/provenance';
import { useLowBandwidth, recorderOptions } from '../../utils/lowBandwidth';
import api from '../../utils/api';

export default function AnswerBox({ onSubmit, busy, submitLabel = 'Submit answer' }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [lowBw] = useLowBandwidth();
  const tracker = useRef(newTracker());

  const addSpoken = (spoken) => {
    const t = tracker.current;
    tracker.current = { ...t, mode: 'voice', original: `${t.original ? `${t.original} ` : ''}${spoken}`.trim() };
    setText(prev => `${prev ? `${prev} ` : ''}${spoken}`.trim());
    setNote('Check the transcript, fix anything misheard, then submit.');
  };
  const mic = useSpeechInput({
    lang: speechTag(user?.language || 'telugu'),
    onFinal: addSpoken,
    onAudio: async (blob) => {
      setNote('Transcribing…');
      try {
        const form = new FormData();
        form.append('audio', blob, 'answer.webm');
        const r = await api.post('/learner/transcribe', form);
        addSpoken(r.data.transcript || '');
      } catch { setNote('Could not transcribe. Type your answer instead.'); }
    },
    recorder: recorderOptions(lowBw)
  });

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const provenance = provenanceFor(tracker.current, text);
    tracker.current = newTracker();
    onSubmit(text.trim(), provenance, () => setText(''));
  };

  return (
    <form className="ln-col" style={{ gap: 10 }} onSubmit={submit}>
      <label className="ln-label" htmlFor="answer">Your answer</label>
      <textarea id="answer" className="ln-textarea" rows={5} value={text} disabled={busy}
        onChange={e => setText(e.target.value)}
        onPaste={e => { tracker.current = recordPaste(tracker.current, e.clipboardData.getData('text')); }}
        placeholder="Explain in your own words. Speaking is fine — press the mic." />
      {note && <span className="ln-small ln-muted" role="status">{note}</span>}
      {mic.error && <span className="ln-small" role="alert" style={{ color: 'var(--status-danger)' }}>{mic.error}</span>}
      <div className="ln-row ln-wrap" style={{ gap: 10 }}>
        {mic.supported && (
          <button type="button" className="ln-btn" onClick={() => (mic.listening ? mic.stop() : mic.start())} aria-pressed={mic.listening}>
            {mic.listening ? <Square size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}{mic.listening ? 'Stop' : 'Speak'}
          </button>
        )}
        <button type="submit" className="ln-btn ln-btn-primary" disabled={busy || !text.trim()}>{busy ? 'Checking…' : submitLabel}</button>
      </div>
      <span className="ln-xs ln-muted">Answers must be your own words. Pasted text or an edited-away transcript is not counted as evidence.</span>
    </form>
  );
}
