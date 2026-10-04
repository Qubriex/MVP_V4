// src/components/learn/VoiceStatus.js
// The same voice message and Replay button on every page that speaks
// (lesson, JD reading, topic intro, interview practice). Says why she is
// silent — busy voice, audio blocked by the browser, or no voice on this
// deployment — and, when the reply could not be spoken, shows its text.
import React from 'react';
import { RotateCcw } from 'lucide-react';

export default function VoiceStatus({ speech, text, dark = false, lang }) {
  if (!speech.voiceIssue) return null;
  const canReplay = speech.issue !== 'none' && speech.hasLast();
  return (
    <div className={`ln-voice-status ${dark ? 'is-dark' : ''}`} role="status">
      <div className="ln-row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <span style={{ flex: 1 }}>{speech.voiceIssue}</span>
        {canReplay && <button type="button" className={`ln-btn ln-btn-sm ${dark ? 'ln-btn-ghost-dark' : ''}`} onClick={speech.replay}><RotateCcw size={14} aria-hidden="true" />Replay</button>}
      </div>
      {text && speech.issue !== 'tap' && <p lang={lang} className="ln-indic" style={{ margin: 0, lineHeight: 1.6 }}>{text}</p>}
    </div>
  );
}
