// scripts/voice-prerender.js — npm run voice:prerender [-- --dry] [--from N] [--kinds listen,notes,scripted]
// Records the fixed lesson audio into tts_cache (see core/voice/prerender.js).
// Needs the voice key (GEMINI_API_KEY_2, or any key) and the deployment's
// database. Safe to run again: recorded clips are skipped. --dry lists what
// would be recorded (clips and characters) without calling the voice.
import 'dotenv/config';
import { clips, run } from '../core/voice/prerender.js';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const kinds = opt('kinds') ? opt('kinds').split(',') : undefined;

if (args.includes('--dry')) {
  const list = clips({ kinds });
  const by = {};
  for (const c of list) { const k = `${c.kind} ${c.mode}`; by[k] = by[k] || { clips: 0, chars: 0 }; by[k].clips += 1; by[k].chars += c.text.length; }
  console.table(by);
  console.log(`${list.length} clips, ${list.reduce((a, c) => a + c.text.length, 0)} characters`);
  process.exit(0);
}
let from = Number(opt('from')) || 0;
let total = { recorded: 0, skipped: 0, chars: 0 };
for (;;) {
  const r = await run({ from, kinds, budgetMs: 10 * 60 * 1000, onProgress: (p) => { if (p.index % 20 === 0) console.log(`${p.index}/${p.total} · recorded ${total.recorded + p.recorded} · ${p.clip}`); } });
  total = { recorded: total.recorded + r.recorded, skipped: total.skipped + r.skipped, chars: total.chars + r.chars };
  from = r.next;
  if (r.stopped !== 'time') {
    console.log(`Done: ${total.recorded} recorded, ${total.skipped} already there, ${total.chars} characters.${r.stopped ? ` Stopped (${r.stopped}) at ${r.next}/${r.total}: run again later with --from ${r.next}.` : ''}`);
    process.exit(0);
  }
}
