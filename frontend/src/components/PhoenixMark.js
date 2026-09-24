// src/components/PhoenixMark.js
// Placeholder brand mark — an abstract twin-wing flame shape built from the
// accent gradient tokens, standing in for the real phoenix logo file until
// it's added to the repo (e.g. public/phoenix-logo.png). To swap it in,
// replace the <svg> below with an <img src="/phoenix-logo.png" ... /> —
// nothing else in NavBar/Footer needs to change since they just render
// <PhoenixMark size={..} />.
import React from 'react';

export default function PhoenixMark({ size = 28 }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 48 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="phoenixGradA" x1="2" y1="2" x2="24" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-400)" />
          <stop offset="55%" stopColor="var(--accent-600)" />
          <stop offset="100%" stopColor="var(--accent-900)" />
        </linearGradient>
        <linearGradient id="phoenixGradB" x1="46" y1="2" x2="24" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-400)" />
          <stop offset="55%" stopColor="var(--accent-600)" />
          <stop offset="100%" stopColor="var(--accent-900)" />
        </linearGradient>
      </defs>
      <path d="M24 37C13 30 2.5 21 2 3C10.5 13.5 18 19.5 24 23.5C24.5 27.5 24.2 33 24 37Z" fill="url(#phoenixGradA)" />
      <path d="M24 37C35 30 45.5 21 46 3C37.5 13.5 30 19.5 24 23.5C23.5 27.5 23.8 33 24 37Z" fill="url(#phoenixGradB)" />
    </svg>
  );
}
