// core/requestContext.js — per-request facts that deep modules need without
// threading them through every call. Today: the demo sandbox a request runs
// in (set by api/middleware/auth.js for demo sessions, and by the demo
// routes), and the tutor mode (scripted or live) for test learners and the
// demo. The AI gateway charges against the demo budget and the mail
// and notification code send to the Demo inbox instead of the outside world.
import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage();

/** Run fn (e.g. express next) with this context. */
export const withContext = (ctx, fn) => store.run({ ...(store.getStore() || {}), ...ctx }, fn);
/** The demo sandbox id of the current request, or null. */
export const currentSandbox = () => store.getStore()?.sandboxId || null;
/** 'scripted' when this request's lessons and checks use the scripted tutor (test learners, demo), else null. */
export const currentTutor = () => store.getStore()?.tutor || null;
/** Days a test learner's clock runs ahead (the /dev "Move time forward" control), else 0. */
export const clockOffsetDays = () => store.getStore()?.clockOffsetDays || 0;
/** Now, as this request sees it: the real clock, plus a test learner's offset. */
export const nowMs = () => Date.now() + clockOffsetDays() * 86400000;
export const nowIsoFor = () => new Date(nowMs()).toISOString();
/** True when the signed-in learner is in the test tenant (#pass/#fail and /dev controls work). */
export const isTestLearner = () => !!store.getStore()?.testLearner;

/** The signed-in learner's learning language, exactly as chosen (telugu, telugu_en, …), else null. */
export const currentLearningMode = () => store.getStore()?.learningMode || null;
