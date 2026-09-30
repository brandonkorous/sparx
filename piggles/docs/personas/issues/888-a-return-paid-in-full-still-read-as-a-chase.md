# 888 — A return paid in full still read as a chase

**Status:** fixed
**Severity:** **moderate** — the headline number said she was owed $18.00 by a
supplier who had already paid it, and the column a buyer scans to decide who to
ring said the settled return had been waiting a fortnight. The screen's own
toolbar, four inches above, said "Nothing outstanding"
**Found by:** P03 · act 316, sweeping the rest of Partners by data weight
**Surface:** mypiggles › Partners › Sent back — the list and the return's own
pane, in both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 13 tests, proved red three ways including the tempting narrow
fix; and her own screen, before and after

## What she saw

RTV-000001. One roll of linen with a water stain, sent back to Ashcombe Mills,
credited in full eleven days ago. The list:

```
Return                        Why              State      Waiting       Owed
RTV-000001 · Ashcombe Mills   Arrived damaged  Credited   2 weeks ago   $18.00
Main Warehouse · ref AM-RMA-118                                         paid in full
```

**Credited, and waiting a fortnight, and $18.00 owed.** Three columns, one row.

And on the return's own pane, the three cards across the top:

```
You are owed        They have credited     Credited
$18.00              $18.00                 September 18, 2026
at what you paid    settled in full        their ref AM-RMA-118
```

The first card and the second card are about the same $18.00. One says she is
owed it. The other says it arrived.

## The screen already knew

The toolbar on that same list reads **"Nothing outstanding"**, and it is right.
It is built from the server's `awaitingCreditCents`, which counts against
`{ status: 'sent', creditReceivedCents: null }` and is documented as the number
"a finance-minded owner actually wants: you are owed $4,310 by suppliers right
now."

So the summary and the rows underneath it disagreed about the same return, on
the same screen, at the same moment. [[feedback_fetched_but_never_rendered]]

## One null, three different returns

Every wrong cell branched on the same thing:

```tsx
{row.awaitingCreditDays === null ? (
  <Text className="text-sm">
    {row.sentAt ? <Timestamp value={row.sentAt} format="relative" /> : 'Not sent'}
  </Text>
) : (
```

The server's own comment says what that null covers:

> _"Days since the goods left with no credit recorded. This is the number that
> turns a filing cabinet into a chase list. **Null before it is sent, and null
> once it is resolved.**"_

Three different returns arrive at that branch — one never sent, one credited,
one written off — and the cell was written for the first of them. "Not sent" is
the right sentence for a draft and the only one it was ever right about. A
credited return fell into the same branch and inherited the draft's fallback,
which prints the day the goods LEFT, under a heading that asks how long a credit
has been overdue.

## The same fix, already made, two cards to the left

The detail pane had found this once before. Its comment is still in the file:

> _"THREE DIFFERENT FACTS USED TO SHARE ONE HEADING. `awaitingCreditDays` goes
> null the moment a credit is recorded, and this card then fell back to the time
> the goods LEFT — under the word 'Waiting'. A return settled in full read
> 'Waiting · 39 seconds ago', which is neither the right label nor the right
> moment."_

That fix landed on the card on the **right**. The card on the **left** was a
fixed string and was never re-read, and the whole list one file away still
rendered the literal thing the comment describes. The comment was the checklist.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What it does now

The rule the server had written down three times now lives where both screens
can read it, in `supplier-returns-data.ts`:

```ts
export function returnIsSettled(status: string): boolean {
  return status === 'credited' || status === 'closed' || status === 'cancelled';
}
```

- **Branch on the STATE, never on the absence of a number.** A finished return
  shows a dash under Waiting; the State column beside it already says which
  ending it had, and the date it ended is on the pane.
- **The claim heading follows the state.** `creditExpectedCents` is the size of
  the claim and never moves, so the words over it have to carry whether it is
  still due: "To claim back" on a draft, "You are owed" while it is out, **"You
  asked for"** once it is finished.
- **The list column headed `Owed` is now `Asked for`**, which is true of a
  settled row and an outstanding one alike. The toolbar keeps saying what is
  genuinely outstanding, because it always did.
- `SETTLED_TITLE` moved out of the detail pane so one rule serves both screens.
- Both consoles.

## Proved

**13 tests**, and three wrong versions:

```
nothing is ever settled (the original)   →  5 fail
only `credited` counts as finished       →  4 fail
one fixed heading for every state        →  3 fail
```

The second is the one worth having. Handling `credited` alone is the obvious
fix, it makes this exact screen correct, and it leaves **written off** — a
credit somebody decided was not coming — still counting days against a chase
nobody is running. It is the same trap as issue 884's "exclude only cancelled".
An unknown future status is pinned to _not_ settled, so a state nobody teaches
this function about cannot quietly drop a return off the list of money she is
owed. [[feedback_a_test_that_cannot_go_red]]

A last test asserts the two rules agree with each other across all five states:
a state with a name for its ending IS an ending, and one without is not. They
are read by different screens and must not drift apart again.

**Checks:** piggles console 170 files / 1590 tests, sparx workbench 139 / 1272,
both fully green. Typecheck 0 on both. ESLint and prettier clean.

**On her own screen**, the row now reads `Waiting —` and `Asked for $18.00 ·
paid in full`, and the pane's first card reads **"You asked for $18.00"** beside
"settled in full".

## Files

- `piggles/apps/workbench/surfaces/inventory/supplier-returns-data.ts`
- `sparx/apps/workbench/surfaces/inventory/supplier-returns-data.ts`
- `piggles/apps/workbench/surfaces/inventory/supplier-returns-list.tsx`
- `sparx/apps/workbench/surfaces/inventory/supplier-returns-list.tsx`
- `piggles/apps/workbench/surfaces/inventory/supplier-return-detail.tsx`
- `sparx/apps/workbench/surfaces/inventory/supplier-return-detail.tsx`
- `piggles/apps/workbench/surfaces/inventory/return-settled.test.ts` (new)
- `sparx/apps/workbench/surfaces/inventory/return-settled.test.ts` (new)

## Measured

```
supplier returns on the platform                      1
  · in a settled state                                1
  · hitting this defect                               1      100%
```

One row, and it is every row there is. The defect is structural rather than
statistical: settled is where every return ends up, so every return reaches it
eventually and none can leave.

## The thing to remember

**A null that means "no number" does not mean one thing.** `awaitingCreditDays`
is absent for a return that has not started and for a return that has finished,
which are opposite ends of the same life, and a cell that reads the absence
alone will give the beginning's answer to the end's question.

The measurement that finds it is not "is this value null" — it was, correctly.
It is **"how many different states reach this branch, and was it written for
all of them?"** Here the server's own doc comment named all three in one
sentence, and three screens read past it.
