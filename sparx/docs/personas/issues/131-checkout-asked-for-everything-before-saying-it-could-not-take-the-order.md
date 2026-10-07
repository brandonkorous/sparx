# 131 — Checkout asked for everything before saying it could not take the order

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (checkout as a stranger)
**Surface:** site › cart page, cart drawer, checkout
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Gillett cannot take card payments yet: card payments are not set up. The site knew this (`paymentMode: 'unavailable'`). But the cart showed "Proceed to checkout". The stranger typed his name, email, phone and street address and chose UPS Ground. Only on the payment step did the site say "This shop cannot take card payments online just yet, so the order cannot be finished here."

## What should have happened

The shopper hears it before typing anything: in the cart, in the cart drawer, and at the start of checkout. Checkout is not offered.

## Why it matters

A stranger gave a shop his address and phone number for an order that could never be placed. That reads as a broken site, and it wastes the customer's time.

## The fix

- New `wizeworks/apps/site/lib/orders-closed.ts`: `ordersClosed(mode)` gives the sentence when the mode is `unavailable`, and null for `card` or `in_person` (paying when the order is handed over is still an order placed here).
- `components/cart-view.tsx` and `components/mini-cart.tsx`: the block that stops checkout is `checkoutBlock(accountRules) ?? ordersClosed(paymentMode)`, shown as an info alert, with Checkout turned off. The drawer takes `paymentMode`, passed from `app/layout.tsx` as `site.commerce.paymentMode`.
- `components/checkout/checkout-flow.tsx`: at the first step, a closed shop shows `OrdersClosed` (in `checkout-chrome.tsx`, beside `EmptyCart`): "Orders can’t be placed here yet", the sentence, and "Go to the home page".

Test, proved red:

- `site/lib/orders-closed.test.ts`: the rule for each mode, and a source check for the three places. Taking `paymentMode` off `<MiniCart />` in the layout fails "hands the shop’s payment mode to the drawer"; taking `ordersClosed` out of the drawer's block fails "blocks the cart page and the cart drawer".

## Confirmed by

On screen, 2026-10-06, as the stranger on Gillett's site: `/cart` shows the info alert above a disabled "Proceed to checkout". `/checkout` shows "Orders can’t be placed here yet" and asks nothing. "Add to cart" on the Bosch injector opened the drawer with the same alert and a disabled Checkout.

## Later

This first version also closed checkout to trade accounts billed on terms, who need no card. Found and fixed the same day as [136].

## Rating effect

—
