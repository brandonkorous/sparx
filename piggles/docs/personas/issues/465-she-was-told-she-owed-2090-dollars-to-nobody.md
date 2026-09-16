# 465 — She was told she owed $2,090 to nobody

**Status:** fixed
**Severity:** major
**Found by:** Devi opening "Bills to pay" after recording two costs she had already paid
**Surface:** `finance.bills` (both consoles)
**Filed:** 2026-09-09

## What was wrong

Devi recorded two costs on the Spending screen: **$1,850 of shop rent** and
**$240 of linen from her supplier**. Both were paid at the time — one by standing
order, one across a counter.

She opened Bills to pay:

```
Total outstanding
$2,090.00
across 2 bills

No due date  ████████████████████████████  $2,090.00
```

She owes that money to nobody. Nothing she typed said she did.

## Why

The quick-add on the Spending screen has three fields and a button, on purpose —
its own comment calls it the row for "a person entering a shoebox of receipts".
It writes:

```ts
incurredAt: new Date().toISOString(),
paidAt: null,
dueAt: null,
```

Which is the honest record of what she actually said: **a cost happened.** It
says nothing about whether the money has left.

This screen read `paidAt: null` as a debt, and summed every such row into
"Total outstanding".

**That is asserting a measurement from an absence** — nobody entered a bill,
nobody set a deadline, nobody said anything was owed.

## The neighbour that was already right

The file's own header had the rule, and stopped one clause short:

> _"LATENESS IS COMPUTED FROM `dueAt` AND NOTHING ELSE. A cost with no due date
> is **not late, it is simply unpaid** — showing '0 days late' for a receipt
> someone typed in would invent a deadline nobody set."_

It knew about the receipt someone typed in. It guarded the LATENESS and then
counted the same row as a debt anyway. Not late, and not owed either, was the
half that was missing.

The aging bar made it worse rather than better: a full-width band labelled "No
due date", drawn to the width of the whole total, which reads as _all of this is
owed_.

## The fix

The headline counts **what has a day to pay it by** — the only thing a person has
said out loud that they owe. The rest is still listed, still one click from
"Paid", still sorted last, and now named for what it is:

```
Total owed
$0.00
nothing with a day to pay it by

Not counted above: $2,090.00 across 2 costs with no due date. Recording a cost
does not say whether you have paid it. Open one to give it a due date, or mark
it paid.
```

Two related bounds moved with it. The `no_date` band is out of the aging BAR,
because a cost with no deadline has no position on a picture of how late money
is. And the "Coming up" filter no longer includes dateless rows — nothing is
coming.

## What I did NOT do, and why

The obvious smaller fix is to make the quick-add stamp `paidAt` when it records a
cost, on the grounds that a receipt is proof of payment. I decided against it:
writing "paid today" when she never said so invents a fact in the opposite
direction, and the rule is that a value nobody measured must never render as one.
The screen should not claim she paid, and it should not claim she owes. It now
claims neither.

## On screen

Before: `Total outstanding $2,090.00 · across 2 bills`.
After: `Total owed $0.00 · nothing with a day to pay it by`, with the $2,090
described below it and left out of the figure.
