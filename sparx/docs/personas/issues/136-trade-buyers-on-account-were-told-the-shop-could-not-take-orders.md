# 136 — Trade buyers on account were told the shop could not take orders

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 9 (testing Utah sales tax as Wasatch Front's buyer)
**Surface:** site › cart, cart drawer, checkout start, payment step; `cartAccountRules` in `@wizeworks/commerce`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

The fix for [131] closed checkout for every shopper while the shop takes no card payments. Renée Castañeda, Wasatch Front's buyer, signed in: her cart said "This shop is not taking payments on its website just yet, so an order cannot be placed here" and Checkout was off. Her account is on Net 30. She is billed, not charged, and in act 5 she ordered this way.

A second, older dead end sat at the payment step: an account on terms was offered "Pay by card" next to "Bill to my account", while the shop takes no cards.

## What should have happened

An account on day terms orders as before. With cards off, it goes straight to "Bill to my account".

## Why it matters

Ordering on account without calling the counter is the first reason Doty came to sparx. The 131 fix stopped exactly those customers.

## The fix

- `commerce/src/services/account-buying-rules.ts`: the basket's account rules carry the account's `paymentTerms`.
- Site `lib/orders-closed.ts`: `ordersClosed(mode, accountTerms)` stays open when the account can be billed (`canBillToAccount`, the rule the payment step already used); prepay or no terms still closes. The cart, the drawer and the checkout start pass the terms.
- Site `components/checkout/payment-step.tsx`: when cards are off and the account can be billed, the step opens on "Bill to your account"; Back returns to delivery.

Tests, proved red:

- `site/lib/orders-closed.test.ts` (6): net30 stays open, prepay and none close; the three places pass the terms; the payment step's `billOnly` start. With the terms ignored, 1 fails; with the old start, 1 fails.

## Confirmed by

On screen, 2026-10-06, as Renée: the cart shows "Proceed to checkout" with no closed notice; checkout went from her details through "Collect in person" straight to "Bill to your account" (no "Pay by card"); with PO WFUC-24-0906 she placed O-000020, which waits for Teodora Vukić-Hale's sign-off.

## Rating effect

—
