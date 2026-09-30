// src/components/learn/LearningCurve.js — learning-curve signals (v4.3 §12.3):
// progress vs active hours against the cohort median, loops per node with
// its trend, and the test-out / review / assurance rates. Plain SVG.
import React from 'react';

const W = 560; const H = 220; const PAD = { l: 40, r: 12, t: 12, b: 30 };

function Line({ points, maxX, color, dash }) {
  if (!points || points.length < 2) return null;
  const x = (h) => PAD.l + (h / maxX) * (W - PAD.l - PAD.r);
  const y = (p) => PAD.t + (1 - p / 100) * (H - PAD.t - PAD.b);
  const d = points.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.hours).toFixed(1)},${y(pt.progress).toFixed(1)}`).join(' ');
  return <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray={dash} strokeLinejoin="round" />;
}

export default function LearningCurve({ data }) {
  if (!data) return null;
  const maxX = Math.max(1, ...data.points.map(p => p.hours), ...(data.cohort_median?.points || []).map(p => p.hours));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxX * f * 10) / 10);
  const maxLoops = Math.max(1, ...data.loops.map(l => l.loops));
  const rate = (v) => (v == null ? '—' : `${v}%`);
  return (
    <div className="ln-col" style={{ gap: 18 }}>
      <figure className="ln-col" style={{ gap: 8, margin: 0 }}>
        <figcaption className="ln-between ln-wrap" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Path mastered vs active hours</span>
          <span className="ln-row ln-small" style={{ gap: 14 }}>
            <span className="ln-row" style={{ gap: 6 }}><span aria-hidden="true" style={{ width: 18, height: 3, background: 'var(--accent-700)', display: 'inline-block' }} />This learner</span>
            <span className="ln-row" style={{ gap: 6 }}><span aria-hidden="true" style={{ width: 18, height: 0, borderTop: '2px dashed var(--color-text-muted)', display: 'inline-block' }} />Cohort median ({data.cohort_median?.learners || 0})</span>
          </span>
        </figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Progress ${data.points[data.points.length - 1].progress}% after ${data.points[data.points.length - 1].hours} active hours`} style={{ width: '100%', height: 'auto', maxHeight: 260 }}>
          {[0, 25, 50, 75, 100].map(p => {
            const yy = PAD.t + (1 - p / 100) * (H - PAD.t - PAD.b);
            return <g key={p}><line x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} stroke="var(--color-border)" /><text x={PAD.l - 6} y={yy + 4} textAnchor="end" fontSize="11" fill="var(--color-text-muted)">{p}%</text></g>;
          })}
          {ticks.map(t => <text key={t} x={PAD.l + (t / maxX) * (W - PAD.l - PAD.r)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">{t}h</text>)}
          <Line points={data.cohort_median?.points} maxX={maxX} color="var(--color-text-muted)" dash="5 4" />
          <Line points={data.points} maxX={maxX} color="var(--accent-700)" />
        </svg>
      </figure>

      <div className="ln-col" style={{ gap: 8 }}>
        <div className="ln-between ln-wrap"><span style={{ fontWeight: 600 }}>Loops per mastered node</span><span className="ln-small ln-muted">{data.loops_trend_label}</span></div>
        {data.loops.length === 0 ? <span className="ln-small ln-muted">No nodes mastered yet.</span> : (
          <div className="ln-col" style={{ gap: 6 }}>
            {data.loops.map((l, i) => (
              <div key={`${l.node}-${i}`} className="ln-row" style={{ gap: 10 }}>
                <span className="ln-small" style={{ width: 170, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.node}>{l.node}</span>
                <div style={{ flex: 1, background: 'var(--color-surface-2)', borderRadius: 6, height: 12 }}>
                  <div style={{ width: `${Math.max(3, (l.loops / maxLoops) * 100)}%`, height: 12, borderRadius: 6, background: 'var(--accent-400)' }} />
                </div>
                <span className="ln-small" style={{ width: 24, textAlign: 'right' }}>{l.loops}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ln-grid ln-g-4" style={{ gap: 10 }}>
        {[['Test-out rate', rate(data.rates.test_out_rate)], ['Review pass rate', rate(data.rates.review_pass_rate)], ['Checks at A1+ (own words)', rate(data.rates.checks_at_a1_plus)], ['Checks at A2+ (challenge)', rate(data.rates.checks_at_a2_plus)]].map(([k, v]) => (
          <div key={k} className="ln-tile ln-col" style={{ gap: 2 }}><span className="ln-xs ln-muted">{k}</span><span style={{ fontSize: 20, fontWeight: 700 }}>{v}</span></div>
        ))}
      </div>
    </div>
  );
}
