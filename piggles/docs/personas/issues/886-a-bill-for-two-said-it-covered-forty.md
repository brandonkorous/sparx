# 886 — A bill for two said it covered forty

**Status:** fixed
**Severity:** **moderate** — the one sentence on the screen that says what the
check found contradicted the table printed directly underneath it. A business
owner deciding whether a supplier has finished invoicing an order was told yes
by the sentence and no by the numbers
**Found by:** P03 · act 315, sweeping Partners by data weight
**Surface:** mypiggles › Partners › What suppliers billed you › any invoice, in
both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 9 tests, proved red three ways including the tempting
sentence-swap; and her own invoice, before and after

## What she saw

AM-2214 from Ashcombe Mills, $36.00:

```
Agrees with the delivery
The one line on this bill matches what was ordered and what arrived.

Line                      Ordered   Arrived            Billed   Each     Check
Linen, natural, 200gsm         40   40                      2   $18.00   Agrees
LINEN-NAT-200                       38 on other invoices
```

**Billed 2. Ordered 40. Arrived 40.** And a sentence saying it matches both.

## The check was right. The sentence was not.

Nothing failed. Two units at the agreed price, against two units no other
invoice had charged for, is exactly right, and "Agrees" is the correct verdict.
The other 38 are on AM-2198, which is also correct, and the row says so.

What was wrong is the one line of prose that tells her what the verdict means.
The row underneath had been taught about other invoices — its own comment says
why:

> _"What arrived, and how much of it somebody else's invoice has already charged
> for. Without the second line, a row saying 40 arrived, 2 billed and 'agrees'
> looks broken."_

The banner above it had never been told. [[feedback_a_fix_leaves_its_neighbour_behind]]

## And a second claim it never checked

The file's own header says what the comparison is:

> _"Three documents, compared: what was ORDERED, what was RECEIVED, what is being
> BILLED. **The comparison that matters is billed-against-received.**"_

The sentence claimed the bill matched **what was ordered**. The check never
looks at that. A delivery two units short, invoiced for the two-short amount,
passes this check and does not match the order — and would have been told it
did. [[feedback_a_promise_in_copy_is_a_contract]]

## Measured

```
Juniper Row's supplier bills                      4
  · covering part of an order billed elsewhere    2      AM-2198 and AM-2214
  · and reading "matches what was ordered"        2
```

Both halves of her only split order said it. The order is one she has already
paid attention to: she queried the third invoice against it herself.

## What it does now

`matchSummary` takes the bill's own lines, which carry the one fact the
aggregate never had, and says which of two things the rest of the order is
doing:

```
on other invoices already   →  "The rest of this order is on other invoices."
arrived and uninvoiced      →  "The rest of this order has not been invoiced yet."
some of each                →  "...partly on other invoices and partly not invoiced yet."
nothing left over           →  "...charges for what arrived, at the price you agreed."
```

The last one is the change to the base sentence. It names the two things the
check actually compared and drops the one it did not.

## Proved

**9 tests**, and three wrong versions:

```
keep ignoring the other invoices     →  2 fail
put the confident sentence back      →  4 fail
call both remainders "uninvoiced"    →  1 fail
```

The third is the one worth having. Reusing the sentence that already existed is
the smallest possible fix, it removes the contradiction, and it tells her the 38
units are still to be invoiced when they are already invoiced and already owed.
One of those sentences means "wait"; the other means "pay".
[[feedback_a_test_that_cannot_go_red]]

A fourth case is pinned too: a caller that has not been updated gets the careful
sentence, never the confident one, so the default is the safe direction.

**Checks:** piggles console 169 files / 1577 tests (2 failing in
`surfaces/migration/column-guess.test.ts`, another agent's in-progress file),
sparx workbench 138 / 1259 all green. Typecheck 0 on both consoles. ESLint and
prettier clean. All 17 guards green.

**On her own invoice**, AM-2214 now reads _"Everything charged here is at the
agreed price, for goods that arrived. The rest of this order is on other
invoices."_ over the row that says 38 on other invoices.

## Files

- `piggles/apps/workbench/surfaces/inventory/supplier-bills-data.ts`
- `sparx/apps/workbench/surfaces/inventory/supplier-bills-data.ts`
- `piggles/apps/workbench/surfaces/inventory/supplier-bill-detail.tsx`
- `sparx/apps/workbench/surfaces/inventory/supplier-bill-detail.tsx`
- `piggles/apps/workbench/surfaces/inventory/bill-match-words.test.ts` (new)
- `sparx/apps/workbench/surfaces/inventory/bill-match-words.test.ts` (new)

## The thing to remember

**A summary is a claim, and it has to be checked against the thing it
summarizes.** Every number on this screen was right. The verdict was right. The
row explained itself. The only wrong thing was the sentence that told her what
all of it added up to, and a sentence is what a person reads first and remembers
afterwards.

The measurement that finds it is not "is the calculation correct" — it was. It
is **"read the headline, then read the table, and see whether a stranger would
believe both."** Where a row had to be given an extra line to stop looking
broken, the sentence above it needs the same fact, and almost never got it.
