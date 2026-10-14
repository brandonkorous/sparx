# 196 — A buyer's return could drop off her own list

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (the other side)
**Surface:** the Gillett site › Your account › Returns
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09 (with a limit: see below)
**Blocked on:** —

## What happened

Found while checking issue 194's neighbours. The Returns page's API read the shop's
latest 200 returns and kept the ones on the buyer's orders (and only her latest 200
orders). In a shop with more than 200 returns, a buyer's older return was not on her
list at all, with nothing to say so. Gillett has one return, so this was found in the
code, not on screen.

## What should have happened

Her returns are found from her own orders, however busy the shop is.

## Where it lives

- `wizeworks/services/api-rest/src/routes/v1/public/returns-account.ts`
  `GET /v1/public/commerce/account/returns`
- `wizeworks/packages/commerce/src/services/return-service.ts` `list` had no buyer filter.

## The fix

- `packages/commerce/src/services/return-list-filter.ts` `returnListWhere`: the console
  filters as before, or the returns on her own orders. A buyer with no orders finds
  nothing, never every return in the shop.
- `returnService.list` takes `customerId` and looks up her order ids in the same
  tenant transaction. The route asks for hers directly.

Shared code: the Piggles site account uses the same route, so it gets the same fix.

Tests, red first: `return-list-filter.test.ts` (commerce, 4). Commerce 538 and api-rest
599 (as CI runs them) pass; lint clean.

## Confirmed by

P01 on screen, 2026-10-09, as Brynn: Returns lists her return for O-000004, and it
opens. Not checked on screen: a shop with more than 200 returns (none here has one); the
filter is covered by the test.

## Rating effect

—
