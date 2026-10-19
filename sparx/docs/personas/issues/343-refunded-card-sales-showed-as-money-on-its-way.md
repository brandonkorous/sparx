# 343 — Refunded card sales showed as money on its way to the bank

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 342 on Finance › Payouts
**Surface:** Workbench › Finance › Payouts, the list and a deposit's page (both consoles); `GET /v1/finance/payouts`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Doty, 2026-10-18
**Blocked on:** —

## What happened

Gillett's only card sales were Marisol Vega's and Dana Whitcomb's, $640.96 each, and both
were refunded to the cent (issue 339). Finance › Payouts still read "Card sales · 2 sales ·
On its way · $1,281.92".

## What should have happened

A sale given back sends nothing to the bank. The page says no deposit is coming, and a sale
refunded in part counts only what is left.

## How to reproduce

1. Take a card payment and refund it, in full or in part.
2. Open Finance › Payouts. The deposit counts the whole sale. Every time.

## Why it matters

The owner plans on $1,281.92 landing in the bank. Nothing lands.

## Where it lives

`loadCaptured` in `wizeworks/services/api-rest/src/routes/v1/finance/payouts.ts` read each
captured payment's `amount` and never its refunds. A refund is a row in `order_refunds`;
nothing writes it back onto the payment.

## The fix

`leftToSettle(amount, refunds)` in `wizeworks/services/api-rest/src/lib/payout-net.ts`, in
cents: what a sale still sends to the bank. The route reads each payment's completed refunds
and counts what is left; a sale given back in full is in no deposit. The deposit's own page
reads the same rows. The comment says the limit: this is an estimate made from the sales, so
a refund made after a deposit landed makes that deposit read smaller.

Test, red first: `payout-net.test.ts` (5): a sale refunded to the cent in parts leaves
nothing, as numbers, text and Prisma Decimals; a part refund leaves the rest; no refund
leaves the whole; never below nothing. Red with the refunds ignored (4 failed), green
after. Lint and format clean.

## Confirmed by

P01 on screen as Doty, 2026-10-18: Finance › Payouts read "No payouts yet" with both of
Gillett's card sales refunded. Not checked: a deposit with a part refund on screen (no such
sale here); the test covers it. The Piggles console was not opened; the route is shared.

## Rating effect

—
