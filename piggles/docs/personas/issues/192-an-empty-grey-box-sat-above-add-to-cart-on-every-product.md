# 192 — An empty grey box sat above Add to cart on every ordinary product

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 4
**Surface:** Juniper Row's own website — every product that is not made to order
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

On the Ash Overshirt's page, between the description and the Quantity box, sat a
bordered grey panel with **nothing in it**. Not a spacer, not a skeleton — a real
box, drawn, empty, on the buy box of a product with nothing wrong with it.

It was on every product in the shop except the one it was built for.

## Why it matters

It is the made-to-order notice from [184], shipped the same day, on the same
walk. A panel that appears on the wrong products is worse than a panel that does
not appear: a shopper reads a drawn box as something that failed to load, and the
place it failed is directly above the button that takes their money.

## Where it lives

`madeToOrderNote()` in
[commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts)
hangs on `visibleWhen(…, 'madeToOrder.shown')`, and
[silica-data.ts](../../../../wizeworks/apps/site/lib/silica-data.ts) returned
`madeToOrder: {}` for a product with no rule.

An ABSENT key and an EMPTY one are not the same thing to the engine, and this is
the third time that distinction has bitten this week (see [187]).
`resolveScoped` cannot walk `madeToOrder.shown` through an empty object, so
`resolveBinding` answers `undefined`, which means **unknown ref** — and silica's
documented contract for an unknown ref is to keep the node's AUTHORED content and
fire a diagnostic, precisely so a typo announces itself instead of eating a
section. Here the authored content is an empty box.

`false`, `''` and `[]` all resolve as FOUND and drop the node. Only absence keeps
it.

## The fix

`madeToOrderRecord` returns every key, always — `shown: false` and three empty
strings when there is nothing to say. The ref becomes answerable, the answer is
falsy, and the engine drops the panel.

The same applies inside it: a made-to-order product with no deposit used to leave
an empty `<span>` for the same reason, and all four keys are now always present.

## Confirmed on screen

**The Ash Overshirt** — the empty box is gone; the description runs straight into
Choose yours.

**The Marlow Knit**, which IS made to order, still carries the real panel:
"Made to order. Ready from Sunday, August 30 — we need 5 days to make it." and
"This shop takes payment in person, so nothing is charged on this website." So
the fix removed the false case without touching the true one.

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).
