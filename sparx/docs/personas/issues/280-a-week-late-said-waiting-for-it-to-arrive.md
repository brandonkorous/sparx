# 280 — PO-000002, a week past its day, said only "Waiting for it to arrive"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating Stock › Purchase orders › PO-000002
**Surface:** a placed purchase order's status box, sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

On October 14, PO-000002 (Alliant Power) showed a calm blue box:

> 1 of 1 units still to come
> Placed with the supplier. Waiting for it to arrive. Emailed to orders@alliantpower.test …

Further down: "Expected: October 7, 2026", and under "When it is expected": "It is what
the overdue list is measured against." The order itself never said it was late.

## What should have happened

"It is 7 days late: it was due October 7." in a warning box, on the order. And "1 of 1
unit".

## How to reproduce

1. Sign in as Doty. Open Stock › Purchase orders › PO-000002 after October 7.

Every placed or partly received order past its expected day.

## Why it matters

The owner opens the order to see where it stands. The one fact she needs to chase the
supplier was two cards down, as a bare date.

## Where it lives

`surfaces/inventory/purchase-order-detail.tsx` (sparx) and
`surfaces/inventory/purchase-order-summary.tsx` (Piggles) drew the box from
`purchaseOrderState`, which knows the status but not the day.

## The fix

- `surfaces/inventory/po-late-words.ts` (new, both consoles): `lateWords` says how late a
  submitted or partly received order is, from its expected day, or nothing.
- Both boxes turn warning and lead with it when it applies.
- "1 of 1 unit still to come": the plural follows the count, in both.
- The neighbor: the sparx Purchase orders list showed both of Gillett's orders, each a
  week late, as plain "Placed" and "Partly received". Each row now carries a warning
  "7 days late" badge beside its state (`lateBadge`, same file, on the same day count).
  The same list ran past its pane at both widths (771 in 735, 457 in 343): the name
  cell's minimum drops to 160px below `@lg`, State folds into the name cell below
  `@md`, and Supplier, Expected and Still due appear at `@3xl`, `@4xl` and `@5xl`. Now
  it fits at both. Piggles' list (`purchase-orders-list.tsx`, over its 250-line rule)
  waits on that split.

Tests: `surfaces/inventory/po-late-words.test.ts` (4) in both consoles. Scoped type
checks and lint clean.

## Confirmed by

sparx as Doty, PO-000002: an amber box, "It is 7 days late: it was due October 7. Placed
with the supplier. Waiting for it to arrive. Emailed to orders@alliantpower.test …".

sparx as Doty, Purchase orders: both rows read "7 days late" beside their state, and the
table fits its pane in the wide view and at 360px.

## Rating effect

inventory.purchase-orders.detail: where it stands, including late.
