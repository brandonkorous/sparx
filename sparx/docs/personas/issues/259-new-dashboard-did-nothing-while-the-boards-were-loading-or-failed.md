# 259 — "New dashboard" did nothing while the boards were loading or had failed to load

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · splitting the Piggles board screen for issue 258 (read in the code, then checked in both consoles)
**Surface:** Customers › Boards, before a board is drawn, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** tests in both consoles; on screen only the board state (see below), 2026-10-13
**Blocked on:** —

## What happened

The board screen keeps its toolbar in every state, so "New dashboard" ("Make a
dashboard" in Piggles) is there while the boards load and when they fail to load. The
button opens the new-board dialog. But in those two states the dialog was never drawn:
only the "no dashboard yet" state and a drawn board put it on the screen. Pressing the
button set the dialog's state and nothing appeared.

This is a screen over a button that does nothing: it looks right and it is dead in two
of its four states.

## What should have happened

Wherever "New dashboard" shows, pressing it opens the new-board dialog.

## How to reproduce

1. Customers › Boards while the boards cannot be read (or while they are still loading).
2. Press "New dashboard". Nothing opens.

## Why it matters

A failed load is exactly when the owner might try to start fresh. The one button offered
does nothing, with no reason given.

## Where it lives

`surfaces/crm/dashboards.tsx` (sparx); Piggles `dashboards-states.tsx`
(`DashboardsLoading`, `DashboardsLoadError`).

## The fix

- sparx `surfaces/crm/dashboards.tsx`: the toolbar used before there is a board now
  carries the new-board dialog with it, so every state that shows "New dashboard" has
  the dialog. The "no dashboard yet" state no longer draws a second copy.
- Piggles: `dashboards-states.tsx` gains `boardlessPane()`, which picks the state to draw
  (or none). `dashboards.tsx` draws that pane, or the board, and then one board dialog
  for every state. The "no dashboard yet" state no longer draws its own.

Tests: `surfaces/crm/dashboard-new-board-dialog.test.ts` in both consoles, red 2 of 2,
then green. Piggles CRM tests 95 of 95 green. Scoped type checks of both files are clean.

## Confirmed by

- On screen, sparx as Doty: on the "Monday numbers" board, board menu › Another board
  still opens "A new board". Canceled.
- The loading and load-error states themselves were not seen on screen. They cannot be
  forced from the screen without stopping the API, which this run does not do. The fix
  is proven by the tests and by reading the code: the dialog is now drawn in those
  states.

## Rating effect

Boards, before a board is drawn: the one button offered works.
