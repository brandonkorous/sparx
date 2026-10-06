# 916: A repeat delivery charged no postage and no tax

**Status:** fixed (act 323)
**Severity:** major (money the shop owes or is owed, on every renewal, every tenant)
**Found by:** P03 · Juniper Row · act 323, while building [739](739-a-shopper-cannot-subscribe.md)
**Surface:** the renewal worker: `subscriptionService.processOccurrence`, `subscriptionBilling.runDueOccurrence`
**Filed:** 2026-10-01
**Blocked on:** —

## What happened

Every renewal of a repeat order created an order and charged it. The order was
created with its items and nothing else:

```
processOccurrence → orderService.create({ items, addresses, … })
                     no shippingTotal, no taxTotal
orderService.create → computeTotals(items, shippingTotal = 0, taxTotal = 0, …)
runDueOccurrence    → charges order.total
```

So the first delivery, bought at checkout, carried the shop's postage and the
sales tax. Every one after it carried neither.

Measured on this machine, 2026-10-01. Juniper Row's one repeat order (a $58.00
silk twill scarf every 2 months, delivered to Oregon) renewed on 2026-09-20 as
**O-000017: $58.00, postage $0.00, tax $0.00.** The shop's delivery rate for
that parcel is $9.00 (free over $150).

This was true of every repeat order, including the ones an owner starts by hand
in the console.

## What changed

1. **The repeat order remembers how it is delivered.** New column
   `commerce_subscriptions.shipping_choice` (migration
   `20270529000000_a_repeat_delivery_keeps_its_postage`):
   `{ providerSlug, rateRef, description }`. A repeat order started from a paid
   checkout copies it from the order (`choiceFromOrder`). Null means nobody
   chose (hand-started, or older than this).
2. **Postage is priced again on each renewal,** by `shippingService.quoteForLines`,
   which is the second half of the cart quote split out. Same package, same
   "free over" test against the renewal's own total, same product groups, same
   site zones. The shopper's option is found by its ref, then by its name (a
   live carrier's ref changes every quote). If it is gone, the cheapest
   delivery goes instead, becomes the kept choice, and a `delivery_changed`
   event records it. Collection never stands in for a delivery.
3. **Tax is worked out on each renewal** by `taxService.calculate`, with the
   postage in it, so the rate in force on the renewal day applies.
4. **A renewal nothing can deliver is held, not sent free.** It is paused with
   the reason on a `paused` event, `subscription.paused` is published (the
   shopper gets the paused email, as dunning does), and the tick counts it as
   `unbillable`.
5. **The order and the schedule advance are one transaction again.**
   `orderService.create` was given a bare ctx, so it wrote the order in a
   transaction of its own. It now gets `{ ...ctx, tx }`.
6. **The words say it.** "Plus postage and tax" now appears in: the repeat note
   on the product page and basket (`lib/repeat-copy.ts`), `RepeatTerms` at
   checkout, both account pages that show a repeat order's amount, the owner's
   "Offer it on repeat" section, and the owner's "start a repeat order" form
   (`eachTimeNote`), in both consoles.

Found while measuring it: the 739 query that finds paid repeat checkouts
(`findOrdersAwaitingRepeat`) failed on every pass (`make_interval(days =>
bigint)`), and it ran outside any try, so it stopped every renewal for the
tenant behind it. Cast to `::int`, and the tick now records a failure there and
carries on billing.

## Proof

- `renewal-pricing.test.ts`, 9 tests. Removing `shippingTotal` and `taxTotal`
  from the renewal order reddens exactly 2.
- Ran the real tick for Juniper Row as of 2027-01-21. The next renewal is
  **O-000030: $58.00 + $9.00 postage ("Standard Delivery") + $0.00 tax =
  $67.00**, and the emailed bill is for $67.00. Tax is $0.00 because Juniper Row
  collects only in Colorado and this goes to Oregon. The next date moved from
  2027-01-20 to 2027-03-20, which is right for every 2 months.
- commerce 267 tests, both consoles' repeat-order words 28 each. Typecheck
  clean on commerce, site, api-rest and both consoles. Lint clean.

## Files

- `wizeworks/packages/commerce/src/services/renewal-pricing.ts` (new) and its test
- `wizeworks/packages/commerce/src/services/subscription-service.ts` (`processOccurrence`)
- `wizeworks/packages/commerce/src/services/subscription-billing.ts`
- `wizeworks/packages/commerce/src/services/shipping-service.ts` (`quoteForLines`)
- `wizeworks/packages/commerce/src/services/repeat-start-service.ts`
- `wizeworks/packages/commerce/src/schedulers/subscription-tick.ts`
- `wizeworks/packages/db/prisma/schema/41-commerce-subscriptions.prisma` + migration
- `wizeworks/apps/site/lib/repeat-copy.ts`, `components/checkout/repeat-checkout.tsx`,
  `app/account/(authed)/repeat-orders/page.tsx`, `app/account/(authed)/payment-methods/page.tsx`
- both consoles' `surfaces/commerce/product-repeat-offer.tsx` and `repeat-order-words.ts`
