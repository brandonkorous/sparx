# 041 — A shop that takes payment at the counter could not take an order

**Status:** fixed — the storefront now has the branch the server always had
**Severity:** blocker (an option the picker offers, producing a checkout that cannot finish)
**Found by:** P01 · Thistle & Rye · act 8 — the whole point of her business
**Surface:** the tenant's live `/checkout`, step 3
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 8 — order **O-000001** placed, $33.00, unpaid

## What happened

Marisol's own `/order` page, in her words, says **order by four the day before,
pay at the counter**. The provider picker offers **Manual payments** — "No fee.
No online card processing." She selects it; it reports **Active — taking
payments**.

Her customer then reaches the payment step and is told the shop cannot take
payment. Every route through her checkout was a dead end.

## Why it matters

An option a product offers must work. Selecting Manual payments and being told
you cannot be paid is worse than not offering it, because the owner has now made
a decision, seen it confirmed as active, and been quietly overruled.

It is also the shape of business this platform says it serves. A bakery, a café,
a barber, a takeaway — collection and cash over the counter is not an edge case,
it is most of the high street.

## Why it happened

The storefront's payment step **always** created a card intent. There was no
other branch, so "how does this shop take money" was a question it never asked.

The server, meanwhile, had supported manual orders all along.
`complete()`'s own comment says so: _"Net-terms / manual orders carry no
paymentRef — they settle via the AR document or a hand-recorded payment, never a
gateway intent."_ Only two things stood in the way:

- `submitPayment` refused anything that was neither a card nor a B2B account.
- The storefront had no way to learn the shop was on manual payments.

## The fix

- **`paymentMode` on the checkout session** — `card` | `in_person` |
  `unavailable`. Three genuinely different situations that had been collapsed
  into one, which is what made a manual shop indistinguishable from a shop with
  nothing set up (see [#038](038-her-customer-was-told-to-go-to-a-settings-screen-they-cannot-reach.md)).
- **Resolved from the tenant's CONFIG, not the adapter registry.** The first
  version asked `getGatewayForTenant`, which resolves an adapter — and `manual`
  deliberately has none, because recording a payment by hand has nothing to
  dispatch. So it threw, and the throw was read as "cannot be paid": the exact
  answer the function exists to avoid. It now reads `tenant_payment_configs`, and
  treats _chosen but not collecting_ as `unavailable`, because a gateway with its
  keys still missing takes no money.
- **`submitPayment` accepts an in-person order**, decided server-side from the
  shop's own configuration and never from a flag the client sends — otherwise any
  caller could declare itself paid in person at a shop expecting a card. The
  order records `paymentProviderSlug: 'manual'` with no ref, so it says how it is
  to be settled rather than looking like a card order that lost its reference.
- **`InPersonPaymentStep`** — no card fields, and one job: be unambiguous that
  the customer has _not_ paid yet, because every other checkout they have used
  took the money at this point.

  > **How you'll pay** — You pay when you collect. Placing this order does not
  > take any money now, and no card details are needed.
  > **Place order — $33.00 to pay**

## Confirmed

**O-000001**, `placed` / `unpaid`, total $33.00, and it carried the whole chain
through to the record:

```
shippingRateRef      collection:in-person
shippingProviderSlug collection
paymentProviderSlug  manual
paymentRef           null
```

The customer row was created, and the address, name and email are all hers.
