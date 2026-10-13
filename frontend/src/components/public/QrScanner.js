// src/components/public/QrScanner.js — "Scan a Passport QR" on Verify.
// The camera is ALWAYS released: on Stop camera, on a successful read, when
// the page is left (unmount) and when the tab is hidden. The stream lives in a
// ref (not in the video element, which React clears before cleanup runs).
// Decoding uses the browser's BarcodeDetector where it exists; otherwise the
// small jsQR library, loaded only when needed.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode as QrIcon, VideoOff } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';

export const EVIDENCE_IN_QR = /QBX-[A-Z0-9-]+/i;

export default function QrScanner({ onCode }) {
  const { t } = useUiLang();
  const video = useRef(null);
  const canvas = useRef(null);
  const stream = useRef(null);
  const frame = useRef(0);
  const wanted = useRef(false); // false once stopped, even mid-permission-prompt
  const [state, setState] = useState('idle'); // idle | starting | scanning | denied | nocamera | unsupported

  const stop = useCallback((next = 'idle') => {
    wanted.current = false;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(tr => tr.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setState(next);
  }, []);

  // Leaving the page, or hiding the tab, turns the camera off.
  useEffect(() => {
    const onHide = () => { if (document.hidden && stream.current) stop(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      wanted.current = false;
      document.removeEventListener('visibilitychange', onHide);
      cancelAnimationFrame(frame.current);
      stream.current?.getTracks().forEach(tr => tr.stop());
      stream.current = null;
    };
  }, [stop]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return; }
    setState('starting');
    wanted.current = true;
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (e) {
      setState(e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'nocamera' : 'denied');
      return;
    }
    if (!wanted.current) { s.getTracks().forEach(tr => tr.stop()); return; }
    stream.current = s;
    const v = video.current;
    if (!v) { stop(); return; }
    v.srcObject = s;
    try { await v.play(); } catch { /* muted inline video plays; ignore */ }
    setState('scanning');
    const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    const jsQR = detector ? null : (await import('jsqr')).default;
    const read = async () => {
      if (!stream.current || !video.current) return;
      let raw = null;
      const el = video.current;
      if (detector) {
        const codes = await detector.detect(el).catch(() => []);
        raw = codes[0]?.rawValue || null;
      } else if (el.videoWidth) {
        const c = canvas.current; c.width = el.videoWidth; c.height = el.videoHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(el, 0, 0, c.width, c.height);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        raw = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
      }
      const m = raw && raw.match(EVIDENCE_IN_QR);
      if (m) { stop(); onCode(m[0].toUpperCase()); return; }
      frame.current = requestAnimationFrame(read);
    };
    frame.current = requestAnimationFrame(read);
  };

  const live = state === 'scanning' || state === 'starting';
  return (
    <div className="ln-col" style={{ gap: 8, width: '100%', maxWidth: 380 }}>
      {!live ? (
        <button type="button" className="ln-btn ln-btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={start}><QrIcon size={16} aria-hidden="true" />{t('verify.scan')}</button>
      ) : (
        <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => stop()}><VideoOff size={16} aria-hidden="true" />{t('verify.stopCamera')}</button>
      )}
      <video ref={video} playsInline muted aria-label={t('verify.cameraView')} style={{ display: live ? 'block' : 'none', width: '100%', borderRadius: 12, background: '#000' }} />
      <canvas ref={canvas} hidden />
      {state === 'scanning' && <span className="ln-xs ln-muted" aria-live="polite">{t('verify.pointCamera')}</span>}
      {state === 'denied' && <span className="ln-small" role="alert">{t('verify.cameraDenied')}</span>}
      {state === 'nocamera' && <span className="ln-small" role="alert">{t('verify.noCamera')}</span>}
      {state === 'unsupported' && <span className="ln-small" role="alert">{t('verify.cameraUnsupported')}</span>}
    </div>
  );
}
