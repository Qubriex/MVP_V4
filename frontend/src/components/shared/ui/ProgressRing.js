// A circular progress ring with the number in the middle. The ring is drawn;
// the meaning is in the label (read out as an image description).
import React from 'react';

export default function ProgressRing({ pct = 0, size = 96, stroke = 9, label, children }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ui-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ui-ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ui-ring-bar"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ui-ring-text" aria-hidden="true">{children ?? `${p}%`}</span>
    </div>
  );
}
