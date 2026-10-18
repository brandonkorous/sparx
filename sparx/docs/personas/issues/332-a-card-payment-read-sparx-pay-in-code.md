# 332 — A card payment read "sparx_pay" on the order

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 9, the owner opens a stranger's order
**Surface:** console › an order › Money in (both consoles)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

O-000035, paid by card through sparx Pay, showed "$640.96 · sparx_pay" under Money in. The words for it existed ("Card"), but the pane looked the processor up in a short list of eight that left out every gateway a business chooses, and printed the code name when the lookup missed.

## What should have happened

"$640.96 · Card".

## How to reproduce

1. Take a card payment through sparx Pay, or a business's own Stripe.
2. Open the order. Read Money in.

## Why it matters

A code name on the screen that answers "how was I paid" tells the owner the screen was not written for her.

## Where it lives

- `sparx/apps/workbench/surfaces/commerce/order-detail.tsx`, `data.ts`, `lib/payment-methods.ts`.
- `piggles/apps/workbench/surfaces/commerce/order-detail-money.tsx`, `order-words.ts`, `lib/payment-methods.ts`.

## The fix

- The pane reads `paymentMethodLabel`, the one list of words for how money moved, directly. The short `PAYMENT_PROCESSOR_LABELS` table had nothing else reading it, so it is gone from both consoles.
- The word list names every card gateway a business can pick as "Card": `stripe_direct`, `authorize_net`, `first_pay` and `custom`, beside `sparx_pay` and `stripe`. Without them the fallback printed "stripe direct", and the dev database holds such a payment.

Tests: `lib/payment-methods.test.ts` in both consoles (3). Commerce surfaces: sparx 54 files / 499, Piggles 57 / 536. Not checked: the workbench `tsc` (out of memory on this machine).

## Confirmed by

2026-10-18. O-000035's Money in reads "$640.96 · Card", "Taken".

## Rating effect

None.
