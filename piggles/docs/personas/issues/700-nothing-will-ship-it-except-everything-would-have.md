# 700 — "Nothing will ship it", except everything would have

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 245, auditing the copy on Expiring stock
**Surface:** mypiggles + sparx — Stock › Expiring stock; the fix is in the picking path
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** measured against the database; the guard is proved red
**Blocked on:** —

## The promise

Expiring stock shows a red alert over out-of-date batches:

> **2 batches are already out of date**
> That stock is **excluded from picking automatically, so nothing will ship it**,
> but it is still counted as stock you own until somebody writes it off.

That is a safety claim, in a red box, about food-or-medicine-shaped stock. It is
the kind of sentence somebody stops worrying on the strength of.

## The mechanism

`resolveFefoLot` is the ONLY thing anywhere in the sell path that excludes an
expired batch. Grep the package for `expires_at > now()` and it is the single
hit. It was reached like this:

```ts
const lot =
  input.strategy === 'fefo'
    ? await resolveFefoLot(tx, { … })
    : null;
```

## The measurement

```
warehouses on this database          87
…with allocation_strategy = 'fefo'    0
…with allocation_strategy = 'fifo'   87

expired batches still holding stock    4
units in them                        137
```

**Not one warehouse in the entire database is `fefo`.** `fifo` is the column
default and nothing has ever moved off it. So the exclusion had never run for any
tenant, for any order, ever — while 137 units of out-of-date stock sat in those
warehouses, fully pickable, under a red box promising they could not be.

[[feedback_a_promise_in_copy_is_a_contract]] and
[[feedback_screen_over_a_function_nobody_calls]] in the same line: a finished
screen over a guard with no reachable caller.

## Why it read as fine

Every part of it looks healthy on its own.

- The exclusion EXISTS, and is well written, with a paragraph explaining why
  expired batches are dropped outright rather than ranked last.
- The copy is accurate about what that function does.
- `fefo` is a real, supported, documented strategy.

Nobody had to make a mistake. The function is correct, the sentence describes the
function, and the configuration that connects them is one nobody chose.

## What was changed

The exclusion is no longer gated on the strategy, because **expired stock not
shipping is a safety rule, not a preference**. The file already makes exactly
this argument about recalls, two paragraphs up:

> "A recall is a decision that stock must not leave the building, and a strategy
> that would ship it 'only if there is nothing else' is a strategy that ships it
> on the day it matters most."

What changes for a non-`fefo` warehouse: **nothing at all** for an item with no
dated lots, because the query returns null for those, which is most items. For an
item that HAS dated lots, the pick now names a batch that is in date instead of
naming no batch and leaving the picker to take whatever box was nearest — which
was the expired one. Seven of the 87 warehouses hold dated lots.

## The guard

`pick-expiry-gate.test.ts`. It reads the source rather than the behavior, because
allocation needs a transaction and **the behavioral suite is one CI skips** —
which is exactly how a `fefo`-only guard survived a green run for as long as it
did. Same technique, and same reasoning, as `adjustment-import-columns.test.ts`.

It asserts three things: that it actually read the file, that the resolver is
called without consulting the strategy, and that the resolver still drops expired
and recalled batches (an ungated caller protects nothing if the query stops
filtering).

**Proved red.** Reinstating the original gate:

```
FAIL  pick-expiry-gate.test.ts > calls the lot resolver without asking what the strategy is
Test Files  1 failed (1)          restored -> 3 passed
```

[[feedback_a_test_that_cannot_go_red]]

## Not confirmed on screen, and why

Juniper Row has no expired batches, so the red alert does not render for her —
her case is the undated one. The claim was proved false against the database and
the fix is proved by a red-able guard. Watching a recalled or expired batch fail
to be picked needs an order, a pick list and a tenant with dated stock, which is
the remaining step.
