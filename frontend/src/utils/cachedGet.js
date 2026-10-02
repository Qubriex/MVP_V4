// src/utils/cachedGet.js
// Stale-while-revalidate GETs for staff pages. A page that was seen before
// renders at once from memory, then refreshes quietly; state only changes when
// the data actually changed, so nothing flickers or jumps back to "Loading…".
// Requests for the same URL in flight at once are shared.
import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';

const cache = new Map();   // url → { data, at }
const inflight = new Map(); // url → Promise

export function fetchCached(url) {
  if (inflight.has(url)) return inflight.get(url);
  const p = api.get(url).then(r => { cache.set(url, { data: r.data, at: Date.now() }); return r.data; })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export const peekCached = (url) => cache.get(url)?.data;
export const dropCached = (prefix) => { [...cache.keys()].forEach(k => { if (k.startsWith(prefix)) cache.delete(k); }); };

/**
 * @param {string|null} url  null skips the request
 * @param {{ refreshMs?: number }} opts  poll interval (0 = no polling)
 */
export function useCachedGet(url, { refreshMs = 0 } = {}) {
  const [data, setData] = useState(() => (url ? peekCached(url) : undefined));
  const [error, setError] = useState(null);
  const last = useRef(data ? JSON.stringify(data) : '');

  const load = useCallback(() => {
    if (!url) return Promise.resolve();
    return fetchCached(url).then(d => {
      const s = JSON.stringify(d);
      if (s !== last.current) { last.current = s; setData(d); }
      setError(null);
    }).catch(e => setError(e));
  }, [url]);

  useEffect(() => {
    const cached = url ? peekCached(url) : undefined;
    last.current = cached ? JSON.stringify(cached) : '';
    setData(cached);
    load();
    if (!refreshMs || !url) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, refreshMs);
    return () => clearInterval(t);
  }, [url, refreshMs, load]);

  return { data, error, reload: load, loading: data === undefined && !error };
}
