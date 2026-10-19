# 341 — A fully refunded order still said "On its way"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 178 (a card-paid return)
**Surface:** the site › an order's page and the Orders list; the order's status everywhere (`wizeworks/packages/crm/src/services/order-refunds-service.ts`)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Doty and Dana Whitcomb, 2026-10-18
**Blocked on:** —

## What happened

Marisol Vega sent back the injector from O-000034 and got all $640.96 back. Her order page
then read "Order O-000034 · On its way", over "Refunded in full" and "Refunded to you
−$640.96". The order's status was still `fulfilled`. Brynn's counter return (O-000004,
$750.00) had ended `refunded`.

## What should have happened

An order refunded to the cent reads "Refunded".

## How to reproduce

1. Refund an order in more than one part, where the parts do not add up exactly in
   floating point: $640.96 as $490.96 and then $150.00 (a part and its core deposit).
2. The order stays at its old status. Most amounts with cents do this.

## Why it matters

The customer is told her money is back and her parcel is on its way at once. The console's
order list and reports count it as a live, shipped order.

## Where it lives

`recordRefund` in `order-refunds-service.ts` decided "refunded in full" with
`Number(input.amount) >= Number(order.total) - Number(order.refundTotal)`, in dollars. In
floating point 640.96 - 490.96 is 150.00000000000006, so the last $150.00 was "not enough".
750 - 600 happens to be exact, which is why Brynn's return looked right.

## The fix

`refundCoversWhatIsLeft(amount, total, refundedSoFar)` in
`wizeworks/packages/crm/src/services/refund-covers.ts` counts in cents. `recordRefund` asks it.

Test, red first: `refund-covers.test.ts` (4): $150.00 after $490.96 on $640.96 is the whole,
as numbers, as text and as a Prisma Decimal; a single full refund is; money still left is
not. Red with the old dollar sum (2 failed), green in cents. Lint and format clean.

## Confirmed by

P01 on screen, 2026-10-18. Dana Whitcomb's O-000035, $640.96, refunded as $490.96 and $150.00
by Doty: the order's status is `refunded`, and Dana's order page reads "Order O-000035 ·
Refunded · Refunded in full".

Marisol's O-000034, refunded before the fix, still has status `fulfilled`. An order refunded
in parts before this fix keeps its old status.

## Rating effect

—
