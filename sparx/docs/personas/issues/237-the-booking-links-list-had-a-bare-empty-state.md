# 237 — The booking links list had a bare empty state

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · pane ratings (Customers › Booking links, none made)
**Surface:** Customers › Booking links, sparx console, no link made
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Booking links in Doty's workbench (light, dark, 360px)
**Blocked on:** —

## What happened

Doty has no booking link. The pane showed a small heading, "No booking links yet", and
a paragraph, both pressed to the top left of an empty column with no card behind them.
Every other empty list (Mailboxes, Dashboards, Duplicates) shows the house state: a card,
the module glyph, a centered title and the reason to make one.

## What should have happened

The same empty state as everywhere else, so the screen reads as "nothing here yet",
not as "this did not finish loading".

## How to reproduce

1. Customers › Booking links, on a business with none.
2. Compare with Customers › Mailboxes.

## Why it matters

A bare heading floating in a blank pane looks broken. The house state tells the owner
the page works and what to do next.

## Where it lives

`sparx/apps/workbench/surfaces/crm/meeting-links.tsx`: a `Heading` and `Text` in a
`div`. Piggles already uses `PaneEmpty` in a `Card` (`meeting-links-body.tsx`).

## The fix

`surfaces/crm/meeting-links.tsx`: the heading and paragraph became `PaneEmpty` in a
`Card`, with the booking-link glyph and the same words, as Piggles already had. The
toolbar keeps the one New booking link button.

Test, red first: `surfaces/crm/meeting-links-empty.test.ts` (1). CRM tests 69 pass.
Lint clean. Typecheck not run.

## Confirmed by

P01, 2026-10-13: Customers › Booking links with none made shows a card, the module glyph
and "No booking links yet" centered, in light, dark and at 360px.

## Rating effect

—
