# 218 — The legal links fell out of the bottom of the footer

**Status:** fixed
**Severity:** design
**Found by:** P03 · Juniper Row · act 6 (neighbour check on P01)
**Surface:** every tenant site whose footer is not the `columns` variant
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** the seeded tree, and a test that pins the placement — **not** on a rendered page; see "What was not seen"

## What happened

Reopening **Thistle & Rye** for the RULE #7 neighbour check, the bottom of every
page looked like this:

```
┌──────────────────────────────────────────────┐
│  Thistle & Rye              Explore          │  ← the footer band, cream
│  Join the list — new work…  What we bake     │
│  [ you@example.com ][Subscribe]  Order…      │
│  No spam, and an unsubscribe link…  About    │
│                                              │
│  © Thistle & Rye                             │
└──────────────────────────────────────────────┘
   Legal                                          ← outside it, on the page
   Privacy Policy
   Terms of Service
   Cookie Policy
   Return Policy
   Refund Policy
```

Five published legal pages, in a column that is not in the footer. Different
background, no padding, a heading a size down from the one beside it, and hard
against the left edge of the viewport.

## What should have happened

They are footer links. They go in the footer.

## Why it matters

It is the last thing on every page of the site, so it is on every page of the
site. It reads as a strip of markup that escaped rather than as part of the
business, which is the specific thing RULE #8 is about: _a site a stranger could
land on without ever knowing it was a test._

And these are the links a visitor goes looking for when they want to know whether
they can trust the shop with a card. Presenting them as the least-finished thing
on the page is the wrong impression to give at that exact moment.

## Where it lives

[site-chrome.ts](../../../../wizeworks/packages/silica-catalog/src/site-chrome.ts),
`ensureLegalLinks` — and the reason it exists is good. `fillSlots` only fills
slots a block has, and the `newsletter` footer has no `link9`, so a tenant who
chose that look got a live site with **no privacy, terms or cookie link at all**
while the Legal checklist told them everything was "linked in your footer". The
safety net appends the core when the fill could not place it.

It appended to the wrong parent:

```ts
return {
  ...footer,
  children: [...(footer.children ?? []), hostCore(HOST_KEYS.siteLegalLinks, …)],
};
```

`footer.children` is the `<footer>` element's own children, and every footer block
puts its content inside a container:

```
footer   [@container bg-base-200 border-t]
  div    [mx-auto w-full max-w-6xl px-6 py-14]     ← the band's padding lives here
    div  [grid …]                                  ← the columns live here
  HOST:site.legal-links                            ← appended out here
```

So the column landed outside the padding, outside the max-width, and outside the
background — which is exactly what the screen showed. **The safety net worked and
the result did not look like part of the site**, and nothing downstream could tell
the difference, because "is it in the footer?" was answered from a placement row
rather than from where the node ended up.

## The fix

The appended column goes into **the last grid inside the footer** — which in every
shipped variant is the grid the link columns are in — falling back to the footer's
first container so that a future variant with no grid at all still lands inside
the band. A test pins it: the core's parent must not be the `<footer>` itself, and
must carry `grid`.

The `columns` variant is untouched: its fill places the core in `link9`, so
`ensureLegalLinks` no-ops exactly as before.

## What it looks like now

The newsletter footer's seeded tree, with the core as a third link column beside
Explore and Account, inside the band:

```
footer   [@container bg-base-200 border-t]
  div    [mx-auto w-full max-w-6xl px-6 py-14]
    div  [grid grid-cols-1 gap-10 @3xl:grid-cols-2]
      div  [flex flex-col gap-4]            ← brand + subscribe
      div  [grid grid-cols-1 gap-8 @sm:grid-cols-2]
        div  [flex flex-col gap-3]          ← Explore
        div  [flex flex-col gap-3]          ← Account
        HOST:site.legal-links               ← here
    div  [mt-12 …]                          ← the copyright bar
```

## What was not seen, and why

**No rendered page.** This is the SEED, and a frame is stored per property once
seeded — so the fix reaches a site created from here on and does not reach one
that already exists. Thistle & Rye's frame carries the old placement and will keep
it until somebody moves that block in the builder, which is a one-drag job and
theirs to do.

That makes this the third time this run has met the same shape: a correction in
code that a stamped tree does not receive
([212](212-her-homepage-was-live-and-the-editor-said-it-did-not-exist.md),
[214](214-a-sold-out-size-was-selectable-and-only-the-button-said-no.md)). [212]
solved it for pages by healing on open. There is no equivalent for the frame, and
whether there should be is a bigger question than this issue.

Confirmation here is therefore the seeded tree itself and the test that pins it —
recorded plainly rather than dressed up as a screen.

## Rating effect

None — the tenant's own website has no row in [rating.md](../rating.md). Recorded
in the run log of [03-juniper-row.md](../03-juniper-row.md).
