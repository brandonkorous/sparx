# 622 — One item marked returned, and the whole order refunded

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Sell › Orders › the order pane, What they bought
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen, before and after)

## What happened

O-000004, still. Under the status badge that
[621](621-refunded-twice-on-one-row-and-neither-told-me-where-my-goods-are.md)
had just fixed:

```
The Ash Overshirt    1 × $128.00                          $128.00
THE-ASH-OVER-M-CLAY

The Everyday Tee     1 × $42.00                            $42.00
THE-EVERYDAY-M-CLAY
1 refunded
                     Order total                          $170.00
                     Given back                            $170.00
```

One item marked returned. The whole $170 back.

The obvious reading is that the Overshirt was kept and the money for it came
back anyway. That reading is wrong. **Both came back:**

```sql
select amount, status, reason, created_at from order_refunds … ;
--  42.00 | completed | Return c2533620-…  | 2026-08-26
-- 128.00 | completed | (no reason)        | 2026-08-28
```

## Why it happened

Two refund paths, and only one of them knows about items.

- A refund raised through a **return** knows which items it covers and writes
  them to `order_refund_items`.
- A refund raised **against the order** is an amount. Nobody is asked which
  items it stands for, and nothing is written.

Measured 2026-09-17, platform-wide:

|                                         |        |
| :-------------------------------------- | -----: |
| refunds                                 |     12 |
| refunds with any line detail at all     |  **1** |
| orders with refunds                     |     11 |
| orders whose lines understate the money | **11** |
| orders with no line marked at all       | **10** |

So `quantityRefunded` is not stale, and nothing is failing to read it. For
eleven refunds out of twelve **the fact was never captured**, and the console
cannot invent it ([[feedback_never_present_absence_as_measurement]]).

What it can stop doing is letting the blank read as an answer. An unmarked line
beside a full refund is absence behaving exactly like "this one was kept"
([[feedback_absent_behaves_like_fine]]) — and here it was absence behaving like
that about $128 of her stock.

## The fix

A sentence under "Given back", in two forms:

> **The whole order was given back, though only some of the items above are
> marked as returned.** The rest was given back against the order as a whole.

> **None of the items above is marked as returned**, because this was given back
> against the order as a whole rather than item by item.

**It states no figure, on purpose.** `refundTotal` is a sum of amounts; the
lines carry a quantity, a unit price, a per-line discount and tax folded in
differently. Any money split this computed would be a guess wearing a dollar
sign, and the file says so where somebody would be tempted to add one.

**It claims nothing about the ambiguous case.** A $42 refund on a $170 order
with one of two items marked is exactly what a one-item return looks like — and
also exactly what a $42 goodwill refund on a kept order looks like. The data
does not tell them apart, so the note says nothing there.

## Guard

New `refund-note.ts` + `.test.ts`, **8 tests** in each console.

Two earn their place beyond the obvious:

```ts
it('claims nothing about a PART refund that has some items marked', …)
it('never states a figure', …)         // asserts the output has no digits in it
```

The second is a rule rather than an example: the temptation here is to compute
the split, and the test makes doing so go red.

Proven red by making the note return null: **3 of 8** fail.

## Not changed

**The refund path that records no items.** Asking "which items is this refund
for?" on an order-level refund is a real product question — sometimes there is
no answer, because the money is goodwill rather than a return — and it changes a
write path and a form. Recorded rather than guessed at.

## Still open

The refund path above. Until it records items, ten orders in eleven will show
the second sentence, which is honest but is not the same as knowing.
