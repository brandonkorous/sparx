# 786 — The column headed "Business" named a person, and hid the person

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 277
**Surface:** mypiggles + sparx workbench — `b2b.quotes.list`, `b2b.quote.detail`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

Two quotes on Juniper Row. One column headed **Business**:

```
Quote      Business           Valid until    Total       Standing
Q-000017   Loom and Larder    —              $504.00     Accepted
Q-000016   Tamsin Vale        Oct 31, 2026   $1,008.00   Draft
```

Tamsin Vale is a person. She is the buyer at Loom and Larder, and she asked for
both quotes. So on a two-row list the same woman is printed as **the business**
on one row and does not appear at all on the other.

Both facts arrive on every row. The route sends `account` and `customer`
together. The list drew one of them.
[[feedback_fetched_but_never_rendered]]

## How often

Measured 2026-09-23 on the dev machine:

```
b2b-quotes documents       16
  with a company on them    2
  with a person on them    16
```

**Fourteen of sixteen** printed a person's name under a header that says
Business. That is not an edge case; it is what the column usually holds. Quotes
without a trade account are deliberately shown here (issue 763) — a shop rings,
you price it up, and nobody has opened an account yet.

The wholesale orders list one tab away has always drawn both, business on top
and who rang beneath it. The quotes list, built from the same shape, drew one.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The fallback was a third wrong answer

`quoteParty` ended with the words `'Unknown business'`. Both halves are untrue:
it asserts a business exists, and that we have mislaid which one. In fact most
quotes have no business by design. The quote detail pane printed it in a
sentence: **"For Unknown business."**
[[feedback_never_present_absence_as_measurement]]

## What was done

**The header says what the column can hold: "Who asked".** It is not drift from
the sibling lists — wholesale invoices genuinely always have a company on them
(17 of 17), so "Business" is right there and wrong here.

**The cell shows both.** Business on top, the person who asked underneath, the
way the orders list next door does it:

```
Quote      Who asked          Valid until    Total       Standing
Q-000017   Loom and Larder    —              $504.00     Accepted
           Tamsin Vale
Q-000016   Tamsin Vale        Oct 31, 2026   $1,008.00   Draft
```

**`quoteParty` returns null** rather than claiming an unknown business, and both
detail panes now read "Nobody is on this quote yet" when there is genuinely
neither.

Two helpers replace the one: `quoteBusiness` (null when there is no trade
account) and `quoteAsker` (the person, or their email when that is all we hold).

## Files

- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-data.ts`
- `piggles|sparx/apps/workbench/surfaces/b2b/quote-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-data.test.ts` (new)
