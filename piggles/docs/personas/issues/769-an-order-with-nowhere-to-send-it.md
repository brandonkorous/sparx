# 769 — An order with nowhere to send it, and no box to type one in

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 272
**Surface:** `commerce.order.detail` — "Where it goes", both consoles
**Filed:** 2026-09-22
**Fixed:** 2026-09-22
**Confirmed by:** P03, addressing O-000020 and posting it
**Blocked on:** —

## What happened

Tamsin accepted the quote. Devi turned it into order O-000020, $504.00 of
knitwear, and opened it to get it out the door:

```
Where it goes
Copied down when the order was placed, so changing the customer's address
later never rewrites where this one went.

Delivery address          Billing address
Not given                 Not given
```

And that was the end of it. No button, no field, nothing to click. A $504 order
she had promised a shop, with no address on it and no way to put one on.

## MEASURED, before the fix

| where                                 | what was there                       |
| ------------------------------------- | ------------------------------------ |
| `orders.shipping_address` on O-000020 | null                                 |
| `orders.billing_address` on O-000020  | null                                 |
| the customer's address book           | **no rows** for Tamsin Vale          |
| the wholesale account `companies` row | the table has **no address columns** |
| the quote it came from                | `{"name","email","address": ""}`     |

Nothing was lost on the way. There was simply never an address anywhere, and
the order screen had no opinion about that beyond printing "Not given" forever.

Across the platform, **1 of 118 orders** has neither an address nor a recorded
delivery method — the one made this way. Every other door captures one: a
shopper types it at checkout, the till copies one down, an import carries one.
**The quote-to-order conversion is the door that does not ask**, because a quote
is a price and nobody asks a price where the goods are going.

## Why it stayed invisible

`PATCH /v1/orders/:id` has always accepted `shippingAddress` and
`billingAddress`. It is in `UpdateOrderInput`, the service writes it, the route
is wired. The pane READ those two fields and never offered to set either.

That is the same shape the file next door already documented about itself, one
section up the same page:

> `POST /v1/orders/:id/payments` has always existed. The order pane READ it —
> the "Money in" card lists every payment and says "No payment has been recorded
> against this order yet" — and offered no way to add one. So the sentence was
> true and permanent.

Same page, same shape, one card apart. [[feedback_screen_over_a_function_nobody_calls]]

## What was done

**The section can be filled in.** A button in its header — **Say where it goes**
when there is nothing (solid, because it is the thing to do), **Change the
address** when there is (quiet, because it is not). It opens the boxes in the
pane rather than a modal, the same rule the customer's own address list follows,
so the app's unsaved-work guard can see them.

**It says so before she goes looking:**

> **Nobody has said where this one goes**
> You cannot post it until there is an address on it. Put one on and it stays
> with this order only.

**Billing follows delivery unless told otherwise**, on a switch, which is how
every checkout in the world asks it and how a shop owner thinks about it.

**It stays a snapshot.** This writes the ORDER's own copy. The customer's
address book is untouched, so the promise in the description — that changing
their address later never rewrites where this one went — now holds in both
directions rather than one.

**Editing closes once anything has gone out.** After a shipment the address is
not a plan any more, it is the record of where a parcel actually went.

**No "copy from their saved addresses" shortcut.** The address book belongs to
the CRM module, and a shop running Selling without it would get a refusal where
a helpful button was promised. [[feedback_a_promise_in_copy_is_a_contract]]

## Files

- `piggles/apps/workbench/surfaces/commerce/order-detail-address-form.tsx` — NEW
- `sparx/apps/workbench/surfaces/commerce/order-address-form.tsx` — NEW
- `piggles/apps/workbench/surfaces/commerce/order-detail-parties.tsx` — the section
- `sparx/apps/workbench/surfaces/commerce/order-detail.tsx` — the section
- `piggles/apps/workbench/surfaces/commerce/order-actions.ts` — `useSetOrderAddresses`
- `sparx/apps/workbench/surfaces/commerce/data.ts` — `useSetOrderAddresses`

## Proof

Typed on screen 2026-09-22 and saved, and the row underneath it:

```
Where it goes                                    Change the address

Delivery address          Billing address
Tamsin Vale               Tamsin Vale
Loom and Larder           Loom and Larder
2140 NE Alberta St        2140 NE Alberta St
Portland, OR, 97211       Portland, OR, 97211
US                        US
```

```
O-000020 | {"city": "Portland", "line1": "2140 NE Alberta St", "region": "OR",
            "company": "Loom and Larder", "country": "US",
            "postalCode": "97211", "recipientName": "Tamsin Vale"}
```

Only the fields she filled. An empty box is an omitted key rather than an empty
string, so nothing draws a blank line inside the address.

The order was then posted from the same screen: USPS, tracking
9400111899223197428851, and **Shipping confirmation: email** ran and completed
for it, so Tamsin has the tracking number.

## Still true, and not this issue

The conversion drops the quote's `bill_to` and `ship_to` — **79 of 105 billing
documents carry a `bill_to` and 31 a `ship_to`** — and none of it reaches the
order. It cannot simply be copied: a document holds one free-text block
(`"88 Mapleton Avenue\nBoulder, CO 80304\nUS"`) and an order holds
`line1 / city / region / postalCode / country`, which required fields a parser
would have to guess at. Guessing a structured address out of free text posts
parcels to the wrong place, so nothing here invents one.
[[feedback_never_present_absence_as_measurement]]
