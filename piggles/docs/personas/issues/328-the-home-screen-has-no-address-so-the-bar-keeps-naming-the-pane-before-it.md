# 328 — Home has no address, so the bar goes on naming whatever she was looking at before

**Status:** open
**Severity:** minor
**Found by:** P03 · Juniper Row · while adding the open-call check for [327]
**Surface:** mypiggles › Home, and the browser address bar
**Filed:** 2026-08-29
**Blocked on:** decision — one route table serves two consoles, and `/home` is
already taken by sparx's Home

## What happened

Devi was on the Publish screen. She clicked **Home** in the tab strip. Home came
to the front, and the address bar did not change:

```
active pane:   Home
address bar:   /builder/publish?site=primary
```

So the bar now names a screen she is not looking at. If she copies it to send
someone "here's my Piggles", they get her Publish screen.

Typing `/home` does not reach it either. That lands on

> `/link-not-found?detail=workbench.home&reason=unknown-path`

which is honest, and is the console telling her that its own Home is not there.

## What should have happened

Focusing Home puts Home's address in the bar, and that address opens Home.

Every other pane in the console does this. That is the whole point of the route
table: [routes.ts](../../../../wizeworks/packages/links/src/routes.ts) opens by
saying it is "the app's public URL vocabulary… written for the person pasting a
link into a chat message."

## How to reproduce

Every time.

1. Open any pane with an address — Publish, Stock, a customer.
2. Click **Home** in the tab strip.
3. The address bar still names the previous pane.

## Why it matters

**A stale address is worse than a blank one.** A bar reading `/` while she looks
at Home is merely unhelpful. A bar reading `/builder/publish` while she looks at
Home is wrong, and she has no reason to distrust it — so the link she sends is
confidently the wrong screen.

It is small for Devi. It is not small for support: "send me a link to what you
are looking at" is the first thing anyone asks, and Home is where people start.

## Where it lives

Home is registered as `piggles.home` in
[piggles-catalog.ts](../../../apps/workbench/lib/surfaces/piggles-catalog.ts),
whose comment is explicit that this is deliberate:

```ts
// NOT 'workbench.home'. That key belongs to the platform's Start here, which
// stays exactly as it is for sparx; this is a second, differently-shaped
// answer to "what do I look at first", and only the Piggles console opens
// it. Keys are persisted in saved layouts, so this one is permanent.
```

The route table has one row for the concept, and sparx already has it:

```ts
{ path: '/home', surface: 'workbench.home' },
```

**Both consoles read that one table.** It has no notion of which brand a path is
for, so `/home` cannot mean two things, and `piggles.home` cannot have `/home`.
This is the only surface in either console in that position.

**It was invisible to the check that exists for exactly this.**
`check-surface-routes.mjs` fails the build on a surface with no address — but it
only ever read `lib/surfaces/catalog/*.ts`, and `piggles.home` is registered one
directory up, in a file of its own. The check has now been widened to read that
file too, which is what surfaced this; `piggles.home` is recorded in
`NO_ADDRESS_YET` against this issue so the gap is named rather than invisible,
and any OTHER unaddressed surface still fails. Same shape as
[[feedback_structural_checks_go_blind]]: the check was green over a file it was
not looking at.

## The fix, and why it is not made here

Three ways to give it an address, and the choice is a product one about a URL
people will paste:

1. **A brand on the route.** `AppRoute` gains an optional brand, `/home` exists
   twice, and each console resolves its own. Cleanest, and it is the only option
   that lets both products call their front door `/home` — which is what someone
   typing it will expect from either. Touches the shared package and the sparx
   console's resolver, so it is not a Piggles-side change.
2. **A different path for Piggles' Home** — `/start`, say. One line, no shared
   contract touched, and it works today. It also means the Piggles console's home
   is at an address that reads like a second-choice name, permanently, because
   these are persisted in saved layouts and in links people have sent.
3. **Leave it.** Home stays unlinkable and the bar stays stale.

Option 1 is right and option 2 is cheap. Picking between them is Brandon's — it
decides what a Piggles customer's home address IS.

## Rating effect

Against `Home`. Small, and only visible to someone who reads the address bar or
tries to share a link.
