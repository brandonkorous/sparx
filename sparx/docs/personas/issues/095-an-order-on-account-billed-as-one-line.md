# 095 — An order on account was billed as one line

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 6 (reading Salt Lake County's INV-000009)
**Surface:** every invoice an order on account raises by itself: checkout on account, a held order signed off, the printed and emailed copy
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06 (INV-000015)
**Blocked on:** —

## What happened

INV-000009, Salt Lake County's bill for O-000012, printed one line: "Order O-000012 · 1 · $3,715.00". The order was 2 × Holset Reman Turbo Actuator at the contract $1,657.50, each with a $200.00 refundable core deposit: $3,315.00 of goods and $400.00 of deposits, folded together. The footer below it asked for cores back "for credit". Five of Gillett's six invoices on account looked like this. The full bill also opened with an empty Customer box, so the bill was in no buyer's history.

## What should have happened

The invoice lists what was bought, at the price charged, with the deposit on its own line, the way "Make an invoice" and a quote's invoice already did.

## How to reproduce

1. As Dana on the site, put 2 × Bosch 0986435621 in the cart, Bill to my account, place it.
2. As Doty, open its invoice, then Preview. Before the fix: one line, "Order O-0000NN". Every time.

## Why it matters

A fleet's accounts department matches a bill line by line against its purchase order, and cannot match "Order O-000012". Nobody could tell from it what the core refund would be. "Every invoice to a fleet has to be right the first time" is Doty's second reason for being here.

## Where it lives

`createOrderArDocument` (`crm/b2b-ar-service.ts`) itemized only an order made from a quote (`quoteLinesForOrder`, issue 086). Any other order got one synthetic line.

## The fix

- `itemizedFromOrder` in `ar-invoice-lines.ts`: the order's own items as invoice lines (name with part code once, quantity, price, discount, tax where the order taxed it, core deposit, part), used when they come to the order total to the cent; otherwise the single line as before, so the amount billed never moves. The same lines "Make an invoice" writes, and `invoiceLineName` and `taxRateFrom` now live there once for both.
- The invoice carries the buyer as its customer.
- Invoices already sent are not rewritten: they are in customers' hands.

Tests, each proved red:

- `crm/src/services/ar-invoice-from-order.test.ts` (O-000012's real numbers) and the new "an invoice raised from an order placed on the site" block in `ar-invoice-cost.test.ts`: the old path reddens 2; dropping the to-the-cent check reddens 2 more.
- The old test "is used for an order that did not come from a quote" pinned the bug; it now reads "is used for an order with nothing to itemize".

## Confirmed by

On screen, 2026-10-06: Dana placed O-000018 (2 × Bosch injector at the contract $510.00, PO SLCO-FM-26-1203, $1,320.00). INV-000015 reads "Bosch Remanufactured Fuel Injector (0986435621) · 2 · $510.00 · $1,020.00" and "Refundable core deposit … 2 · $150.00 · $300.00", Subtotal $1,020.00, Refundable core deposits $300.00, Total $1,320.00, due Nov 20, 2026 (Net 45), with Dana as its customer.

## Rating effect

—
