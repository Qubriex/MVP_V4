// Model-agnostic AI (spec §2, §11): model SDKs are imported only under
// core/ai/adapters/. And the database driver only in core/db/sqlite.js, so
// the PostgreSQL move stays a driver swap (spec §4).
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listSourceFiles, parseImports } from './importGraph.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MODEL_SDKS = /^(@google\/generative-ai|@google\/genai|openai|@anthropic-ai\/|groq-sdk|cohere-ai|@mistralai\/|ollama|@aws-sdk\/client-bedrock|@huggingface\/inference|replicate)/;
const files = listSourceFiles(ROOT, { skip: ['tests'] });

const importers = (pattern) => files.filter(f => {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  return parseImports(src).specs.some(s => pattern.test(s)) || new RegExp(`require\\(['"]${pattern.source.replace(/^\^/, '')}`).test(src);
});

describe('model SDK boundary', () => {
  it('no model SDK import outside core/ai/adapters/', () => {
    expect(importers(MODEL_SDKS).filter(f => !f.startsWith('core/ai/adapters/'))).toEqual([]);
  });

  it('the gemini adapter is found (the scan is not vacuous)', () => {
    expect(importers(MODEL_SDKS)).toContain('core/ai/adapters/gemini.js');
  });
});

describe('database driver boundary', () => {
  it('better-sqlite3 is imported only by core/db/sqlite.js', () => {
    expect(importers(/^better-sqlite3$/)).toEqual(['core/db/sqlite.js']);
  });
});
