// src/utils/errors.js — one way to read API errors. Legacy routes answer
// {error: "text"}; v4.3.1 routes answer {error: {code, message}}.
export function errMsg(e, fallback = 'Something went wrong. Please try again.') {
  const err = e?.response?.data?.error;
  if (!err) return e?.response ? fallback : 'Could not reach the server. Check your connection.';
  return typeof err === 'string' ? err : err.message || fallback;
}
