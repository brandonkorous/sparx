# 271 — "You kept $16,523.40, 93.8%" while 560 things counted as free

**Status:** fixed (sparx); the Piggles headline box listed as debt
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating Money › Profit
**Surface:** Money › Profit, sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

Profit, this month:

> You kept $16,523.40 · 93.8% of everything you sold (green)
> Cost of the goods $1,100.00. What the stock you sold actually cost you, from your
> inventory records.

The $1,100.00 is one dropship order. Gillett has 560 things on its shelves, 3,677
units in all, with no cost recorded (the costing screen says so). Every one sold this
month counted as free. A diesel parts shop does not keep 93.8% of what it sells.

## What should have happened

The figure stays, because it is real as far as it goes. But the screen says what it
leaves out, says the headline is too high, and offers the way to fix it.

## How to reproduce

1. Sign in as Doty. Open Money › Profit, This month.

Every time a business has some costs and some things without one.

## Why it matters

Wrong money, said with confidence. An owner reads a margin she does not have.

## Where it lives

`surfaces/finance/cogs-note.ts` (`costOfGoodsNote`), both consoles. Issue 545 taught
it that a $0.00 over uncosted shelves is a gap. It still treated ANY cost above zero
as a full measurement, so a partial one passed as complete.

## The fix

- `costOfGoodsNote` (both consoles) returns `partial` when some cost is recorded and
  some things have none. The line keeps its figure and adds: "Only things with a cost
  count: 560 things on your shelves, 3,677 units in all, have never had one, so any of
  them sold here count as free." It also returns that gap as its own sentence.
- sparx `profit.tsx`: under the headline, a warning box, "You kept less than this",
  with the gap and a "Put in costs" button that opens "What your stock cost you". The
  "93.8% of everything you sold" badge is warning, not success, while it is
  overstated.
- Piggles gets the cost-line sentence (its `cogs-note.ts` is small, and its comments
  were trimmed to the 3-line rule). Its `profit.tsx` is 558 lines, so the headline box
  waits on splitting it.

Tests: `surfaces/finance/cogs-note.test.ts` in both consoles (2 new), red then green;
finance 104/104 in each. Scoped type checks and lint clean.

## Confirmed by

sparx as Doty, Profit, light, dark and 360px: the warning box reads "You kept less than
this. Things with no cost recorded count as free here, so this figure is too high. 560
things on your shelves, 3,677 units in all, have never had a cost recorded." "Put in
costs" opened "What your stock cost you".

## Rating effect

finance.profit: the headline no longer claims a margin nobody measured.
