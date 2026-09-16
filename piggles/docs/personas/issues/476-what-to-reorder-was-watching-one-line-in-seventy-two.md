# 476 — "What to reorder" was watching one line in seventy-two

**Status:** fixed
**Severity:** major
**Found by:** two screens under the same heading giving answers with nothing in common
**Surface:** `inventory.reorder` (both consoles) · `GET /v1/inventory/reorder/summary`
**Filed:** 2026-09-09

## What was wrong

Two screens, one app, minutes apart.

**At risk** named the two things Devi must buy: The Ash Overshirt in clay and the
silk twill scarf. Three left each, seven days of cover, a fortnight to get more,
**$558 of orders that would have nothing to come from**.

**What to reorder** listed one line, and it was neither of them:

| Item                 | Available | To order | Runs out     |
| -------------------- | --------- | -------- | ------------ |
| THE-ASH-OVER-XS-BONE | 0         | 12       | Out of stock |

with the sentence _"Nothing has sold in the last 90 days, so there is no
deadline."_ The one thing the screen told her to buy is the thing nothing has
sold of, while the two that are selling and about to run out were not on it.

## Why, and why the rule behind it is right

The worklist watches one column:

```sql
WHERE l.reorder_point IS NOT NULL
  AND l.on_hand - l.allocated <= l.reorder_point
```

`reorder_point` is the level a PERSON set. There is a second column,
`dynamic_reorder_point`, which the planner works out — and it is deliberately not
a trigger. The tests spell the reason out: _"LEAVES the human number alone — this
is the whole consent rule"_, and _"adopting is a separate, explicit act"_. A
system that starts ordering off its own arithmetic is worse than one that waits
to be asked. That rule stays.

The planner's numbers for the two missing lines, by the way, were 12 and 11
against 3 available each. It knew.

**One of Devi's 72 stock lines has a human-set point.** So the list showed one
row.

## The bit that was actually wrong

The screen already handles the case where NOTHING has a reorder level, and
handles it well — a whole file of "four kinds of nothing", including:

> **No reorder rules set up yet.** Nothing can be flagged as running low until
> you say when to reorder it.

But that fires at zero. One rule out of seventy-two is not zero, so no message
fired at all, and a one-row worklist was served as the complete answer to "what
should I reorder". The zero case was handled; the case people are actually in was
not. The screen's silence about the other seventy-one lines reads as reassurance
about them.

## The fix

`/v1/inventory/reorder/summary` returned `policyCount`. It now returns the
denominator beside it, `levelCount`, and the pane says so whenever cover is
partial:

> **71 of your 72 stock lines have no reorder level**
> This list only watches the lines you have set a level for, so those ones are
> not on it however low they get. Set a level and how many to buy on "How many
> you have", and they start warning you here. **"At risk" looks at everything
> meanwhile, whether a level is set or not.**

The last sentence is the one that matters: it sends her to the screen that DID
know about the $558, rather than leaving two screens disagreeing in silence.

Shown only in the middle: at zero the existing empty state already says it, and
at full cover there is nothing to say.

## Proven

On her screen: the amber note reads **71 of your 72**, which is what the database
holds (72 levels, one with a reorder point), with the "How many you have" button
beside it. Correct in dark, and the pane holds at 360px with no page-level
sideways scroll.

## Checked, and fine

The one row that IS on the list looked odd — "Takes 21 days" beside "No supplier
yet" — and I started to write it up as a fallback lead time that does not admit
itself, the way At risk admits its own (_"nothing is known about the lead time,
so 14 days is assumed"_). The platform fallback is 14, so 21 had to have come
from somewhere.

It did. That level carries a lead time of 21 days, a reorder point of 2 and a
reorder quantity of 12, all set by hand — and "To order 12" is that quantity,
exactly. Every figure on the row is real. It is the only line in her catalogue
somebody has finished setting up, which is precisely why it is the only one the
list can see.
