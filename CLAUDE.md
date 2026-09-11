# CLAUDE.md — LA Trip Companion

Context for any Claude Code session in this repo. Read this before touching anything.

## What this is

A Hebrew, right-to-left trip companion app for Effi Mor and his 14-year-old son Ben, covering their trip to Los Angeles from 23 September to 5 October 2026. Single-page app, deployed on a Cloudflare Worker.

Live: https://latrip.effi-mor-e04.workers.dev/

It is used on phones, in the field, often on bad hotel wifi and sometimes offline. Every design decision follows from that.

## Who uses it

The app is served behind a per-user password gate. The Worker verifies the password and hands the page a verified identity, and the app reshapes entirely around it. This is not cosmetic; the two people need different things.

**Effi** — running an unpaid consulting handover with a family friend named Yigal, who runs an ocean freight business in Los Angeles. His tabs: היום, העבודה (the Tidelane handover and Deckhand delivery), מדריך (the Tidelane workflow guide), יגאל (commercial and relationship items), לפני, טיסות, מסמכים, חירום.

**Ben** — 14, owns a small AI website-building business, is on the trip to learn. His tabs: היום, לפני, העבודה, המשימה, אנגלית, יומן, טיסות, מסמכים, חירום.

**Guest** — a third, read-only account behind a shared password, for family and friends who
want to know where we are. It gets its own template, `src/guest.html`: the itinerary
side by side with map pins, the flight times, and the base address. Nothing else. See
The guest view below.

All state is scoped per user: `trip:<user>:<key>`. Switching users must never leak one person's checklist, journal or documents into the other's view.

## Hard rules

1. **Hebrew, RTL, always.** `dir="rtl"` on the document. Any new copy is Hebrew. Latin strings (flight numbers, addresses, emails, URLs) get `dir="ltr"` on their own element so bidi does not mangle them. The two exceptions are the entry page and the guest view, which each carry an English translation behind a toggle because half the people arriving are in Los Angeles; see The language switch below. The app itself has no toggle and is not getting one, so anything you add to `src/app.html` is Hebrew.
2. **Hebrew prose uses commas and semicolons, never em dashes.**
3. **Documents never leave the device.** The vault stores passport and ESTA photos. There is no upload path, no server storage, no analytics, no telemetry. Do not add one without an explicit decision from Effi, and the app tells the user this in plain language. Keep that sentence accurate.
4. **Storage is layered and must stay that way:** `window.storage` if present, then `localStorage`, then an in-memory object. Every call is wrapped so a storage failure degrades the feature rather than breaking the page.
5. **Nothing in Ben's tabs may create an obligation or a deliverable for him.** He is 14 and he is there to learn. He is explicitly not accountable for any outcome of the work. Encouraging, never pressuring.
6. **The dates and flight details below are facts.** Do not regenerate them from memory, do not "correct" them.
7. **The Worker owns identity, never the browser.** The page receives its user from the Worker as `window.__TRIP_USER__` and has no say in it. Never reintroduce a client-side user picker and never let the page choose or change who it is; that hands anyone with the URL both accounts. See Auth and deploy below.
8. Full technical SEO and WCAG 2.2 AA accessibility apply, plus a Build → Run → Audit → Fix → Re-test pass before delivery: Lighthouse 90 or above on SEO, Accessibility and Best Practices, and axe clean of critical and serious issues. See the `web-seo-accessibility` skill.

## Trip facts

**Base:** 117 S Doheny Drive, Los Angeles, CA 90048. Yigal lives 200 metres away at 411 N Oakhurst Drive, Beverly Hills, CA 90210.

**Flights** — Austrian and Lufthansa, booking code `9JBMBP`, Economy Green. Each passenger: one 23 kg checked bag, one 8 kg carry-on, one personal item. Passengers Ben Mor and Ephraim Mor. Total paid USD 4,427.20.

