# 022 — The live site showed "Product name $0.00"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1 (the customer side)
**Surface:** tenant site renderer (:3004) · every page with a list
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 — Gillett's homepage shows no invented product or post; Juniper Row (Piggles) still lists its real products with photos
**Blocked on:** —

## What happened

Doty published with examples off. A stranger opening his homepage read, under
"From the shop": a grey image, **Product name**, **$0.00**. Under "From the
journal": **Published date**, **Post title**, "The short summary of this post,
written in the CMS."

## What should have happened

An empty list shows nothing. A placeholder is authoring scaffolding, never a fact
on a real business's site.

## Why it matters

A diesel parts company advertising a nameless product at $0.00 on day one. Every
owner who launches before importing a catalog gets this, on every design built
from the starter.

## Where it lives

- silica's `repeat` draws its template once against an empty list (the
  placeholder-item convention, meant for the canvas).
- Piggles issue 092 fixed this with `repeatOrEmpty` (`silica-catalog/src/conditional.ts`),
  but only in the starter written in code. The captured golden starter
  (`marketplace-catalog/blueprints/sparx/site.json`), its 20 themed copies, the
  Piggles starter, and every tenant's own saved pages still carry a plain `repeat`.

## The fix

At the single render point, not in 22 captured JSON files:

- `silica-catalog/src/render.ts`: new `resolveForVisitors(tree, host, scope)` marks
  every list `omitWhenEmpty` before resolving. The HTML projection uses it.
- `wizeworks/apps/site/components/silica-chrome.tsx`: the frame and the functional
  body call it instead of `resolveTree`. Those were the only other direct calls.
- The builder canvas does not render through here, so authors keep their placeholder.
- `visitor-lists.test.ts`: a plain `repeat`, empty and full. Removing the new pass
  turns the empty case red.
- `conditional.test.ts`: its test host answered EVERY list as empty and so leaned on
  the placeholder item to draw the buy box. It now answers the product list as a
  collection-of-one, the way the live product page does (`silica-resolve.ts`).
  Same assertions.

## Confirmed by

> Re-ran P01: `localhost:3004/?tenant=gillettdiesel` — "From the shop" and "From
> the journal" headings with no invented card under them.

> Second business (RULE #7): `?tenant=juniper-row` (Piggles) still shows "The Ash
> Overshirt $128.00", "Linen Shirtdress $145.00" with photos loaded (921px).

Checks: silica-catalog 1380/1380 tests, tsc 0; site 159/159 tests, tsc 0;
builder-schemas 355/355; eslint 0; prettier clean.

Left for the brand act: the headings "From the shop" / "From the journal" still
show over empty lists. Doty's import fills the shop; whether an empty section
should hide whole is part of 023's look at the starter's content.

## Rating effect

—
