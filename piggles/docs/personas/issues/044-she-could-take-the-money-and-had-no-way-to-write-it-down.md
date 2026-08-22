# 044 — She could take the money and had no way to write it down

**Status:** fixed
**Severity:** **blocker** (a manual-payments business could place orders and never finish one)
**Found by:** P01 · Thistle & Rye · act 9 — Rowan collects and pays cash
**Surface:** mypiggles › Sell › the order pane, "Money in"
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 9 — **O-000001** flipped to Paid

## What happened

Order placed, bread ready, Rowan hands over $33.00. The order pane says:

> **Money in** — No payment has been recorded against this order yet.

And offers no way to record one. The only actions on the whole pane were **Send
to the warehouse** and **Cancel order**.

## Why it matters

This is not a missing convenience — it is the advertised feature not existing.
The provider picker offers **Manual payments** and describes it, in its own
words, as _"Record check, cash, wire or bank transfer by hand… you mark each
order paid yourself."_ A business that took that offer could take orders and
never mark one paid: the order sits `unpaid` for ever, the "still owed" banner
never clears, and her Money screens count a debt that was settled at the counter.

For a collection-only bakery that is the entire business model.

## Why it happened

`POST /v1/orders/:id/payments` has always existed. The pane READ it — the card
lists every payment and reports the empty case — and nothing in either console
ever called the write. So the sentence was true, and permanently true.

A clean example of the API-first rule delivering the endpoint and the surface
never following.

## The fix

**`useRecordOrderPayment`** in both consoles' order data layer, and a
**`RecordPayment`** control on the "Money in" card:

> **How much they paid** `33.00` · **How they paid** `Cash` · **Anything to note
> (optional)** · **Write it down**

- Prefilled with what is outstanding, because settling in full is the common
  case — and it is an input, so a **part payment is just typing over it**. (That
  is act 10's $200-on-account case, from the same control.)
- Offered only while money is actually outstanding. A settled, cancelled or
  refunded order has nothing left to write down, and the box would invite a
  second payment onto an order already square.
- `stripe`/`paypal` are deliberately absent from "How they paid": a gateway
  records its own payments, and offering them here invites somebody to type in a
  card sale that never happened.
- The words are hers. "processor", "captured" and "processorRef" are the API's
  vocabulary; she took some money and wants to write down how much and how.

`SubSection` gained a `footer` slot, because the control that adds the FIRST row
has to be reachable when there are no rows — the state it exists for. `children`
alone could not do it; the component hides them at count 0.

## Confirmed

Recorded $33.00 in cash. The order chip went **Not paid → Paid**, "Money in"
shows `$33.00 · Cash · Taken`, the form withdrew because nothing is outstanding,
and a Refund action appeared.

## Two copy defects it exposed, both fixed

- **`$33.00 · manual`** — the raw column value on a screen about somebody handing
  over notes. `PAYMENT_PROCESSOR_LABELS` now renders "Cash", "Cheque", "Bank
  transfer", "On account", matching the `PAYMENT_STATUS_LABELS` map beside it
  that already turns "captured" into "Taken".
- **"Sends $33.00 back to the card it was paid with."** — there was no card. Both
  halves of the refund description now branch on whether the money ever went
  through a gateway; fixing only the first left "The money leaves your account
  straight away" standing immediately after "nothing is sent anywhere", two
  sentences contradicting each other about a refund.

## What it exposed next — fixed in 046

The pane's primary action was **Send to the warehouse** (it generates a picking
walk), for an order the customer chose **Collect in person** for, at a bakery
with one shop and no warehouse. "Where it goes" and "Deliveries" were written the
same way, and the order DTO the console reads carried no shipping method at all —
only the checkout SESSION had `shippingDescription` — so the pane could not tell
the two apart.

That is [046](046-she-could-hand-the-bread-over-and-the-order-stayed-open-forever.md):
the method now travels onto the order, the whole card reads off it, and the
handover itself can be recorded.
