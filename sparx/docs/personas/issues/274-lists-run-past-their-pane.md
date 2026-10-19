# 274 — Lists run past their pane: the button the screen names is off the edge

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating Stock › Counting schedules, then measured on every screen rated since
**Surface:** list tables in both consoles; 78 name cells in sparx and 78 in Piggles share the cause
**Filed:** 2026-10-14
**Fixed:** 2026-10-16 (Counting schedules and Purchase orders 2026-10-14)
**Confirmed by:** sparx as Doty and Piggles as Rosalind (The Marrow Review), 2026-10-16, every list with rows
**Blocked on:** —

## What happened

Counting schedules, in a pane about 730px wide, said: "1 schedule is due … Press 'Count
now' on a row to do it immediately." "Count now" was past the right edge; the table was
wider than its pane. At 360px it ran 26px over.

The viewer now measures every rated screen at both widths (a table whose scroll width
is wider than its box). Seen so far:

| Screen                    | Wide (≈735px)         | Phone (≈343px)                                   |
| ------------------------- | --------------------- | ------------------------------------------------ |
| Counting schedules        | over, "Count now" cut | 369 in 343                                       |
| Purchase orders           | 771 in 735, State cut | 457 in 343                                       |
| Purchase order (lines)    | fits                  | 445 and 395 in 295                               |
| Cost to keep              | fits                  | 516 in 303                                       |
| What your stock cost you  | fits                  | "Cost to you" box off the edge                   |
| Shelves                   | fits                  | scrolls sideways                                 |
| Segments, Requests, Tasks | fits                  | columns dropped, titles squeezed to 5 to 9 lines |

## What should have happened

A list fits its pane at every width. What drops from a column comes back inside the
first cell, as Counting schedules already did for Next and State.

## Why it matters

Panes sit side by side, and a phone is the narrowest pane of all. A table that runs
past its box hides the right-hand column, which is where the state and the row's own
button usually live.

## Where it lives

Most lists give the first cell `w-full max-w-0 min-w-56` (a 224px minimum) and keep two
or three `whitespace-nowrap` cells on at every width (total, state, a button). 224px plus
those cells is wider than 343px. At mid widths, columns switch on at `@lg` to `@2xl`
(32 to 42rem), lower than the widths at which all of them fit.

## The fix so far

- Counting schedules (sparx): Covers, How often and Per run appear at `@4xl` and `@5xl`;
  Next and State at `@lg`, folding into the name cell below; Covers folds in too; the
  name minimum is 160px. Fits at both widths.
- Purchase orders (sparx): see issue 280; fits at both widths.
- Piggles' copies of both lists are over its 250-line rule and wait on their splits.

## What is left, and the choice

About 75 lists in sparx and 78 in Piggles have the same cause. Two ways to finish:

1. **Fold per list**, as above: each list chooses its narrow-pane columns and folds the
   rest into its first cell. Fits each list to its content, but it is 150 hand edits,
   and the next list written will repeat the mistake.
2. **A stacked table in silicaui**: below a container width, a table's rows become
   blocks (header hidden, each cell on its own line or wrapping). Lists opt in with one
   prop. Fixes the class at the design system, so the next list gets it too. It is a
   new silicaui variant, which is a design-system decision.

## The stacked table (2026-10-16)

Built in silicaui as PR #114 (https://github.com/silicaui/silicaui/pull/114), not
merged or released. `table-stack` on a `.table` (or `<Table stack>`) stacks each row
into a wrapping block below 36rem of its own container; `table-stack-sm` to `-3xl`
pick 24 to 48rem, matching the container sizes the lists already use. The header
stays for screen readers, `data-label` names a cell, and while stacked the lists'
`w-full max-w-0 min-w-56` and `whitespace-nowrap` are set aside. The table's parent
becomes the container itself, so no list needs a new wrapper. Its browser test: the
same list measured 566px in a 341px pane without the stack and fits with it.

Next, once released and installed: put `stack` on the ~75 sparx and ~78 Piggles lists
this issue counts, check each at 360px and side by side, and add a guard that a list
in a pane uses it.

## Rolled out (2026-10-16)

silicaui 0.60.0 released and installed (catalog pins raised; `silicaui-behaviors` had no
release and stays 0.59.3).

- **One place per console.** Piggles' `components/table.tsx` passes `stack` by
  default. Sparx had no table of its own; `components/table.tsx` is its twin (stack,
  the scroll wrapper filling its parent, codes on one line), and the 171 sparx files
  that imported silicaui's `Table` now import it (an import-only codemod, read back
  line by line against a backup). Piggles' two stragglers (b2b/account-statement,
  crm/report-widget) were moved the same way.
- **Guard:** `scripts/check-table-stack.mjs` (`pnpm check:table-stack`, in pre-push):
  no pane imports silicaui's `Table`, and every `stack={false}` carries a comment
  saying why. Red with report-widget put back, green over 452 tables in 1,687 files.
- **Column names.** A stacked row hides its header, so four helpers labeled every
  cell that needs its column name (`data-label`): about 490 in sparx and 150 in
  Piggles. First cells, status badges, buttons and self-describing text are left
  bare. Report tables label from their own column names.
- **Kept as grids, with the reason in a comment:** the stock grid (a paste fills down
  one column) and the stock import's file preview, in both consoles. Piggles' copies
  were added by hand: the default would otherwise have stacked them.
