# 320 — The product type form said "Id" and "your these products"; repeat orders were also subscriptions

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Selling › Product types › New product type (and an existing one); sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

The new product type form said "What you call it, and the id products use.", labeled the permanent name field "Id", and printed each attribute's code under its name ("Details / details"). With the plural name left blank, the attributes section read "The extra details every one of your these products holds." With only a name set, it read "every one of your Wheel".

## What should have happened

"Reference name", the word [299] settled on for every permanent name. No code under an attribute's name. A sentence that reads right whatever is filled in.

## How to reproduce

1. Selling › Product types › New product type.
2. Leave the plural name blank and read the Attributes section.

## Why it matters

An owner reads "Id" and a code line as something not meant for them, and broken grammar reads as a broken page.

## Where it lives

`surfaces/commerce/product-type-detail.tsx` in each console; `surfaces/commerce/subscriptions-list.tsx` (sparx) and `lib/surfaces/catalog/commerce-orders.ts` in each console.

## The fix

- "Reference name", with "A short permanent name used behind the scenes…", and the section line "the permanent name products use behind the scenes".
- The attribute row no longer prints its code.
- The repeat orders list and the "+" menu say "Start a repeat order", as Piggles does, instead of "Start a subscription" over a page about repeat orders. "repeat orders" is a search word for it.
- The Attributes line reads "each of your Wheels", "each Wheel", or "each product of this kind", from what is filled in.

No test: words on the page.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. New product type reads "What you call it, and the permanent name products use behind the scenes.", "Reference name / A short permanent name used behind the scenes…", and "The extra details each product of this kind holds." The Details attribute shows "Details / Long text" with no code line. Selling › Subscriptions shows "Start a repeat order" in the toolbar and in the empty state.

Not checked: Piggles on screen.

## Rating effect

See the pane's row in `rating.md`.
