# 364 — "Bluffdale Bolt Co.." and a CSV feed that "routes" orders

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · checking issue 170, as Doty
**Surface:** workbench › Dropshipping › a supplier order, and a supplier's state, in both consoles
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19 (sparx)
**Blocked on:** —

## What happened

- A supplier order not placed yet read "This order has not gone to Bluffdale Bolt Co.. Send it
  to them": a name that ends in a period, with the sentence's period after it.
- A connected CSV-feed supplier read "Working normally. Its catalog can be synced and orders
  can be routed to it." Orders never go to a feed: the connect form itself says "you place
  each one with them yourself".

## What should have happened

The sentence never ends on the name. A CSV supplier says its orders wait for the owner.

## How to reproduce

1. Connect a supplier whose name ends in a period, as a CSV feed.
2. Read its state, then a supplier order for it.

## Why it matters

The owner is told orders go over by themselves, and waits for something that never happens.

## Where it lives

`surfaces/dropship/order-detail.tsx` and `dropship-data.ts` `supplierState`, in both consoles.

## The fix

"Bluffdale Bolt Co. does not have this order yet. Send it to them, then say so here." A CSV
supplier: "Working normally. Its products are read from its feed. Orders for them wait for you
to place them yourself."

Test, red first: `surfaces/dropship/supplier-words.test.ts` in both consoles (2). Lint and
format clean.

## Confirmed by

P01 as Doty, 2026-10-19: Bluffdale Bolt Co.'s page read "Working normally. Its products are read
from its feed. Orders for them wait for you to place them yourself."; Renée's O-000042, waiting
on them, read "Bluffdale Bolt Co. does not have this order yet. Send it to them, then say so
here." Piggles not seen on screen; its test passes.

## Rating effect

—
