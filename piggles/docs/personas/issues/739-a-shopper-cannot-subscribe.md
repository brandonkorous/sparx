# 739 — A shopper cannot ask for something on repeat

**Status:** fixed (act 323), proved with Stripe; the other gateways in [917](917-a-shop-on-square-paypal-or-authorize-net-could-not-be-paid.md)
**Severity:** major
**Found by:** P03 · Juniper Row · act 264
**Surface:** the tenant storefront (`wizeworks/apps/site`) — product page, cart, checkout
**Filed:** 2026-09-19
**Blocked on:** —
**Decided:** 2026-10-01 by Brandon: option B, the card is saved by the payment itself, the way a shopper knows it from Subscribe & Save. For every gateway that can save cards.

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

## The build (act 323 onward), and what done means

Measured before starting, 2026-10-01:

- Five gateways can save a card: Piggles Pay and own Stripe (card form on the
  shop), Square, Authorize.net and PayPal (their own hosted page). The shop has
  no card form for the last three, so a Square shopper cannot save a card
  anywhere today.
- A product says it is repeatable only through `fulfillmentType =
'subscription'`, which is a label nothing in commerce reads, and it carries no
  cadence. Nothing says HOW OFTEN a shopper may choose.
- A shopper's account lists their repeat orders and lets them switch the card.
  There is no pause, skip or cancel. "Cancel any time" would be a promise with
  nowhere to keep it.

Every part below is the definition of done. None is optional.

1. **The owner chooses the cadences.** On the product's Repeat orders panel,
   both consoles: offer this on repeat, and which of every week / 2 weeks /
   4 weeks / month / 2 months / 3 months. Stored on the product.
2. **The product page** offers Buy once or Deliver every N, only for a product
   with cadences and only where the gateway can save cards. The line under it
   says what is charged today and what is charged after.
3. **The cart line** carries its cadence, shows it, and can be changed back to
   once.
4. **Checkout** needs a signed-in shopper for a repeat line, says in plain
   words that the card is saved and charged on each delivery, and takes the
   first payment with the card saved in the same step.
5. **Each gateway** saves the card during the payment: Stripe (both), PayPal,
   Authorize.net, Square. Each one proved in its own test mode.
6. **After payment** the card is stored on the customer and one repeat order
   is created per cadence, starting one interval after today, on that card,
   for that site. If the card could not be saved, the order still stands and
   the repeat order bills by emailed link instead, and the shopper is told so.
7. **The confirmation** says the repeat order is set up and when the next one
   goes out.
8. **The shopper's account** gets a Repeat orders page: what, how often, next
   date, and pause, skip the next one, and cancel.
9. **Owner copy** that says shoppers cannot do this yet is rewritten.

## Where it stands (2026-10-01, act 323)

Built, all nine parts above:

| part                                                                          | where                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cadences on a product, migration `20270528000000_a_shopper_chooses_how_often` | `products.repeat_options`, `commerce-schemas/src/repeat.ts`                                                                                                                                                                        |
| owner picks them                                                              | both consoles, `surfaces/commerce/product-repeat-offer.tsx`, on the product's Repeat order options pane                                                                                                                            |
| product page                                                                  | builder buy box `repeatPicker()` in `silica-catalog`; React `<ProductDetail>` via `components/repeat-choice.tsx`                                                                                                                   |
| cart line                                                                     | `commerce_cart_items.repeat_interval_*`; refused unless the product offers it AND the shop can keep a card                                                                                                                         |
| checkout                                                                      | sign-in asked BEFORE the forms, refused at payment without one, refused on collection; `RepeatTerms` at the pay step                                                                                                               |
| pay and keep the card                                                         | `saveForLater` on `createPaymentIntent`, `vaultFromPayment` read-back: Stripe (both) at the payment, PayPal by `store_in_vault`, Authorize.net by `createCustomerProfileFromTransaction`, Square by CreateCard from the payment id |
| after payment                                                                 | the subscription tick starts one repeat order per cadence from a PAID order, in the same transaction that marks the order line; card read retried for 3 passes, then billed by link                                                |
| confirmation                                                                  | `RepeatConfirmed`                                                                                                                                                                                                                  |
| shopper's account                                                             | `/account/repeat-orders`: pause, resume, skip the next, cancel (asks first)                                                                                                                                                        |

