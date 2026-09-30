// Child process for the outbox crash test. Commits three events for one
// aggregate, starts delivering, and is SIGKILLed by its own subscriber in the
// middle of delivering the second event — after the state change and event
// were committed, before delivery completed.
import * as dal from '../../../core/db/dal.js';
import { migrate } from '../../../core/db/migrate.js';
import { emit } from '../../../core/events/outbox.js';
import { subscribe } from '../../../core/events/subscribers.js';
import { createWorker } from '../../../core/events/worker.js';

dal.connect({ file: process.argv[2] });
await migrate();
await dal.tx(async () => {
  await dal.run("UPDATE learners SET city = 'Warangal' WHERE id = 'crash-learner'");
  for (let i = 1; i <= 3; i += 1) await emit('NODE_ADVANCED', { aggregateType: 'learner', aggregateId: 'crash-learner', payload: { n: i } });
});
let seen = 0;
subscribe('NODE_ADVANCED', 'test.recorder', () => {
  seen += 1;
  if (seen === 2) process.kill(process.pid, 'SIGKILL');
});
await createWorker({ pollMs: 10 }).tick();
