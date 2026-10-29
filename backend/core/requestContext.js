// core/requestContext.js — per-request facts that deep modules need without
// threading them through every call. Today: the demo sandbox a request runs
// in (set by api/middleware/auth.js for demo sessions, and by the demo
// routes), which the AI gateway charges against the demo budget and the mail
// and notification code send to the Demo inbox instead of the outside world.
import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage();

/** Run fn (e.g. express next) with this context. */
export const withContext = (ctx, fn) => store.run({ ...(store.getStore() || {}), ...ctx }, fn);
/** The demo sandbox id of the current request, or null. */
export const currentSandbox = () => store.getStore()?.sandboxId || null;
