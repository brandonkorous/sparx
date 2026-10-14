# 249 — The report builder squeezed its answer into a sliver in a narrow pane

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 246 (Piggles as The Marrow Review, a report open in a docked pane)
**Surface:** Customers › Build a report › one report, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty (360px) and Piggles as The Marrow Review (a docked pane), 2026-10-13
**Blocked on:** —

## What happened

Rosalind opened "How far along your customers are" in a pane about 480px wide, beside
Email designs. The builder kept its two columns: the question on the left at its full
320px, and "The answer, right now" in what was left, about 60px. The chart was a circle
of a few pixels with no labels. The words "The answer, right now" wrapped one per line.

The two columns are meant to become one on a narrow screen. The rule that does it is
`max-[900px]:grid-cols-1`, which reads the WINDOW's width. A pane is narrow inside a wide
window all the time in the workbench, so the rule never fired. The pane shell is a
container (`@container` in `PANE_SHELL`) so that panes can respond to their own width;
this screen did not use it.

## What should have happened

In a narrow pane the answer sits under the question, full width, readable.

## How to reproduce

1. Open a report from Build a report in a pane under about 900px wide (dock it beside
   another pane) in a wide window.

## Why it matters

The answer is the point of the screen. In the workbench's normal layout it was not
readable.

## Where it lives

The grid around the builder's two columns in `surfaces/crm/report-builder.tsx` (sparx)
and the Piggles report builder.

The same window-width rules appear in about 220 other screens in each console (`md:`,
`lg:`, `max-[Npx]:` on grids and columns inside panes). Most set two form fields side by
side and still read in a narrow pane. They are recorded for the after-sweep layout
decision, with the 360px list findings.

## The fix

The two-column grid now uses the pane's own width: `grid-cols-1 ...
@4xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]`, in place of the window rule
`max-[900px]:grid-cols-1`. Both consoles. Tested by `report-builder-result.test.ts`.

The other window-width rules inside panes (about 220 files per console) stay on the
after-sweep list with the 360px findings.

## Confirmed by

- sparx at 360px: the answer sits under the question; the table is 279px wide with every
  stage name.
- Piggles in a pane about 480px wide: the question is full width and the donut below it
  is full width and readable.

## Rating effect

Build a report, one report, at narrow widths: the answer is readable.
