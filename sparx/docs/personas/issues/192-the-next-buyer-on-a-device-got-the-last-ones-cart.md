# 192 — The next buyer on a computer got the last buyer's cart and trade price

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (the other side)
**Surface:** the Gillett site › cart and checkout, after Sign out
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Renée (Wasatch, fleet price) left five BD flexplates in her cart and signed out. Brynn,
a retail customer, signed in on the same browser and added one flexplate. Her cart
showed **6** flexplates at **$404.76** each, $2,428.56: Renée's five plus hers, all at
Wasatch's 12% fleet price. In the database the cart still belonged to Renée.

## What should have happened

Signing out ends the cart with the session. The next person starts their own, at their
own prices, and never sees what someone else had in theirs. A shop's counter computer,
or a family laptop, is exactly where this happens.

## Why it matters

Another customer's cart contents on screen (privacy), and a price a retail customer is
not owed (wrong money). The checkout has a "this cart belongs to a different account"
check, but only for repeat deliveries.

## Where it lives

- `wizeworks/apps/site/components/cart-provider.tsx`: the cart id and its token live in
  the browser and outlive the session; `logout` in `customer-provider.tsx` leaves them.
- `wizeworks/services/api-rest/src/lib/public-commerce-context.ts` `assertCartToken`:
  the token alone opens a cart, whoever is signed in.

## The fix

Two layers.

- Site: `lib/cart-session.ts` `cartEndsWithSession(before, after)`; `cart-provider.tsx`
  forgets the stored cart when its buyer signs out or a different buyer signs in. A guest
  who signs in keeps theirs (the server's cart handoff). While the session is unknown,
  nothing changes.
- API: `lib/cart-owner.ts` `cartUsableBy`; `assertCartToken` (every cart read and write)
  answers "not found" when the cart belongs to one buyer and a different buyer is signed
  in, whatever token the browser kept. The site already forgets a cart that is not found.
  Tests red first: `cart-session.test.ts` (site, 5), `cart-owner.test.ts` (api-rest, 4).
  Site 454 and api-rest 490 pass; lint clean.

## Confirmed by

P01 on screen, 2026-10-09, on one browser at the Gillett site:

- Renée signed in. The site gave her own cart back (6 flexplates, fleet price $404.76).
  She signed out, and the browser no longer held a cart.
- Brynn signed in on the same browser. No cart was kept for her. She added one flexplate:
  a new cart, 1 × $459.95, the retail price. Nothing of Renée's on it.
- The server layer: as Brynn, Renée's old cart and its token were put back into the
  browser by hand and the cart page reloaded. The API answered 404 and the page said
  "Your cart is empty". The site dropped the stored cart.
- Brynn signed out: the browser held no cart. Renée signed in again and got her own cart.

Not checked: two tabs open at once with different buyers (one browser shares one sign-in,
so this cannot happen).

## Rating effect

—
