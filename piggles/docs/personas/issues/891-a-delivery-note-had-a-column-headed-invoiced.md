# 891 — A delivery note had a column headed "Invoiced"

**Status:** fixed
**Severity:** **moderate** — the column named a document that does not exist
when goods are booked in, and on her screen it disagreed with the real invoice
for that same delivery, named in a card four inches below it
**Found by:** P03 · act 316, sweeping Booking stock in by data weight
**Surface:** mypiggles › Partners › Booking stock in › a delivery's own pane,
in both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** a source guard of 5 assertions, proved red three ways
including one probe that was itself wrong; and her own screen, before and after

## What she saw

GR-000003. Fifty-eight brass buckles from Fairfield Trims.

```
Item                          Units   Invoiced   Plus getting it here   Really cost, each
Brass belt hardware, antique    58      $3.60      $0.24 · 6.3%             $3.84
BRASS-BELT-1                                       $14.00 in all
```

And on the same pane, a little further down:

> **The supplier's invoice** · Already entered
> Invoice **FT-INV-2291** is already on this order.

That invoice charges **$3.84** a unit and **no freight at all**.

So the screen says "Invoiced $3.60" directly above a card naming the invoice,
which says $3.84.

## Both documents are true

```
PO-000002   agreed                60 @ $3.60
GR-000003   booked in             58 @ $3.60  + a $14.00 courier charge → $3.84 landed
FT-INV-2291 Fairfield's invoice   58 @ $3.84  + $0.00 freight            = $222.72
```

Fairfield billed the carriage inside the unit price. Devi booked the goods in at
the agreed $3.60 and entered the courier's $14.00 as a separate cost. The two
totals land eight cents apart, and neither party is wrong about its own piece of
paper. That is exactly what three-way matching is for, and the platform already
handles it: the bill check flagged the $13.92 difference and the supplier
scorecard's price column correctly read 0.0%, because it measures receipts.

What was wrong is the **word**.

## It was never an invoice

A receipt line's `unitCostCents` is set in one of two ways, in
`goods-receipts.ts`:

```ts
const unitCostCents =
  input.unitCostCents !== undefined
    ? toBaseUnitCost(input.unitCostCents, uom.unitsPerUom) // what she typed
    : poLine.unitCostCents; // what was AGREED
```

Neither branch touches an invoice, and nothing could: the invoice has not
arrived yet. That is the entire premise of the screen it sits on.

## The right word was already in the file

Three hundred lines below the header, the cost card calls the very same money
what it is:

```
$208.80          $14.00                          $222.80
What the goods   Getting them here: 6.3% of the  What this stock
cost             total                           is worth to you
```

**"What the goods cost."** One screen, two words for one fact, and the wrong one
was the one in the table. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What it does now

The column is headed **`Goods, each`**, so the three read across as one
sentence:

```
Goods, each $3.60  ·  Plus getting it here $0.24  ·  Really cost, each $3.84
```

True whichever way the price was set, consistent with the card underneath, and
it no longer claims a document the pane itself links to separately. Both
consoles.

## Proved

A **source guard** of 5 assertions — the house pattern here, alongside
`channel-slug-never-rendered.test.ts` — which reads the pane's `<th>` cells and
asserts none of them is an invoice word, that the goods column is still there,
and that its two neighbours are too. Three wrong versions:

```
the word "Invoiced" back (the original)   →  2 fail
the column deleted rather than renamed    →  1 fail
the guard reads a file with no headings   →  3 fail
```

The second matters because "remove the wrong word" passes a naive guard by
deleting the column, which loses the number that makes the other two readable.

## The probe that was wrong, not the guard

My first attempt at the third probe renamed `<th ` to `<th-x ` and the guard
stayed green, which looked exactly like a check that had gone blind. It had not.
The pattern is `<th\b[^>]*>`, and `\b` matches between `h` and `-`, so `<th-x>`
is still a match. The probe was broken, not the thing it was probing. Renaming
to `<thx>` — where `h` and `x` are both word characters and the boundary fails —
reddens three assertions including the one that exists for precisely this.
[[feedback_structural_checks_go_blind]]

Worth writing down because the false result pointed the right way by accident: a
guard that cannot go red and a probe that cannot make it go red look identical
from the outside, and only one of them is a problem.

## Checks

piggles console 172 files / 1611 tests, sparx workbench 141 / 1293, both fully
green. Typecheck 0 on both. ESLint and prettier clean.

## Files

- `piggles/apps/workbench/surfaces/inventory/receipt-detail.tsx`
- `sparx/apps/workbench/surfaces/inventory/receipt-detail.tsx`
- `piggles/apps/workbench/surfaces/inventory/receipt-has-no-invoice-column.test.ts` (new)
- `sparx/apps/workbench/surfaces/inventory/receipt-has-no-invoice-column.test.ts` (new)

## Measured

```
receipt lines on the platform        12      every one of them drew this header
receipts carrying a delivery note     3 of 6 · rendered correctly, checked
freight charges recorded              1      · rendered correctly, checked
```

## Also checked and correctly not filed

**The delivery note.** Three of her six receipts carry a written note, and the
best of them is the story of the delivery: _"Two buckles came through with the
antique plating scratched down to the brass. Set aside and reported to
Fairfield. Courier billed 14.00 separately."_ It is drawn on the pane under its
own heading. I first measured it as missing and was reading the wrong pane — the
supplier's, not the receipt's. Looking again is what settled it.

**The duplicate-invoice guard.** Entering a second bill against a delivery that
already has one is how a supplier gets paid twice, and the pane says so before
she can: _"Invoice FT-INV-2291 is already on this order. Entering a second one
is how a delivery gets paid for twice."_ That is the rule working.

## The thing to remember

**A column header is a claim about where the number came from.** "$3.60" is
correct under any heading that describes the order or the keyboard, and false
under one that describes a document nobody had received yet. Nothing in the
arithmetic can tell you which — only the write path can.

The measurement that finds it is **"what wrote this column, and does the word
over it name that?"** It is the same question that found issue 885, asked of a
word instead of a date.
