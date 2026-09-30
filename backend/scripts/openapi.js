// scripts/openapi.js — generate openapi.json (OpenAPI 3.1) from the mounted
// Express routers (npm run openapi). tests/unit/openapi.test.js fails when the
// committed file is out of date, so the spec always matches the routes.
// Paths and methods are exact; request/response bodies are described in
// docs/API_REFERENCE.md until each route gains a schema.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT = path.resolve(HERE, '../openapi.json');
const PUBLIC = new Set([
  'POST /api/auth/institution/login', 'POST /api/auth/institution/register', 'POST /api/auth/learner/login',
  'POST /api/auth/admin/login', 'POST /api/auth/employer/login', 'POST /api/auth/employer/register',
  'GET /api/auth/staff/invite/{token}', 'POST /api/auth/staff/invite/{token}/accept',
  'GET /api/auth/learner/invite/{token}', 'POST /api/auth/learner/invite/{token}/accept',
  'POST /api/auth/learner/pin-reset-request', 'GET /api/health',
  'GET /api/verify/{evidenceId}', 'GET /api/verify/jwks.json', 'GET /api/verify/status/{listId}'
]);
const UNSAFE = new Set(['post', 'put', 'patch', 'delete']);

export async function buildSpec() {
  const { MOUNTS } = await import('../api/app.js');
  const paths = {};
  const add = (method, full, tag) => {
    const oa = full.replace(/:(\w+)/g, '{$1}');
    const key = `${method.toUpperCase()} ${oa}`;
    const params = [...oa.matchAll(/\{(\w+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    const op = {
      tags: [tag],
      operationId: `${method}_${oa.replace(/^\/api\//, '').replace(/[{}]/g, '').replace(/[^\w]+/g, '_')}`,
      responses: { 200: { description: 'OK' }, 400: { $ref: '#/components/responses/Error' }, 401: { $ref: '#/components/responses/Error' }, 403: { $ref: '#/components/responses/Error' }, 429: { $ref: '#/components/responses/Error' } }
    };
    if (params.length) op.parameters = params;
    if (PUBLIC.has(key)) op.security = [];
    else if (UNSAFE.has(method)) op.parameters = [...(op.parameters || []), { $ref: '#/components/parameters/CsrfToken' }];
    paths[oa] = paths[oa] || {};
    paths[oa][method] = op;
  };
  for (const [prefix, router] of MOUNTS) {
    const tag = prefix.split('/')[2];
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) add(method, `${prefix}${layer.route.path}`, tag);
    }
  }
  add('get', '/api/health', 'health');
  add('get', '/.well-known/did.json', 'verify');
  const sorted = Object.fromEntries(Object.keys(paths).sort().map(k => [k, paths[k]]));
  return {
    openapi: '3.1.0',
    info: { title: 'Qubirex API', version: '4.3.1-phase0.1', description: 'Generated from the Express routers by scripts/openapi.js. Do not edit by hand.' },
    servers: [{ url: '/' }],
    security: [{ cookieSession: [] }, { bearer: [] }],
    components: {
      securitySchemes: {
        cookieSession: { type: 'apiKey', in: 'cookie', name: 'qbx_session', description: 'httpOnly SameSite=Strict session cookie. State-changing requests also need X-CSRF-Token.' },
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Same session token; accepted until the frontend moves to cookies (docs/decisions.md D-002).' }
      },
      parameters: {
        CsrfToken: { name: 'X-CSRF-Token', in: 'header', required: false, schema: { type: 'string' }, description: 'Required when authenticating with the session cookie.' }
      },
      responses: {
        Error: {
          description: 'Error. New routes (/api/employer, /api/verify, /api/practical) answer {error: {code, message}}; legacy routes answer {error: string}.',
          content: { 'application/json': { schema: { type: 'object', properties: { error: { oneOf: [{ type: 'string' }, { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } }, required: ['code', 'message'] }] } } } } }
        }
      }
    },
    paths: sorted
  };
}

export const render = (spec) => `${JSON.stringify(spec, null, 2)}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(OUTPUT, render(await buildSpec()));
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}`);
}
