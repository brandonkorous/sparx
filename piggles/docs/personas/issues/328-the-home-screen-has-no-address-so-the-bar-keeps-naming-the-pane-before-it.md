# 328 — Home has no address, so the bar goes on naming whatever she was looking at before

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · while adding the open-call check for [327]
**Surface:** mypiggles › Home, and the browser address bar
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** `/home` opening this console's Home, and the address check going
red when the route is taken away

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

## The fix

**A brand on the route.** `AppRoute` gains an optional `brand`, `/home` appears
twice, and each console resolves its own. This was written up as a decision
between three options, two of which would have given the Piggles console a
second-choice address permanently. It was not a decision worth anybody's time:
every product's front door should be `/home`, because that is what a person
typing it expects from either, and the only thing standing in the way was that
one table could not spell one path twice.

**Nothing in the sparx console changed, and nothing had to.** The two directions
are not symmetrical:

- `buildPath` is keyed by SURFACE, and each Home is its own surface, so both
  already build `/home` with no notion of brand at all.
- `matchPath` is the only ambiguous direction, so it takes the brand as an
  optional third argument. Absent, the unbranded route answers — which is what
  sparx passes today and what every other caller passes for every other address.

So a brand is a PREFERENCE, never a filter: a console asking for a path that
varies by nothing still gets the one shared row. That is what lets a single
branded route exist without all 340 others having to declare a brand.

Two invariants moved with it, both in `test/routes.test.ts`:

- **"no duplicate path"** becomes **"no duplicate path within a brand"**. Two
  rows for one path in one brand is still the ambiguity it was guarding.
- **A branded route must have a shared route to fall back to.** Without one, a
  console that did not ask for that brand gets nothing — a silent dead link,
  which is the thing this table exists to make impossible.
- The **round trip** now asks as the product that owns the route. It is a
  property within a brand, not across them.

`piggles.home` came off `NO_ADDRESS_YET` in
[check-surface-routes.mjs](../../../../scripts/check-surface-routes.mjs), and that
list is now **empty** — 341 surfaces, all addressed, none recorded as an
exception. Proved red by deleting the route: the check names `piggles.home` and
exits 1.

## Confirmed by

The check, red then green, and 60 tests in `@wizeworks/links` including four that
pin the behaviour directly: each product's Home at the same path, both building
`/home`, every non-varying address still resolving for a branded caller, and an
unknown brand getting the shared answer rather than nothing.

## Rating effect

Against `Home`. Small, and only visible to someone who reads the address bar or
tries to share a link — but it was the last surface in either console without an
address, and the exception list it lived on is now empty.
