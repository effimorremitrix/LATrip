/**
 * ben-la-proxy - Cloudflare Worker
 *
 * Serves the LA Trip Companion at https://benmor2026.com/la/ by forwarding to
 * the LATrip Worker, which lives in a DIFFERENT Cloudflare account.
 *
 * Cross-account is the whole reason this file exists. A Service Binding would be
 * the better mechanism, but bindings do not cross accounts, so the proxy fetches
 * LATrip's public origin over the network instead. The `env.LATRIP` branch below
 * is kept for the day both Workers share an account; today it is never taken.
 *
 * What the proxy is responsible for:
 *   - stripping the /la prefix on the way out, and putting it back on the way in
 *     (redirect Location headers, and the Path on the session cookie)
 *   - keeping the whole thing out of search engines
 *
 * What the proxy is deliberately NOT responsible for:
 *   - authentication. The password gate stays entirely in LATrip; this Worker
 *     never sees a password, never issues a cookie and never decides who anyone
 *     is. It forwards the Cookie header and gets out of the way.
 *   - cache policy. LATrip serves the app with a strong ETag and
 *     `private, no-cache` so a reopen on bad hotel wifi costs a few hundred
 *     bytes instead of 26 KB, and the login page and API routes with
 *     `no-store`. Those headers are passed through untouched. Overriding them
 *     with a blanket `no-store` here would cost a full re-download on every
 *     single open and buy nothing: `private` already keeps the app out of
 *     shared caches, and `no-cache` already forces the cookie to be re-checked
 *     on every open.
 */

/* Overridable only so `wrangler dev` can point at a local LATrip. In production
   no ORIGIN var is set and this constant is what runs. */
const ORIGIN_DEFAULT = "https://latrip.effi-mor-e04.workers.dev";

const PREFIX = "/la";

const NOINDEX = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = env.ORIGIN || ORIGIN_DEFAULT;

    /* `/la` with no trailing slash. The page uses relative URLs, so the trailing
       slash is what makes `api/login` resolve to `/la/api/login` rather than
       `/api/login`; getting here without it would break the login POST. */
    if (url.pathname === PREFIX) {
      return new Response(null, {
        status: 301,
        headers: { Location: `${PREFIX}/${url.search}`, ...NOINDEX },
      });
    }

    /* The routes are `/la` and `/la/*`, so nothing else should reach this
       Worker. If Cloudflare ever hands us something else, say so rather than
       silently mangling the path. */
    if (!url.pathname.startsWith(`${PREFIX}/`)) {
      return new Response("not found", { status: 404, headers: NOINDEX });
    }

    const upstreamPath = url.pathname.slice(PREFIX.length) || "/";
    const upstream = new Request(origin + upstreamPath + url.search, req);
    /* The inbound Host is benmor2026.com; the subrequest must carry the
       origin's own host or the Workers platform routes it back at us. */
    upstream.headers.delete("Host");

    /* Ask the origin for an uncompressed body.

       Without this the runtime adds its own `Accept-Encoding` to the subrequest,
       the origin answers with a brotli body, and the response we build carries
       `Content-Encoding: br` out to a client that never asked for it. The client
       then gets compressed bytes it will not decode, which is a blank page.

       Compression is not lost, only moved: this hop is Cloudflare-internal, and
       the edge still compresses the response it sends to the phone, based on
       what that phone actually asked for. */
    upstream.headers.set("Accept-Encoding", "identity");

    const res = env.LATRIP ? await env.LATRIP.fetch(upstream) : await fetch(upstream);
    const out = new Response(res.body, res);

    /* Belt and braces: if an origin ignores `identity` and encodes anyway, the
       runtime decodes the body for us but can leave the headers describing the
       encoded form. Passing those on would mislabel a plain body. */
    if (out.headers.has("Content-Encoding")) {
      out.headers.delete("Content-Encoding");
      out.headers.delete("Content-Length");
    }

    /* Put the prefix back on any same-origin redirect. LATrip does not currently
       issue one, so this is insurance rather than a live code path. */
    const loc = out.headers.get("Location");
    if (loc) {
      const l = new URL(loc, origin);
      if (l.origin === new URL(origin).origin) {
        out.headers.set("Location", `${PREFIX}${l.pathname}${l.search}`);
      }
    }

    /* The session cookie is issued by LATrip with `Path=/`, which is correct at
       its own origin and wrong here: it would be sent on every request to
       benmor2026.com, including Ben's site. Re-scope it to /la and drop any
       Domain, so it is confined to this one subtree. `Path=/la` matches `/la`
       and `/la/...` and nothing else; per RFC 6265 it does not match `/label`.

       Consequence worth knowing: this is a separate session from the one at the
       workers.dev origin. Signing in at one door does not sign you in at the
       other. */
    const cookies = out.headers.getSetCookie?.() ?? [];
    if (cookies.length) {
      out.headers.delete("Set-Cookie");
      for (const c of cookies) {
        const fixed =
          c
            .replace(/;\s*Domain=[^;]*/gi, "")
            .replace(/;\s*Path=[^;]*/gi, "") + `; Path=${PREFIX}`;
        out.headers.append("Set-Cookie", fixed);
      }
    }

    /* LATrip already sends both of these on every response. Setting them here
       too means the page stays out of search engines even if it is ever pointed
       at an origin that does not. */
    for (const [k, v] of Object.entries(NOINDEX)) out.headers.set(k, v);

    return out;
  },
};
