# 322 — The pricing page had two titles, and module chips were painted with inline hex

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · scoring the screens outside the console
**Surface:** sparx.works › Pricing, the home page's switchboard, and the footer on every page
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Doty and Renée (Gillett Diesel Service), 2026-10-18, in part
**Blocked on:** —

## What happened

The pricing page had two `h1`s: the hero's "Pay for what you use. Nothing else." and the switchboard section's "Switch on what you use". The switchboard's stack card painted each module chip with an inline hex fill and a white icon, the pricing feature list painted its dots the same way, and so did the footer's domain dots on every page. RULE #1 allows a hex only in OG images and other companies' marks.

## What should have happened

One page title. Module colors from the theme: the fill class and its paired ink.

## How to reproduce

1. Open sparx.works /pricing and count the h1s.
2. Inspect a chip in "Your stack".

## Why it matters

A hex cannot follow light or dark or a token change, and a white icon on orange is the low-contrast pairing silica's `-content` inks exist to avoid.

## Where it lives

`sparx/apps/web/components/marketing/pricing-switchboard.tsx`, `stack-summary-card.tsx`, `landing/switchboard.tsx`, `pricing/features.tsx`, `footer.tsx`.

## The fix

- The switchboard heading is an `h2`.
- `StackLineItem.fill` carries `MODULE_BACKGROUND_COLOR` and `MODULE_CONTENT_COLOR` classes instead of a hex; the icon takes its ink from them.
- The feature dots and the footer dots use `MODULE_BACKGROUND_COLOR`.
- `module-strip.tsx` keeps `MODULE_HEX`: it is used only in OG images, where hex is sanctioned.

No test: the marketing app has no test suite. `check:colors` passes.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

2026-10-18. sparx.works /pricing has one h1. The stack card chips read `bg-module-builder text-module-builder-content` and so on, with no inline style, painted rgb(79, 70, 229) with white ink for Builder and rgb(249, 115, 22) with dark ink for Commerce. The feature dots read `bg-module-builder`, `bg-module-commerce`, `bg-module-cms`.

Not checked: the footer dots on screen (same classes, one line).

## Rating effect

See the screen's row under "Outside the console" in `rating.md`.
