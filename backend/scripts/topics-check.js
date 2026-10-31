// scripts/topics-check.js — npm run topics:check. Lists every lesson part that
// is missing, per language (English, Telugu, Hindi), for every course; every
// module's test and project; and module files the course lists but that do
// not exist. Exits 1 when a course marked complete (Python, Java) has any
// gap; draft courses are listed for information only.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { catalog, missingParts } from '../core/courses/catalog.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/courses');
const LANGS = { en: 'English', te: 'Telugu', hi: 'Hindi' };
let failed = false;

for (const course of catalog().courses) {
  const complete = course.status === 'complete';
  const gaps = [];
  const listed = JSON.parse(fs.readFileSync(path.join(DIR, course.id, 'course.json'), 'utf8')).modules || [];
  listed.filter(m => typeof m === 'string' && !fs.existsSync(path.join(DIR, course.id, m))).forEach(m => gaps.push(`module file ${m} is missing`));
  let lessons = 0;
  for (const m of course.modules) {
    if (!(m.lessons || []).length) gaps.push(`${m.id}: no lessons`);
    if (!(m.test?.questions || []).length) gaps.push(`${m.id}: no module test`);
    if (!m.project?.tests?.length || !m.project.solution) gaps.push(`${m.id}: no module project with tests and a solution`);
    for (const l of m.lessons || []) {
      lessons += 1;
      for (const [code, name] of Object.entries(LANGS)) {
        const miss = missingParts(l, code);
        if (miss.length) gaps.push(`${l.id} (${name}): missing ${miss.join(', ')}`);
      }
    }
  }
  const head = `${course.title.en} — ${course.status}, ${course.modules.length} modules, ${lessons} lessons`;
  if (!gaps.length) console.log(`✓ ${head}: complete in English, Telugu and Hindi`);
  else {
    console.log(`${complete ? '✗' : '·'} ${head}: ${gaps.length} gap(s)`);
    if (complete) gaps.slice(0, 200).forEach(g => console.log(`    ${g}`));
    else console.log(`    draft: outline only, needs lessons and faculty review`);
    if (complete) failed = true;
  }
}
process.exit(failed ? 1 : 0);
