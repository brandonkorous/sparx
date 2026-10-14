# 257 — An order promised a lead time the supplier did not have

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 252 (Piggles as The Marrow Review, adding Kestrel Paper Co. and placing PO-000001)
**Surface:** Stock › Suppliers › one supplier, and Stock › Orders to suppliers › one order, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Rosalind added Kestrel Paper Co. as a supplier. The "Days to arrive" box showed a grey
**7**. It looked filled in, so she left it. Nothing was saved: the 7 was only a
placeholder.

Then she drafted PO-000001. Under "Expected" the form said: "When you expect it. Left
blank, the supplier's usual lead time fills it in when you place the order." She left it
blank and placed the order. The order says Expected "No date". Kestrel has no usual lead
time, so nothing filled it in.

Two faults, one after the other:

1. A placeholder number on the supplier form looks like a value that is set.
2. The order form makes a promise about the supplier without looking at the supplier.
   The form already loads every supplier's lead time (`useSuppliers`), and never reads it.

## What should have happened

- The supplier form has no number in an empty "Days to arrive" box, and says what a
  blank box means: orders get no expected date until one is set.
- The order form says what will really happen for the supplier chosen:
  - with a lead time of 10 days: "Left blank, it is set 10 days after you place the
    order: Kestrel Paper Co.'s usual time."
  - with none: "Kestrel Paper Co. has no usual delivery time, so left blank the order has
    no expected date."

## How to reproduce

1. Stock › Suppliers › Add a supplier. Leave "Days to arrive" as it shows. Save.
2. Draft an order to that supplier. Leave "Expected" blank. Place it.
3. The order says Expected "No date".

## Why it matters

The expected date drives "late" warnings and what is on the way. An owner who believed
the form has no date on any order, and no warning when one is late.

## Where it lives

- `surfaces/inventory/supplier-detail.tsx` (the "Days to arrive" box)
- `surfaces/inventory/purchase-order-detail.tsx` (the "Expected" description)

## The fix

- New `surfaces/inventory/expected-date-words.ts` per console: `expectedDateHelp(supplier)`
  says what a blank "Expected" becomes for the supplier chosen (N days and whose usual
  time; or "has no usual delivery time, so … no expected date"; or only "When you expect
  it." before a supplier is chosen).
- The order form finds the chosen supplier in the list it already loaded and passes it
  in. The fixed promise is gone.
- The supplier form: no placeholder number in "Days to arrive". It says "Their usual
  delivery time. It sets each new order's expected date. Left blank, orders have no
  expected date until you give one."

sparx: `purchase-order-detail.tsx`, `supplier-detail.tsx`. Piggles: both files were over
the size rule, so they were split first (the order form into 28 files, the "Expected"
field now in `purchase-order-fields-terms.tsx`; the supplier form into 12, "Days to
arrive" now in `supplier-detail-fields.tsx`).

Tests: `expected-date-words.test.ts` in both consoles. The two form cases were red before
the change, then green. Piggles inventory tests: 296 of 296 green; a scoped type check of
the split files is clean (it found two unnamed toast types in the split hooks, fixed).

## Confirmed by

- sparx, Doty: a new order, no supplier: "When you expect it." With Alliant Power (5
  days): "Left blank, it is set 5 days after you place the order: Alliant Power's usual
  time." The new supplier form shows no number and the new words. The order was closed
  without saving.
- Piggles, Rosalind: a new order with Kestrel Paper Co. (no lead time): "Kestrel Paper
  Co. has no usual delivery time, so left blank the order has no expected date." The new
  supplier form shows no number and the new words. Kestrel's own page still draws every
  section after the split.

## Rating effect

Order to a supplier (new) and Supplier: the form says what will really happen.
