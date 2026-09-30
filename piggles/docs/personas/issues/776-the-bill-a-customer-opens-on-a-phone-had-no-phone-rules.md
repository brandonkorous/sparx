# 776 — The bill a customer opens on a phone had no phone rules

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 274
**Surface:** the printed billing document stylesheet — preview, PDF and the copy the customer gets
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

RULE #6 wants a pane seen at 360px before it is scored, so the invoice preview
was narrowed to 360. The document did not reflow. It did not scale. It simply
overflowed, in two directions.

```
the sheet kept 96px of its own padding inside a 296px box
the two address columns kept a 48px gutter between them
the totals table kept a hard min-width of 280px inside 200px
```

The totals block pushed out past the sheet's own edge, so "Subtotal",
"Shipping", "Total" and "Balance due" sat outside the paper they belong to. The
Ship to column and the AMOUNT column were both off the right side. Reading the
bill meant dragging sideways, and dragging sideways cut the other half off.

The stylesheet had **no `@media` rule of any kind except `print`.**

## Why it matters more than a preview

This is not only the pane. `invoiceStyles` is in the shell both renderers use,
so it is the PDF, and it is the copy that lands in the customer's inbox.

Tamsin opens her bill on her phone. A wholesale buyer checking a $504 invoice
between deliveries is the ordinary case, not the edge one.
[[feedback_responsive_top2_rule]]

## What was done

One `@media (max-width: 640px)` block. Nothing in it is a different design:

- the masthead, the two party blocks and an authored row stack instead of
  sitting side by side, and the document head aligns left with them
- the sheet's padding eases from 48px to 20px, the page's from 32px to 12px
- the line and payment tables tighten their cell padding
- `table.totals` gives up its 280px floor and takes the full width instead

A floor that forces a sideways scroll is not protecting the column it is on, it
is moving the damage somewhere nobody looks — the same reading as issue 773, one
document down.

Printing is untouched: `@page` is 7.5in wide, well above the breakpoint, and the
`@media print` block still comes last.

## Proof

At a 360px pane, before:

```
Ship to column cut off · AMOUNT column cut off · totals outside the sheet
a horizontal scrollbar under the page
```

After, same pane, same width:

```
masthead, Invoice, Unpaid, Number / Issued / Due   all readable
Bill to then Ship to, stacked, every line whole
Description · Qty · Unit price · Amount            all four columns visible
Subtotal $42.00 · Shipping $9.00 · Total $51.00 · Balance due $51.00
Notes and the footer
no horizontal scroll
```

Dark mode was checked at the same time and is right by construction: the console
chrome goes dark and the document stays paper-white, because `:root` sets
`color-scheme: light` on purpose. It is a printed page, not a screen.

## Files

- `wizeworks/packages/crm/src/services/billing-document-html.ts`

## Gap to 10

Below about 320px the four line-table columns stop fitting and the page scrolls
again. 360 is the stated floor and it is clean there.
