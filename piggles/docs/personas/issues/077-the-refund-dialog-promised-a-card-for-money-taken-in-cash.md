# 077 — The refund dialog promised a card, for money taken in cash

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · standing checks — wrong moves
**Surface:** mypiggles › Sell › Order, the refund confirm and the toast after it
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

She took $8.00 in **cash** over the counter for order O-000003 and wrote it down.
Then she pressed **Refund $8.00**, and the dialog said:

> **Refund $8.00 to Rowan Ellery?**
> This sends $8.00 back to **the card used for order O-000003**. **The money leaves
> your account straight away** and this cannot be undone. Stock is NOT taken back
> in, if you expect the items returned process a return instead so the goods come
> back on the shelf.

There is no card. There is a till.

And the panel it opened from, four inches below the dialog, said the opposite:

> Marks $8.00 as given back. **You hand the money over yourself, nothing is sent
> anywhere**, and this cannot be undone.

Two descriptions of one act, on one screen, contradicting each other about
whether money is about to move on its own.

Had she gone through with it, the toast would have finished the job:

> Refunded $8.00 · Order O-000003, **the customer's card has been credited.**

## Why it matters

The dialog is the last thing read before an irreversible action, and the toast is
the only record of what happened. Both told her the customer had been paid
automatically. The true answer is that nothing moved and she owes Rowan eight
dollars out of the till.

A refund is the one place a business owner cannot afford a vague sentence, and
this was not vague, it was wrong in a specific and expensive direction: it says
the money is already gone, so she does not hand it over.

**The pane already knew.** `refundGoesBackToACard` is computed at the top of the
surface, from whether any payment was taken by hand, with a comment explaining
exactly this:

> `// Money the business took by hand never passed through a gateway, so "back to`
> `// the card it was paid with" is a promise about a card that does not exist.`

The panel line used it. The dialog and the toast were hardcoded strings that
never asked.

There is also a note in the source, added when the panel line was fixed, warning
that this exact thing happens when only one of the sentences is corrected:

> `// Both halves branch. Fixing only the first left "The money leaves your`
> `// account straight away" standing after "nothing is sent anywhere", two`
> `// sentences contradicting each other about a refund, which is not a place`
> `// to be vague.`

Three sentences, one branch, and the warning was written on the one that had it.

## The fix

New [surfaces/commerce/refund-words.ts](../../../apps/workbench/surfaces/commerce/refund-words.ts):
one function owning all three sentences, branching once.

```ts
const refundSays = refundWords({ amount, orderNumber, toACard: refundGoesBackToACard });
// refundSays.panel   → the line under the heading
// refundSays.confirm → the dialog
// refundSays.done    → the toast
```

The hand-to-hand wording is now honest at every step, and the toast says what is
left for her to do rather than announcing something that did not happen:

> Order O-000003. Nothing was sent anywhere, so give them the money yourself.

The card wording is unchanged in meaning. The stock warning is shared, because it
is true either way and was the only part both copies agreed on.

Two smaller things went with it: the panel line was `text-sm` (14px, under the
16px floor) and is now `text-base`, and the em-dashes came out of all of it.

## Confirmed on screen — 2026-08-21

Same order, same cash payment, pressed **Refund $8.00** again:

> **Refund $8.00 to Rowan Ellery?**
> This marks $8.00 on order O-000003 as given back. You hand the money over
> yourself, so nothing is sent anywhere, and this cannot be undone. Stock is NOT
> taken back in. If you expect the items returned, process a return instead so
> the goods come back on the shelf.

Backed out with **Leave it as it is**, so the order is still paid and unrefunded.
The confirm itself was already right on the destructive-action rule: it names the
amount and the person, its confirm button is `danger`, and the cancel is worded
as a choice rather than a dismissal.

## Not fixed, and worth a decision

A **mixed** order (part card, part cash) takes the hand-to-hand wording, because
`refundGoesBackToACard` is false if ANY payment was taken by hand. That is the
safe direction, since it tells her to check rather than to assume, but it is not
accurate for the card half. Splitting the sentence per payment is a bigger change
than this issue, and nothing in P01 produces a mixed order.
