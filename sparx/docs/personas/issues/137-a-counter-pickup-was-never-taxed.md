# 137 — A counter pickup was never taxed

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (Utah sales tax)
**Surface:** site › checkout › payment; `quoteTaxForSession` in `@wizeworks/commerce`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty set up Utah: "Utah sales tax (Bluffdale)", 7.25%, switched on, "Collecting". Renée chose "Collect in person" for two injectors. The payment step showed no tax line; the total was $1,307.60.

Tax was only ever worked out from a delivery address. A collection has none, so it came back as "no tax" for every pickup.

## What should have happened

A pickup is sold at the counter, so it is taxed where the shop is.

## Why it matters

The shop owes the tax either way. Every counter pickup from the website left it unpaid while the tax screen said "Collecting".

## The fix

- `commerce/src/services/checkout-service.ts` `quoteTaxForSession`: with no delivery address, the shop's own address (its default stock location, the same one checkout ships from) is where the order is taxed.

Test, proved red:

- `commerce/src/services/checkout-tax-collection.test.ts`: a basket with no delivery address is priced with Bluffdale, 84065 as the destination and the tax comes back. With the old `const to = input.shippingAddress`, it fails. The exemption test beside it still passes (6 in all).

## Confirmed by

On screen, 2026-10-06, as Renée, pickup: "Tax $73.05" (7.25% of $1,007.60 in parts; the $300.00 of core deposits is not taxed), total $1,380.65. Order O-000020 stores tax_total 73.05 and total 1380.65.

## Rating effect

—
