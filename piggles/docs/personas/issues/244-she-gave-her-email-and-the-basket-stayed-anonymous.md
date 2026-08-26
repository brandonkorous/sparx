# 244 — A shopper gave her email at checkout and the basket stayed anonymous

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 9 — testing "one per customer"
**Surface:** the shop's checkout
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 9 — a returning shopper is now refused a code they have already used

## What happened

SPRING15 was set to **one use per customer**. Rowan Ellery had already used it.
Rowan filled in checkout — name, email, address — went back to the basket, typed
SPRING15, and it was accepted.

The cart's `customer_id` was **NULL**, and had been the whole time.

## What should have happened

Giving your email at checkout is identifying yourself.

## Why it matters

`assertUsageLimit` guards the per-customer check with `if (customerId)`. On a
null customer it does not fail — it **skips**, silently. So "one per customer"
was unenforceable for anybody not already signed in, which on a small shop is
nearly everybody. An owner sets a limit, reads it back on the screen, and it
holds for no one.

The same null spread further: `first_order_only` cannot be answered without
knowing who is shopping, and neither can a customer-group restriction. Every one
of those quietly passed.

## Where it lives

[checkout-service.ts](../../../../wizeworks/packages/commerce/src/services/checkout-service.ts).
`submitContact` wrote the email onto the checkout SESSION and stopped there. The
customer was only ever resolved at order placement, by `ensureCheckoutCustomer`
— which is also why order O-000006 has a customer on its usage row while the
cart it came from never did.

## The fix

`submitContact` now recognises a returning shopper and links the cart to them.

Two decisions inside that, both deliberate:

**It recognises; it does not create.** A brand-new email still mints nothing
until an order is actually placed. `ensureCheckoutCustomer` promotes to the
`customer` lifecycle stage, which is true of somebody who bought and false of
somebody still typing their address — so filling a shop's CRM with abandoned
checkouts, each labelled a customer, would be a worse bug than the one being
fixed.

**It is scoped to the cart's own site**, exactly as `ensureCheckoutCustomer` is,
so one business under a shared tenant cannot recognise the other's shoppers.

## What it looked like once fixed

Same shopper, same code:

> You've already used this discount the maximum number of times

## What this does not fix

A determined shopper can still use a one-per-customer code twice by giving a
different email each time. That is true of guest checkout everywhere and is not
something this layer can close; the limit binds anyone the shop already knows,
which is what it is for.

## Related

[241](241-the-conditions-on-a-sale-were-stored-and-never-read.md) — the
customer-group and first-order conditions this same null was defeating.

## Rating effect

`Sell › Discounts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
