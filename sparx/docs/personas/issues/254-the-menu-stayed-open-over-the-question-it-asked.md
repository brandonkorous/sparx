# 254 — The ≡ menu stayed open on top of the question it had just asked

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming issue 242's split screens (Piggles as The Marrow Review, placing PO-000001)
**Surface:** every pane bar that folds its actions into the ≡ menu, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Rosalind's order PO-000001 was open in a narrow pane, so its bar showed Save and ≡. She
opened ≡ and chose "Place order". The confirm box came up ("Place PO-000001 with Kestrel
Paper Co.? This places the order and locks it…") and the ≡ menu stayed open on top of
it, covering the box's title and first line. She had to know to click somewhere else to
read what she was being asked.

The menu is an uncontrolled popover. Choosing one of its action rows runs the action but
never closes the menu, and an action that opens a dialog opens it underneath.

## What should have happened

Choosing an action closes the menu, as a menu does. The question it asks is the only
thing on top.

## How to reproduce

1. Open a purchase order in a pane under 672px wide.
2. ≡ › Place order (or Cancel, or Delete).

## Why it matters

A confirm box exists to be read before the owner commits. This one was half hidden by the
menu that opened it.

## Where it lives

`components/pane-toolbar-overflow.tsx` in both consoles: the one menu every folded bar
uses.

## The fix

`components/pane-toolbar-overflow.tsx` (sparx) and the split Piggles
`components/pane-toolbar-popover.tsx`: the menu is a controlled popover, and a capture
handler on the panel closes it when a plain button in the panel is pressed. Buttons that
work inside the menu keep it open: anything with `aria-haspopup`, `aria-pressed`,
`aria-expanded`, or a combobox, switch, checkbox, radio, tab or option role. Only a
button inside the panel's own DOM counts, so a nested menu's rows (portalled elsewhere)
do not close it.

The first cut closed the menu only for the action rows. On screen, "Close" and "Cancel"
on a purchase order sit in the controls zone, above the rows, so the rule moved to the
whole panel.

Tests: `components/pane-toolbar-menu-closes.test.ts` in both consoles, red then green.
The Piggles file (263 lines) was split to the size rule; the console-parity check maps
the new file onto the old name.

## Confirmed by

- sparx, Doty, PO-000002 at 360px: ≡ › Cancel. The question "Cancel PO-000002? This calls
  the order off for good…" came up alone, with the menu closed. "Keep it" was pressed;
  the order is still "submitted".
- Piggles, Rosalind, PO-000001 in a narrow pane: ≡ › Cancel. The question "Cancel
  PO-000001? This calls the order off for good…" came up alone, with the menu closed.
  "Keep it" was pressed; the order is still "Placed".

## Rating effect

Every folded bar: a question an action asks is no longer half covered.
