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

All state is scoped per user: `trip:<user>:<key>`. Switching users must never leak one person's checklist, journal or documents into the other's view.

## Hard rules

1. **Hebrew, RTL, always.** `dir="rtl"` on the document. Any new copy is Hebrew. Latin strings (flight numbers, addresses, emails, URLs) get `dir="ltr"` on their own element so bidi does not mangle them.
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
| `GET /` without a valid cookie | login page only; no trip content in the response |
| `POST /api/login` | password checked against a Cloudflare secret, sets the session cookie |
| `GET /` with a valid cookie | app, with the verified user substituted into `%%TRIP_USER%%` |
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

Three secrets live in Cloudflare and never in git: `AUTH_SECRET`,
`PASSWORD_EFFI`, `PASSWORD_BEN`. Set or rotate them with `npm run setup`.
`wrangler secret put` is itself a deployment, so nothing needs redeploying
after. If any secret is missing the Worker returns 503 `not_configured` and
serves nothing. That is deliberate: an unconfigured deploy is locked, not open.

After deploying, run `bash scripts/smoke-test.sh <url>`, which checks the auth
boundary from outside.

Deploy with `npm run deploy`, never bare `wrangler deploy`. The npm script runs
`scripts/deploy.mjs`, which stamps the current commit into `APP_VERSION` and warns if
the branch is behind its remote. `curl <url>/version` then says which commit is live,
so a stale deploy is distinguishable from a broken one. This matters: a stale deploy
has already been mistaken for a failed one once.

**On rule 3 and telemetry.** The vault is still client-side only, document
bytes never reach the Worker, and the sentence at `src/app.html:161` telling
the user their files stay on the device remains true. The Worker itself does
emit Workers Logs and Traces, which record request metadata and a
`login_rejected` line carrying the attempted username and the caller's IP. No
document content and no passwords are logged. If zero server-side telemetry is
wanted, remove `[observability]` from `wrangler.toml`; the cost is losing all
visibility into password guessing.

Deployment and rotation detail lives in README.md. Do not duplicate it here.

## Tidelane, Deckhand and the two tracks

Tidelane is Effi's container shipping product. **Deckhand** is its core: container and
shipment numbers arrive by email, and today a person retypes them into INTTRA and ACE.
Deckhand removes that retyping. It is the core deliverable of the two weeks and it owns
session 3 on 26.9. The mechanism, whether UI automation, a real integration, or clean
extraction that a human pastes, is deliberately undecided until the real emails are
seen on 24.9. Do not decide it in copy.

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
collapsed into `<details>` sections because 293 lines of guide on a phone is a wall of
text, and the sections open one at a time.

**The map is not a map.** The היום tab renders each day's places as chips that link out
to whatever map app the phone has, via `https://www.google.com/maps/search/?api=1&query=`
with the place name. The app never draws a map itself, and it must stay that way: it
has no network budget for tiles, it has to work offline, and Ben's own checklist already
has him downloading offline LA maps, so the phone's map app is the map. Adding an
embedded tile map would mean opening the CSP for an external script and tile server, a
request on every pan, and a blank rectangle when offline. Do not do it.

Place data lives in the `pl:` array on each `DAYS` entry in `src/app.html`, as
`{n: 'Hebrew label', q: 'search query'}`. Queries are English for US landmarks because
map apps resolve those far more reliably; the label the user sees stays Hebrew. The two
fixed addresses come from Trip facts above and are quoted verbatim.

## Content that must stay accurate

Some copy in this app is load-bearing and was written deliberately. Do not soften or "improve" it without asking:

- Ben's seven session rules, especially rule 1 (phone stays in the pocket for three hours) and rule 7 (fill the journal before standing up, not in the evening).
- Effi's four uncomfortable conversations in the יגאל tab: the USD 4,427.20 already paid, the one-sentence IP carve-out, the three-hour daily boundary, and the ownership transfer on 3 October. Conversations 2 and 4 each carry a מסלול א׳ version and a מסלול ב׳ version, because the tracks are opposites on ownership. Both versions must stay; deleting either leaves the wrong script to read aloud.
- The security checklist in Effi's העבודה tab. Those items must close before real shipment data enters Tidelane.
- The English pitch script in Ben's המשימה tab. It is written to be spoken by a nervous 14-year-old, not to read well.

## Related

The other repo in this trip is Tidelane, the container shipping application being handed over to Yigal: https://yigal.effi-mor-e04.workers.dev/. This app is a companion to that work, not part of it. Do not import code or dependencies between them.
