// core/util/seq.js — array helpers for async callbacks, run one at a time.
// Database calls are async, so `rows.map(r => lookup(r))` must await each
// lookup. These run the callback sequentially (never in parallel), which keeps
// statement order deterministic and is safe inside a transaction.
export async function mapSeq(arr, fn) {
  const out = [];
  let i = 0;
  for (const x of arr) out.push(await fn(x, i++, arr));
  return out;
}
export async function eachSeq(arr, fn) {
  let i = 0;
  for (const x of arr) await fn(x, i++, arr);
}
export async function filterSeq(arr, fn) {
  const out = [];
  let i = 0;
  for (const x of arr) if (await fn(x, i++, arr)) out.push(x);
  return out;
}
export async function someSeq(arr, fn) {
  let i = 0;
  for (const x of arr) if (await fn(x, i++, arr)) return true;
  return false;
}
export async function everySeq(arr, fn) {
  let i = 0;
  for (const x of arr) if (!(await fn(x, i++, arr))) return false;
  return true;
}
export async function findSeq(arr, fn) {
  let i = 0;
  for (const x of arr) if (await fn(x, i++, arr)) return x;
  return undefined;
}
export async function flatMapSeq(arr, fn) {
  return (await mapSeq(arr, fn)).flat();
}
export async function reduceSeq(arr, fn, init) {
  let acc = init;
  let i = 0;
  for (const x of arr) acc = await fn(acc, x, i++, arr);
  return acc;
}