- **Piggles debt:** about 100 Piggles files over 250 lines were not labeled (the
  owner's rule for sweeps, 2026-10-13); they stack, with headers hidden, until each is
  split. Their sparx twins are done.
- Tests: sparx inventory 268, crm and commerce 598, the other folders 862 (one date
  test froze its clock, issue 283); Piggles inventory 300, crm and commerce 640, the
  other folders 578. ESLint clean on every touched file.
- **Found by the sweep:** 12 lists start with a cell hidden on a phone, and the
  question and review lists start with a selection checkbox; silicaui's "first cell on
  its own line" lands on the wrong cell. Being fixed once, in silicaui.

## Screen check, 2026-10-16

silicaui 0.60.1 (the first-visible-cell fix, PR #115) installed; every silicaui pin is
`^0.60.1`. Doty, a 360px frame (no window resize), 27 lists with data:

- **Fit (wrapper scroll width = box):** Counting schedules ("Count now" on screen),
  Purchase orders, Shelves, Orders, Returns, Discounts, Customers, Accounts, Deals,
  Requests, Tasks, Owed to you, Payments, Your sparx bill.
- **Still wide while stacked:** Products 1040 in 323, Stock 765 in 323, Segments 649 in
  323, Reorder 543 in 323, Cost to keep (the second table) 629 in 299.
- **No rows to check here:** Costing, Counts, Pick lists, Lots, Questions, Reviews, Gift
  cards, Price lists, Bills.

Cause of the wide ones: the class `table` is also a Tailwind utility
(`.table { display: table }`, in the utilities layer). It wins over silica's stacked
`display: block`, so the table keeps the table algorithm's width: the rows are flex and
wrap, but the table is as wide as one unwrapped row. Forcing `display: block` in the
frame made Products fit (323 in 323). Being fixed once, in silicaui.

Also seen: dev served 0.60.0's CSS after the install and a restart (no
`nth-child(1 of` rule in the served stylesheet), so the selection checkbox still took a
line of its own. The Turbopack cache in `sparx/apps/workbench/.next/dev/cache` holds the
old plugin output.

## Confirmed by

sparx as Doty, 2026-10-16. silicaui 0.60.2 (PR #116: the stacked table is a block
with `!important` below its stacking width, and a table hidden on purpose stays
hidden) installed; every silicaui pin is `^0.60.2`; the three Turbopack caches
deleted with dev stopped; dev restarted. The same 360px frame (no window resize),
the same 28 addresses:

- **All 19 lists with rows fit.** Wrapper scroll width = box, the table is `display:
block`, the rows are flex, the page does not scroll sideways (356 in 356): Products
  323/323 (50 rows), Stock 323/323 (50), Segments 323/323 (8), Reorder 338/338, Cost
  to keep 299/299 (both tables, 2 and 25 rows), Counting schedules, Purchase orders,
  Shelves, Orders (33), Returns, Discounts, Customers (38), Accounts, Deals,
  Requests, Tasks, Owed to you (20), Payments (12), Your sparx bill (11).
- **The selection checkbox sits beside the name**, not on a line of its own:
  Products' checkbox is at x 21, 24px high, centered on the name's 62px line (name
  from x 57, 263px wide). On screen: checkbox, name, web address, then "Price
  $600.00" and "On sale" on the next line.
- **No rows to check, as before:** Costing, Counts, Pick lists, Lots, Questions,
  Reviews, Gift cards, Price lists, Bills.

Then Piggles as Rosalind (The Marrow Review), 2026-10-16, in the same 360px frame, at
all 93 list addresses in the console's link table (Devi's Juniper Row has more rows,
but another session was using Piggles, so the signed-in persona was kept):

- **One list ran past its box: Locations, 372 in 338.** Its one row, "Main
  Warehouse", ships online orders from an address too short for couriers, so the name
  line held the name and two badges, "Ships online orders" and "Address too short for
  couriers". Badges never shrink and the line could not wrap, so it was 34px wider than
  the pane. sparx's Locations list has the same line. Fixed in both consoles: the name
  line wraps (`flex-wrap`, `gap-x-2 gap-y-1`), in
  `piggles/apps/workbench/surfaces/inventory/locations-list-table.tsx` and
  `sparx/apps/workbench/surfaces/inventory/locations-list.tsx`. After: Piggles 338 in
  338, the courier badge on its own line under the name (x 37, below "Main Warehouse"
  and "Ships online orders"); sparx as Doty 342 in 342, "Ships online orders" under
  "Warehouse (Concord Park)".
- **The other 21 lists with rows fit**, the table a block, the page 356 in 356:
  Collections, Categories, Product types, Customers (41 rows), Segments, Pipelines,
  Tasks, Record types, Shelves, Suppliers, Purchase orders, Content (19), Authors,
  Tags, Content types (both tables), Broadcasts, Automatic emails, Do not email,
  Places, Automations (61), Counting schedules. Holding cost: both tables fit, no rows.
- **No rows to check:** the other 70 addresses, either empty for this business or a
  module it has off.

The test opened 32 tabs in Rosalind's workspace; they were closed and the layout
read back after a reload (34 tabs, as before). The Locations tab the sparx check
opened in Doty's workspace was closed too.

Not checked in Piggles: where the selection checkbox sits on a stacked row. The lists
that have one (reorder, the stock grid, reviews, questions, service levels) have no
rows for this business, and Customers has no checkbox.

## Rating effect

Every list scored so far carries the 360px gap in its notes.
