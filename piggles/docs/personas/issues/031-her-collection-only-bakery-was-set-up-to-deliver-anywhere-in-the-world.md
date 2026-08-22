# 031 — Her collection-only bakery was set up to deliver anywhere in the world

**Status:** fixed — the seed is gone and collection answers in its place
**Severity:** blocker (money + a promise to a customer she cannot keep)
**Found by:** P01 · Thistle & Rye · act 7 — while confirming the new shipping-policy notice
**Surface:** mypiggles › Sell › Postage and delivery
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** — (owed: act 8, at her own checkout)

## What happened

Marisol has never opened **Postage and delivery**. Opening it for the first time:

> **Delivery regions**
> **US domestic** — Delivers to United States — _3 options_
> **Everywhere** — Delivers anywhere in the world — _1 option_
>
> **Product groups**
> Standard — All other products
> US domestic — standard goods — All other products

Her business, in her own words at signup: one shop, six days a week, sold over
the counter and **for collection**. _No delivery, no shipping, no second
location._ She is in the UK — her phone is 01632 960 118.

Her shop is configured to post a sourdough loaf **anywhere in the world for a
flat $5**, in US dollars, with a 5-day estimate.

## Why it matters

This is not cosmetic and it is not hypothetical. Nothing stops a shopper in
another country adding two loaves to a basket, choosing delivery, and paying.
Marisol finds an order she cannot fulfil, for a service she does not offer, at a
price she never set, in a currency she does not trade in. She either eats the
cost of posting bread internationally or refunds a stranger and takes the review.

It also quietly defeats the thing this session just built: the new shipping-policy
notice fired for her — correctly, because rows really do say she delivers. The
notice is honest about what it sees; **what it sees is wrong.**

## Where it lives

[wizeworks/packages/commerce/src/services/shipping-service.ts:414](../../../../wizeworks/packages/commerce/src/services/shipping-service.ts#L414)
— `bootstrapDefaults`, run on `module.activated(commerce)`.

The rationale is written down and, on its own terms, sound:

> On `module.activated(commerce)`, seed a fallback shipping setup so checkout can
> quote a rate before the tenant connects a carrier or configures zones —
> otherwise **an enabled store can add to cart but never complete an order**.

It creates one `Everywhere` zone (`countries: []` — matches every address), one
`Standard` profile, and one flat `$5` / 5-day rate.

The second pair — `US domestic` and `US domestic — standard goods` — comes from
[presets/shipping.ts](../../../../wizeworks/packages/commerce/src/presets/shipping.ts).
**Not checked** how that one came to be applied to this tenant; nobody asked her.

## The shape of the mistake

One outcome, two causes, one default:

- "checkout cannot quote a rate" because **they have not set delivery up yet** —
  the seed is right, and stops a dead checkout.
- "checkout cannot quote a rate" because **they do not deliver at all** — the
  seed invents a service the business does not sell.

The bootstrap cannot tell these apart, so it treats every shop as the first one.
A collection-only bakery, a restaurant taking table bookings, a barber, a seller
of downloads: all get worldwide postage.

## The fix

Brandon's call, 2026-08-20: **"remove it? it needs to be right."** Removed, and
the hole it leaves filled honestly rather than left to dead-end.

**1. Nothing is seeded on activation.**
`shippingService.bootstrapDefaults` is deleted, along with its call in
[module-provisioning.ts](../../../../wizeworks/services/api-rest/src/lib/module-provisioning.ts).
A tenant who has never opened Postage and delivery now has no zones, which is
the truth about them. (`taxService` and `commerceSiteService` bootstraps stay —
neither invents a service; they materialise a settings row.)

**2. "Collect in person" answers when no delivery has been set up.**
[services/collection-option.ts](../../../../wizeworks/packages/commerce/src/services/collection-option.ts)
— free, in the cart's own currency, no carrier, no delivery estimate.
`rateShipment` returns it when the quote is empty **and the tenant has no zones
at all**. The two "no rate" cases the old bootstrap could not tell apart are now
distinguished:

| what is true                                       | what a shopper is offered     |
| -------------------------------------------------- | ----------------------------- |
| no zones at all — they never said how they deliver | Collect in person, free       |
| zones exist, none reach this address               | nothing, and checkout says so |

The second is a real answer, not a missing one, so it must not be papered over:
a business that HAS set delivery up has drawn a boundary on purpose.

**3. The dead-end the removal would have exposed, on both checkouts.**
Both `apps/site` and `apps/market` fabricated a `{ rateRef: 'standard',
amountCents: 0 }` row whenever a quote came back empty — but `submitShipping`
re-prices every choice against a FRESH server quote (BUG-005), and a ref the
client made up is never in it. Picking it dead-ended on _"That shipping option
is no longer available."_ Both now show what the shop really offers, say plainly
when they cannot reach an address, and re-quote when the address changes rather
than carrying a rate priced for the old one.

**4. The merchant is told.**
The Shipping surface (piggles + sparx) now leads with _"Right now, customers
collect from you"_ while there are no regions, and the empty state reads _"You
don't deliver — people collect"_ instead of scolding her for not having set up
something she does not do.

**What this does NOT add:** collection as an option a merchant can switch on
_alongside_ delivery, with pickup instructions. That wants a
`CommerceSiteSettings` column and is a feature, not this defect — the defect was
a service nobody offered being invented for them.

## Knock-on

The shipping-policy notice built earlier the same day fired for Marisol because
`shippingRate` rows really did exist. With the seed gone they do not, so it
correctly stays quiet. It was honest about what it saw; what it saw is now right.

## Confirmed by

Code + unit level, 2026-08-20: `collection-option.test.ts` — 9 tests, green
(free, cart currency, no delivery estimate, stable ref, and no
"Collection Collect in person" on the order). `@wizeworks/commerce` typechecks;
`silica-catalog` 1144 tests green.

**Owed — the confirmation that actually counts:** act 8 is the buyer at 390px.
Two sourdough and a pack of buns, through her real checkout, and the only choice
offered must be to collect.

## Rating effect

None recorded — `commerce.shipping` has not been scored.
