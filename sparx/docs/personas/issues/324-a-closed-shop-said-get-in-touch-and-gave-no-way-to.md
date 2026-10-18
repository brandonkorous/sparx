# 324 — A shop that cannot take payments said "get in touch" and gave no way to

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 9, a stranger checks out before payments are live
**Surface:** Gillett site › cart drawer, /cart, /checkout; `wizeworks/apps/site`
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as a stranger on the Gillett Diesel site, 2026-10-17
**Blocked on:** —

## What happened

sparx Pay was chosen but not finished, so Gillett could not take a card yet. A stranger put a DDP 6.7L injector in the cart. The drawer said, correctly, that the shop is not taking payments on its website and nothing will be charged, then ended: "Get in touch with the shop to order: their details are on this site." It gave neither the phone number nor the email, although the site holds both in Site settings and prints them on its Contact page. Checkout said the same.

## What should have happened

The sentence that tells a buyer to get in touch hands her the way to: the shop's phone number and email, as links she can tap. A shop with neither filled in says only "To order, get in touch with the shop", with no promise that its details are somewhere on the site.

## How to reproduce

1. Leave a shop's payments unfinished.
2. Signed out, add a product to the cart.
3. Read the drawer, /cart and /checkout.

## Why it matters

This is the moment a stranger is ready to buy and the website cannot take the money. Every extra step between "I want this" and reaching the shop loses some of those buyers.

## Where it lives

`wizeworks/apps/site/lib/orders-closed.ts`, `components/orders-closed-reach.tsx` (new), `components/mini-cart.tsx`, `components/cart-view.tsx`, `components/checkout/checkout-chrome.tsx`, `components/checkout/checkout-flow.tsx`, `app/checkout/page.tsx`, `app/layout.tsx`, `components/silica-host-cores.tsx`, `lib/tel-href.ts` (moved out of `silica-data.ts`).

## The fix

- `ORDERS_CLOSED_MESSAGE` now ends at "Nothing will be charged."
- `shopReach(contact)` turns the site's phone and email into links: the phone as a dialable `tel:` (the same `telHref` the Contact page binding uses, now in its own file), the email as `mailto:`. A blank or digitless phone, and a blank email, count as not filled in.
- `OrdersClosedReach` adds "To order, call (801) 571-7780 or email contact@gillettdiesel.com." (or only the parts that exist, or the plain sentence). The drawer, the cart page and the closed checkout all show it. The site's contact reaches them from the layout, the cart host core and the checkout page; checkout names the prop `shopContact` because `contact` there is the buyer's own details.
- In the drawer and the cart page the words sit in one `<span>`: the alert lays out each child as its own block, which broke the sentence into pieces. The email wraps whole (`break-words`), not mid-word.

Tests: `lib/orders-closed.test.ts` (9): `shopReach` for full, blank and digitless details, and that all three places pass the shop's contact. Red when the drawer's reach line is removed. The site suite passes (53 files, 508 tests). Site `tsc` clean.

## Confirmed by

2026-10-17. Signed out on the Gillett site with the injector in the cart: the drawer, /cart and /checkout each read "… Nothing will be charged. To order, call (801) 571-7780 or email contact@gillettdiesel.com." as one sentence. The links are `tel:8015717780` and `mailto:contact@gillettdiesel.com`. Checkout stays closed and Checkout stays disabled.

## Rating effect

The cart and checkout rows under "Outside the console" in `rating.md` keep their scores: the honest closed message was already counted (issue 131); this removes the dead end after it.
