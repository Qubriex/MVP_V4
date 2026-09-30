// Vercel Function entry: every /api/* request (and /.well-known/did.json) is
// rewritten here by vercel.json and handled by the backend's Express app.
// A Vercel deployment always runs with production rules (secure cookies, no
// dev keys or dev codes, the startup secrets check), whatever NODE_ENV says.
if (process.env.VERCEL && process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'production';

const { default: handler } = await import('../backend/vercel/handler.js');
export default handler;

export const config = { maxDuration: 60 };
