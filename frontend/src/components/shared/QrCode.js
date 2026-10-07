// src/components/shared/QrCode.js — a QR code for a link (Passport verify
// links, the public verifier). Drawn on the device; nothing is sent anywhere.
import React, { useEffect, useState } from 'react';
import QR from 'qrcode';

export default function QrCode({ value, size = 160, label }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    QR.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' }).then(u => { if (live) setSrc(u); }).catch(() => setSrc(''));
    return () => { live = false; };
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} className="ln-skeleton" aria-hidden="true" />;
  return <img src={src} width={size} height={size} alt={label || `QR code for ${value}`} style={{ borderRadius: 8, background: '#fff' }} />;
}
