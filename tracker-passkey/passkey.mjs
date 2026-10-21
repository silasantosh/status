// passkey.mjs - tracker owner passkey server (rebuilt 2026-10-21 from live recon; source lost with sandbox /tmp)
// Behavior matched against live in-learn.in probes (2026-10-21 22:45-22:46 IST) and live D1 row shapes.
// Env: SITE (e.g. "in-collab"), AUTH_DB (D1 binding with auth_records + recovery_requests), ASSETS (Pages static).
// DATA: embedded per-site ledger (imported from ./data.mjs, generated from the site's tracker sheet).
// Parity flags (could not be observed from outside, chosen sensibly):
//  - session cookie name "pk_session" (live name unobservable; live swap re-logs the owner once)
//  - enroll handoff sets cookie "pk_enroll" (register-options takes no token in the client bundle, so a cookie is the only channel)
//  - login-options with no owner row answers {"error":"No passkey set up yet"}
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { DATA } from './data.mjs';

const SITE = globalThis.__SITE_NAME || 'in-collab'; // overridden at build time per site
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const now = () => Date.now();
const DAY = 86400e3, SESSION_TTL = 30 * DAY, CHALLENGE_TTL = 10 * 60e3, ENROLL_COOKIE_TTL = 600;
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function sha(s) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
const rid = () => crypto.randomUUID().replace(/-/g, '') + '-' + crypto.randomUUID();

function cookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  for (const part of c.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}
function setCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function getRec(env, key) {
  const r = await env.AUTH_DB.prepare('SELECT value, expires FROM auth_records WHERE key=?').bind(key).first();
  if (!r) return null;
  if (r.expires && r.expires < now() && r.expires !== 9007199254740991) return null;
  return r.value;
}
async function putRec(env, key, value, expires) {
  await env.AUTH_DB.prepare('INSERT OR REPLACE INTO auth_records(key, value, expires) VALUES (?,?,?)').bind(key, value, expires).run();
}
async function expireRec(env, key) {
  await env.AUTH_DB.prepare('UPDATE auth_records SET expires=1 WHERE key=?').bind(key).run();
}
async function ownerCred(env) {
  const v = await getRec(env, 'owner');
  return v ? JSON.parse(v) : null;
}
async function session(req, env) {
  const s = cookie(req, 'pk_session');
  if (!/^[0-9a-f]{64}$/.test(s)) return false;
  return (await getRec(env, 'session:' + s)) === 'owner';
}
async function newSession(env) {
  const s = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await putRec(env, 'session:' + s, 'owner', now() + SESSION_TTL);
  return s;
}
async function liveEnrollToken(env) {
  const r = await env.AUTH_DB.prepare("SELECT key FROM auth_records WHERE key LIKE 'enroll:%' AND value='yes' AND expires>?").bind(now()).all();
  return (r.results || []).length ? r.results[0].key.slice(7) : null;
}

