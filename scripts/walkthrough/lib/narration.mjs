// Narration audio through the app's own voice pipeline (POST /api/learner/tts:
// the key pool → Cloud TTS Chirp 3 HD en-IN → Gemini TTS), as a test learner
// signed in off camera. Clips are cached by text. When no server voice
// answers, the videos are subtitle-only and the report says so.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { BASE, BYPASS, CACHE, FFPROBE, devPasscode, playwright } from './config.mjs';

const DIR = path.join(CACHE, 'narration');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const sayId = (en) => crypto.createHash('sha1').update(en).digest('hex').slice(0, 12);

export function duration(file) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim();
  return Number(out) || 0;
}
// Without a voice the line is read as a subtitle: time to read it comfortably.
const estimate = (text) => Math.max(2.4, text.split(/\s+/).length / 2.3 + 0.8);

/** All say lines of the given scenes → { [id]: { file, dur, engine } }. */
export async function prepareNarration(scenes, { log = console.log, subtitlesOnly = false } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  const lines = [];
  for (const sc of scenes) for (const s of sc.steps) if (s.say) { s.say.id = s.say.id || sayId(s.say.en); lines.push(s.say); }
  const out = {};
  const engines = new Set();
  let req = null; let token = null; let failed = 0;
  for (const line of lines) {
    if (out[line.id]) continue;
    const file = path.join(DIR, `${line.id}.wav`);
    const meta = `${file}.json`;
    if (!subtitlesOnly && fs.existsSync(file) && fs.existsSync(meta)) {
      const m = JSON.parse(fs.readFileSync(meta, 'utf8'));
      out[line.id] = { file, dur: duration(file), engine: m.engine };
      engines.add(m.engine);
      continue;
    }
    if (subtitlesOnly || failed >= 3) { out[line.id] = { file: null, dur: estimate(line.en), engine: null }; continue; }
    if (!req) {
      const { request } = playwright();
      req = await request.newContext({ extraHTTPHeaders: BYPASS || undefined });
      await req.post(`${BASE}/api/dev/unlock`, { data: { passcode: devPasscode() } });
      const r = await req.post(`${BASE}/api/dev/login`, { data: { account_key: 'learner_te' } });
      if (!r.ok()) throw new Error(`narration: test learner sign-in failed (${r.status()})`);
      token = (await r.json()).token;
    }
    let done = false;
    for (let attempt = 0; attempt < 6 && !done; attempt += 1) {
      const r = await req.post(`${BASE}/api/learner/tts`, { data: { text: line.en, lang: 'english' }, headers: { Authorization: `Bearer ${token}` }, timeout: 90000 }).catch(e => ({ ok: () => false, status: () => 0, err: e }));
      if (r.ok()) {
        const buf = await r.body();
        const engine = r.headers()['x-voice-engine'] || 'server';
        const ext = buf.slice(0, 4).toString() === 'RIFF' ? 'wav' : 'mp3';
        const tmp = `${file}.${ext}`;
        fs.writeFileSync(tmp, buf);
        // Normalise to 48 kHz stereo WAV for the mix.
        execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-ar', '48000', '-ac', '2', file]);
        fs.rmSync(tmp);
        fs.writeFileSync(meta, JSON.stringify({ engine, text: line.en }));
        out[line.id] = { file, dur: duration(file), engine };
        engines.add(engine);
        done = true;
        log(`  narration ${line.id} ${out[line.id].dur.toFixed(1)} s (${engine})`);
      } else if (r.status() === 429) {
        const wait = Number(r.headers?.()['retry-after'] || 20);
        await sleep(Math.min(65, wait) * 1000);
      } else {
        log(`  narration ${line.id}: voice answered ${r.status()}`);
        await sleep(2000);
        if (attempt >= 1) break;
      }
    }
    if (!done) { failed += 1; out[line.id] = { file: null, dur: estimate(line.en), engine: null }; }
    await sleep(2100); // the learner's 30-a-minute request limit
  }
  if (req) await req.dispose();
  // One voice for the whole run: if any line could not be voiced, every line
  // is a subtitle (half-voiced videos would be worse). Voiced clips stay cached.
  if (failed || subtitlesOnly) {
    for (const [id, l] of Object.entries(out)) {
      const text = lines.find(x => x.id === id)?.en || '';
      out[id] = { file: null, dur: estimate(text), engine: null };
    }
    if (failed) log(`  narration: ${failed} line(s) could not be voiced (voice quota); this run is subtitle-only.`);
    return { lines: out, engines: [], subtitleOnly: true };
  }
  return { lines: out, engines: [...engines], subtitleOnly: !engines.size };
}
