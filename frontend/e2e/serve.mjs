// e2e/serve.mjs — the built site plus an /api proxy to the backend, the way
// Vercel serves it (unknown paths fall back to index.html). For the e2e
// scripts locally and in CI:  SITE=build API=3001 PORT=3000 node e2e/serve.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';

const SITE = path.resolve(process.env.SITE || 'build');
const API = Number(process.env.API || 3001);
const PORT = Number(process.env.PORT || 3000);
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.wasm': 'application/wasm', '.zip': 'application/zip', '.mjs': 'application/javascript' };

http.createServer((req, res) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/.well-known/')) {
    const p = http.request({ host: '127.0.0.1', port: API, path: req.url, method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(p);
    return;
  }
  let f = path.join(SITE, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(SITE, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`site on http://localhost:${PORT} → api :${API}`));
