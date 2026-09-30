// Vercel Function entry: every /api/* request (and /.well-known/did.json) is
// rewritten here by vercel.json and handled by the backend's Express app.
export { default } from '../backend/vercel/handler.js';

export const config = { maxDuration: 60 };
