# 258 — Adding a report to a board opened on an empty box

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating pass (Customers › Boards, "Monday numbers")
**Surface:** Customers › Boards › Add a report, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13 (the word placement waits on silicaui #113)
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Doty opened the "Monday numbers" board and pressed "Add a report". The dialog's first
field, "Which report", was an empty box: no words in it, nothing to say it was a list to
choose from. "Add it" was off, with no reason given.

Every other picker in the console says what to do in its empty box ("Choose a trade
account", "Choose a supplier…"). This one does not set one, so it draws blank.

## What should have happened

The box says "Choose a report" until one is chosen.

## How to reproduce

1. Customers › Boards › any board › Add a report.

## Why it matters

A blank box with a disabled button reads as broken. The owner has to guess that the box
opens.

## Where it lives

`surfaces/crm/dashboards.tsx` in both consoles: the "Which report" `<Select>`.

## The fix

Two parts.

1. `surfaces/crm/dashboards.tsx` (sparx), and the split Piggles `dashboard*.tsx` files: the
   picker has `placeholder="Choose a report"`. Test:
   `surfaces/crm/dashboard-report-picker.test.ts` in both consoles, red then green.
2. On screen, the words then sat in the middle of the box. That is silicaui: while
   nothing is chosen, the listbox Select still draws its empty value slot, and the
   trigger spreads its parts apart. Every Select with a placeholder in both consoles has
   it. Fixed in silicaui (`select-menu.js`: the empty value leaves the row while a
   placeholder shows), PR #113, with a patch changeset and a new check,
   `pnpm verify:select-placeholder` (red, then green). Not merged: merging is Brandon's.

## Confirmed by

- sparx, Doty, "Monday numbers" › Add a report: the box says "Choose a report".
- Piggles, Rosalind, "Ad sales this season" › Add a report: the box says "Choose a
  report", and the list opens with the eight ready-made reports. Piggles'
  `dashboards.tsx` was over the size rule, so it was split first (into 9 files); the
  picker is in `dashboard-widget-dialog.tsx`.
- The silicaui part, on the live sparx page with the same rule added for the test: the
  words start 12.7 px from the box's edge, like a chosen value. Not yet with the
  released package.

## Rating effect

Board › Add a report: the first field says what to do.
