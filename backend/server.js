// server.js — Qubirex Backend (Inferexaa Private Limited)
// Applies migrations, starts the outbox worker, then listens.
import 'dotenv/config';
import params from './config/params.js';
import { migrate } from './core/db/migrate.js';
import { createWorker } from './core/events/worker.js';
import { createApp } from './api/app.js';
import { logger } from './core/logger.js';

const PORT = process.env.PORT || 3001;

params.load(); // fails fast in production without secure-config/
await migrate();
const worker = createWorker();
worker.start();

createApp().listen(PORT, () => {
  logger.info('server.started', { port: Number(PORT), params: params.report().every(p => p.stage === 'prior') ? 'priors' : 'secure-config' });
  console.log(`\nQubirex backend running on http://localhost:${PORT}`);
  console.log('   RECEIVE · BUILD · RETURN\n');
});
