# 215 — It told a mail-order customer to come and collect

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 6
**Surface:** the tenant's website — product page, basket, checkout, confirmation — and the console's order pane
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 6, as a shopper at 390px and as Devi in the console

## What happened

A customer filled a basket on Juniper Row, gave a Portland, Oregon address, chose
**Delivery · 4 days**, and reached the last screen before paying:

```
How you’ll pay

  You pay when you collect. Placing this order does not take any money now,
  and no card details are needed.

              [ Place order — $170.00 to pay ]
```

Collect from where? Devi's business is a rented studio she works in. Her own
persona file says it in one line: **sold online only. No shop, no counter.** The
order was going in the post to another state.

She placed it anyway, and the receipt said the same thing:

```
Order confirmed
Thank you! Your order O-000004 has been placed.
Keep this order number — you pay when you collect.
```

A $170 order, unpaid, being posted 1,200 miles, and the only instruction the
customer was given is to turn up somewhere that does not exist. **Nothing on any
screen told them how to actually pay.**

The same assumption was in three more places:

| Where                           | What it said                                                            |
| ------------------------------- | ----------------------------------------------------------------------- |
| The Marlow Knit's product page  | "This shop takes payment **in person**, so nothing is charged…"         |
| The basket and checkout summary | the same sentence again                                                 |
| The console's order pane        | "…this is the earliest day it can be **collected**" — on a posted order |

## What should have happened

A shop that does not take cards online is a shop that does not take cards online.
Where the money changes hands is a separate question, and this one has an answer:
the parcel is in the post, so it does not change hands anywhere — the shop has to
go and get it.

## Why it matters

**It is a false sentence about money, on the last screen before somebody
commits.** That is the same class as
[206](206-checkout-said-shipping-was-free-before-it-knew-where-to-send-it.md) and
[185](185-it-told-her-customer-they-had-paid-at-a-shop-that-takes-no-money.md),
and it is the third time this run has found a checkout stating something the
system knows is not so.

**It is also an instruction the customer cannot follow**, which is the sharper
half. Advice printed on a screen is part of the contract, and it owes the reader
a remedy that actually exists. Here there is none: "collect" is impossible, no
alternative is offered, and the customer closes the tab owing $170 with no idea
what happens next — while Devi has no idea when she will be paid.

And it misrepresents the thing she deliberately chose. The console describes the
option she picked as:

> **Manual payments** — Record check, cash, wire or bank transfer by hand. There
> are no card payments and no fee — you mark each order paid yourself.

Four ways to be paid, none of which is a counter. Her customers were told a
fifth, and it was the only one she cannot do.

## Where it lives

The platform's manual-payment mode is called **`in_person`**, and everything
downstream wrote copy for a room.

`resolvePaymentMode`
([checkout-service.ts](../../../../wizeworks/packages/commerce/src/services/checkout-service.ts)):

```ts
if (config.gatewayId === MANUAL_GATEWAY_ID) return 'in_person';
```

The mapping itself is fine — the shop takes no card here — but the NAME is a
claim about place, and the screens took it literally. `InPersonPaymentStep`
([payment-step.tsx](../../../../wizeworks/apps/site/components/checkout/payment-step.tsx))
even says so in its own doc comment:

> the order is placed and the money changes hands **where the goods do**

Which is exactly right for a bakery counter and exactly wrong for a parcel. The
goods change hands on a doorstep in Oregon, where nobody is standing with a card
machine.

**This came in with [185]'s fix**, which was correct about the half it was
looking at — it removed "You paid $35.95 today" from a shop that had charged
nothing — and carried the wrong half forward in the replacement sentence. Worth
naming: a fix that swaps a false statement for a truer one still has to check
whether the truer one is true of everybody.

The console half is the same shape in a different tree:
[order-detail-due-day.tsx](../../../../piggles/apps/workbench/surfaces/commerce/order-detail-due-day.tsx)
printed "collected" unconditionally, next to a `deliveryPlan(order).collected`
helper the orders LIST was already using to draw "To send" against that very row.

## The fix

**The screen asks which kind of order this is, because the order already knows.**

`isCollectionRate` and `deliveryPlan().collected` both existed and both were
already in use elsewhere; nothing new had to be computed and nothing had to be
stored.

- **Checkout's payment step** takes `collecting`, threaded from the same
  `collectedOrder` ref the confirmation was already given. Collecting keeps the
  old sentence; posting gets: _"Placing this order does not take any money now,
  and no card details are needed. We'll be in touch about paying for it."_
- **The confirmation** does the same: _"Keep this order number — we'll be in
  touch about paying."_
- **The product page, basket and checkout summary** stop naming a room at all.
  They cannot know at that point whether this shopper will collect or be posted
  to, so they say the thing that is true of every manual shop: _"This shop does
  not take card payments on this website, so nothing is charged here."_
- **The console's order pane** reads "the earliest day it can be **sent**" for a
  posted order, and keeps "collected" for a collected one.

**No promise of an email.** An order that never takes a card payment never
triggers an order-confirmation — the confirmation component's own comment says
so — and the fix must not quietly start claiming one is on its way.

## What is NOT fixed, and is the owner's call

**She still cannot say HOW she wants to be paid.** "We'll be in touch" is the
only honest sentence the platform can write on its own, and it is worse than the
one Devi would write herself: _"I'll email you my bank details when it ships."_

The complete fix is a free-text line on the manual-payments panel that reaches
the customer at checkout, on the confirmation, and in the order email. That needs
a column on `tenant_payment_configs`, which has no free-text field —
**`Blocked on: pipeline`** for the migration and worth a look from Brandon on
where the words belong. Everything that does not depend on it is done.

Also untouched, and recorded rather than implied: the CARD-mode deposit lines
still read "the rest is paid when you collect"
([made-to-order-summary.tsx](../../../../wizeworks/apps/site/components/made-to-order-summary.tsx)).
They only render for a shop taking cards, and no tenant on this machine has a
gateway, so that wording is **not checked** — same blocker as [026]'s card half.

## What it looked like once fixed

As a shopper, at 390px, on a $138 basket posted to Brooklyn:

```
How you’ll pay

  Placing this order does not take any money now, and no card details
  are needed. We’ll be in touch about paying for it.

              [ Place order — $147.00 to pay ]
```

```
Order confirmed
Thank you! Your order O-000005 has been placed.
Keep this order number — we’ll be in touch about paying.
Ready from Sunday, August 30.
```

The Marlow Knit's own page and the checkout summary now read **"This shop does
not take card payments on this website, so nothing is charged here."**

And in the console, on that same order:

```
Due Sunday, August 30
Something on this order has to be made first, so this is the earliest day it
can be sent. It was agreed when the order was placed and does not move if you
change the product afterwards.
```

## Rating effect

`Sell › An order` in [rating.md](../rating.md) — the pane described a posted
order as a collection. Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
