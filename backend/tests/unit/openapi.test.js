// The committed openapi.json must match the routes (regenerate with npm run openapi).
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { buildSpec, render, OUTPUT } from '../../scripts/openapi.js';

describe('openapi.json', () => {
  it('is up to date with the mounted routes', async () => {
    const spec = await buildSpec();
    expect(spec.paths['/api/employer/me'].get).toBeTruthy();
    expect(spec.paths['/api/auth/employer/register'].post.security).toEqual([]);
    expect(fs.readFileSync(OUTPUT, 'utf8')).toBe(render(spec));
  });
});