| Date | Flight | Route |
|---|---|---|
| Wed 23 Sep | OS84 | Tel Aviv T3 06:00 → Vienna T3 08:45 |
| Wed 23 Sep | OS51 | Vienna 09:55 → LAX Terminal B 13:05 |
| Mon 5 Oct | LH457 | LAX 15:05 → Frankfurt T1 11:00 next day |
| Tue 6 Oct | LH694 | Frankfurt 14:00 → Tel Aviv 19:15 |

Vienna connection is 1h 10m, legal with no slack. No seats were selected at booking. Israel is 10 hours ahead of Los Angeles.

**Work sessions:** 07:00 to 10:00 at Yigal's apartment, 24 to 30 September, plus reserve sessions 2 and 3 October. Free days 1 and 4 October.

**Holidays:** Sukkot from sundown 25 September to 2 October; Shemini Atzeret 2 to 3 October; Simchat Torah 3 to 4 October. All parties agreed to work through it. Yom Kippur is 20 to 21 September, before departure, and Israel stops completely, which is why the pre-flight cutoff in the app is Saturday 19 September.

## Document vault

- Keys: `trip:<user>:docs:index` holds the array; `trip:<user>:doc:<id>` holds each file as a data URL.
- Images are downscaled to a 1500px longest edge and re-encoded as JPEG at 0.72 quality before storage. A 4 MB phone photo becomes roughly 250 KB.
- PDFs are stored as-is and refused above 3.5 MB, with a suggestion to photograph the page instead.
- Under `localStorage` the whole origin has only a few megabytes. Passport and ESTA fit comfortably; twenty photos do not. Keep the compression aggressive and do not add bulk import.

## Auth and deploy

The app is not a static file. `src/index.js` is a Cloudflare Worker that owns
identity; `src/app.html` and `src/login.html` are imported into it as text
modules and served from it.

| Route | Behaviour |
|---|---|
| `GET /` without a valid cookie | login page only, in Hebrew or English; no trip content in the response |
| `POST /api/login` | password checked against a Cloudflare secret, sets the session cookie |
| `GET /` with a valid cookie | app, with the verified user substituted into `%%TRIP_USER%%`, and the itinerary into `%%DAYS%%` |
| `GET /` with a valid `guest` cookie | `src/guest.html`, with the guest projection of the itinerary |
| `POST /api/logout` | clears the cookie; this is the יציאה button in the header |
| `GET /version` | no login needed; the commit this deploy was built from |

The app response carries a strong `ETag` and `Cache-Control: private, no-cache`, so a
reopened app revalidates instead of resending ~26 KB. `no-cache` means the cookie is
still checked on every single open: a signed-out browser gets the login page, never a
304 onto trip content it may no longer see. Everything else, the login page and all the
API and status routes, stays `no-store`.

The cookie is `user.expiry.HMAC-SHA256(user.expiry, AUTH_SECRET)`, HttpOnly,
Secure, SameSite=Lax, thirty days. Editing any field breaks the signature, so a
`ben` session cannot be rewritten into an `effi` one.

Secrets live in Cloudflare and never in git: `AUTH_SECRET`, `PASSWORD_EFFI`,
`PASSWORD_BEN`, and the optional `PASSWORD_GUEST`. Set or rotate them with `npm run setup`.
`PASSWORD_GUEST` is deliberately **not** in the missing-secret check: adding it there
would take the whole app down the moment this deployed and before the secret existed.
Unset, guest logins are refused and the other two accounts carry on. Keep it that way.
`wrangler secret put` is itself a deployment, so nothing needs redeploying
after. If any secret is missing the Worker returns 503 `not_configured` and
serves nothing. That is deliberate: an unconfigured deploy is locked, not open.

After deploying, run `bash scripts/smoke-test.sh <url>`, which checks the auth
boundary from outside.

**Merging into the default branch is what deploys.** The repo is connected to
Cloudflare Workers Builds, whose deploy command is `npm run deploy`. Deploying
by hand is the emergency path, and then it is `npm run deploy`, never bare
`wrangler deploy`, which loses the version stamp.

