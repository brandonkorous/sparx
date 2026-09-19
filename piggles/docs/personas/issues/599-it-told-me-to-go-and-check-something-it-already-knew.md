# 599 — It told me to go and check something it already knew

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 203
**Surface:** mypiggles › Money › What you kept
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 203 (seen on screen)

## What happened

**Money › What you kept** is one of the best screens I have used. It walks the
whole chain and every step holds:

| line               |    amount |
| ------------------ | --------: |
| Money in           |   $726.00 |
| Cost of the goods  |     $0.00 |
| Selling fees       |     $0.00 |
| Cost of the work   |   $308.70 |
| What the work made |   $417.30 |
| Wages              |     $0.00 |
| Running costs      | $1,850.00 |
| **What you lost**  | $1,432.70 |

$726.00 − $308.70 = $417.30. $417.30 − $1,850.00 = −$1,432.70. It adds up, and
where it cannot measure something it says so out loud: "Nothing here has been
measured yet: 68 things on your shelves, 375 units in all, have never had a cost
recorded."

Then the card at the bottom:

> **$2,158.70 was not charged to any job**
> That is normal: rent and insurance belong to the business, not to one repair.
> But **if a job's parts are sitting in here**, that job will look more
> profitable than it was.

They are. **$308.70 of that $2,158.70 is parts and materials** — it is the "Cost
of the work" line, four inches up the same card. The screen printed both numbers
and then asked me to go and work out whether one was inside the other.

## What should have happened

Say so. The screen has both figures in its hand.

## Why it matters

Small, but it is the exact shape of the thing this console is usually good at
and it stands out for that reason. Every other sentence on this pane tells me
something specific: how many items have no cost, what a marketplace kept, what
is not included. This one hands the question back.

A conditional the screen can settle is a job it gave to the reader.

## Where it lives

`workbench/surfaces/finance/profit.tsx`. The card renders
`current.unallocatedCents`, and `current.costOfSaleCents` is the very next field
on the same object. It is [[fetched but never rendered]] again: nothing needed
fetching, designing or plumbing, only saying.

**Fixed:** the card now adds a line.

> $308.70 of that is parts, materials or subcontractors, which usually does
> belong to a job.

**The figure is a FLOOR, and the sentence changes when it is one.** The rollup
stores how much spend was pinned to jobs but not which lines it came from, so
once anything has been pinned the most that can be proved is
`direct − pinned`: even if every pinned cent came out of the parts pile, that
much is still loose. Where nothing has been pinned at all — Devi's case, and
most shops' — the floor and the true figure are the same number and the sentence
says it plainly.

| what is known              | what it says                   |
| -------------------------- | ------------------------------ |
| nothing pinned to a job    | "$308.70 of that is parts…"    |
| some pinned, some provable | "At least $208.70 of that is…" |
| nothing provable           | nothing at all                 |

"At least" over a figure that is exact teaches a reader to distrust the exact
ones, so the two cases read differently rather than both hedging.

The third row matters too: a shop whose uncharged pile is all rent would
otherwise carry "$0.00 of that is parts, materials or subcontractors" on the
screen every month, which is a line she has to read to learn nothing.

## Guard

`workbench/surfaces/finance/uncharged-words.test.ts`, 8 tests in each console.

Proven red by replacing the floor with `return f.costOfSaleCents` — the naive
"all of it is loose" — which fails **4 of 8**, including the one that matters:

```
× is a floor when some spend has been pinned, never an overstatement
  expected 30870 to be +0
```

There is also a property test that the exact and the floor wording differ once
the numbers are stripped out, so a future edit cannot quietly collapse them into
one hedge.

## Still open

Nothing from this issue.

Noted, not filed: "Money in $726.00" here and "$535.00 received" on Where money
comes from are different windows (this month versus 90 days), not a
disagreement. Checked rather than assumed, after
[594](594-i-sold-2350-and-the-screen-only-talks-about-535.md).
