# LA Trip Companion 2026

The Los Angeles trip app (23.9 – 5.10.2026), served from a Cloudflare Worker
behind a per-user password gate. Two accounts: **אפי** (`effi`) and **בן** (`ben`).

## How the gate works

The app used to ask "who are you?" in the browser and take your word for it.
Now the Worker decides, and the browser is never trusted with the answer.

```
GET /                      no valid cookie  ->  login page, nothing else
POST /api/login            password checked against a Cloudflare secret
                           ->  signed session cookie, 30 days
GET /                      valid cookie     ->  app, with the user's identity
                                                injected server-side
POST /api/logout           clears the cookie
```

The session cookie is `user.expiry.HMAC-SHA256(user.expiry, AUTH_SECRET)`, set
`HttpOnly` + `Secure` + `SameSite=Lax`. Editing any part of it invalidates the
signature, so you cannot turn a `ben` session into an `effi` one. Password and
signature comparisons are constant-time, and a wrong username costs exactly as
much as a wrong password, so neither can be probed by timing.

The trip content is never sent to an unauthenticated request. The login page is
a separate document.

## Deploy

**Normally you do not.** The repo is connected to Cloudflare Workers Builds, so
merging a pull request into the default branch deploys it. That is the whole
procedure: merge, then check `/version` below.

The local path is the emergency one, for when you need a build that is not on
the default branch:

```bash
npm install
npm run deploy
```

It refuses to run unless HEAD is the tip of the remote default branch and the
tree is clean, because the mistake it exists to prevent is deploying a stale
checkout: `git pull` says "Already up to date" when you are sitting on a branch
that is not the one being merged into, so being up to date says nothing about
being current. Override deliberately:

```bash
npm run deploy -- --force
```

Either way it stamps the commit in, then reads `/version` back off the live
Worker and compares, so a deploy that did not land says so instead of looking
like a success.

First-time setup only:

```bash
npx wrangler login
npm run setup             # prompts for the passwords, generates AUTH_SECRET
```

Then check the lock actually holds:

```bash
bash scripts/smoke-test.sh https://latrip.effi-mor-e04.workers.dev
bash scripts/smoke-test.sh https://benmor2026.com/la
```

### The Workers Builds settings

