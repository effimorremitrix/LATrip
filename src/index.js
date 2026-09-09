/**
 * LA Trip Companion 2026 - Cloudflare Worker
 *
 * Serves the trip app behind a per-user password gate.
 *
 * Routes:
 *   POST /api/login   { user, password }  -> sets signed session cookie
 *   POST /api/logout                      -> clears the cookie
 *   GET  /healthz                         -> liveness probe, no auth
 *   GET  *                                -> app if signed in, login page if not
 *
 * Secrets (set with `wrangler secret put <NAME>`):
 *   AUTH_SECRET     random string used to sign session cookies
 *   PASSWORD_EFFI   password for user "effi"
 *   PASSWORD_BEN    password for user "ben"
 */

import APP_HTML from "./app.html";
import LOGIN_HTML from "./login.html";

const COOKIE_NAME = "trip_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAX_LOGIN_BODY = 4096; // bytes; a login body is ~60

/* user id -> name of the secret holding that user's password */
const USERS = {
  effi: "PASSWORD_EFFI",
  ben: "PASSWORD_BEN",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; "),
};

/* ---------- small helpers ---------- */

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64url(new Uint8Array(sig));
}

/**
 * Compare two strings in constant time. Both sides are hashed to a fixed
 * 32 bytes first, so nothing about their length leaks, and the comparison
 * itself runs in the runtime rather than in JS where a JIT could short-circuit.
 */
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

/**
 * Read a request body with a hard byte ceiling, so an unauthenticated caller
 * cannot make the Worker buffer an arbitrarily large payload. Returns null if
 * the body is larger than maxBytes.
 */
async function readBounded(request, maxBytes) {
  const declared = request.headers.get("Content-Length");
  if (declared !== null && Number(declared) > maxBytes) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/* ---------- session ---------- */

async function issueSession(user, secret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${user}.${expires}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

async function readSession(request, secret) {
  const raw = readCookie(request, COOKIE_NAME);
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const [user, expires, signature] = parts;
  if (!Object.prototype.hasOwnProperty.call(USERS, user)) return null;

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000) return null;

  const expected = await hmac(secret, `${user}.${expires}`);
  if (!(await safeEqual(expected, signature))) return null;

  return user;
}

function sessionCookie(value, maxAge) {
  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

/* ---------- responses ---------- */

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

/* ---------- handlers ---------- */

async function handleLogin(request, env) {
  const raw = await readBounded(request, MAX_LOGIN_BODY);
  if (raw === null) return json({ ok: false, error: "payload_too_large" }, 413);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const user = typeof body?.user === "string" ? body.user : "";
  const password = typeof body?.password === "string" ? body.password : "";

  /* Always do the full compare, even for an unknown user, so a wrong name and
     a wrong password cost the same and reveal the same. */
  const secretName = USERS[user];
  const expected = (secretName && env[secretName]) || "";
  const ok = (await safeEqual(expected, password)) && expected !== "";

  if (!ok) {
    /* Only ever log a username we recognise, never attacker-supplied text,
       and never the password. This is what makes guessing visible in logs. */
    console.log(
      JSON.stringify({
        event: "login_rejected",
        user: secretName ? user : "unknown",
        ip: request.headers.get("CF-Connecting-IP") || null,
      })
    );
    await new Promise((r) => setTimeout(r, 400));
    return json({ ok: false, error: "invalid_credentials" }, 401);
  }

  const cookie = sessionCookie(await issueSession(user, env.AUTH_SECRET), SESSION_SECONDS);
  return json({ ok: true, user }, 200, { "Set-Cookie": cookie });
}

function handleLogout() {
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      console.error(
        JSON.stringify({
          event: "unhandled_error",
          error: e instanceof Error ? e.message : String(e),
        })
      );
      return json({ ok: false, error: "internal_error" }, 500);
    }
  },
};

async function route(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/healthz") {
    return new Response("ok", { headers: { "Cache-Control": "no-store" } });
  }

  if (!env.AUTH_SECRET || !env.PASSWORD_EFFI || !env.PASSWORD_BEN) {
    return json(
      { ok: false, error: "not_configured", detail: "Missing AUTH_SECRET / PASSWORD_EFFI / PASSWORD_BEN" },
      503
    );
  }

  if (url.pathname === "/api/login") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    return handleLogin(request, env);
  }

  if (url.pathname === "/api/logout") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    return handleLogout();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const user = await readSession(request, env.AUTH_SECRET);
  if (!user) {
    /* Clear a cookie that is expired or no longer verifies, so the browser
       stops sending it on every request. */
    const stale = readCookie(request, COOKIE_NAME);
    return html(LOGIN_HTML, 200, stale ? { "Set-Cookie": sessionCookie("", 0) } : {});
  }

  return html(APP_HTML.replace("%%TRIP_USER%%", user));
}
