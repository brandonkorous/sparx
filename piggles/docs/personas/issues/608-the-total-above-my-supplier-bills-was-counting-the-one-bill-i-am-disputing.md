# 608 — The total above my supplier bills was counting the one bill I am disputing

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 206
**Surface:** mypiggles › Stock › What suppliers billed you
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 206 (seen on screen, before and after)

## What happened

I opened **What suppliers billed you** to see what I owe. The line at the top
said:

> **$684.00 owed across 1 bill**

Underneath it, four bills. None of them paid:

| invoice     | supplier        | state                     |        amount |
| ----------- | --------------- | ------------------------- | ------------: |
| FT-INV-2291 | Fairfield Trims | Entered                   |       $222.72 |
| AM-2198     | Ashcombe Mills  | Entered                   |       $684.00 |
| AM-2231     | Ashcombe Mills  | Queried with the supplier |       $684.00 |
| AM-2214     | Ashcombe Mills  | Entered                   |        $36.00 |
|             |                 | **total**                 | **$1,626.72** |

I owe **$1,626.72**. The screen said $684.00.

And the one bill it was counting is **AM-2231** — the one I have queried with
Ashcombe Mills. The single bill on the list I have told them I am not paying yet
is the only one it called owed, and the three I actually owe were left out.

## Why it happened

`inventory/src/services/supplier-bills.ts`. The rows and the total are two
different queries, and they had no overlap at all:

```ts
// the rows, in the default view
const where = {}; // every bill

// the total above them
const outstandingWhere = {
  paidAt: null,
  status: { notIn: ['cancelled', 'draft'] },
};
```

`draft` is the status this console shows as **"Entered"** — a bill that has
arrived and been typed in. That is precisely the money a shop owes, and it was
the one thing excluded. Meanwhile `disputed` was not excluded, so the only
status that survived the filter on this account was the queried one.

Wrong in both directions at once, which is why the two numbers had nothing in
common rather than merely differing.

I can see what it was reaching for: something like "approved payables", money
signed off to pay. But it does not say that, it says **owed**, and it does not
implement that either — `awaiting_approval` and `disputed` both pass a
`notIn ['cancelled', 'draft']` filter, and neither is approved.

## What owed means now

Every unpaid bill that has not been cancelled. Cancelled is the only thing
nobody is expecting.

A queried bill is a real complication: somebody is still expecting the money,
and the figure might change. One number cannot say both, so the total says the
total and then names the part that is uncertain:

> **$1,626.72 owed across 4 bills · $684.00 of that is queried with the
> supplier**

"of that", never a second figure beside the first — a reader who adds the two
together has been misled by punctuation.

Seen on screen, and the four rows now sum to the headline exactly.

## Guard

`workbench/surfaces/inventory/supplier-bills-words.test.ts`, 9 tests in each
console, on the real numbers from this account.

Two of them are the rule rather than a string:

```ts
it('never reports the queried bill as if it were the whole debt', ...)
it('is what the old heading broke', ...)   // totalCoversRows
```

`totalCoversRows` is not rendered anywhere. It is the invariant the old heading
violated, written down so a test can hold it: **a shop-wide total can never
count fewer things than the list under it is showing.** One counted, four on
screen.

Proven red by putting the old aggregate's shape back — a total built from the
queried bills alone — which fails **6 of 9**.

Also verified end to end: 395 inventory tests, both console suites (587 / 489),
and api-rest typechecks over the two new fields.

## Still open

Nothing from this issue.

Checked rather than assumed, after this one: **Supplier returns** has the same
sentence shape ("$X owed across N returns") and is NOT wrong. Its aggregate is
`status: 'sent', creditReceivedCents: null`, which is exactly what the screen
calls "awaiting credit", and it deliberately carries a separate `everCount`
with a comment saying the point of that number is to see past the filter.
Different author, or the same author on a better day.
