# 595 — Nine people owe me and the screen will not say how much

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 203
**Surface:** mypiggles › Money › Owed to you
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 203 (seen on screen)

## What happened

I opened **Owed to you** to work out who to ring first. The top of the pane was
exactly right:

> Total outstanding
> **$1,645.50**
> across 9 invoices
>
> Not yet due $659.00 · 1–30 days late $986.50

Then the table underneath:

| Invoice    | Customer           | How late    | Due         |
| ---------- | ------------------ | ----------- | ----------- |
| INV-000004 | Wren Ashcombe      | 9 days late | Sep 8, 2026 |
| INV-000005 | Marguerite Adeyemi | 9 days late | Sep 8, 2026 |
| INV-000006 | Tessa Wren         | 9 days late | Sep 8, 2026 |
| …          |                    |             |             |

Nine debts, and **not one amount**. The screen told me I was owed $1,645.50 and
then would not say who owed which part of it.

The Balance column exists. It was **79 pixels off the right-hand edge** of my
pane. There is a thin sideways scrollbar under the table, which I did not
notice, because the table looked finished: "Due" is a perfectly sensible last
column and nothing suggested a sixth one was hiding.

## What should have happened

The amount is the reason the screen exists. It should be the **last** thing to
be dropped, not the first.

Everything else on the pane already tells me the money matters: the headline is
a money figure, the two bars are money figures, the column I cannot see is money.
Only the money went missing.

## How to reproduce

Every time, at any pane width between about 512 and 646 pixels. Mine opens at
**567**.

1. Sign in as Devi, open **Money › Owed to you**.
2. The headline reads "$1,645.50 across 9 invoices".
3. The table shows Invoice, Customer, How late, Due. No Balance.
4. Drag the table sideways and the amounts are there, off the edge.

Below 512px it is worse: at 390px the table is **134px** wider than the space it
has, so Due AND Balance are both off the edge.

## Why it matters

This is the chase list. Ringing someone about money without knowing the amount
is not a shorter phone call, it is a different one.

And the failure is data-dependent, which is how it survived: with short customer
names the five columns just fit, and with real ones they do not. The column was
admitted at a width the table could not draw it in.

## Where it lives

`workbench/surfaces/finance/receivables.tsx`. The Due column was
`hidden @lg:table-cell` — it appears once the pane passes **512px**. Five columns
need **628px** to draw. Between those two numbers the table overflows and the
last column, Balance, is the one that goes over the edge.

The arithmetic, measured rather than guessed:

| column   | width |
| -------- | ----: |
| Invoice  |   116 |
| Customer |   177 |
| How late |   119 |
| Due      |   122 |
| Balance  |    94 |
| **all**  |   628 |

512 admits the fifth column. 628 is what the fifth column costs. Nothing checked
that those two agreed.

**This is issue 591's lesson, and the neighbouring screen already had it right.**
**Money you owe** (`bills-to-pay.tsx`) is the mirror of this surface — same
module, same shape of table, same aging badge — and it puts its Due column at
`@2xl`. One file over, the same decision was made correctly. This one never got
it.

**Fixed:** columns now drop in the order she can afford to lose them.

| column   | shows from   | why                                                |
| -------- | ------------ | -------------------------------------------------- |
| Customer | always       | who to ring                                        |
| How late | always       | carries the color and the sort; aging IS this pane |
| Balance  | always       | the reason the screen exists                       |
| Invoice  | `@lg` (512)  | she opens the row to quote it anyway               |
| Due      | `@2xl` (672) | "9 days late" already said it                      |

Below `@lg` the invoice number **rides under the customer name** rather than
disappearing. Devi has INV-000006 and INV-000007, both Tessa Wren, both $101.95,
both due the same day. Without the number those are the same row printed twice.

**The name WRAPS now, and that is what bought the extra column.** A `truncate`
div keeps `white-space: nowrap`, so inside a table it demands the full width of
the longest name as the column's minimum however narrow the pane gets. Measured
both ways:

| columns | with a nowrap name | with a wrapping name |
| ------- | -----------------: | -------------------: |
| 3       |                390 |              **324** |
| 4       |                506 |              **440** |
| 5       |                628 |              **561** |

That is the difference between the Invoice column coming back at 576 and coming
back at 512 — which is the difference between Devi seeing three columns and four
in the pane she actually opens.

Worth recording that the first attempt at this was wrong and the measurement
caught it. Moving `truncate` from the `<td>` onto an inner `<div>` — the house
pattern from the mirror surface — changed the table's width by **exactly zero**:
507px both ways. The wrapper was never the problem; the `nowrap` inside it was.

Measured across twelve widths after the change:

| pane width | columns shown | sideways scroll |
| ---------: | ------------: | --------------: |
|        360 |             3 |               0 |
|        440 |             3 |               0 |
|        512 |             3 |               0 |
|        560 |             4 |               0 |
|        672 |             4 |               0 |
|        700 |             5 |               0 |
|        900 |             5 |               0 |

Three, four, five. No step adds two columns, and nothing scrolls sideways from
**360px** up.

At 320px the table is 37px over. That is a real remainder and it is written down
rather than rounded off: three columns of a customer name, a badge and a money
figure do not fit in 296 pixels of content box.

## The second defect, found in the same file

**sparx said "Not yet due" about an invoice with no due date at all.**

Piggles' copy of `lateness()` carries this branch and a paragraph explaining it:

> "Not yet due" is a claim about a DEADLINE. An invoice with no due date has
> none … `overdueDays` is 0 for both cases, which is exactly why they have to be
> told apart HERE.

sparx's copy of the same function did not have the branch. An invoice with no
agreed date read **"Not yet due"** forever: it can never enter an aging bucket,
never turn red, and never reach the chase list, and the screen says the money is
fine the whole time.

That is [[a fix leaves its neighbour behind]] for the fourth time, in the same
pair of files as the first defect.

**Fixed by removing the place it can happen.** `lateness()` and `bucketTone()`
now live in `receivables-words.ts`, one file, identical in both consoles, with a
test. Neither console has a private copy to drift.

## Guard

`workbench/surfaces/finance/receivables-words.test.ts`, 8 tests in each console.

The one that matters:

```ts
const l = lateness(invoice({ dueAt: null, overdueDays: 0 }));
expect(l.label).not.toBe('Not yet due');
expect(l).toEqual({ label: 'No date agreed', tone: 'warning' });
```

Proven red: deleting the no-date branch — the state sparx shipped in — fails
**2 of the 8**, and names them:

```
× will not call an invoice with no date "not yet due"
  expected 'Not yet due' not to be 'Not yet due'
× keeps the no-date warning even when the bucket says everything is current
  expected 'info' to be 'warning'
```

Also covered: the singular/plural property tested by comparing the noun at one
day against the noun at two rather than by matching a shape I guessed at, and
that no late bucket wears the same color as `current`.

## Still open

The column widths are measured from the rendered table, not asserted anywhere. A
test cannot see a browser, so the guard against this recurring is the comment in
the file stating what the columns cost and what admits them.

A third table did do it, in the same walk: see
[597](597-my-spending-total-was-on-screen-and-none-of-the-amounts-were.md), which
found the shared cause.

Also noted, not filed: every one of Devi's nine invoices is "9 days late" and due
Sep 8. That is the seed, not the product — the database agrees with the screen.