`scripts/deploy.mjs` stamps the commit into `APP_VERSION`, and refuses to run
locally unless HEAD is the tip of the remote default branch and the tree is
clean (`--force` overrides; the account pin does not). It then reads
`/version` back off the live Worker and fails if it does not match what it just
sent. Every one of those guards is there because the corresponding mistake was
actually made: a stale deploy has been mistaken for a failed one, and a checkout
sitting on the wrong branch has been deployed while `git pull` said "Already up
to date".

**On rule 3 and telemetry.** The vault is still client-side only, document
bytes never reach the Worker, and the sentence at `src/app.html:161` telling
the user their files stay on the device remains true. The Worker itself does
emit Workers Logs and Traces, which record request metadata and a
`login_rejected` line carrying the attempted username and the caller's IP. No
document content and no passwords are logged. If zero server-side telemetry is
wanted, remove `[observability]` from `wrangler.toml`; the cost is losing all
visibility into password guessing.

Deployment and rotation detail lives in README.md. Do not duplicate it here.

## The /la door on benmor2026.com

The app answers at two URLs. `latrip.effi-mor-e04.workers.dev` is the origin, and
`benmor2026.com/la/` is a proxy in front of it: `proxy/`, a Worker called
`ben-la-proxy` deployed to **Ben's** Cloudflare account (`2837794c...d548`), not
Effi's. Cloudflare Service Bindings do not cross accounts, so the proxy fetches
the public origin; the `workers.dev` URL therefore has to stay enabled, and both
doors stay password-gated and `noindex`.

Four things here are load-bearing:

1. **In-page URLs are relative.** `fetch('api/login')` and
   `location.replace('./')`, never `/api/login` or `/`. That one choice is what
   lets the same HTML work at `/` and at `/la/` with no build step. Absolute
   paths under `/la` resolve to `benmor2026.com/api/login`, which is Ben's site;
   the login would fail with no visible error. Do not "tidy" these.
2. **The proxy never touches cache headers.** It passes the `ETag` and
   `private, no-cache` through, for the reason in Auth and deploy above: this
   page is reopened many times a day on bad wifi. A blanket `no-store` at the
   proxy would undo that and protect nothing, since `private` already keeps the
   app out of shared caches.
3. **The routes are `benmor2026.com/la` and `benmor2026.com/la/*`, not
   `/la*`.** The single-wildcard form also swallows `/laptop`, `/latest` and
   anything else on Ben's site starting with those two letters, and forwards it
   to LATrip with the first three characters cut off.
4. **`robots.txt` on benmor2026.com must not `Disallow: /la`.** A crawler has to
   be able to fetch the page in order to see the `noindex`. Blocking the path
   instead is what gets a URL listed with no description rather than not listed
   at all. `/la` likewise never goes in Ben's sitemap or navigation.

The proxy owns the path rewrite, the cookie re-scoping to `Path=/la`, and the
noindex headers. It owns nothing else; in particular it never sees a password
and never decides who anyone is.

**`proxy/` here is the source of truth; the running Worker was deployed from
Ben's machine out of his own repo.** An OAuth token minted for Effi's account
cannot see Ben's, so the deploy has to happen there. That leaves two copies of
one file with nothing keeping them in step. The proxy is seventy lines and
finished, so this is cheap rather than free, but if it ever changes: change it
here, hand the new `proxy/src/index.js` to Ben to redeploy, and say so in the
commit. Never edit the deployed copy and let this one rot; it is the same
re-sync discipline as `docs/workflow-guide.he.md` in The מדריך tab below.

Each side is pinned to its own account so they cannot be crossed:
`account_id` in `wrangler.toml` is Effi's, `account_id` in
`proxy/wrangler.toml` is Ben's, and `scripts/deploy.mjs` refuses to run if the
first one goes missing or turns into the second.

`bash scripts/verify-local.sh` exercises both doors against two local `wrangler
dev` servers, without deploying anything.

## Tidelane, Deckhand and the two tracks

Tidelane is Effi's container shipping product. **Deckhand** is its core: container and
shipment numbers arrive by email, and today a person retypes them into INTTRA and ACE.
Deckhand removes that retyping. It is the core deliverable of the two weeks.

