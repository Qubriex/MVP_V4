// core/qep/statusList.js — Bitstring Status List (v4.3 §9.3): one bit per
// credential for revocation (and one list for suspension). The encoded list
// is GZIP-compressed and base64url-encoded; verifiers may cache it ≤ 24 h.
import zlib from 'zlib';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';

const SIZE = 131072; // bits (16 KiB), the W3C minimum for herd privacy

async function ensureList(purpose) {
  let row = await dal.one("SELECT * FROM status_lists WHERE purpose = ? AND next_index < ? ORDER BY created_at LIMIT 1", purpose, SIZE);
  if (!row) {
    const id = ulid();
    await dal.run('INSERT INTO status_lists (id, purpose, bits, next_index, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
      id, purpose, Buffer.alloc(SIZE / 8), dal.nowIso(), dal.nowIso());
    row = await dal.one('SELECT * FROM status_lists WHERE id = ?', id);
  }
  return row;
}

/** Allocate the next index on the current revocation list. */
// The increment and the read are one statement, so concurrent issuers never
// share an index.
export async function allocate(purpose = 'revocation') {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await ensureList(purpose);
    const got = await dal.one(`UPDATE status_lists SET next_index = next_index + 1, updated_at = ?
      WHERE id = ? AND next_index < ? RETURNING next_index - 1 AS idx`, dal.nowIso(), row.id, SIZE);
    if (got) return { listId: row.id, index: got.idx };
  }
  throw new Error('Could not allocate a status-list index');
}

// Read-modify-write under a row lock, so two revocations never lose a bit.
export async function setBit(listId, index, on = true) {
  await dal.tx(async () => {
    const row = await dal.one('SELECT bits FROM status_lists WHERE id = ? FOR UPDATE', listId);
    const bits = Buffer.from(row.bits);
    const byte = Math.floor(index / 8); const mask = 1 << (7 - (index % 8));
    bits[byte] = on ? bits[byte] | mask : bits[byte] & ~mask;
    await dal.run('UPDATE status_lists SET bits = ?, updated_at = ? WHERE id = ?', bits, dal.nowIso(), listId);
  });
}

export async function getBit(listId, index) {
  const row = await dal.one('SELECT bits FROM status_lists WHERE id = ?', listId);
  if (!row) return null;
  return (Buffer.from(row.bits)[Math.floor(index / 8)] >> (7 - (index % 8))) & 1;
}

export async function encodedList(listId) {
  const row = await dal.one('SELECT * FROM status_lists WHERE id = ?', listId);
  if (!row) return null;
  return {
    id: listId, type: 'BitstringStatusList', statusPurpose: row.purpose,
    encodedList: zlib.gzipSync(Buffer.from(row.bits)).toString('base64url'), updated_at: row.updated_at
  };
}
