# 359 — A box still on the bench made the customer owe its cores

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · checking issue 184, as Doty on O-000008
**Surface:** workbench › Selling › Cores owed, and an order's lines, in both consoles
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19
**Blocked on:** —

## What happened

With 2 injectors sealed in a box on the bench, O-000008 read "2 of 6 sent so far · 2 cores
still owed", and Cores owed listed "O-000008 · 2 of 6 · 0 days". Nothing had left.

## What should have happened

Issue 184's rule: an old part is owed once the customer has the new one. A box on the bench is
"packed, waiting to go", and its cores are due once it goes.

## How to reproduce

1. Pack and seal a box with a part that carries a core deposit. Do not send it.
2. The order and Cores owed say the core is owed.

## Why it matters

The shop chases a fleet for old parts before it has sent the new ones.

## Where it lives

Sealing a box counts its units in `quantityFulfilled`, and both the cores rule
(`coresOutstanding`) and the line's words read that.

## The fix

`unitsHandedOver` (`commerce-schemas/src/cores.ts`): units in deliveries `shipped` or
`delivered`. Cores owed (`core-service.ts`) uses it and dates from it. The order detail sends it
per line as `quantityHandedOver` (`crm` `order-service.get`). Both consoles' cores and "sent so
far" words read it (`sentSoFarWords`: "0 of 6 sent so far · 2 packed, waiting to go").

Tests, red first: `cores-handed-over.test.ts` (4) and `sentSoFarWords` in both consoles'
`packed-box.test.ts` (3). crm, commerce and api-rest `tsc` clean. Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19, on O-000018 (2 injectors, $150.00 deposits). Sealed at the bench, the
order read "2 cores due once handed over" and Cores owed did not list it. After "Mark this box
as sent" it read "2 cores still owed", and Cores owed listed O-000018.

## Rating effect

—