**v0 is built** (`28ba223` in the Yigal repo) and lands in Yigal's hands on **25.9,
session 2**: extraction only, email or attachment in, paste-ready block out, no browser
automation, nothing stored, and never a portal password. Session 3 on 26.9 hardens it
against the ugly emails in his real inbox. What is still undecided is **v1**, the
browser-assist step, and that decision comes from the numbers counted in session 1 on
24.9, not before. **v2**, autonomous inbox intake, stays out of bounds for the visit.
Do not write copy that decides v1.

Deckhand is **not** live ACE and INTTRA integration. That stays mocked and out of
bounds, because real access is a vendor agreement and not code. The app draws that line
in three places and it must stay drawn.

The two tracks are a live decision Yigal makes on the first morning, and they are
opposites on ownership:

| | מסלול א׳ | מסלול ב׳ |
|---|---|---|
| Tidelane becomes | how his company actually works | a product he uses, still Effi's |
| Ownership | transfers to him on 3 October | never moves |
| He is | the owner | the first design partner, free |
| Two weeks enough | barely | no |

The plan assumes א׳. Anything that assumes a transfer, in a checklist row or a day
plan, is Track A only and is marked `(מסלול א׳ בלבד)`. Never write copy that assumes
one track without saying which.

## The מדריך tab and the map

**מדריך** is Effi's tab holding the Tidelane workflow guide, in two parts: how to work
the system, and how to develop and deploy it. It is a **copy**, not the source. The
source of truth is `docs/workflow-guide.he.md` in the Yigal repo
(`effimorremitrix/yigal`). When that file changes, this tab does not; re-sync it
deliberately rather than editing the copy and letting the two drift apart. It is
collapsed into `<details>` sections because 325 lines of guide on a phone is a wall of
text, and the sections open one at a time.

**The map is not a map.** The היום tab renders each day's places as chips that link out
to whatever map app the phone has, via `https://www.google.com/maps/search/?api=1&query=`
with the place name. The app never draws a map itself, and it must stay that way: it
has no network budget for tiles, it has to work offline, and Ben's own checklist already
has him downloading offline LA maps, so the phone's map app is the map. Adding an
embedded tile map would mean opening the CSP for an external script and tile server, a
request on every pan, and a blank rectangle when offline. Do not do it.

**The itinerary lives in `src/days.js`**, not in either page. The Worker substitutes it
into `%%DAYS%%` in whichever template it is serving, so a day is edited in one place and
the app and the guest view cannot drift apart.

Place data is the `pl:` array on each `DAYS` entry, as
`{n: 'Hebrew label', en: 'English label', q: 'search query', ll: 'lat,lng'}`. Queries are
English for US landmarks because map apps resolve those far more reliably; the label the
user sees is Hebrew in the app, and Hebrew or English in the guest view. `en` is read only
by the guest view, and `src/index.js` strips it back out of the payload it hands the app. `ll` is preferred over `q` when present, because it pins the exact spot: "Malibu"
as text is a whole city. The two fixed addresses deliberately carry **no** `ll`; a
verbatim street address geocodes more precisely than a coordinate typed by hand. They
come from Trip facts above and are quoted verbatim.

## The guest view

`src/guest.html`, served only to a `guest` session. Four things make it safe, and all
four must stay:

1. **It is a separate template, not the app with tabs hidden.** Tab filtering happens in
   the browser, so an `app.html` served to a guest would carry Effi's commercial notes and
   Ben's journal in the page source. The guest password is shared; View Source is not a
   threat model you get to ignore.
2. **The guest itinerary is projected in the Worker, not filtered in the page.** A page
   that renders `gt` but is handed `t` has hidden nothing. `GUEST_DAYS` in `src/index.js`
   rebuilds each day from `gt`/`gam`/`gpm` and drops `n`, so the working mornings never
   reach the response at all. If you add a field to a day, decide whether a guest may see
   it, and add it to that projection or leave it out.