Proved: the owner ticked Every month and Every 2 months on the Linen Shirtdress
as Devi and saved (`repeat_options` holds both). The pane said plainly that
shoppers will not see it, because Juniper Row takes payment in person, with a
button to change that. Her product page shows no "How often", which is right
for a shop that cannot keep a card. 9 new commerce tests, 9 schema tests, all
suites green; the sign-in rule shown red.

**Proved end to end, 2026-10-03,** with "Your own Stripe" in Stripe's sandbox
and Stripe's published test card 4242 4242 4242 4242. Brandon pasted the
sandbox keys; Devi made it her active way to take payment.

1. Devi's dress page showed **How often** only after she published (see the
   first defect below).
2. A new shopper, Mara Ellison (`p03.mara@piggles.test`, the persona test
   password), chose M Indigo, Every month. Checkout asked her to sign in or make
   an account before any form, then priced it: $145.00 + $9.00 Standard
   Delivery + $4.21 Colorado tax = **$158.21**. Stripe's form said the card is
   kept for future payments.
3. **O-000031** was paid at Stripe, marked paid here (second defect below), and
   the tick started one repeat order: active, `stripe_direct`, card, every 1
   month, delivery choice kept, card **Visa 4242, 12/2034** kept.
4. Her account's Repeat orders page: "$145.00 every month, plus postage and
   tax. Next delivery November 3, 2026. Charged automatically to Visa ending
   4242." with Skip, Pause and Cancel.
5. The tick run as of 2026-11-05 charged the kept card with nobody present:
   **O-000032, $158.21, paid**, next delivery moved to December 4.

**Defects found on the way, all fixed:**

- **A product page saved before repeat orders existed never offered them.**
  `repeatPicker()` was added to the factory buy box only, and the repair that
  brings older pages forward (`upgradePageBody`, `missingDisclosures`) was not
  told about it. Devi had edited her product page, so the re-stamp rightly left
  it alone, and an owner who ticked "Offer it on repeat" got nothing on her own
  page. `repeat.shown` is now a disclosure: the repair adds the factory's own
  picker inside the form before the old-part choice, and the owner's home and
  Publish screens say "If you offer something on repeat, your page cannot offer
  it." until she publishes. 6 new tests; turning the repair off reddens exactly
  those 6.
- **Without a webhook, a "Your own Stripe" order was never marked paid.** The
  step after checkout read only the shop's own record, and only the webhook
  writes `succeeded` to it, so the card was charged, the order stayed unpaid,
  no card was kept and no repeat order started. The console called the
  webhook secret optional. Gateways now answer `lookupPayment` (both Stripe
  connections), and checkout completion and the 5-minute stranded-payment sweep
  ask it when the record has not heard, through the webhook's own handlers. The
  sweep asks only about payments from the last 3 days. The console's webhook
  words were rewritten to say what the webhook is still for (refunds, disputes,
  late bank payments). 6 + 6 new tests; turning the lookup off reddens 3.
- **A shopper could read "Cart token does not match."** Now: "Your basket was
  changed in another window. Go back to your basket and check out again."

**Square, Authorize.net and PayPal** (act 324): each can now be asked about a
payment, as Stripe can. Building that found those three, with 1stPay and a
custom gateway, could not be paid at all: one reference for every shopper, no
webhook address, PayPal never taking the money, unsigned webhooks trusted, and
no refund reaching the money. All fixed and filed as
[917](917-a-shop-on-square-paypal-or-authorize-net-could-not-be-paid.md); a
sandbox run per vendor is still owed.

Also open:

- Existing product pages are stamped from the old buy box. Pages nobody edited
  get the picker through **ops.yml → backfill-record-templates** after release;
  edited ones get it from the page repair the next time the owner opens the
  editor and publishes.
- A page still on the retiring legacy builder tier offers Buy once only; so
  does the shoppers' AI tool, which checkout would refuse anyway.
- Renewals charged no postage and no tax: [916](916-a-repeat-delivery-charged-no-postage-and-no-tax.md), now fixed. That run also found `findOrdersAwaitingRepeat` failing on every pass (`make_interval` got a bigint) and stopping the tenant's renewals with it; cast to `::int`, and the tick now carries on past a failure there.
