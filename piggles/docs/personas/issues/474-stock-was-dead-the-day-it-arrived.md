# 474 — Stock was called dead the day it arrived

**Status:** fixed
**Severity:** blocker
**Found by:** Devi opening "Not selling" on a boutique that opened a fortnight ago
**Surface:** `inventory.planning.idle` (both consoles) · `@wizeworks/inventory` slow-mover report
**Filed:** 2026-09-09

## What was wrong

Juniper Row's stock arrived on 24 August. Today is 9 September. That is sixteen
days.

"Not selling" told her that **54 of her 72 stock lines** are not selling at all,
worth $870, costing $217.50 a year to keep, and said this about them:

> **Nothing has ever sold from this.** Discount it, bundle it, return it to the
> supplier, or write it off — it is not going to move on its own.

That is a real instruction to a real owner about garments that have been in the
shop for a fortnight. Following it costs money.

## Why

Her dead-stock window is **180 days**, which is the default and the number the
planning settings screen shows her. The rule the report documents for itself is:

> _dead — nothing sold in the dead-stock window._

The code applied that window to every line that HAD sold, and to none of the
lines that had not:

```ts
const isDead =
  (velocity === null || velocity <= 0) &&
  (daysSinceLastSale === null || daysSinceLastSale >= deadStockDays);
```

`daysSinceLastSale === null` means "this has never sold", and it went straight
through as dead. So the window was 180 days for the shirt that sold in March and
**nought days** for the identical shirt beside it that arrived on Tuesday.

Never having sold is the ABSENCE of a sale. It only becomes a finding when a
length of time is attached to it, and no length of time was.

## The second symptom, which nobody could have seen

Before any overnight pass has run, there are no velocity rows at all, so every
line in the catalogue has a null velocity AND a null last sale. Every line was
therefore dead. A brand-new tenant's first look at this screen listed their
entire catalogue as dead stock to write off.

Which also means the pane's own "nothing has been checked yet" empty state —
carefully written, and correct — **could never appear** for anybody who had
stock. It was unreachable code guarded by the bug it was written for.

## The fix

A line that has never sold is measured from when it arrived. The first movement
on a level is when the shop actually got the item, so it is now carried through
the report as `stockedSince`:

```ts
const quietDays = daysSinceLastSale ?? daysHeld;
const isDead =
  (velocity === null || velocity <= 0) && quietDays !== null && quietDays >= deadStockDays;
```

One window, applied to every line the same way.

And when even that is unknown — nothing has ever been measured — then how long
it has had to sell is unknown, and unknown is not "long enough". The line drops
out, and the empty state that was written for exactly that case finally shows.

The sentence carries the length of time now, because that is the whole
difference between advice and a guess:

> Nothing has sold from this in the **400 days** you have had it. Discount it,
> bundle it, return it to the supplier, or write it off.

## The test protected the bug

`planning.test.ts` had:

> `it('calls stock that has never sold dead, and says what to do about it')`

and its fixture received 40 units and expected them to be dead in the same
breath. The FIXTURE was wrong, not the assertion — the receipt is now back-dated
past the window, so the test states the rule instead of pinning the defect.

| breaking                                | reddens                                                |
| --------------------------------------- | ------------------------------------------------------ |
| putting the old `isDead` condition back | 2 — the fortnight-old case and the never-measured case |

## Proven

On Devi's own screen: 54 rows and "$870.00 tied up" became **"Everything is
moving"**, whose description is the honest one — _"Either the buying is well
judged, or there is not enough history yet to tell."_ Her stock is sixteen days
old and nothing about it is dead.
