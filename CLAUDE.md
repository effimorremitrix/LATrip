# CLAUDE.md — LA Trip Companion

Context for any Claude Code session in this repo. Read this before touching anything.

## What this is

A Hebrew, right-to-left trip companion app for Effi Mor and his 14-year-old son Ben, covering their trip to Los Angeles from 23 September to 5 October 2026. Single-page app, deployed on a Cloudflare Worker.

Live: https://latrip.effi-mor-e04.workers.dev/

It is used on phones, in the field, often on bad hotel wifi and sometimes offline. Every design decision follows from that.

## Who uses it

The app opens on a user picker and reshapes entirely around the choice. This is not cosmetic; the two people need different things.

**Effi** — running an unpaid consulting handover with a family friend named Yigal, who runs an ocean freight business in Los Angeles. His tabs: היום, העבודה (the Tidelane handover and Deckhand delivery), יגאל (commercial and relationship items), לפני, טיסות, מסמכים, חירום.

**Ben** — 14, owns a small AI website-building business, is on the trip to learn. His tabs: היום, לפני, העבודה, המשימה, אנגלית, יומן, טיסות, מסמכים, חירום.

All state is scoped per user: `trip:<user>:<key>`. Switching users must never leak one person's checklist, journal or documents into the other's view.

## Hard rules

1. **Hebrew, RTL, always.** `dir="rtl"` on the document. Any new copy is Hebrew. Latin strings (flight numbers, addresses, emails, URLs) get `dir="ltr"` on their own element so bidi does not mangle them.
2. **Hebrew prose uses commas and semicolons, never em dashes.**
3. **Documents never leave the device.** The vault stores passport and ESTA photos. There is no upload path, no server storage, no analytics, no telemetry. Do not add one without an explicit decision from Effi, and the app tells the user this in plain language. Keep that sentence accurate.
4. **Storage is layered and must stay that way:** `window.storage` if present, then `localStorage`, then an in-memory object. Every call is wrapped so a storage failure degrades the feature rather than breaking the page.
5. **Nothing in Ben's tabs may create an obligation or a deliverable for him.** He is 14 and he is there to learn. He is explicitly not accountable for any outcome of the work. Encouraging, never pressuring.
6. **The dates and flight details below are facts.** Do not regenerate them from memory, do not "correct" them.
7. Full technical SEO and WCAG 2.2 AA accessibility apply, plus a Build → Run → Audit → Fix → Re-test pass before delivery: Lighthouse 90 or above on SEO, Accessibility and Best Practices, and axe clean of critical and serious issues. See the `web-seo-accessibility` skill.

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

## Content that must stay accurate

Some copy in this app is load-bearing and was written deliberately. Do not soften or "improve" it without asking:

- Ben's seven session rules, especially rule 1 (phone stays in the pocket for three hours) and rule 7 (fill the journal before standing up, not in the evening).
- Effi's four uncomfortable conversations in the יגאל tab: the USD 4,427.20 already paid, the one-sentence IP carve-out, the three-hour daily boundary, and the ownership transfer on 3 October.
- The security checklist in Effi's העבודה tab. Those items must close before real shipment data enters Tidelane.
- The English pitch script in Ben's המשימה tab. It is written to be spoken by a nervous 14-year-old, not to read well.

## Related

The other repo in this trip is Tidelane, the container shipping application being handed over to Yigal: https://yigal.effi-mor-e04.workers.dev/. This app is a companion to that work, not part of it. Do not import code or dependencies between them.
