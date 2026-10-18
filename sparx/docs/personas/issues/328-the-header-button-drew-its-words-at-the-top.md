# 328 — The header button drew its words at the top

**Status:** fixed
**Severity:** minor
**Found by:** Brandon, watching P01 · Gillett Diesel Service · act 9
**Surface:** Gillett site header, every wide screen; the 22 designs built from the captured `sparx` header
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Doty and as a stranger (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

On a wide screen, "Get in touch" in Gillett's header sat against the top of its red fill. It did not line up with "Sign in" and the cart beside it.

## What should have happened

The words sit in the middle of the button, like every other button.

## How to reproduce

1. Open any page of a site built from the captured `sparx` header, 1024px wide or more.
2. Look at the header's filled button.

## Why it matters

It is the one button the header exists to show. Off-center, it looks broken.

## Where it lives

`wizeworks/packages/silica-catalog/src/upgrade-frame.ts` (`fitHeaderOnPhone`, `centerBarButtons`); `marketplace-catalog/blueprints/sparx/site.json`; the generators `gen-sparx-themed.ts` and `gen-piggles-showcase.ts`.

## The fix

- Not silicaui's fault, and not Gillett's. silicaui's `.btn` is an `inline-block` and centers its words with `align-content: center`. That works in a block box and does nothing in a single-line flex box.
- The phone repair (issue 291) hid the button on a phone and showed it again at 1024px with `@5xl:inline-flex`. That made it a flex box, and the centering stopped.
- It now shows the button again with `@5xl:inline-block`. The light/dark switch keeps `@5xl:inline-flex`: it is a wrapper, not a `.btn`.
- Headers already repaired the old way get `centerBarButtons`: a `.btn` with only words, `hidden` and `@5xl:inline-flex` becomes `@5xl:inline-block`. A button with an icon is left alone: silicaui centers that one with its own `.btn:has(svg)` flex rule.
- Like every frame repair, it lands on the draft when the owner opens the builder, and on the site when she publishes.
- Designs: the captured `sparx` file patched (1.6.6), the 20 themed copies (1.5.6) and the Piggles starter (1.3.6) regenerated. 22 of 22 now carry `@5xl:inline-block`; none carries the old class on a button.

Tests: `upgrade-frame.test.ts` (3 new, 1 changed): the phone repair writes `inline-block`; an old header is put right, the switch is left alone and it runs once; a button with an icon is left alone. Red with the step removed and the old class restored (2 fail). Suites: silica-catalog 44 files / 1479, site-lint 18 / 403. `check-blueprint-versions` and `check-blueprint-journal` OK.

## Confirmed by

2026-10-18. As Doty, the builder drew "Get in touch" centered and said "Saved, not live yet"; Publish said "Your site is published". On the live /about page the button reads `btn btn-primary btn-sm hidden @5xl:inline-block` and its words sit in the middle, level with "Sign in" and the cart.

## Rating effect

The site header row under "Outside the console" in `rating.md` keeps its score: it was scored on a narrow screen.
