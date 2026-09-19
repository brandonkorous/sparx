# 669 — Both screens told me to do it on the other one

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 239
**Surface:** mypiggles › Stock › On the way, and an order's "What they say has shipped"
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi had two orders out with suppliers, so she opened **On the way** expecting to
see them. Instead:

> **Nothing on the way**
> When a supplier tells you what they have shipped (by email, on a file, or
> through their own system), **record it against the order** and it appears here.
> Receiving then pre-fills it instead of being typed from scratch.

So she went to the order. Its panel said:

> **What they say has shipped**
> Recording a supplier's dispatch note means receiving starts pre-filled, and
> means a short delivery is visible instead of being invisible.
>
> Nothing recorded. Without a dispatch note, a short shipment and a short order
> look identical when the invoice arrives.
>
> \[ **See everything on the way** ]

One button, and it goes back to the list she came from.

**Each screen told her to do it on the other, and neither could do it.** There is
no form anywhere in the console for recording a dispatch note.

MEASURED 2026-09-18: **zero rows in `inventory_advance_ship_notices` across every
tenant on the platform.** The console's own `useCreateAsn()` hook was written,
exported and had **zero callers**.

Then, once she could record one, three more things were untrue.

**The pre-fill never happened.** "Book this delivery in" on a dispatch note opens
receiving with `?advanceShipNoticeId=…` in the address. The receiving screen read
`id` and `purchaseOrderId` and **dropped that third one on the floor**, so
"Received now" was empty on every line and "Outstanding" showed what the ORDER
still owed rather than what the supplier said was in the lorry. `useAsnPrefill()`
was also written, exported, and had zero callers.

**Booking the delivery in never closed the notice.** After she booked 4 units
against ASN-000001, the notice's own screen still said:

> **Nothing has been checked in against this yet**
> Nothing has been compared, because nothing has arrived.

…directly above a table whose **Arrived** column read **4**. The badge still said
"On the way" and the button still offered to book the same delivery in again. In
the database the notice was still `status = expected`, `goods_receipt_id` NULL.
The server's `consumeAdvanceShipNoticeOnTx` was complete and waiting; the console
simply never put `advanceShipNoticeId` in the receipt it posted.

**And the comparison, when it finally ran, was wrong about money.** She recorded
a second notice for the last 2 rolls, and it matched exactly — 2 said, 2 arrived.
The screen said:

> **What arrived does not match what they said**
> **More arrived than the notice claimed. Worth checking before it is paid for
> twice.**
>
> | Item                   | On order | They sent | Arrived | Match                      |
> | ---------------------- | -------- | --------- | ------- | -------------------------- |
> | Linen, natural, 200gsm | 6        | 2         | **6**   | **4 more than the notice** |

Nothing was wrong. It was comparing the notice's 2 against the order line's
**lifetime** total of 6 across both deliveries.

## What should have happened

There is a way to record a dispatch note. Receiving starts from its figures.
Booking the delivery settles the notice. And a notice is judged against its own
delivery, not against everything that ever arrived on that order line.

Those are four sentences the product already says out loud, in copy, on screen.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › On the way** — empty, and it tells you to record one on the order.
3. Open any placed order, scroll to **What they say has shipped** — it tells you
   to record one, and offers only a link back to step 2.

And then, with a notice made by hand through the API:

4. **Book this delivery in** — every "Received now" box is empty.
5. Post the receipt — the notice stays "On the way" for ever.
6. Record a second notice on the same order and receive it — the screen reports
   a discrepancy that does not exist.

## Why it matters

**A dispatch note is the only thing that makes a short delivery visible.** The
order's own copy says it: "without a dispatch note, a short shipment and a short
order look identical when the invoice arrives." Six of twelve turning up reads
exactly like twelve being ordered and six being sent, and nobody can say whose
mistake it was once the invoice is on the desk. That is the whole point of the
feature, and it could not be switched on by anybody.

It is the same shape as [666](666-the-spending-limit-nobody-could-set.md), one
surface further along the same screen: a service, a route, a list pane, a detail
pane, a receiving pre-fill and a settlement path, all finished, behind a door
that was never cut. [[feedback_screen_over_a_function_nobody_calls]]

The last one is worse than missing. **"More arrived than the notice claimed.
Worth checking before it is paid for twice"** sends a business owner to ring a
supplier about an overcharge that is not there — and it fires on the ordinary
case, an order that takes two deliveries, which is precisely the case a supplier
who sends dispatch notes at all is in.

## Where it lives

| What                            | Where                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| No way to record one            | `piggles\|sparx/apps/workbench/surfaces/inventory/purchase-order-procurement.tsx`    |
| Receiving dropped the notice id | `…/receipt-detail.tsx` — `ReceiptDetailSurface` read only `id` and `purchaseOrderId` |
| Receipt never carried it        | `…/receiving-data.ts` — `CreateReceiptInput` had no `advanceShipNoticeId`            |
| The wrong comparison            | `wizeworks/packages/inventory/src/services/advance-ship-notices.ts` `loadDetail`     |

