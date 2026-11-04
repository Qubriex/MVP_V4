#!/usr/bin/env node
// npm run walkthrough:script — writes narration-script.md from the scene data
// (the one source of the words): English spoken, Telugu and Hindi subtitles.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OUT } from './lib/config.mjs';
import { loadScenes } from './lib/scenes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const scenes = await loadScenes();
const names = { 1: 'Chapter 1 · The public site', 2: 'Chapter 2 · A learner\'s day', 3: 'Chapter 3 · The college', 4: 'Chapter 4 · The employer', 5: 'Chapter 5 · Trust', phone: 'Phone video', internal: 'Internal cut only' };
const lines = ['# Qubirex walkthrough: narration script', '',
  'Generated from `scripts/walkthrough/scenes/*.js` by `npm run walkthrough:script`. Edit the scene files, not this file.', '',
  'English is spoken (the app\'s own voice); Telugu and Hindi are subtitles. Simple, warm Indian English; the benefit first, then the screen. Sample data is called sample.', '',
  '**Status: reviewable.** Nobody has approved this script yet; the videos were recorded with it as written.', ''];
let chapter = null;
let words = 0;
for (const s of scenes) {
  if (s.chapter !== chapter) { chapter = s.chapter; lines.push(`## ${names[chapter] || chapter}`, ''); }
  lines.push(`### ${s.title} \`${s.id}\``, '', `Account: ${s.account ? `\`${s.account}\` (test tenant, signed in off camera)` : s.unlock ? '/dev, unlocked off camera' : 'none (public)'} · ${s.viewport === 'phone' ? '390×844 phone' : '1440 layout at 1080p'}`, '');
  for (const st of s.steps) {
    if (st.label) lines.push(`- *Caption:* ${st.label}`);
    if (st.say) {
      words += st.say.en.split(/\s+/).length;
      lines.push(`- **EN** ${st.say.en}`, `  - **TE** ${st.say.te}`, `  - **HI** ${st.say.hi}`);
    }
  }
  lines.push('');
}
lines.splice(8, 0, `About ${words} spoken words in ${scenes.length} scenes.`, '');
const md = `${lines.join('\n')}\n`;
fs.writeFileSync(path.join(here, 'narration-script.md'), md);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'narration-script.md'), md);
console.log(`narration-script.md: ${scenes.length} scenes, about ${words} words`);
