// src/components/BrandLogo.js — the Qubirex logo, from the files in
// public/brand/ (never redrawn, recoloured or cropped). variant="full" is
// the mark with the wordmark and tagline; variant="mark" is the flame alone.
// tone="auto" follows the light/dark theme; tone="onDark" is for surfaces
// that are dark in both themes (the college sidebar, sign-in side panels).
import React from 'react';

const SRC = {
  light: ['/brand/qubirex-logo-640.png', '/brand/qubirex-logo-1280.png'],
  dark: ['/brand/qubirex-logo-on-dark-640.png', '/brand/qubirex-logo-on-dark-1280.png']
};
const RATIO = 1754 / 458; // width / height of the full logo

export default function BrandLogo({ variant = 'full', height = 36, tone = 'auto', className = '' }) {
  if (variant === 'mark') {
    return <img src={height > 48 ? '/brand/qubirex-mark-192.png' : '/brand/qubirex-mark-64.png'} width={height} height={height} alt="Qubirex" className={`brand-logo ${className}`} />;
  }
  const w = Math.round(height * RATIO);
  const img = (set, cls) => <img src={set[0]} srcSet={`${set[0]} 1x, ${set[1]} 2x`} width={w} height={height} alt="Qubirex — Your Language. Your Skills. Your Future" className={`brand-logo ${cls} ${className}`} />;
  if (tone === 'onDark') return img(SRC.dark, '');
  return <>{img(SRC.light, 'brand-logo-light')}{img(SRC.dark, 'brand-logo-dark')}</>;
}
