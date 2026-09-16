# 453 — The replacement went out with no way to follow it

**Status:** fixed
**Severity:** major
**Found by:** Brandon, reading act 110 · built as P03 · Juniper Row
**Surface:** Selling › Returns › a return › Send the replacement
**Filed:** 2026-09-09

## What was wrong

[448] built the email that tells a customer their replacement is on its way. It
could say that and nothing more, because **the replacement had no delivery
record of its own.** No carrier, no tracking number, no date it was posted.

The gap was written into the code as a comment, which is how it was found:

> No tracking row is offered because a replacement has no delivery record of its
> own yet; saying "on its way" and nothing more is the true version of what the
> shop knows.

True at the time, and the wrong thing to settle for. On this same platform the
ordinary shipping confirmation **leads with the tracking number**, in an
emphasized row, because that is what the recipient opened the email for. A
customer who gets "it's on its way" and no number writes back to ask where it is
— the exact exchange Devi bought this product to stop having. Returns are 22% of
her orders and swaps are the normal case.

## Why it is not an order fulfillment

The obvious answer is wrong, and it is worth writing down so nobody tries it
again.

A parcel normally lives in `order_fulfillments`. `createFulfillment` refuses this
one: it caps each line at `quantity - quantity_fulfilled`, and the line was
fulfilled **once already**, when the customer first received the thing they are
now returning. Getting past that cap would double-count `quantity_fulfilled` and
publish a second `order.fulfilled`, sending "your order has shipped" about an
order that shipped weeks ago.

A replacement is not another go at an order line. It is its own parcel, and it
belongs to the return that caused it.

## What it is instead

`commerce_return_labels` was already the right table, one leg short. It holds a
parcel that exists BECAUSE of a return, with a tracking number and a tracking
URL — and every row in it was the label the customer uses to send the goods
**back**. The replacement going the other way is the same fact pointing the other
direction, so the table gained a direction rather than a second table gaining six
identical columns.

```
direction   'inbound' (default, every existing row) | 'outbound'
carrier     the carrier as a PERSON names it
label_ref   now nullable — there is no carrier label id when nobody bought one
shipped_at  when it was actually posted, not when the row was written
```

`provider_slug` is `manual` and `label_ref` is null when somebody typed the
number in, which is how most replacements go out. Those two columns answer "which
integration bought this label", and inventing a value for them would be the same
mistake as a $0.00 refund standing in for a swap.

## Two moments, not one

The important design decision. **The tracking number usually does not exist when
the swap is settled.** A shop decides what to send while the customer is waiting,
settles it there and then, and the parcel goes out that afternoon.

So it is asked twice:

| when                 | what happens                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| known at settle time | rides on `return.exchanged`; the swap email prints it. One email.                                      |
| known afterwards     | **Say how it went out** → `return.replacement_shipped` → its own email whose entire job is the number. |

Never both. A swap settled with the number in hand never reaches the second path,
so a customer gets one email about their replacement rather than two saying the
same thing.

Leaving the route open afterwards is the whole point, and it is [452]'s lesson
applied before it could bite again: a fact about the world that arrives five
minutes after a screen closes needs somewhere to go, or it is lost.

## Where the code changed

- `wizeworks/packages/db/prisma/{migrations/20270502000000_a_replacement_travels_too, schema/43-commerce-returns.prisma}`
- `wizeworks/packages/commerce-schemas/src/returns.ts` — `ReplacementShipment`,
  `RecordReplacementShipmentInput`, and `shipment` on the settle input
- `wizeworks/packages/commerce/src/services/return-service.ts` —
  `writeReplacementShipment`, `recordReplacementShipment`, the parcel facts on
  the event, `direction`/`carrier`/`shippedAt` on the detail
- `wizeworks/packages/events/src/types.ts`, `commerce/src/events.ts`,
  `terraform/envs/prod/main.tf` — `return.replacement_shipped`
- `wizeworks/packages/automation/src/resolvers/builtins.ts` — three parcel fields
  on both swap events
- `wizeworks/packages/builder-schemas/src/{binding.ts, default-emails-silica.ts, default-emails.ts}`
  — the tracking rows on the swap email, and a new **Replacement tracking**
  template (41 → 42)
- `wizeworks/packages/automation-actions/src/seeds/{returns.ts, index.ts}` — the
  automation that sends it
- `wizeworks/services/api-rest/src/{routes/v1/commerce/providers.ts, lib/email-data.ts}`
- `{piggles,sparx}/apps/workbench/surfaces/commerce/` — `carriers.ts` (extracted,
  see below), `return-shipment.ts`, `replacement-shipment-fields.tsx`,
  `return-parcels.tsx`, the swap modal, the **Say how it went out** modal, both
  return panes
- Tests: `{piggles,sparx}/…/commerce/return-shipment.test.ts` (15 each)

### Four neighbours it would have left behind

1. **`resolveReturn` reads "the newest label on this return"** for
   `return.labelUrl`. With outbound rows in the same table, the newest row on a
   swapped return is the replacement — so a customer who wanted the page for
   POSTING a parcel would have been sent to a tracking page for one already sent.
   Now split by direction.
2. **Neither console rendered `labels` at all.** The prepaid label has always
   been fetched by the return detail and drawn on no screen, so a shop wanting to
   tell somebody their return label number had to look in the database. The new
   **Parcels** card draws both legs.
3. **The carrier list was about to be a third copy.** It lived inline in each
   console's handover modal; extracted to `carriers.ts` so a carrier added to the
   list appears on every screen that asks.
4. **The `ReturnRequest.status` comment in the schema never learned
   `exchanged`**, added the day before. A doc-in-code that lists nine of ten
   states misleads the next reader precisely because it looks complete.

## Verification

Migration applied to the local database on 2026-09-09 and the client regenerated.
All three columns landed, `label_ref` is nullable, and **all 30 existing rows read
`inbound`** — every one of them is what the column now says it is.

Green with the database up: api-rest 507 across 87 files, commerce-schemas 459,
commerce 190, builder 142, automation 75, automation-actions 62, piggles console
185, sparx console 110. Typecheck, lint and prettier clean everywhere; the RLS
audit passes over 441 tables; `check:events`, `check:webhooks`,
`check:console-parity`, `check:routes`, `check:docker` and `check:boundaries` all
pass.

No `return.*` event is webhook-subscribable, so the new one matches its siblings
rather than being left out of a list it should have joined.

**Driven on screen as Devi on 2026-09-09**, both moments and both carrier kinds:

- A swap settled **with** the tracking number in hand rode it on `return.exchanged`;
  the "Replacement sent" automation ran and completed. One email.
- A swap settled **without** one grew the **Say how it went out** card; recording
  it there published `return.replacement_shipped` and its own automation ran and
  completed. One email, and the card then disappeared.
- The Parcels card draws both legs, and draws nothing on a return with no parcel.
- A courier typed by hand ("Larimer Courier") stores and prints as typed.
- Send stays disabled with no tracking number, which is the whole rule.
- The rows landed as designed: `direction: outbound`, `provider_slug: manual`,
  `label_ref` null, cost 0, `shipped_at` set.

Walking it turned up two defects the checks could not see, both filed as [454]:
the carrier printed as the raw code `usps` on her screen and in her customer's
email, and the swap toast claimed goods had gone back on a shelf when nothing had.

## Rating effect

`Selling › Returns › a return` — recorded in [rating.md](../rating.md).
