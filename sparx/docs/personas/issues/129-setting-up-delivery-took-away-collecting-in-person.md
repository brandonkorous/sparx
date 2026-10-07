# 129 — Setting up delivery took away collecting in person

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (checkout as a stranger, after adding the United States region)
**Surface:** site › checkout › Delivery; workbench › Shipping (both consoles); onboarding's setup story; `rateShipment` in `@wizeworks/commerce`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Before Doty set up shipping, checkout offered one choice: "Collect in person". He added a United States region with UPS Ground. After that, checkout offered UPS Ground only. Collecting was gone for good, and nothing on the Shipping screen could bring it back.

Gillett has a counter in Bluffdale. Doty's setup story said his customers "pick up locally". Walk-in customers lost the free way to get a part the moment the shop started to ship.

## What should have happened

A shop that ships and also has a counter offers both at checkout. The owner says so once, on the Shipping screen, and the setup story says it for them when they picked "pick up locally".

## Why it matters

A local shop loses the customers who would drive over today. They are told to pay for UPS to get a part that sits ten miles away.

## The fix

- Migration `20270530000031_a_shop_that_ships_still_hands_over`: `commerce_site_settings.offers_collection`, per site, default off. Prisma `offersCollection`.
- `commerce/src/services/shipping-service.ts`: `rateShipment` adds "Collect in person" beside the delivery options when the site has delivery set up and `offersCollection` is on. With no delivery set up, collecting stays the only choice, as before. `getCollectionSetting` / `setCollectionSetting` read and write it.
- `GET` / `PUT /v1/commerce/shipping/collection`.
- Both consoles: `surfaces/commerce/collection-setting.tsx`, a "Collecting in person" section on the Shipping screen with the switch "Customers can also collect". With no delivery yet it says collecting is the only choice. Hooks in `shipping-data.ts`.
- Onboarding (both consoles): a story that picks "pick up locally" turns the setting on (`offerCollection()` in `steps-setup.ts`, `CommitStoryInput.offersCollection`).
- Site checkout: the delivery step shows "Rather pick it up? Collect it from us, free" when the shop offers it. Choosing it skips the address, and the order goes through with no address sent.

Tests, proved red:

- `api-rest/test/integration/collect-beside-delivery.test.ts` (database): with a US region and UPS Ground, checkout rates UPS Ground only; after `PUT offersCollection: true`, it rates "Collect in person" and UPS Ground. With `rateShipment`'s `offersCollection` check made false, it fails: "expected [ 'UPS Ground' ] to deeply equal [ 'Collect in person', 'UPS Ground' ]".
- `workbench/lib/onboarding/story-pickup.test.ts`: the story reads "pickup" from the customer answers, and the composer passes `offersCollection: fulfillment(story).has('pickup')`, which `api.ts` writes after the modules are saved. With the composer sending `offersCollection: false`, 1 of 2 fails.

## Confirmed by

On screen, 2026-10-06, as Doty: Shipping › "Collecting in person" › "Customers can also collect" on; the toast read "Customers can collect at checkout". As the stranger at checkout with a St. George address: "UPS Ground · 5 days, Free" and "Collect in person, Free". "Rather pick it up?" moved to the collection step with no address asked.

## Rating effect

—
