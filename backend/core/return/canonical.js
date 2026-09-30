// core/return/canonical.js — JSON Canonicalization Scheme (RFC 8785).
// Object members sorted by UTF-16 code units, no whitespace, numbers in the
// ECMAScript shortest round-trip form (JSON.stringify), strings escaped as
// JSON.stringify does. Used before every hash and signature (v4.3 §9.3).
export function canonicalize(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('RFC 8785: non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(v => (v === undefined ? 'null' : canonicalize(v))).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  throw new Error(`RFC 8785: cannot canonicalize ${typeof value}`);
}

export const canonicalBytes = (value) => Buffer.from(canonicalize(value), 'utf8');
