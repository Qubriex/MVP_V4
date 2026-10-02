// core/curriculumText.js
// Text out of an uploaded curriculum file, so it can go into the new-cohort
// brief (the same box staff paste into). Plain text, Markdown and CSV are read
// directly; a Word file (.docx) is unzipped here and its paragraphs read; a
// PDF is transcribed by the model through the gateway. Nothing is stored.
import zlib from 'node:zlib';
import { generate } from './ai/gateway.js';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel request bodies stop at 4.5 MB
const MAX_CHARS = 60000;

// Minimal ZIP reader for one entry (central directory → local header → inflate).
function unzipEntry(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw Object.assign(new Error('Not a valid .docx file'), { status: 400 });
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28); const extraLen = buf.readUInt16LE(p + 30); const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw Object.assign(new Error('Not a valid .docx file'), { status: 400 });
}

const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function docxText(buf) {
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  return xml.split(/<\/w:p>/).map(p => decodeXml((p.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''))).filter(Boolean).join('\n');
}

/**
 * @param {{buffer: Buffer, filename?: string, mimeType?: string, institutionId?: string|null}} file
 * @returns {Promise<{text: string, truncated: boolean, kind: string}>}
 */
export async function extractCurriculumText({ buffer, filename = '', mimeType = '', institutionId = null }) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  let text; let kind;
  if (['txt', 'md', 'csv', 'tsv', 'json'].includes(ext) || /^text\//.test(mimeType)) {
    text = buffer.toString('utf8'); kind = 'text';
  } else if (ext === 'docx') {
    text = docxText(buffer); kind = 'docx';
  } else if (ext === 'pdf' || mimeType === 'application/pdf') {
    const r = await generate({
      task: 'CURR.extract_text', institutionId,
      system: 'You transcribe documents. Output only the text of the document, in reading order, with headings and list items on their own lines. Do not summarise or add anything.',
      input: 'Transcribe this curriculum document.',
      audio: { base64: buffer.toString('base64'), mimeType: 'application/pdf' },
      temperature: 0, maxTokens: 8192
    });
    text = r.text; kind = 'pdf';
  } else {
    throw Object.assign(new Error('Upload a .pdf, .docx, .txt, .md or .csv file'), { status: 415 });
  }
  text = String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw Object.assign(new Error('No text found in that file'), { status: 422 });
  return { text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS, kind };
}
