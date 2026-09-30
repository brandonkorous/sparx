# 875 — A payment written down by mistake could not be taken back

**Status:** fixed
**Severity:** **major** — money can be recorded against an order by hand, and
could never be un-recorded. The endpoint that does it has always existed and is
complete; nothing in either console called it. The only remedy on offer was to
record a **refund** that never happened, which puts money out of the door in the
refund figures, the buyer's lifetime total and the takings report
**Found by:** P03 · act 310, reading the order pane's money card
**Surface:** mypiggles › Sell › Orders › an order › Money in, in both consoles
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 16 tests, proved red on two plausible wrong rules

## Measured

```
order_payments on the platform            33
taken by hand (manual / check / wire / card / gift card)   17
ever voided                                0
```

`voided_at` is NULL on every row the platform has ever written.

## The chain

The server side is finished:

```ts
app.post('/v1/orders/:id/payments/:paymentId/void', async (request) => { ... });
```

`voidPayment` is idempotent, recomputes the order's `amountPaid` and the buyer's
lifetime total inside the same call, and writes an audit entry. The console's
payment row renders the amount, the method, the date, the note and a status
badge, and **offers no action at all**. A search for the route across both
consoles returns nothing.

## Why it matters on a shop like hers

`useRecordOrderPayment` exists exactly so a business that takes cash over a
counter can mark an order paid. Its own comment says why:

> The provider picker offers **Manual payments** and describes it, in its own
> words, as "you mark each order paid yourself". A business that took that offer
> could place orders and never mark one paid.

A counter is also where the mistake happens. Two customers, one screen, and the
$30 goes against the wrong order. Seventeen hand-taken payments exist on the
platform and **ten of them are hers**.

With nothing to take it back, she had two moves:

1. Leave an unpaid order reading as paid. It stops appearing in **Still owed**,
   so it is never chased.
2. Record a refund. `amountPaid` comes back down, but now there is a refund that
   never happened: in the refund figures, on the customer's record, and in the
   takings. **The only offered remedy made the books less true, not more.**
   [[feedback_one_outcome_two_causes]]

## Why only money she took herself

Taking a row off here changes what sparx believes. It tells a payment provider
nothing. On a card charge through Stripe or PayPal the money really is sitting
with the provider, so marking it off would make her books say unpaid while the
provider holds the cash: a new wrong answer in place of the old one.

`paidByHand` already existed for exactly this distinction, used to pick the refund
wording, with its own note about why a card on the shop's OWN reader counts and a
gateway does not. The action is gated on it, and on the payment still being one
the order counts:

```ts
const COUNTED = new Set(['captured', 'authorized', 'pending']);

export function canTakeOff(payment: TakeOffFacts): boolean {
  if (!payment.byHand) return false;
  return COUNTED.has(payment.status);
}
```

`failed` is excluded on purpose. Nothing was ever counted, so there is no figure
to correct and the row already says what happened.

## What it says

The button on the row is **Take it off**, and it is `danger` + `outline`, the
same treatment as the two irreversible rows at the bottom of the pane, because it
is irreversible: the server will not un-take-off a row.

```
Take $33.00 off order O-000013?

Use this when a payment was written down by mistake. No money moves: $33.00 was
never put through a card machine and was never taken online, so there is nothing
to send back. The order counts it as unpaid again, and the line stays on it
marked Canceled so you can see what happened. If the money really did come in
and you are sending it back, close this and use Refund instead.
```

Three things that dialog does on purpose:

- **It names the other remedy.** Two presses on this pane look identical from the
  outside and cost completely different things.
- **It says what the line will read afterwards.** The badge says "Canceled", and
  that word also describes a canceled ORDER. Saying it in advance is what stops
  it reading like the wrong thing happened.
- **It predicts no new balance.** What is still owed is worked out from the
  total, refunds, gift cards and account credit. A figure guessed in a dialog
  would be a second opinion about her money.
  [[feedback_never_present_absence_as_measurement]]

The reason goes on the record as **"Written down by mistake"**, which the row
already prints, so the line says why it is off rather than only that it is.

**One word changed after the fact.** The first wording said the money was never
charged through "a card machine or a payment provider", and `check:screen-names`
caught it: **Payment providers** is the name of a screen in the sparx console, and
Piggles calls that same screen **How you take payment**. A sentence naming a screen
that a reader cannot find is a sentence sending them to look for it. The file is
byte-identical in both consoles, so it now names neither: "never put through a card
machine and was never taken online".

## Proved

**16 tests**, proved red on the two plausible wrong rules:

```
gate on status alone, dropping byHand   →  1 of 16 fails ("never offers it on money a provider is holding")
treat `failed` as takeable              →  1 of 16 fails ("does not offer it on a payment that never worked")
```

Both breaks look like improvements. Gating on status alone is the obvious
simplification and the server would accept every one of them. Treating `failed`
as takeable reads as "anything not finished can be undone".

**Checks:** typecheck 0 on both workbenches. Tests: piggles 162 files / 1512,
sparx 133 / 1221. ESLint and prettier clean. `check:confirm` green: 41
destructive mutations, every one in a file that asks first.
`payment-undo.ts` is byte-identical in both consoles.

**Driven end to end on her own screen**, once her console was back up, on order
O-000018 ($52.00, $30.00 already in by hand).

A $22.00 cash payment was written down first, so her existing records were not the
thing being undone. The order flipped to **Paid**, both rows offered **Take it
off**, and the confirm read exactly as written, naming Refund as the other remedy.
After confirming: the row carries the badge **Canceled** and the line **Written
down by mistake**, its button is gone, the $30.00 row keeps its own, the order is
back to **Part paid**, and the "write it down" box reappeared holding $22.00.

The database afterwards: `amount_paid` 30.00, `payment_status` `partially_paid`,
`voided_at` set with the reason stored, and **0 rows in `order_refunds`** — which
is the entire point of the issue.

At 360px the badge and the button wrap under the amount and date with no overflow.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/commerce/payment-undo.ts` (new, identical)
- `piggles/apps/workbench/surfaces/commerce/payment-undo.test.ts` (new)
- `piggles/apps/workbench/surfaces/commerce/{order-actions.ts,order-detail-actions.ts,order-detail-money.tsx,order-detail-body.tsx}`
- `sparx/apps/workbench/surfaces/commerce/{data.ts,order-detail.tsx}`

## The thing to remember

**A screen that can only add is a screen that cannot be corrected.** Every write
on this pane was built as an addition: record a payment, record a handover, put a
tracking number on. Each one was found missing and wired, and each was wired in
the direction that makes an order MORE complete. Nothing was wired in the
direction that makes a wrong order right, and the server had been ready for it
the whole time.

The question that finds this shape is **"what happens when she does this to the
wrong row?"**
