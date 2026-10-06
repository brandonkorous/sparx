# 001 — The sparx home page scrolled sideways on a normal desktop screen

**Status:** fixed
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** sparx.works › every page › footer
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-opened sparx.works at 1411px — page 1411px wide, no element past the edge, footer in two rows of four
**Blocked on:** —

## What happened

Doty landed on sparx.works in a 1411px-wide window. A horizontal scrollbar sat
under the page from the first screen. Measured: the page was **1585px** wide in a
**1411px** window. The element past the edge was the footer's last link column
("Legal & trust"), which started at 1462px.

## What should have happened

No sideways scroll at any width. The footer's own comment says the single-row
layout needs ~1085px and switches on at `xl` (1280px).

## How to reproduce

1. Open http://localhost:3003/ in a window between 1280px and ~1620px wide.
2. A horizontal scrollbar shows. Scroll right: the footer's last column is there.

Every time, on every page (the footer is on all of them).

## Why it matters

Every visitor on a common laptop or desktop width sees a page that wobbles
sideways. It reads as unfinished on the first screen of the product.

## Where it lives

`sparx/apps/web/components/marketing/footer.tsx`: the footer flips to one row at
`xl` (`xl:grid-flow-col xl:grid-cols-none`). The comment measured six columns plus
the brand aside at ~1085px. There are now **seven** columns, and the row measures
~1620px, so `xl` is far too early.

## The fix

`footer.tsx`: dropped the `xl:grid-flow-col xl:grid-cols-none` single-row switch and added `xl:grid-cols-4`. The footer now stacks at every width (1 → 2 → 3 → 4 tracks), so an eighth column adds a row instead of a scrollbar. The comment that carried the stale ~1085px measurement now says why. Sibling check: the domain bar below it already used `grid-cols-1` and did not overflow.

## Confirmed by

> Re-ran P01 act 1. Reloaded http://localhost:3003/ in the same 1411px window: `scrollWidth` 1411 = `clientWidth` 1411, nothing measured past the right edge. Pressed End: the footer reads Brand · Modules · Platform · By industry, then Developers · Partners · Company · Legal & trust.

Not yet checked at 360px or in dark mode (scored with the home page row).

## Rating effect

Recorded on the sparx.works home row in rating.md.