// ---- branded HTML pages (COL-014 / MED-023 fix: no more bare JSON for broken passkey links) ----
function page(title, heading, body) {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow"><title>' + title + ' | ' + SITE + '</title><style>'
    + ':root{--g:#00695C;--gd:#153D35;--bg:#F0FAF7;--line:#dcdff3}'
    + 'body{margin:0;background:var(--bg);color:var(--gd);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}'
    + '.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px;max-width:420px;width:100%}'
    + 'h1{font-size:20px;margin:0 0 10px;color:var(--g)}p{margin:8px 0}a{color:var(--g);font-weight:600}</style></head>'
    + '<body><div class="card"><h1>' + heading + '</h1>' + body + '</div></body></html>',
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const branded404 = () => page('Link not found', 'That link is not valid',
  '<p>This sign-in link does not exist or has expired.</p><p>For a new link, ask your assistant. You can also <a href="/tracker/">open the tracker</a> and sign in with your passkey or a one-time code.</p>');

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const path = u.pathname.replace(/\/$/, '') || '/';
    const ORIGIN = u.origin;
    const rpID = u.hostname;

    // ---- static tracker assets ----
    if (req.method === 'GET' && (path === '/tracker' || path === '/tracker/index.html' || path === '/tracker/tracker.js')) {
      return env.ASSETS.fetch(req);
    }
    if (req.method === 'GET' && path.startsWith('/tracker/visuals/')) {
      if (!(await session(req, env))) return J({ error: 'owner_required' }, 403);
      return env.ASSETS.fetch(req);
    }

    // ---- status + handoff ----
    if (req.method === 'GET' && path === '/tracker/status') {
      return J({ enroll: !!(await liveEnrollToken(env)) });
    }
    if (req.method === 'GET' && path === '/tracker/handoff') {
      const token = (u.searchParams.get('token') || u.searchParams.get('t') || '').trim();
      const ok = token && (await getRec(env, 'enroll:' + token)) === 'yes';
      if (!ok) return Response.redirect(ORIGIN + '/tracker/?link=used', 303);
      return new Response(null, { status: 303, headers: { Location: ORIGIN + '/tracker/', 'Set-Cookie': setCookie('pk_enroll', token, ENROLL_COOKIE_TTL) } });
    }

    // ---- owner-gated data ----
    if (path === '/tracker/owner-data') {
      if (!(await session(req, env))) return J({ error: 'owner_required' }, 403);
      return J(DATA);
    }
    if (path === '/tracker/health') {
      if (!(await session(req, env))) return J({ error: 'owner_required' }, 403);
      // Sites without a health engine answer the "no health engine yet" JSON the client already renders.
      return J({ site: SITE, at: now(), checks: [] });
    }
    if (path === '/tracker/notes') {
      if (!(await session(req, env))) return J({ error: 'owner_required' }, 403);
      await env.AUTH_DB.prepare('CREATE TABLE IF NOT EXISTS tracker_notes(n INTEGER PRIMARY KEY AUTOINCREMENT,row_id TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,seen INTEGER NOT NULL DEFAULT 0)').run();
      if (req.method === 'GET') {
        const id = (u.searchParams.get('id') || '').slice(0, 40);
        const r = await env.AUTH_DB.prepare('SELECT n,row_id,body,created FROM tracker_notes WHERE row_id=? ORDER BY n DESC LIMIT 100').bind(id).all();
        return J({ notes: r.results });
      }
      if (req.method === 'POST') {
        if (req.headers.get('Origin') !== ORIGIN) return J({ error: 'origin' }, 403);
        const b = await req.json().catch(() => ({}));
        const id = String(b.id || ''), text = String(b.text || '').trim();
        if (!/^[A-Za-z0-9._-]{1,40}$/.test(id) || !text || text.length > 2000) return J({ error: 'Check the reply and try again' }, 400);
        const known = [...Object.values(DATA.sites || {}).flat(), ...(DATA.live_additions || [])].some((x) => x.id === id);
        if (!known) return J({ error: 'Unknown item' }, 404);
        const rc = await env.AUTH_DB.prepare('SELECT count(*) AS c FROM tracker_notes WHERE created>?').bind(now() - 3600000).first();
        if (rc && rc.c >= 60) return J({ error: 'Too many replies this hour' }, 429);
        const t = now();
        await env.AUTH_DB.prepare('INSERT INTO tracker_notes(row_id,body,created) VALUES(?,?,?)').bind(id, text, t).run();
        return J({ ok: true, created: t });
      }
      return J({ error: 'Not found' }, 405);
    }

    // ---- passkey API ----
    if (path.startsWith('/tracker/passkey/')) {
      const sub = path.slice('/tracker/passkey/'.length);
      if (req.method !== 'POST') { if (req.method === 'GET') return branded404(); return J({ error: 'Not found' }, 404); }
      if (req.headers.get('Origin') !== ORIGIN) return J({ error: 'origin' }, 403);
      const b = await req.json().catch(() => null);
      if (!b) return J({ error: 'bad json' }, 400);

      if (sub === 'register-options') {
        if (await ownerCred(env)) return J({ error: 'Owner already enrolled' }, 400);
        const token = cookie(req, 'pk_enroll');
        if (!token || (await getRec(env, 'enroll:' + token)) !== 'yes') return J({ error: 'Setup link needed. Ask your assistant for a new one.' }, 403);
        const id = rid();
        const options = await generateRegistrationOptions({
          rpName: SITE + ' tracker', rpID,
          userName: 'owner', userDisplayName: SITE + ' owner',
          attestationType: 'none',
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
          timeout: 60000,
        });
        await putRec(env, 'challenge:' + id, JSON.stringify({ type: 'register', challenge: options.challenge, enroll: token, browser: await sha(req.headers.get('User-Agent') || '') }), now() + CHALLENGE_TTL);
        return J({ id, options });
      }
      if (sub === 'register-verify') {
        const rec = await getRec(env, 'challenge:' + String(b.id || ''));
        if (!rec) return J({ error: 'Challenge expired or already used' }, 400);
        const ch = JSON.parse(rec);
        if (ch.type !== 'register') return J({ error: 'Challenge expired or already used' }, 400);
        let verification;
        try {
          verification = await verifyRegistrationResponse({
            response: b.response, expectedChallenge: ch.challenge,
            expectedOrigin: ORIGIN, expectedRPID: rpID, requireUserVerification: true,
          });
        } catch (e) { return J({ error: 'Passkey was not accepted. Try again.' }, 400); }
        if (!verification.verified || !verification.registrationInfo) return J({ error: 'Passkey was not accepted. Try again.' }, 400);
        const { credential } = verification.registrationInfo;
        await putRec(env, 'owner', JSON.stringify({
          id: credential.id, publicKey: [...credential.publicKey], counter: credential.counter,
          transports: credential.transports || [],
        }), 9007199254740991);
        await expireRec(env, 'challenge:' + String(b.id || ''));
        if (ch.enroll) await expireRec(env, 'enroll:' + ch.enroll);
        const s = await newSession(env);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': setCookie('pk_session', s, SESSION_TTL / 1000) } });
      }
      if (sub === 'login-options') {
        const cred = await ownerCred(env);
        if (!cred) return J({ error: 'No passkey set up yet' }, 400);
        const id = rid();
        const options = await generateAuthenticationOptions({
          rpID, timeout: 60000, userVerification: 'required',
          allowCredentials: [{ id: cred.id, transports: cred.transports || ['hybrid', 'internal'] }],
        });
        await putRec(env, 'challenge:' + id, JSON.stringify({ type: 'login', challenge: options.challenge, browser: await sha(req.headers.get('User-Agent') || '') }), now() + CHALLENGE_TTL);
        return J({ id, options });
      }
      if (sub === 'login-verify') {
        const rec = await getRec(env, 'challenge:' + String(b.id || ''));
        if (!rec) return J({ error: 'Challenge expired or already used' }, 400);
        const ch = JSON.parse(rec);
        if (ch.type !== 'login') return J({ error: 'Challenge expired or already used' }, 400);
        const cred = await ownerCred(env);
        if (!cred) return J({ error: 'No passkey set up yet' }, 400);
        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            response: b.response, expectedChallenge: ch.challenge,
            expectedOrigin: ORIGIN, expectedRPID: rpID, requireUserVerification: true,
            credential: { id: cred.id, publicKey: new Uint8Array(cred.publicKey), counter: cred.counter || 0, transports: cred.transports || [] },
          });
        } catch (e) { return J({ error: 'Sign-in did not complete. Try again.' }, 400); }
        if (!verification.verified) return J({ error: 'Sign-in did not complete. Try again.' }, 400);
        cred.counter = verification.authenticationInfo.newCounter;
        await putRec(env, 'owner', JSON.stringify(cred), 9007199254740991);
        await expireRec(env, 'challenge:' + String(b.id || ''));
        const s = await newSession(env);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': setCookie('pk_session', s, SESSION_TTL / 1000) } });
      }
      if (sub === 'code-request') {
        const live = await env.AUTH_DB.prepare('SELECT count(*) AS c FROM recovery_requests WHERE used=0 AND expires>?').bind(now()).first();
        if (live && live.c >= 5) return J({ error: 'Too many open code requests. Wait a few minutes.' }, 429);
        const t = now();
        const id = crypto.randomUUID() + crypto.randomUUID();
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, '0');
        await env.AUTH_DB.prepare('INSERT INTO recovery_requests(id,browser,ip,code,expires,created,fails,used) VALUES (?,?,?,?,?,?,0,0)')
          .bind(id, await sha(req.headers.get('User-Agent') || ''), await sha(req.headers.get('CF-Connecting-IP') || ''), code, t + 600e3, t).run();
        return J({ ok: true, id, message: 'Ask your assistant for this sign-in code. It expires in 10 minutes.' });
      }
      if (sub === 'code-verify') {
        const id = String(b.id || ''), code = String(b.code || '').trim();
        const row = await env.AUTH_DB.prepare('SELECT * FROM recovery_requests WHERE id=?').bind(id).first();
        if (!row || row.used || row.expires < now() || row.fails >= 5) return J({ error: 'Wrong or expired code' }, 400);
        if (row.code !== code) {
          await env.AUTH_DB.prepare('UPDATE recovery_requests SET fails=fails+1 WHERE id=?').bind(id).run();
          return J({ error: 'Wrong or expired code' }, 400);
        }
        await env.AUTH_DB.prepare('UPDATE recovery_requests SET used=1 WHERE id=?').bind(id).run();
        const s = await newSession(env);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': setCookie('pk_session', s, SESSION_TTL / 1000) } });
      }
      if (sub === 'logout') {
        const s = cookie(req, 'pk_session');
        if (s) await expireRec(env, 'session:' + s).catch(() => {});
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': setCookie('pk_session', '', 0) } });
      }
      // COL-014 / MED-023: branded HTML 404 instead of bare JSON for broken passkey links
      return branded404();
    }
    return J({ error: 'Not found' }, 404);
  },
};