```text
discrepancyUnits: settled
  ? line.purchaseOrderLine.quantityReceived - line.quantityShipped   // ← lifetime, not this delivery
  : null,
```

## The fix

**1. A form.** `asn-record-dialog.tsx` is new in both consoles, opened by a
**Record what they sent** button in the order's own panel — where both screens
were already pointing. Its own file because that panel is documented as
read-mostly and a form is a second job.

It opens filled in with everything the order is still owed, because "they sent
the lot" is the ordinary case and a short shipment is then one edit rather than a
form typed from nothing. Nothing is written until the button is pressed. A notice
claiming MORE than the order still owes is allowed through and said out loud
("That is recorded as they said it, so you can take it up with them") rather than
clamped away — over-claiming is the thing a notice exists to expose. The button
only appears on orders the service will accept one against (`submitted`,
`partial`), so it cannot be offered where it would always fail.

**2. Receiving reads the notice.** `preAsnId` is read from the params, passed to
`BookDelivery`, and the existing `useAsnPrefill()` finally has a caller. The
seeding effect fills each line from what the supplier stated, and their dispatch
number becomes the receipt's reference if the receiver has not typed one.

The blank-by-default rule for a plain order is deliberate and is kept — the
comment on that effect warns against "a silent pre-tick that over-books whatever
the buyer did not glance at". A dispatch note is the one exception, and it is not
silent: a panel above the table names the note the numbers came from.

> **Filled in from ASN-000002, what they say they sent**
> These are the supplier's figures, not a count. Change anything that did not
> turn up, or turned up damaged: what you enter here is what goes onto your
> stock, and the two are compared for you afterwards.

**3. The receipt carries the notice.** `advanceShipNoticeId` added to
`CreateReceiptInput` and sent when the receiver came from one. The server already
did the rest. Booking now also invalidates `asnKeys.all`, so the notice's pane
and the list stop showing "on the way" for something that has landed. (A real
import, not a duplicated key — `advance-ship-notices-data` does not import
`receiving-data`, so there is no cycle to route around.)

**4. The comparison uses its own delivery.** `loadDetail` reads the goods-receipt
lines behind `goodsReceiptId` and compares those with what the notice claimed.
A new `quantityArrivedOnThisDelivery` is what the **Arrived** column now shows;
the line's lifetime total stays on the row as context, which is what it always
was. A settled notice with no receipt behind it is left uncomparable rather than
measured against zero.

**Proved red.** The existing test booked ONE delivery per order, where the
line's lifetime total and the delivery are the same number — so it was green with
the bug installed and structurally could not have caught it.
[[feedback_a_test_that_cannot_go_red]] The new test takes two deliveries, 4 then
2 of 6, each matching its note exactly. Reinstating the old arithmetic fails it
with **"expected 6 to be 2"**.

**Sibling check.** Both consoles carry the same four changes. `check:console-parity`
passes. The only other place that renders `quantityReceived` from a notice is the
same column in the sparx twin, changed with it.

## Confirmed by

Re-ran P03 act 239 on the screen, end to end, with nothing stubbed:

> Recorded **ASN-000001** against PO-000005 — Ashcombe say 4 of the 6 rolls went
> out with Brindle Haulage, BR4471902. It appeared on **On the way** as
> "against PO-000005 · their ref AM-DN-8841 · Typed in by hand".
>
> **Book this delivery in** opened receiving with **4** already in the box, under
> "Filled in from ASN-000001, what they say they sent", and "How it lands"
> reading **2 short**. Booked as GR-000005, 4 units onto the shelf, slip
> AM-DN-8841 carried across.
>
> Recorded **ASN-000002** for the last 2. The dialog opened on "Still owed 2".
> Booked it in — **2**, "Completes this" — as GR-000006. The notice went to
> **Arrived**, linked to GR-000006 in the database, and its own screen reads:
>
> > **What arrived matched the notice** — Every line came in at the quantity they
> > said it would.
> > Linen, natural, 200gsm · On order 6 · They sent 2 · **Arrived 2** · **Matched**

Before the fix the same screen said "More arrived than the notice claimed. Worth
checking before it is paid for twice", with Arrived reading 6.

ASN-000001 is deliberately left `expected` in the data: it was booked in before
the third fix landed, and it is the record of what that looked like.

## Rating effect

Recorded in [rating.md](../rating.md):

- `Stock › On the way — Design 8 · Ease 8`, first scored this act
- `Stock › On the way › (a shipment) — Design 9 · Ease 8`, first scored this act
