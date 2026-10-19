# 348 — Her PO number was on one copy of her order and not the other

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 5 promise 11, as Renée Castañeda on the Gillett site
**Surface:** the site › Account › Orders › an order (`/account/orders/:id`); `GET /v1/public/commerce/account/orders/:id`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Renée Castañeda, 2026-10-18
**Blocked on:** —

## What happened

Renée paid for O-000036 by card and typed her PO number, WUD-PO-4471, as checkout asked:
"It is kept with this order". Her wholesale account's order page read "Placed October 18,
2026 by Renée Castañeda · Your PO number WUD-PO-4471". Her Orders page opened the same order
under "Placed October 18, 2026 · Paid in full", with no PO number anywhere.

## What should have happened

Both copies of the order carry the number she gave it.

## How to reproduce

1. As a trade buyer, pay by card and give a PO number.
2. Account › Orders › the order. No PO number.

## Why it matters

Her accounts team matches the order to their PO from what she sees. The page she reaches
first leaves it out, so it reads as lost.

## Where it lives

The order endpoint of the shopper's account (`api-rest/src/routes/v1/public/account.ts`)
never sent it; the trade portal's endpoint reads it with `poNumberOf(metadata)`.

## The fix

The shopper's order sends `poNumber: poNumberOf(order.metadata)`, the client type carries it,
and the order page adds "· Your PO number WUD-PO-4471" after the payment, in the trade page's
words.

No new test: `poNumberOf` is tested in `crm-schemas`, and the rest is passing a field and
printing it. Lint and format clean.

## Confirmed by

P01 as Renée Castañeda, 2026-10-18: Account › Orders › O-000036 read "Placed October 18, 2026
· Paid in full · Your PO number WUD-PO-4471".

## Rating effect

—
