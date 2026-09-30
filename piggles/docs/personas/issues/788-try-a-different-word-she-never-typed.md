# 788 — "Try a different word" to someone who had not typed one

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 277
**Surface:** mypiggles + sparx workbench — `b2b.orders.list`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

Wholesale orders, search box empty, Canceled pressed:

```
              No orders match that

    Try a different word, or switch back to All
            to see every wholesale order.
```

She had typed no word. The empty search box is on screen directly above the
sentence telling her to change what is in it.

## Why it is worth a line

The shop's own Orders list has never said this. It calls `emptyAdvice`, which
exists for precisely this and whose comment says so:

> What to try when nothing matched — naming ONLY what is actually narrowing the
> list. Telling someone to clear a filter they never set sends them looking for
> a control that is already off.

The helper sits in the file this pane already imports its chips from. The
wholesale copy of the screen imported the chips and hand-typed the sentence.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

Both wholesale orders lists call the shared helper.

```
filter only     The “Canceled” filter is on. Switch back to All to see the rest.
search only     Try part of an order number, or the customer’s name, company or email.
both            both sentences
neither         nothing at all
```

The Quotes list built its own in the same act (issue 785), so it carries the
same rule: `quoteEmptyAdvice` never names a search that was not typed, never
names a filter that is not on, and never says an order or a quote is "marked"
the chip's word — a chip gathers several stages at once, so that sentence would
send her down the table hunting for a word it does not print.

## Files

- `piggles|sparx/apps/workbench/surfaces/b2b/orders-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-data.ts`
