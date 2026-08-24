# 064 — A customer collecting a bun had to type a postal address

**Status:** fixed — awaiting confirmation on screen
**Severity:** major (friction on the only checkout a collection-only business has)
**Found by:** P01 · Thistle & Rye · act 8's outstanding 390px pass — placing **O-000002**
**Surface:** the tenant's live site — Checkout, step 2
**Filed:** 2026-08-21
**Fixed:** 2026-08-24
**Blocked on:** the migration + `prisma generate` (checkout_sessions.customer_name)

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

## The fix — 2026-08-24

### The name moved, and that is what made the rest possible

Checkout asked for "Full name" as the FIRST LINE OF THE SHIPPING FORM. So the
only way a shop could learn who was buying was to make the buyer type a street,
a city and a postal code first — `ensureCheckoutCustomer` read the customer's
name out of `shippingAddress.recipientName`, and `complete()` refused outright
without a shipping address. Deleting the form would have deleted the name.

So the name moved to the contact step, beside the email, where it belongs: it is
what EVERY order needs however it leaves. `checkout_sessions.customer_name` is
new, nullable and undefaulted — a session that has not reached the contact step
has not been told a name, and no default can say that.

Migration: `20270408000000_a_collected_order_needs_a_name_not_an_address`.

### Asking the question before asking the shopper anything

The obvious version — quote with a placeholder destination and call an empty
result "collection only" — is wrong, and would have been a worse bug than the
one being fixed. A live carrier GEOCODES the destination to rate, so a shop with
Shippo connected and no manual zones returns zero rates against a placeholder,
and checkout would have concluded "collection only" and hidden USPS from every
one of that shop's customers.

`shippingService.deliveryIsConfigured` answers it from CONFIGURATION instead:
a delivery zone exists for this site, or a shipping carrier is connected and
enabled. Both are knowable with nobody's address in hand. The shipping-quote
route now returns `{ deliveryOffered, rates }`, and checkout opens the session
and asks this before it draws its first form.

### What a shopper now sees

| The shop                          | Step 2                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hands everything over its counter | **"How you'll get your order"** — the method, and a line saying whose name it will be under. No address form, and the step is labelled _Collection_, not _Shipping_.                             |
| Delivers                          | **"Where should we send it?"** — their saved addresses as choices with their usual one already picked, or a new one with _"Keep this address on my account, so I don't type it again"_ under it. |

The address book was always there — the account area has listed and edited
addresses for as long as it has existed, and its own file says the default one
"is used to prefill checkout". It never was. That is fixed in the same pass.

### The server refuses a delivery with nowhere to deliver to

`shippingAddress` is optional on `SubmitShippingInput`, and `submitShipping`
throws unless the chosen rate is a collection rate. Absent is stored as
`Prisma.DbNull` — not a placeholder, and not the JSON value `null` — so every
screen downstream can tell "collected" from "we lost the address".

### What reads it downstream

- **Order pane** — the collected branch was rendering an `AddressBlock` over
  `billingAddress`, which on a new collected order is "Not given". It now shows
  **who is collecting**, and only shows an address when an older order actually
  carries one, labelled as what it is rather than as a destination.
- **The shopper's own order page** — showed nothing at all for an order with no
  address. The public order now carries `shippingDescription` and `collecting`
  (derived, not the raw metadata blob, which holds payment refs), so it says
  _"How you'll get it — Collect in person"_.
- **Order confirmation email** — already conditional on the address, with tests
  for the omitted case. Unchanged.
- **`site-mcp`** — `set_checkout_shipping` takes the address optionally and its
  description says when to omit it; `set_checkout_contact` takes the name.

### Files

`wizeworks/packages/db/prisma/schema/40-commerce-checkout.prisma` ·
`…/migrations/20270408000000_…` ·
`packages/commerce-schemas/src/checkout.ts` ·
`packages/commerce/src/services/{checkout-service,shipping-service,collection-option}.ts` ·
`packages/commerce/src/services/checkout-address.test.ts` (new) ·
`packages/site-mcp/src/catalog/checkout.ts` ·
`services/api-rest/src/routes/v1/public/{checkout,account}.ts` ·
`apps/site/lib/{checkout-client,customer-client}.ts` ·
`apps/site/components/checkout/{checkout-flow,contact-step,collection-step,delivery-step,rate-choices,saved-addresses,use-address-book,checkout-chrome}.tsx` ·
`apps/site/app/account/(authed)/orders/[orderId]/page.tsx` ·
`piggles/apps/workbench/surfaces/commerce/order-detail*.tsx`

### Not confirmed yet

Nothing has been driven through a live checkout — the migration has to be
applied and the Prisma client regenerated first, and both need the dev server
stopped. Two `customerName` typecheck errors in `checkout-service.ts` are the
expected consequence of that and clear when it runs.
