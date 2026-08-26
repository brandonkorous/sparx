# 223 — Writing the cheque number down made the order un-refundable

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 7
**Surface:** mypiggles › Sell › An order › Money in
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 7 — the same order refunded $42.00 on screen where it had refused

## What happened

Anneliese's cheque arrived. Devi recorded it the way the screen asked:

| How much they paid | How they paid | Anything to note (optional)  |
| ------------------ | ------------- | ---------------------------- |
| 170.00             | Cheque        | `Cheque 4471, banked Aug 25` |

Two things followed, and the second one took an hour to explain.

**The note vanished.** The Money in row came back reading `$170.00 · Cheque` and
the date. Nothing about cheque 4471. A field that asks for a cheque number and
then shows it back nowhere is a field that ate what she typed.

**And the order could no longer be refunded.** Taking a return through to
settlement on that order failed. Twice. On Jo Kim's order — same shop, same
cheque, same everything — **the identical refund had gone through a minute
earlier.** The one difference between the two orders was that Devi had filled in
the note box on one of them.

What the screen told her, both times:

> **That didn't save.** Check what you entered and try again.

What the server had actually said:

> No payment gateway is configured to settle this refund. Refund the customer
> manually or issue account credit.

## What should have happened

Writing down which cheque it was does not change what the money is.

## Why it matters

**A shop that takes cheques cannot give money back**, and the thing that breaks
it is filling in an optional box exactly as prompted. There is no way to work
that out from the screen: the field is optional, the note is never displayed, and
the failure arrives on a different page days later wearing a message about a
payment gateway this business has never had.

Devi is on manual payments. She has no gateway and never will. Every order she
notes a cheque number on is an order she cannot refund, and she would find out
one customer at a time.

Two more consequences of the same root:

- `processorRef` is part of `@@unique([tenantId, processor, processorRef])`.
  Two cheques noted the same way — "cheque from Jo", twice — **collide**, and the
  second payment is refused.
- Anything reading `processorRef` as a charge reference reads a human sentence.

## Where it lives

Three layers, one mistake.

**The console** put the note in the wrong column.
[order-actions.ts](../../../../piggles/apps/workbench/surfaces/commerce/order-actions.ts)
and [sale-data.ts](../../../../piggles/apps/workbench/surfaces/commerce/sale-data.ts):

```ts
...(input.reference?.trim() ? { processorRef: input.reference.trim() } : {}),
```

`processorRef` means _the gateway's own reference for this charge_. The box above
it is labelled **"Anything to note (optional)"** and placeholdered **"Cheque
number, who took it…"**. Those are not the same field and the screen was writing
one into the other.

**The refund path** treated the presence of that reference as proof a gateway
charge existed:

```ts
const payment = await tx.orderPayment.findFirst({ …, select: { processorRef: true } });
return payment?.processorRef ?? null;   // ← truthy ⇒ call the gateway
```

so it tried to reverse a charge at a gateway, on a shop with no gateway.

**The pane** rendered the note nowhere, which is why the first symptom was
silent.

## The fix

- **The note goes to `metadata.note`.** `processorRef` is left for what it means.
- **The processor decides whether there is a gateway charge**, not whether a
  reference happens to be present. `stripe` and `paypal` hold a charge somewhere
  else; `manual`, `check`, `wire`, `ach`, `card` (the shop's own terminal) and
  `net_terms` are money a person handed over, and giving it back is counting
  notes out rather than an API call.
- **The Money in row shows the note.** It reads `metadata.note` first and falls
  back to `processorRef` for payments taken before this was fixed — on a
  hand-taken payment that field only ever held what somebody typed, so showing it
  is the honest reading of an old row.

## What is NOT fixed

**The console still swallowed the server's sentence.** api-rest returned a 422
carrying _"No payment gateway is configured to settle this refund. Refund the
customer manually or issue account credit"_ — actionable, correct, and exactly
what Devi needed — and two toasts appeared saying "That didn't save. Check what
you entered" and "The refund did not go through." The one path to the answer was
reading the response body by hand.

That is its own defect, the same shape as
[172](172-fourteen-of-her-fifteen-codes-were-not-the-one-she-typed.md) if a 422's message
cannot reach a toast anywhere in the app. **Filed separately as
[224](224-the-server-explained-the-problem-and-the-screen-said-check-what-you-entered.md).**

## Rating effect

`Sell › An order` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
