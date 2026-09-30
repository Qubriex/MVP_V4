// api/asyncErrors.js
// Express 4 ignores the promise an async handler returns, so a rejected
// database call would leave the request hanging. This makes every route and
// middleware handler forward a rejection to next(err), which reaches the
// error handler in app.js. Imported once, before any router is built.
import Layer from 'express/lib/router/layer.js';

if (!Layer.prototype.__qbxAsync) {
  Layer.prototype.handle_request = function handle(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next();
    try {
      const out = fn(req, res, next);
      if (out && typeof out.catch === 'function') out.catch(next);
    } catch (err) {
      next(err);
    }
    return undefined;
  };
  Layer.prototype.__qbxAsync = true;
}
