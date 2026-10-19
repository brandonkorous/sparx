# 319 — Product panels said the product name twice

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › a product › Where it is sold, Repeat orders, Translations, Reviews; Content › Translations › a product; sparx console
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

On five product panels, the toolbar named the product ("Cummins Fuel Injection Crossover Tube O-Ring") and a large heading right under it named it again. Fitment and Build on the same product carry the name once and use the heading for what the panel says. Piggles had already removed the second name.

## What should have happened

The name once, in the toolbar, and the panel's own sentence under it.

## How to reproduce

1. Open a product's Translations panel.

## Why it matters

Identity once is a house rule for detail screens. A repeated name pushes the panel's real content down and looks like a mistake.

## Where it lives

`surfaces/commerce/product-channels.tsx`, `product-subscriptions.tsx`, `product-translations.tsx`, `product-reviews.tsx`, and `surfaces/cms/translation-detail.tsx`.

## The fix

The in-body level-1 heading is gone from all five. The toolbar keeps the name, as in Piggles.

No test: layout only.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. On the O-Ring, Where it is sold, Repeat orders, Translations and Reviews each open with the name in the toolbar, then their sentence ("Every place this product is offered, and whether each one is live.", "Written in one language. …").

## Rating effect

See the panes' rows in `rating.md`.
