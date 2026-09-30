# 752 — A limit on one shop was reported as a limit on everybody

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 268
**Surface:** mypiggles + sparx workbench — Orders to approve (`b2b.approvals`)
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on screen, before and after
**Blocked on:** —

## What happened

Two limits, set in that order:

```
Over $5,000.00    Every customer      [on]
Over $2,500.00    Loom and Larder     [on]
```

And above them, the screen's own account of what it is doing:

```
Nothing waiting
No orders are held for sign-off right now. You are holding
every order over $2,500.00, so the next one lands here.
```

**That is not what those rules do.** The $2,500 limit is Loom and Larder's.
A different shop ordering $4,000 clears the only limit that covers it, so it is
placed, unheld, by a console that had just said otherwise.

## Why

`holdQueueNotice` took the lowest LIVE limit and printed it, and the shape it
was handed had no room for the question:

```ts
export interface HoldRule {
  isActive: boolean;
  minAmountCents: number;
  minAmountFormatted: string;
}
```

No `accountName`. The rule row three inches below it has drawn
`rule.accountName ?? 'Every customer'` since the day it was written, so the
fact was on the screen twice, right and wrong, four lines apart.
[[feedback_fetched_but_never_rendered]]

`overWhat` then made it worse by being confident: `every order over $2,500.00`.
A sentence saying what happens next is a contract.
[[feedback_a_promise_in_copy_is_a_contract]]

## The case nobody was told about at all

Switch the $5,000 limit off and leave Loom and Larder's on, and the old sentence
read the same way: "every order over $2,500.00". In that state **nothing at all
covers anybody else**, and there was no wording for it.

That one matters most, because it is the state a shop reaches by setting a limit
on the one buyer who worried them. They believe they have turned sign-off on.

## What was done

The notice reads who each limit is for, and says the true sentence for four
shapes rather than one:

| the rules               | what it says now                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| one blanket limit       | You are holding every order over $5,000.00                                                           |
| blanket + one named     | …every order over $5,000.00, and anything over $2,500.00 from Loom and Larder                        |
| blanket + several named | …every order over $5,000.00, and 2 wholesale customers have a limit of their own                     |
| named only              | …anything over $2,500.00 from Loom and Larder. **No other customer's order is held, however large.** |

That last sentence is the one the screen never had.
[[feedback_never_present_absence_as_measurement]]

A zero limit still reads `every order` rather than `over $0.00`, and a named
zero limit reads `everything from Loom and Larder`.

## Files

- `piggles|sparx/apps/workbench/surfaces/b2b/approval-hold-notice.ts`
- `piggles|sparx/apps/workbench/surfaces/b2b/approval-hold-notice.test.ts`

sparx says "accounts" where piggles says "wholesale customers", which is the
only difference between the two copies.

## Proof

12 tests per console. Proved red by putting the old one-limit reading back:
**6 of 12** fail, including the two properties —

- the promise and the switches must agree (it already had this one), and
- **an amount printed after "every order over" must be one that applies to
  everybody**, checked across five mixes of blanket and named limits.

Read on screen 2026-09-20 with both limits live:

```
You are holding every order over $5,000.00, and anything over
$2,500.00 from Loom and Larder, so the next one lands here.
```
