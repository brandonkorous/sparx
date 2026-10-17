# 262 — A board card on a phone squeezed its words and lost its remove button

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating pass (crm.dashboard.detail at 360px)
**Surface:** Customers › Boards › any board, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty, 2026-10-16
**Blocked on:** —

## What happened

On a 360px phone, each report card on the "Monday numbers" board put its title and
description beside four controls (how wide, rename, open, remove). The controls never
shrink, so the words got what was left: "Where your / deals are" over a description
broken into one or two words a line, eleven lines tall. The fourth control, remove
(×), did not fit at all and was cut off past the card's edge.

## What should have happened

When there is no room beside the words, the controls move to their own line under the
title. The words keep the card's width, and every control stays on screen.

## How to reproduce

1. Open a board with a report on it in a pane 360px wide.

## Why it matters

The card's words become hard to read, and a person on a phone cannot take a report off
the board at all.

Under the controls, the card's table had no space between its columns on a phone:
"DealsTotal value" and "Visited their yard1". It was a hand-made `<table>` with no cell
padding, not the house table.

## Where it lives

`surfaces/crm/report-widget.tsx` in both consoles: the card's header row.

## The fix

`surfaces/crm/report-widget.tsx` in both consoles:

- The header row wraps (`flex-wrap`), and the words keep at least 12rem and take the
  rest (`min-w-48 flex-1`). With no room beside them, the controls move to a line of
  their own under the words.
- The table is silicaui's `<Table size="sm">`, which spaces its columns, in place of the
  hand-made `<table>` (RULE #1).

Tests: `surfaces/crm/report-widget-header.test.ts` in both consoles, red then green
(the table case was added second and was red on its own first).

## Confirmed by

sparx as Doty, "Monday numbers" in a 360px frame: "Where your deals are" and its
description take the card's full width in five lines; Half, rename, open and remove (×)
sit on their own line under them, all on screen; the table's four columns fit (Stage,
Deals, Total value). Piggles: not checked on screen.

## Rating effect

—
