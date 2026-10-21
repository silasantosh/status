// _worker.js - Pages router: /tracker/* -> passkey server, everything else -> static assets.
// Bundled with esbuild (nodejs_compat). Rebuilt 2026-10-21; import paths are relative now (no /tmp).
import pk from './passkey.mjs';
const EXACT = new Set(['/tracker', '/tracker/', '/tracker/index.html', '/tracker/tracker.js', '/tracker/handoff', '/tracker/handoff/', '/tracker/status', '/tracker/status/', '/tracker/owner-data', '/tracker/owner-data/', '/tracker/notes', '/tracker/health']);
const isPk = (p) => EXACT.has(p) || p.startsWith('/tracker/passkey/') || p.startsWith('/tracker/visuals/');
export default {
  async fetch(req, env, ctx) {
    if (isPk(new URL(req.url).pathname)) return pk.fetch(req, env, ctx);
    return env.ASSETS.fetch(req);
  },
};
