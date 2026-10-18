// Pill, BandPill and BandBar. Readiness bands use the same colours on every
// page: Ready = green · Nearly ready = amber · Building = blue · none = grey.
// Red is never a band colour (red means error, locked, revoked or overdue).
// The band name is always written, so colour never carries meaning alone.
import React from 'react';
import { useUiLang } from '../../../context/UiLangContext';

export function Pill({ tone = 'neutral', children, className = '', ...rest }) {
  return <span className={`ui-pill ui-pill-${tone} ${className}`} {...rest}>{children}</span>;
}

export const BAND_TONE = { ready: 'ok', nearly: 'warn', building: 'info', none: 'neutral' };

export function BandPill({ band = 'none', score, className = '' }) {
  const { t } = useUiLang();
  const b = BAND_TONE[band] ? band : 'none';
  return <Pill tone={BAND_TONE[b]} className={`ui-band ${className}`}>{score != null ? <b className="ui-num">{score}</b> : null}{t(`band.${b}`)}</Pill>;
}

/** Stacked bar of band counts, with the numbers written beside each part. */
export function BandBar({ counts, onSelect, label }) {
  const { t } = useUiLang();
  const order = ['ready', 'nearly', 'building', 'none'].filter(k => counts[k] != null);
  const total = order.reduce((a, k) => a + (counts[k] || 0), 0) || 1;
  return (
    <div className="ui-bandbar" role="group" aria-label={label || t('band.readiness')}>
      <div className="ui-bandbar-track">
        {order.map(k => counts[k] ? (
          <button key={k} type="button" className={`ui-bandbar-seg ui-tone-${BAND_TONE[k]}`} style={{ width: `${(counts[k] / total) * 100}%` }}
            onClick={onSelect ? () => onSelect(k) : undefined} disabled={!onSelect} aria-label={`${t(`band.${k}`)}: ${counts[k]}`} title={`${t(`band.${k}`)}: ${counts[k]}`} />
        ) : null)}
      </div>
      <div className="ui-bandbar-legend">
        {order.map(k => (
          <button key={k} type="button" className="ui-bandbar-key" onClick={onSelect ? () => onSelect(k) : undefined} disabled={!onSelect}>
            <span className={`ui-dot ui-tone-${BAND_TONE[k]}`} aria-hidden="true" />{t(`band.${k}`)} <b className="ui-num">{counts[k] || 0}</b>
          </button>
        ))}
      </div>
    </div>
  );
}
