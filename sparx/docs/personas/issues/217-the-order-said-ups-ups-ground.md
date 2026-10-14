# 217 — The order said "UPS UPS Ground"

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 11, on the other side
**Surface:** the Gillett site › an order › Shipping to; the order confirmation
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11
**Blocked on:** —

## What happened

Renée's order O-000023 read, under "Shipping to": "UPS UPS Ground". Gillett's rate is named
"UPS Ground", carried by "UPS"; the order joined the two.

## What should have happened

"UPS Ground". A rate whose name already starts with its carrier is not given the carrier
twice.

## How to reproduce

1. A shipping rate named with its carrier ("UPS Ground", carrier UPS), as most are.
2. Check out with it; open the order. Every time.

## Why it matters

It reads as a mistake on every order shipped this way. True, but sloppy.

## Where it lives

`wizeworks/packages/commerce/src/services/collection-option.ts` `describeRate`:
`${carrier} ${service}`.

## The fix

- `commerce` `collection-option.ts` `describeRate`: a service that starts with its carrier,
  as a whole word, is said once. `rateNames` returns both the new and the carrier-twice
  name, and `renewal-pricing.ts` matches a repeat order's saved choice against both, so a
  live carrier's option (whose ref changes every quote) is still found on renewal.
- Orders already placed keep the words they were placed with.

Shared: every brand. Tests, red first: `collection-option.test.ts` (+1, including
"UPSide" keeping its carrier), `renewal-pricing.test.ts` (+1, the old saved name). Lint
clean.

## Confirmed by

P01 on screen, 2026-10-11, as Renée: O-000025 and O-000027 read "Shipping to: UPS Ground";
O-000023, placed before, still reads "UPS UPS Ground".

## Rating effect

—
