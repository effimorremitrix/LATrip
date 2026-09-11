# ben-la-proxy

Serves the LA Trip Companion at **https://benmor2026.com/la/**.

It is a separate Worker in a separate Cloudflare account from the app it serves,
and that is the only reason it exists.

```
phone  ->  benmor2026.com/la/...        Ben's account    ben-la-proxy
                  |  strip /la
                  v
           latrip.effi-mor-e04.workers.dev/...   Effi's account   latrip
```

## Why a proxy and not a binding

A Service Binding is the right way for one Worker to call another: no network
hop, no public URL. Bindings do not cross Cloudflare accounts, and these two
Workers are in different accounts, so the proxy fetches LATrip's public origin
over the network instead. `src/index.js` keeps an `env.LATRIP` branch for the
day that changes; today it is never taken.

Two consequences worth knowing before you change anything:

1. **`latrip.effi-mor-e04.workers.dev` must stay enabled.** It is the origin. It
   is still password-gated and still sends `X-Robots-Tag: noindex, nofollow,
   noarchive`, so it is a second door, not an open one.
2. **The two doors have separate sessions.** The cookie at `/la` is scoped to
   `Path=/la`, so signing in at one does not sign you in at the other.

## What it does and does not do

It rewrites paths in both directions: `/la/x` out to `/x`, and on the way back
any same-origin `Location` header and the `Path` on the session cookie.
It sets `X-Robots-Tag` and `Referrer-Policy`, and it asks the origin for an
uncompressed body so it never hands the phone a body labelled with an encoding
the phone did not ask for.

It does **not** do authentication. The password gate lives entirely in LATrip;
this Worker never sees a password, never issues a cookie and never decides who
anyone is.

It does **not** set cache policy. LATrip serves the app with a strong `ETag` and
`private, no-cache` so a reopen on bad hotel wifi costs a few hundred bytes
instead of 26 KB, and serves the login page and API routes `no-store`. Those
headers pass through untouched. A blanket `no-store` here would cost a full
re-download on every open and buy nothing, because `private` already keeps the
app out of shared caches and `no-cache` already forces the cookie to be
re-checked every time.

## The two routes

```toml
routes = [
  { pattern = "benmor2026.com/la",   zone_name = "benmor2026.com" },
  { pattern = "benmor2026.com/la/*", zone_name = "benmor2026.com" },
]
```

Not `benmor2026.com/la*`. That single pattern also matches `/laptop`, `/latest`
and `/labs`: it would take those pages away from Ben's site and forward them to
LATrip with the first three characters cut off. These two patterns match exactly
`/la` and `/la/<anything>` and leave the rest of the site alone.

## Deploy

This deploys to **Ben's** account, pinned by `account_id` in `wrangler.toml`.
LATrip's own `scripts/deploy.mjs` refuses to deploy into that same account, so
the two cannot be crossed by accident.

**It has to be deployed from Ben's side.** An OAuth token minted for Effi's
account does not carry a later-granted membership of Ben's, and wrangler then
fails with `Authentication error [code: 10000]` and a warning that the
`account_id` "does not match any of your authenticated accounts". That is not a
permissions problem to debug; it is the token predating the membership. Deploy
from Ben's machine, or from a Workers Build inside his account.

```bash
cd proxy
npm install
npx wrangler deploy
```

If a login is needed, use `npx wrangler login --device`. The default localhost
callback flow crashes on Windows with a libuv assertion in `src\win\async.c`.

**This directory is the source of truth.** The running Worker was deployed out
of Ben's own repo, so a second copy of `src/index.js` exists over there with
nothing keeping the two in step. Change this one, hand it to Ben to redeploy,
and say so in the commit. Do not edit the deployed copy.

If the deploy succeeds but attaching the route fails with an authorization
error, the Workers Admin role does not carry zone-level route permission on this
zone. Do not retry with other credentials. Ben can add it by hand:

> Cloudflare dashboard, zone **benmor2026.com**, Workers Routes, Add route:
> `benmor2026.com/la` and `benmor2026.com/la/*`, both to Worker **ben-la-proxy**.

## Verify

```bash
curl -sI https://benmor2026.com/la          # 301 to /la/
curl -sI https://benmor2026.com/la/         # X-Robots-Tag: noindex, nofollow, noarchive
curl -s  https://benmor2026.com/la/ | grep -i 'name="robots"'
curl -sI https://benmor2026.com/            # Ben's site, and no X-Robots-Tag
```

The app's own auth-boundary test works against this door unchanged, because
every path in it is relative to the base URL you pass:

```bash
TRIP_PW_EFFI=... bash ../scripts/smoke-test.sh https://benmor2026.com/la
```

## Local development

```bash
cp .dev.vars.example .dev.vars     # ORIGIN=http://127.0.0.1:8787
npm run dev                        # proxy on :8788

# in the LATrip root, in another shell
npm run dev                        # origin on :8787

bash scripts/verify-local.sh       # 42 checks across both doors
```

`ORIGIN` is read only from `.dev.vars`. In production no such var is set and the
constant at the top of `src/index.js` is what runs, so a stray var cannot
silently repoint the proxy somewhere else.