In Cloudflare, Worker `latrip` (Effi's account) → Settings → Builds:

| Field | Value |
|---|---|
| Repository | `effimorremitrix/LATrip` |
| Branch | `main` |
| Build command | *(none)* |
| Deploy command | `npm run deploy` |
| Root directory | `/` |

`scripts/deploy.mjs` detects `WORKERS_CI` and skips the git guards there, since
in a build the checkout *is* the commit that was pushed, and takes the commit
from `WORKERS_CI_COMMIT_SHA`. The account is pinned by `account_id` in
`wrangler.toml`, so a build that somehow authenticated as the wrong account
fails instead of deploying.

## Which commit is live

Every deploy stamps its commit into the Worker, so a running deploy can tell you
what it is:

```bash
curl https://latrip.effi-mor-e04.workers.dev/version
```

```json
{ "version": "a570eba", "deployed": "2026-09-11T05:40:43Z" }
```

Compare it with the default branch. A `-dirty` suffix means uncommitted changes
were deployed; `unknown` means someone ran `wrangler deploy` directly instead of
going through `scripts/deploy.mjs`, and the stamp was lost.

You should rarely need to check by hand, because `npm run deploy` now reads this
endpoint back after deploying and fails if it does not match what it just sent.
That check exists because a stale deploy and a failed deploy look identical from
the outside, and the two have been confused more than once.

The same endpoint answers through the other door, `/la/version`, which is a quick
way to confirm the proxy is pointed where you think it is.

`/version` needs no login, so you can check it from a phone without signing in. It
exposes only a short commit SHA.

## Why reopening the app is cheap

The app page is about 26 KB gzipped and gets opened many times a day, often on bad
wifi. It is served with a strong `ETag` and `Cache-Control: private, no-cache`, so the
browser revalidates instead of re-downloading: a reopen costs a few hundred bytes
rather than 26 KB, unless the deploy actually changed.

`no-cache` is the important half. The browser must revalidate every time, so the Worker
re-checks the session cookie on every open. Signing out, or an expired cookie, means the
next open returns the login page rather than a 304 onto content the browser still has.
The login page and every API route stay `no-store`.

## The second door: benmor2026.com/la

The app is also reachable at **https://benmor2026.com/la/**, Ben's own domain.
That is not a second deployment. It is a 60-line proxy Worker, `proxy/`, living
in Ben's Cloudflare account, forwarding to this Worker and stripping the `/la`
prefix on the way. See `proxy/README.md`.

```
phone -> benmor2026.com/la/...  ->  latrip.effi-mor-e04.workers.dev/...
         Ben's account                Effi's account
         ben-la-proxy                 latrip
```

Three things follow from it, and all three are deliberate:

- **The `workers.dev` URL stays enabled.** It is the origin the proxy fetches.
  Cloudflare Service Bindings do not cross accounts, so there is no private
  channel available here. Both doors are password-gated and both send
  `X-Robots-Tag: noindex, nofollow, noarchive`.
- **The two doors have separate sessions.** The cookie at `/la` is re-scoped to
  `Path=/la` by the proxy, so it is never sent to the rest of Ben's site.
  Signing in at one door does not sign you in at the other.
- **In-page URLs are relative, not absolute.** `fetch('api/login')`, not
  `fetch('/api/login')`. The same HTML then resolves correctly at `/` and at
  `/la/` with no build step and no base-path config. Do not "fix" these back to
  absolute paths; it would break the `/la` door silently, because
  `benmor2026.com/api/login` is Ben's site, not this app.

### Where the proxy is actually deployed from

`proxy/` in this repo is the **source of truth** and the reviewed copy. The
running Worker was deployed from Ben's machine, out of his own repo, because the
route lives in his zone and an OAuth token minted for this account cannot see
his.

So there are two copies of a file that nothing keeps in step. The proxy is
seventy lines and finished, so this is cheap rather than free; but if you ever
change it, change it **here**, then hand the new `proxy/src/index.js` to Ben to
redeploy, and say so in the commit. Do not edit the deployed copy and let this
one rot, for the same reason `docs/workflow-guide.he.md` is re-synced deliberately
rather than edited in two places.

Neither door is indexable. There is deliberately **no** `Disallow: /la` in Ben's
`robots.txt`: a crawler has to be able to fetch the page to see the `noindex`,
and a blocked URL can still be listed from inbound links alone.

`scripts/deploy.mjs` refuses to deploy this Worker into Ben's account, and
`proxy/wrangler.toml` pins Ben's account id, so the two cannot be crossed.

## Passwords

They live only in Cloudflare, as encrypted Worker secrets. They are not in this
repository and never will be.

Rotate one without touching anything else:

```bash
npx wrangler secret put PASSWORD_BEN     # then paste the new value
```

Rotating `AUTH_SECRET` signs both users out of every device:

```bash
npx wrangler secret put AUTH_SECRET
```

| Secret          | What it does                        |
| --------------- | ----------------------------------- |
| `AUTH_SECRET`   | Signs session cookies               |
| `PASSWORD_EFFI` | Password for the `effi` login       |
| `PASSWORD_BEN`  | Password for the `ben` login        |

Because both people share one Cloudflare account, either can read or change the
other's password from the dashboard. The gate keeps other people out; it is not
a wall between אפי and בן.

## Local development

```bash
cp .dev.vars.example .dev.vars     # fill in throwaway values
npm run dev                        # http://127.0.0.1:8787
```

`.dev.vars` is gitignored and is never uploaded to Cloudflare.

## Layout

```
src/index.js     Worker: routing, login, session cookies, security headers
src/login.html   Login page (Hebrew, RTL, same palette as the app)
src/app.html     The trip app itself
src/guest.html   Read-only itinerary served to a guest session
src/days.js      The itinerary, substituted into whichever template is served
scripts/         setup-secrets.sh (one-time secrets), smoke-test.sh (post-deploy),
                 verify-local.sh (both doors, locally, without deploying)
proxy/           ben-la-proxy: the benmor2026.com/la door, deployed separately
                 to Ben's Cloudflare account
wrangler.toml    Worker config; the HTML files are imported as text modules
```

## Adding a third person

1. Add them to `USERS` in `src/index.js`: `dana: "PASSWORD_DANA"`.
2. Add a button to the picker in `src/login.html`.
3. `npx wrangler secret put PASSWORD_DANA`, then `npm run deploy`.

The app's own tab sets are keyed on `effi` / `ben` in `src/app.html`, so a new
person also needs their own entry in `TABS` and `LISTS` there.

## Observability

Workers Logs and Traces are on in `wrangler.toml`. Every rejected login emits a
structured line you can query in the dashboard or tail live:

```bash
npm run tail
```

```json
{ "event": "login_rejected", "user": "effi", "ip": "203.0.113.7" }
```

Only a username the Worker recognises is logged; anything else is recorded as
`"unknown"`, so an attacker cannot write arbitrary text into your logs. The
password is never logged. Repeated `login_rejected` lines from one IP are what
guessing looks like.

## Known limitation

There is no rate limit on `/api/login`. A wrong password costs the attacker a
forced 400 ms delay and nothing else, so the passwords need to be strong enough
to survive patient guessing on their own. The logging above makes an attempt
visible after the fact; it does not stop one. If that ever feels thin,
Cloudflare's Rate Limiting binding drops into `wrangler.toml` without touching
the auth code.
