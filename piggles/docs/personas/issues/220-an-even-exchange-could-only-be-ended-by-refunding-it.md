# 220 — An even exchange could only be ended by refunding it

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 7
**Surface:** mypiggles › Sell › Returns › A return
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 7, on screen, $0.00 moved and stock right in both directions

## What happened

Anneliese Vogt sent the Ash Overshirt back to swap Clay for Slate. Same
garment, same size, same $128.00. Devi recorded the return, approved it, marked
it received, checked it as-new and put it back on sale. The return had said
**"Wants a replacement"** from the moment it was opened.

At the end of all that the pane said:

> **Checked, ready to settle**
> You have recorded the condition. **Give the customer their money back to
> finish.**

and offered exactly one way to finish:

> **Give the money back.** Settle the return by refunding the customer. This
> moves real money and cannot be undone.
>
> `Give money back…`

Nobody is giving any money back. Anneliese is not owed $128.00; she is owed a
shirt in a different color.

## What should have happened

An exchange ends when the replacement goes out. No money moves, because none is
owed in either direction.

## Why it matters

Devi had two ways to go and both were wrong:

- **Click it.** She refunds $128.00 on a swap where the customer keeps a
  garment of exactly the same value. The button says it "cannot be undone", and
  it is right.
- **Don't click it.** The return sits at "Checked, ready to settle" forever, on
  a list whose whole job is telling her what still needs doing. The Slate
  overshirt goes in the post and the platform never hears about it — no stock
  movement, no record, and the Clay one she counted back in is the only half of
  the swap that exists.

**An exchange is not a rare shape for this business.** Fifteen size-and-color
combinations of one overshirt, sold to people who cannot try it on. Swapping is
the second most common thing that happens after the sale, and it was the one
outcome with no way to end.

The system knew the whole time. `preferredOutcome` is stored on the return, the
person picked "A replacement" out of a list, the pane printed **"Wants a
replacement"** at the top — and then every sentence below it was written as
though the answer had been "Money back". **A field that is displayed and not
obeyed is worse than one that was never collected**, because the screen shows
the customer's wish and then ignores it.

## Where it lives

The words and the action both assumed one outcome:

- `returns-words.ts` — `returnState('inspected')` returned a single sentence,
  "Give the customer their money back to finish", for all four outcomes.
- `return-actions.tsx` — the settle block offered `Give money back…` and
  nothing else.
- `return-service.ts` — `issueRefund` was the only transition out of
  `inspected`, and `ReturnStatus` had no terminal state that was not
  `refunded`.

The inspection dialog carried the same assumption one layer down: _"Anything you
mark fit to resell is added back into your stock **when you settle the
refund**"_ — so on an exchange, where no refund is ever settled, the restock had
no trigger either. The disposition panel saved that in practice, but only
because somebody happened to press **Back on sale**.

## The fix

**A return settles the way the customer asked.** `preferredOutcome` now decides
the sentence and the action:

| They asked for | It ends with                   | Money         |
| -------------- | ------------------------------ | ------------- |
| Money back     | Give the money back            | the refund    |
| Store credit   | Give the money back, as credit | credit issued |
| A replacement  | **Send the replacement**       | **none**      |

`settleExchange` is a real transition to a new terminal status, **`exchanged`**,
not a $0.00 refund wearing a refund's clothes. A return that ends this way
reads "Swapped" and records `$0.00 moved`, and the audit log and the
`return.exchanged` event both say what actually happened. Recording it as a
refund of nothing would have put a $0.00 refund in her books for every swap she
ever does.

Settling takes **which replacement is going out**, so one comes off the shelf
the same moment the returned one goes back on it. Devi picks the version; the
form defaults to the same product, so the common case is two clicks.

The inspection dialog's promise was rewritten to match what the disposition
panel actually does, rather than pointing at a refund that may never come.

## What it did NOT fix

**The replacement gets no delivery record of its own.** Stock moves and the swap
is on the record, but there is no second tracking number to send Anneliese —
the original order's delivery is the Clay one that already went. Giving the
replacement its own would mean raising a zero-value order against the exchange,
which is a real design decision about how swaps appear in her sales figures, and
it is Brandon's rather than mine. **Blocked on: a product decision.**

## What it looked like once fixed

```
Swapped · Order O-000004
Anneliese Vogt · Wants a replacement · 1 item
Sent instead: The Ash Overshirt — M · Slate
$0.00 moved
```

`THE-ASH-OVER-M-CLAY` 5 → 6 (`return`), `THE-ASH-OVER-M-SLATE` 6 → 5 (`sale`),
and not a cent either way.

## Rating effect

`Sell › A return` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md). Sits with
[219](219-there-was-no-way-to-start-a-return.md), which had to be fixed before
this one could be reached at all.
