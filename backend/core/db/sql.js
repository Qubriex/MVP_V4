// core/db/sql.js
// Turns the SQL the app writes into PostgreSQL wire form:
//   ?            → $1, $2, …   (positional parameters, in order)
//   @name        → $n          (named parameters, when a single object is passed)
//   INSERT OR IGNORE INTO …  → INSERT INTO … ON CONFLICT DO NOTHING
// String literals, quoted identifiers and comments are left untouched.
// Results are cached per statement text.

const cache = new Map();

function scan(sql) {
  let out = '';
  let n = 0;
  const names = [];
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue; } break; }
        j += 1;
      }
      out += sql.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '-' && sql[i + 1] === '-') {
      const j = sql.indexOf('\n', i); const end = j === -1 ? sql.length : j;
      out += sql.slice(i, end); i = end; continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const j = sql.indexOf('*/', i + 2); const end = j === -1 ? sql.length : j + 2;
      out += sql.slice(i, end); i = end; continue;
    }
    if (c === '?') { n += 1; out += `$${n}`; i += 1; continue; }
    if (c === '@' && /[A-Za-z_]/.test(sql[i + 1] || '')) {
      let j = i + 1;
      while (j < sql.length && /\w/.test(sql[j])) j += 1;
      const name = sql.slice(i + 1, j);
      let k = names.indexOf(name);
      if (k === -1) { names.push(name); k = names.length - 1; }
      out += `$${k + 1}`; i = j; continue;
    }
    // PostgreSQL casts (::type) are passed through.
    out += c; i += 1;
  }
  return { text: out, positional: n, names };
}

export function translate(sql) {
  let hit = cache.get(sql);
  if (hit) return hit;
  let text = sql;
  let ignore = false;
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(text)) {
    text = text.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');
    ignore = true;
  }
  const s = scan(text);
  let out = s.text;
  if (ignore) out = `${out.replace(/;\s*$/, '').trimEnd()} ON CONFLICT DO NOTHING`;
  hit = { text: out, positional: s.positional, names: s.names };
  cache.set(sql, hit);
  return hit;
}

/** Builds the value array for a translated statement. */
export function bind(t, params) {
  if (t.names.length) {
    const obj = params[0] || {};
    return t.names.map(k => norm(obj[k]));
  }
  if (params.length !== t.positional) {
    throw new Error(`SQL expects ${t.positional} parameter(s), got ${params.length}: ${t.text.slice(0, 120)}`);
  }
  return params.map(norm);
}

// undefined → NULL (better-sqlite3 rejected it; Postgres drivers need null).
// Booleans are stored as 0/1 in INTEGER columns, as before.
const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