3. **It shows the flight times, never the booking code, the passenger names or the
   USD 4,427.20.** The guest page holds no checklist, no journal and no vault, and writes
   nothing to storage.
4. **The English is the English of the GUEST day, never of the real one.** A day's `en`
   says `Work morning`, never the session number, because `en` is rendered by the one page
   that is allowed to see only `gt`. Translating `t` or `n` into `en` would walk the
   working mornings straight back into the guest response in the other language. When you
   add a field, decide for both languages at once.

The guest page's own half of the language switch is the `en` field on each day; the
rest is described in The language switch below.

The working mornings are a handover of someone else's freight business. Session numbering,
Deckhand, QuickBooks and the ownership transfer are Yigal's business, so a guest sees
`בוקר עבודה` and the afternoon plan. Ben's `שלושה עסקים` mission is likewise hidden behind
`gpm`; he is 14 and his personal challenge is not semi-public.

Verify a change here by logging in as guest and grepping the response body, not by looking
at the rendered page.

## The language switch

Two pages have one: `src/login.html`, the entry page anyone lands on, and
`src/guest.html`. `src/app.html` does not and is not getting one.

**Both languages ship in the one response, and the toggle is a repaint rather than a
request.** This is read on aeroplanes and on hotel wifi, and a language switch that needs
the network is a language switch that fails exactly when it is wanted. Static chrome is
duplicated as `.l-he` and `.l-en` span pairs with the English marked `hidden` in the
markup, so a visitor with no JavaScript gets a readable Hebrew page rather than both
languages at once. Strings that script rewrites cannot be span pairs, so the entry page's
subtitle and its error line come from a `T` dictionary instead, and every one of them is
written by a single `paint()`; that is what keeps the subtitle, the error and the page
title from falling out of step with the toggle.

**`src/lang.js` is the one definition of the rule.** `detectLang`, `applyLangSpans` and
`applyLangButtons` live there as a string that `src/index.js` substitutes into `%%LANG%%`
in both templates, the same way the itinerary goes into `%%DAYS%%`. Two standalone pages
with no build step would otherwise hold two copies of the detection rule and drift.

**The default is picked in the browser**, from the phone's language list first and its
timezone only as a tiebreak. What someone reads is a better guess than where they are
standing, so an Israeli cousin in Los Angeles still lands in Hebrew, and Doheny Drive
neighbours land in English. Deliberately **not** `request.cf.country`: geography answers
the wrong question, and a body that varies by country varies the `ETag` with it.

**Nothing about the choice is stored**, on either page, so the guest view's "writes
nothing to storage" stays literally true and a reload re-detects. That is the decision,
not an oversight; if you ever make it persistent it is one key, and this section has to
say so.

Both pages flip `dir` to `ltr` in English, so any new CSS here uses logical properties,
`text-align:start` and `border-inline-start`, never the physical ones. The two toggle
buttons read `עברית` and `English` and are named by their own visible text rather than by
an `aria-label`, so what a voice-control user says is what is written on them.

## Content that must stay accurate

Some copy in this app is load-bearing and was written deliberately. Do not soften or "improve" it without asking:

- Ben's seven session rules, especially rule 1 (phone stays in the pocket for three hours) and rule 7 (fill the journal before standing up, not in the evening).
- Effi's four uncomfortable conversations in the יגאל tab: the USD 4,427.20 already paid, the one-sentence IP carve-out, the three-hour daily boundary, and the ownership transfer on 3 October. Conversations 2 and 4 each carry a מסלול א׳ version and a מסלול ב׳ version, because the tracks are opposites on ownership. Both versions must stay; deleting either leaves the wrong script to read aloud.
- The security checklist in Effi's העבודה tab. Those items must close before real shipment data enters Tidelane.
- The English pitch script in Ben's המשימה tab. It is written to be spoken by a nervous 14-year-old, not to read well.

## Related

The other repo in this trip is Tidelane, the container shipping application being handed over to Yigal: https://yigal.effi-mor-e04.workers.dev/. This app is a companion to that work, not part of it. Do not import code or dependencies between them.
