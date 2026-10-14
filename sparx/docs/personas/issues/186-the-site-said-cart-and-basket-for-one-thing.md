# 186 — The site said "Cart" and "basket" for one thing

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 13 (a fleet orders past its limit)
**Surface:** the Gillett site: product page, checkout, discount codes; the messages the API sends a shopper
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Renée tried to add 30 Bosch injectors. The product page said: "Sorry, only 1 is left to
buy, counting any already in your basket. Lower the quantity and try again." The header
of the same page says "Cart", and her account page says "Your cart".

Thirteen sentences a shopper can read say "basket": the stock refusal, two links back
from a repeat checkout, three discount-code refusals, and five checkout and API errors.

## What should have happened

One word for one thing. The site already calls it the cart, in its header, its account
page and its `/cart` address.

## Where it lives

- `wizeworks/apps/site/lib/stock-refusal-words.ts`,
  `components/checkout/repeat-checkout.tsx`
- `wizeworks/packages/commerce/src/errors.ts`,
  `services/checkout-service.ts`, `services/discount-conditions.ts`,
  `services/discount-service.ts`
- `wizeworks/services/api-rest/src/lib/public-commerce-context.ts`

The code identifier `not_basket_owner` is a field code, not a sentence, and stays.

## The fix

All thirteen sentences say "cart". The tests that quoted them now quote the new words.
A guard, `wizeworks/apps/site/lib/cart-word.test.ts`, reads every sentence the site and
the shopper-facing API code can show (the site's `app`, `components` and `lib`,
`packages/commerce/src`, and api-rest's `lib` and public routes, over 200 files) and
fails on "basket"; comments and code names (`basket.has(id)`, `not_basket_owner`) are
left alone. Proved red first: it listed the eleven lines it then cleared. Commerce 525,
site 429 and api-rest 396 tests pass; lint clean.

## Confirmed by

P01 on screen, 2026-10-09 (the Gillett site, as Renée, 30 Bosch injectors): "Sorry,
only 1 is left to buy, counting any already in your cart. Lower the quantity and try
again."

## Rating effect

—
