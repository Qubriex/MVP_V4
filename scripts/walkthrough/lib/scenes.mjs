// Loads every scene file (scenes/*.js), in file order, and gives each
// narration line its id (a hash of the English text).
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { sayId } from './narration.mjs';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scenes');

export async function loadScenes() {
  const files = fs.readdirSync(DIR).filter(f => /\.js$/.test(f)).sort();
  const out = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(DIR, f)).href);
    for (const sc of mod.default) {
      sc.file = f;
      for (const s of sc.steps) if (s.say) s.say.id = sayId(s.say.en);
      out.push(sc);
    }
  }
  const ids = new Set();
  for (const sc of out) { if (ids.has(sc.id)) throw new Error(`Two scenes have the id ${sc.id}`); ids.add(sc.id); }
  return out;
}
