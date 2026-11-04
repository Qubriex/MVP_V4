// src/utils/recording.js — recording mode for the walkthrough videos
// (scripts/walkthrough). Opening any page with ?record=1 turns it on for this
// browser tab (?record=0 turns it off). It only hides internal tools — the
// developer bar and "Test data only" badges — and those exist only for
// test-tenant (/dev) sessions, so a real account is never affected.
const KEY = 'qbx_record';

export function isRecording() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('record');
    if (q === '1') window.sessionStorage.setItem(KEY, '1');
    if (q === '0') window.sessionStorage.removeItem(KEY);
    return window.sessionStorage.getItem(KEY) === '1';
  } catch { return false; }
}
