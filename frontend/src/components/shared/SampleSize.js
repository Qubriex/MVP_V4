// src/components/shared/SampleSize.js — numbers about people say how many
// people they rest on. Under 5: hidden to protect privacy ("Too few to
// show"). Under 20: shown with a "Small sample" tag.
import React from 'react';
import { EyeOff } from 'lucide-react';
import { Popover } from './Popover';

import { useUiLang } from '../../context/UiLangContext';
export const MIN_SHOWN = 5;
export const SMALL = 20;

export function SmallSample({ n }) {
  const { t } = useUiLang();
  if (n == null || n >= SMALL || n < MIN_SHOWN) return null;
  return (
    <Popover trigger="Small sample" triggerClass="sk-small" title={t('shared.sampleSize.smallSample')}>
      {t('shared.sampleSize.basedN', { n })} {n === 1 ? t('shared.sampleSize.person') : t('shared.sampleSize.people')}{t('shared.sampleSize.treatCareOneTwo')}
    </Popover>
  );
}

/** Renders children only when n ≥ 5; otherwise the privacy card. */
export function TooFew({ n, children, compact = false }) {
  const { t } = useUiLang();
  if (n != null && n < MIN_SHOWN) {
    return compact
      ? <span className="sk-toofew-inline" title={t('shared.sampleSize.fewerThan5People')}>{t('shared.sampleSize.tooFewShow')}</span>
      : (
        <div className="sk-toofew" role="note">
          <EyeOff size={18} aria-hidden="true" />
          <b>{t('shared.sampleSize.tooFewShow')}</b>
          <span>{t('shared.sampleSize.fewerThan5People')}</span>
        </div>
      );
  }
  return children;
}
