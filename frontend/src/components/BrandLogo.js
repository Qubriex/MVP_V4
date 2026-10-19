// src/components/BrandLogo.js — the Qubirex logo, from the files in
// public/brand/ (never redrawn, recoloured or cropped). variant="full" is
// the mark with the wordmark; variant="mark" is the flame alone. The tagline
// line in the artwork is unreadable below about 56 px, so smaller logos use
// the same artwork without it (public/brand/qubirex-logo-notag-*) and pages
// show the tagline as real text where it matters (footer, sign-in panels).
// tone="auto" follows the light/dark theme; tone="onDark" is for surfaces
// that are dark in both themes (the college sidebar, sign-in side panels).
import React from 'react';

import { useUiLang } from '../context/UiLangContext';
const SRC = {
  light: ['/brand/qubirex-logo-640.png', '/brand/qubirex-logo-1280.png'],
  dark: ['/brand/qubirex-logo-on-dark-640.png', '/brand/qubirex-logo-on-dark-1280.png']
};
const SRC_NOTAG = {
  light: ['/brand/qubirex-logo-notag-640.png', '/brand/qubirex-logo-notag-1280.png'],
  dark: ['/brand/qubirex-logo-notag-on-dark-640.png', '/brand/qubirex-logo-notag-on-dark-1280.png']
};
const RATIO = 1754 / 458; // width / height of the full logo

export default function BrandLogo({ variant = 'full', height = 36, tone = 'auto', tagline = height >= 56, className = '' }) {
  const { t } = useUiLang();
  if (variant === 'mark') {
    return <img src={height > 48 ? '/brand/qubirex-mark-192.png' : '/brand/qubirex-mark-64.png'} width={height} height={height} alt="Qubirex" className={`brand-logo ${className}`} />;
  }
  const w = Math.round(height * RATIO);
  const src = tagline ? SRC : SRC_NOTAG;
  const img = (set, cls) => <img src={set[0]} srcSet={`${set[0]} 1x, ${set[1]} 2x`} width={w} height={height} alt={t('ui.brandLogo.qubirexLanguageSkillsFuture')} className={`brand-logo ${cls} ${className}`} />;
  if (tone === 'onDark') return img(src.dark, '');
  return <>{img(src.light, 'brand-logo-light')}{img(src.dark, 'brand-logo-dark')}</>;
}
