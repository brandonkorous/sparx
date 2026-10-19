# 267 — "That segment is no longer here", and nothing to press

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating Customers › Segment (a saved pane on a segment since deleted)
**Surface:** every detail screen's "no longer here" state, sparx console and Piggles (104 of 105 in sparx)
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

A pane Doty had kept open pointed at a segment that was since deleted. It said:

> That segment is no longer here
> It has been deleted, or the address points at something that is not in this
> business. Nothing of yours has been lost.

There was no button. The only way on was the pane tab's ×. At 360px the screen is the
whole phone, so the tab is not even in view.

## What should have happened

The shared error part's own comment says it: for a gone record, "the way out is back
to the list". The board screen offers "Show my dashboards". Every gone record should
offer its list.

## How to reproduce

1. Open any record, then delete it from another pane (or keep a pane on it and delete
   it elsewhere).
2. Reload. The pane shows "That … is no longer here" with nothing to press.

Every time, on 104 detail screens.

## Why it matters

A dead end with no way out, on the screen that has just said something is missing.

## Where it lives

`components/pane-load-error.tsx` in both consoles shows buttons only when the screen
passes `actions`. Only the board screen did.

## The fix

At the one shared part, not on 104 screens:

- `lib/surfaces/list-for.ts` (new, both consoles): `listFor(detail)` finds the listed
  screen whose create button opens that detail screen. A list already names it as
  `createSurface`, so nothing new is declared.
- `components/gone-way-out.tsx` (new, both consoles): "Open <list>" in the same pane,
  or "Close this" when no list owns the screen.
- `components/pane-load-error.tsx` (both): a gone record with no `actions` of its own
  shows it. A screen's own way out (the board's) still wins.
- `lib/workbench/context.tsx` (both): `useOptionalWorkbench`, so the part renders
  safely where there is no dock.
- 47 detail screens are opened by no list's create button (orders, sites, carts,
  returns). For those, `listFor` falls back to the list by its plural name
  (`quote.detail` to `quotes.list`, `site` to `sites`), which reaches about 20 more;
  the rest keep "Close this".

Tests: `lib/surfaces/list-for.test.ts` in both consoles (4 each), red (no helper; the
fallback case red again with the fallback removed), then green. Scoped type checks and lint clean; console parity green.

## Confirmed by

sparx as Doty: the gone segment shows "Open Segments" in light and at 360px. Pressing
it turned the pane into the Segments list.

sparx as Doty: a gone site, which no create button names, offers "Open Sites".

## Rating effect

crm.segment.detail and every gone-record state: a way out.
