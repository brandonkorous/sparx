# 330 — "Pairs well with" offered parts for another truck

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9, a stranger's order email
**Surface:** order confirmation, order delivered, review request and saved cart emails, and the product page's "You might also like", on every selling site; `wizeworks/packages/commerce`, `wizeworks/services/api-rest`, `wizeworks/packages/builder-schemas`, `wizeworks/packages/builder`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as a stranger (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

Marisol bought a DDP injector for a 2007.5 to 2018 Ram 6.7L Cummins. Under her receipt, "Pairs well with" offered a Pacbrake exhaust brake for a 1994 to 1998 Ram 5.9L, another for a 2006 to 2007 GM Duramax, and a Fleece coolant bypass for an older Cummins. None of them can go on her truck. The rail was the shop's six newest products, whatever the order held.

## What should have happened

A suggestion under an order goes with what was bought. For a shop that sets what its parts fit, that means parts that fit the same vehicle, and never what is already in the order.

## How to reproduce

1. Buy a part that has a vehicle set (Gillett's injector).
2. Read the order confirmation's "Pairs well with".

## Why it matters

A diesel shop that recommends a part for the wrong engine looks like it does not know its own catalog, in the one email every buyer reads.

## Where it lives

- `wizeworks/packages/commerce/src/services/related-products.ts` (new: `relatedProductIds`, `fitsWhatWasBought`), exported as `relatedProductService`; `product-service.ts` (`ids` on the list filter).
- `wizeworks/services/api-rest/src/lib/email-data.ts` (`productsInEmail`, `resolveProducts`).
- `wizeworks/packages/builder-schemas/src/silica-email-kit.ts` (`productRail`).
- `wizeworks/packages/builder/src/services/email-default-refresh.ts` and `email-default-history.json`.
- The product page: `wizeworks/services/api-rest/src/routes/v1/public/commerce.ts` (new `GET /v1/public/commerce/products/:handle/related`), `wizeworks/apps/site/lib/commerce.ts` (`listRelatedProducts`), `lib/silica-data.ts` (`commerce.related`), and the rail's own note in `wizeworks/packages/silica-catalog/src/commerce.ts`.

## The fix

- **What is suggested.** Never what is in the order or cart. When the order's parts say what they fit, only parts that fit it too: set to the same vehicle, to a wider one that holds it (a part for every RAM 2500 fits her 2500 6.7L), or to the whole list. Year windows must meet when both parts set one. A part with no fit set is not offered here: in Gillett's catalog that usually means nobody entered it, and its title shows it is engine-specific. Parts from other categories come first, because beside an injector the exhaust brake goes with it and another injector does not. With no fitment in the order: the same category, then the newest. Only parts the sending site shows.
- **What the email holds.** The rail reads the order's lines, else the cart's (the one named, else the customer's live basket).
- **An empty rail.** It can now be empty, so it drops like the content rail: the heading and the button bind the list, and the cards use `omitWhenEmpty` instead of drawing one blank card.
- **The product page, the neighbor.** Its "You might also like" had the same fault twice: on a builder page it was the shop's newest products, and on the code page the same product type. Both now read the same picker through a new public read, `/products/:handle/related`. Off a product page, `commerce.related` keeps the newest. The rail's own note promised it was never empty; it now says it can be, and drops.
- **Stored emails.** The four default bodies changed, so their outgoing fingerprints are recorded and every untouched copy a business holds refreshes to the new rail.

Tests: `related-products.test.ts` (9: same engine yes, another engine no, a wider fit yes, a narrower no, another truck no, the whole list yes, another list no, year windows, no fit set no), red with the vehicle check removed (3 fail). commerce 75 files / 595, builder 26 / 206, builder-schemas 37 / 383, api-rest `email-data` 13.

## Confirmed by

2026-10-18, the picker run on Gillett's data for O-000034. Before: three exhaust brakes and a coolant bypass for other engines. After: Pacbrake C44038 exhaust brake for 07.5-18 Ram 6.7L, BD Iron Horn turbo manifold 6.7L 07-18, BD Killer Grid Heater 6.7L, and three Fleece Cheetah turbochargers for the 6.7L Cummins.

In a sent email: O-000035, a second stranger order paid in a headless browser with Stripe's test card. Dana Whitcomb's "Your order O-000035 is confirmed" lists under "Pairs well with" the Pacbrake C44038 for 07.5-18 Ram 6.7L ($1,856.74), the BD Iron Horn turbo manifold 6.7L 07-18 ($2,135.95) and the 6.7L parts after them.

**The years.** Gillett's fit entries named the engine and not the years, so a turbo for 2019 to 2022 was offered beside an 07.5 to 18 injector. Its vehicle list does have a Year range, but a fit took years only when it was added: an entry already there could only be deleted and added again, losing its note. Each entry on a product's "What it fits" now has "Add the year" / "Change the year" (`fitment-years-editor.tsx`, both consoles), which saves in place. As Doty, the injector got 2007 to 2018 on both entries and the three Fleece turbos 2007 to 2012, 2013 to 2018 and 2019 to 2022; the injector's suggestions then dropped the 2019 to 2022 turbo and kept the two that fit, with two coolant bypasses and a drain tube kit for the 6.7L after them. The entries' count badge there named `neutral` without approval and is now colorless.

On the product page, 2026-10-18: the DDP injector's "You might also like" lists the Pacbrake C44038 for 07.5-18 Ram 6.7L, the BD Iron Horn manifold, the BD Killer Grid Heater and the Fleece turbochargers for the 6.7L. Before, it led with the Pacbrake C44072 for a 94-98 5.9L.

## Rating effect

None to the scores.
