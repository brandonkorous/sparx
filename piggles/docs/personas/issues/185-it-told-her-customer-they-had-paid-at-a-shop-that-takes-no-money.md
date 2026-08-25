# 185 — It told her customer they had paid, at a shop that takes no money

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · [026] website half
**Surface:** Juniper Row's own website — basket, checkout, order confirmation
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Juniper Row takes payment in person. Devi chose **Manual payments** in the
picker, which describes itself as "No fee. No online card processing," and the
console confirmed it: _Active — taking payments._

A shopper then bought a made-to-order knit. The last screen they saw said:

> Thank you! Your order **O-000002** has been placed. Keep this order number —
> you pay when you collect.
>
> Ready from Saturday, August 29.
>
> **You paid $35.95 today. $66.00 is due when you collect.**

They paid nothing. No card was asked for, no card was charged, and the row in the
database says so — `payment_status: unpaid`, with no payment record against the
order at all. The two sentences are one line apart and they contradict each
other.

The step before it was no better. The payment screen carried three statements at
once:

| Where                  | What it said                                               |
| ---------------------- | ---------------------------------------------------------- |
| The notice             | "Placing this order does not take any money now"           |
| The summary, 1in right | "**To pay now** $35.95" · "To pay when you collect $66.00" |
| The button             | "Place order — **$101.95** to pay"                         |

Three numbers about paying, on one screen, none of which agreed. And the basket
had already opened with "To pay at checkout $30.00" — a checkout that takes
nothing.

## What should have happened

A shop that settles in the room charges nothing on its website, so there is no
"now" for a deposit to be paid at. The only true things are the day it will be
ready and the fact that the shop will take the money itself.

## Why it matters

A receipt is the one screen a customer keeps. "You paid $35.95 today" on an order
where nothing was taken is a false financial statement handed to a stranger, and
it fails in both directions: a customer who believes it arrives expecting to owe
$66.00 and is asked for $101.95, and a customer who does not believe it now
distrusts the shop.

For Devi it is worse than a wrong number, because it is wrong about the thing she
deliberately chose. She picked "no online card processing" on purpose, and her
own website told her customer a card had been charged.

It is also the CORE failure this project keeps finding: **a number nobody
collected must never render as money.**

## Where it lives

`resolvePaymentMode` already existed and already knew the answer
([checkout-service.ts](../../../../wizeworks/packages/commerce/src/services/checkout-service.ts)) —
`card`, `in_person` or `unavailable`, read from the tenant's own configuration.
`Confirmation`
([checkout-chrome.tsx](../../../../wizeworks/apps/site/components/checkout/checkout-chrome.tsx))
even branched on it, correctly, for the email line one paragraph above the wrong
one:

```tsx
{
  paymentMode === 'in_person'
    ? 'Keep this order number — you pay when you collect.'
    : 'A confirmation email is on its way.';
}
```

The money line, three lines below, branched on nothing.

And the basket could not have branched even if somebody had thought to: the mode
travelled ONLY on the checkout session, which does not exist until a shopper has
given their details. The cart page and the product page had no way to learn it.

## The fix

**The shop's payment mode travels with the site, not only with the checkout.**

- `resolvePaymentMode` is exported and the public site payload carries
  `commerce.paymentMode`
  ([content.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/content.ts)).
  One extra field, tenant-level, on a payload the storefront already fetches once
  per request.
- `SiteCommerce` gains it, defaulting to `card` — which is what every storefront
  assumed before it was carried, so nothing changes for a card shop.
- The defaults are now **merged** rather than substituted. `data.commerce ?? DEFAULT`
  only catches the block being missing entirely; an api-rest that predates a field
  sends the block WITHOUT it, and a required-typed field arriving as `undefined`
  is how a storefront ends up branching on a value nobody sent.

With the mode in hand, three screens stop describing a charge that does not
happen:

- **Basket and checkout summary** drop the "to pay now / to pay on collection"
  split and keep the ready day, plus one sentence: "This shop takes payment in
  person, so nothing is charged on this website."
- **The confirmation** drops the money line entirely. Nothing is lost by not
  splitting it — the whole amount is settled with the shop, and the line directly
  above already says "you pay when you collect."
- **The product page** says the same thing rather than "Pay $30.00 today" —
  see [184](184-the-page-that-sells-the-knit-never-said-it-has-to-be-made.md).

`unavailable` is treated the same way: a shop with no working gateway took no
money either, so it makes no claim about money at all.

**Two copy defects found on the same walk and fixed with it:**

- "the rest of the made-to-order items **is** paid when you collect them" → "the
  rest is paid when you collect."
- The delivery options read "Express · **1 days**"
  ([rate-choices.tsx](../../../../wizeworks/apps/site/components/checkout/rate-choices.tsx)).

## Confirmed on screen

As a shopper on `juniper-row`, all the way through, with Manual payments active.

**Basket** — "Ready from Saturday, August 29 — one item needs 5 days to make."
followed by "This shop takes payment in person, so nothing is charged on this
website." No "To pay at checkout".

**Delivery** — "Express · 1 day".

**Payment** — the notice, the summary and the button now agree: nothing is taken
now, and the button says the $101.95 that will eventually be paid.

**Confirmation** — order **O-000003**:

> Thank you! Your order O-000003 has been placed. Keep this order number — you
> pay when you collect.
>
> **Ready from Saturday, August 29.**

No money sentence. The order row agrees: `payment_status: unpaid`, `ready_on
2026-08-29`, no payment record — the same facts the screen now reports.

**Dark and 360px**: checked in a 360px iframe rather than by resizing. The
summary block wraps cleanly at phone width and inverts correctly.

## What is not proven

The `card` branch — an actual card charged an actual deposit — has not been seen,
because no tenant on this machine has live gateway credentials. That half of
[026] is still owed and is recorded there.

## How to reproduce

1. Sell › How you take payment › Manual payments › Use manual payments.
2. Put a deposit on a product and buy it from the tenant's own website.
3. Before: the confirmation said "You paid $X today" and nothing had been charged.

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).
