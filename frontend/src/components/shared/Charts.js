// src/components/shared/Charts.js — the shared chart style for learner pages:
// thin horizontal bars (they fit a phone), a labelled value axis, values
// written at each bar so colour is never the only cue, a tooltip on hover or
// keyboard focus, a legend when there is more than one series, and a table
// view for screen readers. Series colours (--viz-1..3 in learner.css) passed
// the colour-blind checks in light and dark.
import React, { useState } from 'react';

const ticksFor = (max, step) => Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);

function Tip({ tip }) {
  if (!tip) return null;
  return <div className="viz-tip" role="status" style={{ left: `${tip.x}%` }}>{tip.text}</div>;
}

/**
 * Floating bars from min to max on one value axis, with a tick at the middle.
 * rows: [{ key, label, min, max, mid, note }]
 */
export function RangeBars({ rows, axisLabel, unit = '', step = 2, ariaLabel, format = (v) => `${v}${unit}`, tableHeads }) {
  const [tip, setTip] = useState(null);
  const top = Math.max(step, Math.ceil(Math.max(...rows.map(r => r.max)) / step) * step);
  const pct = (v) => (v / top) * 100;
  return (
    <figure className="viz" aria-label={ariaLabel}>
      <div className="viz-plot" role="img" aria-label={ariaLabel}>
        {rows.map(r => {
          const text = `${r.label}: ${format(r.min)} – ${format(r.max)}${r.note ? ` · ${r.note}` : ''}`;
          return (
            <div key={r.key} className="viz-row" data-viz-row={r.key}>
              <span className="viz-label">{r.label}</span>
              <div className="viz-track">
                {ticksFor(top, step).map(v => <i key={v} className="viz-grid" style={{ left: `${pct(v)}%` }} />)}
                <button type="button" className="viz-range" aria-label={text}
                  style={{ left: `${pct(r.min)}%`, width: `${Math.max(1.5, pct(r.max - r.min))}%` }}
                  onMouseEnter={() => setTip({ x: pct((r.min + r.max) / 2), text, key: r.key })} onFocus={() => setTip({ x: pct((r.min + r.max) / 2), text, key: r.key })}
                  onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}>
                  {r.mid != null && <i className="viz-mid" style={{ left: `${((r.mid - r.min) / Math.max(0.01, r.max - r.min)) * 100}%` }} />}
                </button>
                {tip?.key === r.key && <Tip tip={tip} />}
              </div>
              <span className="viz-value">{format(r.min)}–{format(r.max)}</span>
            </div>
          );
        })}
        <div className="viz-row viz-axis" aria-hidden="true">
          <span className="viz-label" />
          <div className="viz-track">{ticksFor(top, step).map(v => <span key={v} style={{ left: `${pct(v)}%` }}>{format(v)}</span>)}</div>
          <span className="viz-value" />
        </div>
        <div className="viz-axis-title" aria-hidden="true">{axisLabel}</div>
      </div>
      {tableHeads && (
        <div className="ln-sr-only"><table>
          <thead><tr>{tableHeads.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r.key}><td>{r.label}</td><td>{format(r.min)}</td><td>{format(r.max)}</td><td>{r.mid != null ? format(r.mid) : ''}</td></tr>)}</tbody>
        </table></div>
      )}
    </figure>
  );
}

/**
 * Grouped horizontal bars: one group per row, one bar per series, on a 0–max axis.
 * series: [{ key, label }]; rows: [{ key, label, values: { [seriesKey]: number } }]
 */
export function GroupedBars({ rows, series, max = 100, step = 25, axisLabel, ariaLabel }) {
  const [tip, setTip] = useState(null);
  const pct = (v) => (Math.min(max, Math.max(0, v)) / max) * 100;
  return (
    <figure className="viz" aria-label={ariaLabel}>
      <div className="viz-legend ln-xs" data-viz-legend>
        {series.map((s, i) => <span key={s.key}><i className={`viz-swatch viz-c${i + 1}`} />{s.label}</span>)}
      </div>
      <div className="viz-plot" role="img" aria-label={ariaLabel}>
        {rows.map(r => (
          <div key={r.key} className="viz-row viz-group" data-viz-row={r.key}>
            <span className="viz-label">{r.label}</span>
            <div className="viz-bars">
              {series.map((s, i) => {
                const v = r.values[s.key];
                const text = `${r.label} · ${s.label}: ${v}`;
                const id = `${r.key}:${s.key}`;
                return (
                  <div key={s.key} className="viz-track">
                    {ticksFor(max, step).map(g => <i key={g} className="viz-grid" style={{ left: `${pct(g)}%` }} />)}
                    <button type="button" className={`viz-bar viz-c${i + 1}`} style={{ width: `${pct(v)}%` }} aria-label={text}
                      onMouseEnter={() => setTip({ x: pct(v) / 2, text, id })} onFocus={() => setTip({ x: pct(v) / 2, text, id })}
                      onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)} />
                    <span className="viz-barvalue" style={{ left: `calc(${pct(v)}% + 4px)` }}>{v}</span>
                    {tip?.id === id && <Tip tip={tip} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="viz-row viz-group viz-axis" aria-hidden="true">
          <span className="viz-label" />
          <div className="viz-bars"><div className="viz-track">{ticksFor(max, step).map(v => <span key={v} style={{ left: `${pct(v)}%` }}>{v}</span>)}</div></div>
        </div>
        <div className="viz-axis-title" aria-hidden="true">{axisLabel}</div>
      </div>
      <div className="ln-sr-only"><table>
        <thead><tr><th />{series.map(s => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={r.key}><th>{r.label}</th>{series.map(s => <td key={s.key}>{r.values[s.key]}</td>)}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}
