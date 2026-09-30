# 739 — A shopper cannot ask for something on repeat

**Status:** open
**Severity:** major
**Found by:** P03 · Juniper Row · act 264
**Surface:** the tenant storefront (`wizeworks/apps/site`) — product page, cart, checkout
**Filed:** 2026-09-19
**Blocked on:** —

## What is missing

A repeat order can now be set up by the shop owner
([738](738-repeat-orders-nobody-could-start.md)). A shopper still cannot ask for
one. There is nowhere on any storefront to choose "send me this every month".

```
grep -i subscri across wizeworks/apps/site/**             2026-09-19
  app/account/(authed)/payment-methods/page.tsx   lists subscriptions that
                                                  already exist and moves them
                                                  between saved cards
  everything else                                 comments about unrelated
                                                  event subscribers
  no product-page control
  no cart line carrying a schedule
  no checkout step
```

The server side is complete: models, schedule, renewal worker, dunning ladder,
invoice path, and now a REST create route. The one missing half is the shopper's.

## Why it matters

Three things point at it and none of them can deliver it:

- The product's own `fulfillmentType` accepts `'subscription'`, and the public
  product endpoint already sends the value. **Nothing on the storefront reads
  it.** MEASURED: 1 product on the whole machine is marked `subscription`, and
  its page looks exactly like every other product's.
- The subscription detail pane tells the shop owner "They can add one from their
  account, then it can be charged automatically" — true of the CARD, and the
  only way that account ever gets a subscription to attach a card to is if she
  made it for them.
- A repeat order is the one thing in this module that a customer would rather
  arrange at 11pm than by ringing a shop.

## What it needs, and the question in the middle of it

1. A control on the product page for products whose fulfillment is
   `subscription`: buy once, or every N weeks/months.
2. A cart line that can carry that schedule. `CartItem` has
   `configurationPayload` and nothing schedule-shaped.
3. A checkout step that creates the subscription alongside the first order.

**The question:** a card subscription needs a vaulted payment method, and
vaulting happens during payment. So checkout has to either take the schedule
BEFORE it knows whether the card vaulted, or create the subscription after the
gateway returns and reconcile a failure. The invoice path
(`billingMode: 'invoice'`) sidesteps vaulting entirely and is what the console
create screen uses, so a first cut could offer only that — but a shopper who
just typed a card and is then told they will be emailed a bill every month is a
worse experience than the one they expected.

That is a decision about the checkout, not a bug in it, which is why this is
filed rather than built alongside 738.

## Files

- `wizeworks/apps/site/app/products/[handle]/` — the buy box
- `wizeworks/packages/commerce/src/services/cart-service.ts`
- `wizeworks/packages/commerce/src/services/checkout-service.ts`
- `wizeworks/services/api-rest/src/routes/v1/public/commerce.ts`
