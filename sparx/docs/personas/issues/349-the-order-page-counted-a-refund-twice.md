# 349 — The order page counted a refund twice

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 347's last half (a refund made on the order page), as Doty
**Surface:** workbench › Selling › Orders › an order, "Refund this order" (`sparx/apps/workbench/surfaces/commerce/order-detail.tsx`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19
**Blocked on:** —

## What happened

Renée Castañeda paid $108.44 for O-000036. Her return gave $93.44 back, so Gillett still
held $15.00, the delivery charge. Doty opened the order: "Paid so far $108.44", "Given back
$93.44", and no "Refund this order" row at all. There was no way to give back the $15.00.

## What should have happened

The order offers "Refund $15.00", the money it still holds.

## How to reproduce

1. Refund part of an order, by a return or on the order page.
2. Open the order. The refund row offers the rest less the earlier refunds a second time,
   or, when the earlier refunds are more than half, nothing at all.

O-000001 ($750.00 paid, $150.00 given back) would have offered $450.00 of the $600.00 still
held. O-000033 ($1,587.00 paid, $793.50 given back) offered nothing.

## Why it matters

The owner cannot give a customer the rest of their money from the order, or gives back
less than they meant to and does not know it.

## Where it lives

The order keeps `amountPaid` net of every refund: the payment rollup writes it as captured
less refunded (`recomputeOrderPaymentRollup`). The server's refund (`order-refund.ts`) and
Piggles's order page both read it that way. The sparx order page took `refundTotal` off it
again.

## The fix

`leftToRefund(order)` in `surfaces/commerce/data.ts`, beside `paidIn`: the money the order
holds now, `amountPaid` rounded to cents. The order page uses it.

Test, red first: `order-paid-in.test.ts`, four new cases. It is $15.00 after a $93.44 return
on a $108.44 order, all of it with no refund, nothing on a full refund, and it is what the
order page offers (red before the page used it). Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19, three orders. O-000036 now reads "Refund this order · Refund $15.00";
Doty gave it back to Renée's card (Stripe test refund `re_3US9E5FY8gqB2fvj1jWR41Md`) and the
order reads "Refunded". O-000033 offered $793.50 and O-000001 offered $600.00, each what the
order still held, and both read "Refunded" after.

## Rating effect

—
