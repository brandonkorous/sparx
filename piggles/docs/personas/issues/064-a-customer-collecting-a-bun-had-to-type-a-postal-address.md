# 064 — A customer collecting a bun had to type a postal address

**Status:** open — accepted, to build
**Severity:** major (friction on the only checkout a collection-only business has)
**Found by:** P01 · Thistle & Rye · act 8's outstanding 390px pass — placing **O-000002**
**Surface:** the tenant's live site — Checkout, step 2
**Filed:** 2026-08-21
**Fixed:** —
**Blocked on:** —

## What happened

Thistle & Rye is one shop on Mercer Lane. No delivery, no warehouse, no couriers —
everything is collected at the counter, which is exactly what [046](046-she-could-hand-the-bread-over-and-the-order-stayed-open-forever.md)
established from behind the counter.

Checkout step 2 is headed **"Shipping address"** and asks for:

> Full name · Address · Apartment, suite, etc. · City · State / Region · Postal code ·
> Country · Phone

All of it required except the apartment and the phone. The button says
**"See your options"**. Filled it in — 14 Mercer Lane, Ashfield, OR, 97401 — pressed it,
and the options appeared:

> **How you'll get your order**
> ⦿ **Collect in person** — Free

One option. It needs no address at all. The customer typed a delivery address for an
order that will never be delivered, to find out that delivery was never on offer.

## What should have happened

The shop should ask for an address when it is going to use one. A collection-only
business should reach the method choice — or skip it — without a delivery form.

## Why it matters

Seven fields between "I want a bun" and "you can have a bun", on a phone, for nothing.
Some of those shoppers stop typing. And a business owner who set up collection-only
deliberately watches her own checkout ask for something she told it she does not need.

It also puts a fictional-looking address on a collection order, which the console then
shows on the order pane as though it meant something.

## Where it lives

- `wizeworks/apps/site/components/checkout/checkout-flow.tsx` — `handleShipping` quotes
  rates from the entered address, so the address must exist before any method is known.
- `wizeworks/services/api-rest/src/routes/v1/public/checkout.ts:164` — the quote route
  **already accepts `destinationCountry` alone** and notes _"Zone matching only reads
  `toAddress.country`, so that alone is enough for manual rates."_ A pickup rate is a
  manual rate. **So the checkout could pre-quote on country alone and know, before it
  asks for anything, whether this shop delivers.**

## Why this is not patched here

The pre-quote is the easy half. The hard half is `ShippingBody`, same file, line 49:

```ts
const Address = z.object({
  name: …min(1), line1: …min(1), city: …min(1), postalCode: …min(1), country: …length(2), …
});
```

`line1`, `city` and `postalCode` are **required** on `submitShipping`. Skipping the form
means either relaxing that schema for pickup rates, or sending placeholders — and
placeholders would write a fake street onto a real order — a value nobody supplied,
rendered as though somebody had. Whichever
way it goes, it changes what an order record contains, and the order pane, the packing
walk, invoices and carrier labels all read that field.

**That is a data-model decision, not a mechanical fix** — the same reason
[056](056-she-published-and-her-site-showed-the-old-page-for-eight-minutes.md) was left
alone rather than half-wired.

## The shape a fix would take

1. On entering the shipping step, quote with `destinationCountry` only.
2. If every returned rate is a pickup rate, show the method choice **first** and collect
   only what a handover actually needs — **a name and a phone number**.
3. Let `submitShipping` accept that shape for a pickup rate, and store it as what it is:
   a collection contact, not a delivery address. A collection order should read
   "Collect in person — Rowan Ellery, 541-555-0142" on the order pane, with no address
   line at all.
4. If any rate ships, the address form is exactly what it is today.

## How to reproduce

1. A tenant with only a pickup fulfilment method (Thistle & Rye).
2. Add anything, go to checkout, reach step 2.
3. Fill in the whole address. Only then does **Collect in person** appear.

Every time.

## Decision — 2026-08-24, Brandon

**The address is optional.** A collection order stores none, because there is no
address involved in collecting something.

The requirement moves to where it belongs: **checkout asks for an address only
when the order is a delivery**, and when it is, it gives the customer a way to
enter one and SAVE it, so the next order does not ask again.

One nuance that does not change the answer: tax can need an address even on a
collection order, but that is the SHOP's address, not the customer's, so nothing
here has to be collected from the buyer to make tax work.
