# 239 — An empty phone systems list explained a number that was not there

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · pane ratings (Customers › Phone systems, none connected)
**Surface:** Customers › Phone systems, sparx console and Piggles, no phone system connected
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Phone systems in Doty's workbench (light, dark, 360px)
**Blocked on:** —

## What happened

Doty has no phone system connected. Under the "No phone system connected yet" state, the
foot of the pane said: "To change the token on a connected number, disconnect it and
connect it again." There is no connected number, and "token" is a word he has not met
yet on this screen.

This is the neighbour of issue 236 (the same foot line on Mailboxes). A search of every
foot line in the console found only these two that talk about rows that may not exist.

## What should have happened

The line shows only when a phone system is listed, beside the thing it explains.

## How to reproduce

1. Customers › Phone systems, on a business with none.
2. Read the line at the foot of the pane.

## Why it matters

Advice about a thing you do not have reads as a sign you missed a step.

## Where it lives

- `sparx/apps/workbench/surfaces/crm/phone-systems-list.tsx`: the foot `<p>` renders in
  every state.
- `piggles/apps/workbench/surfaces/crm/phone-systems-list.tsx`: the same line through
  `productCopy('crm.phone.tokenNote', …)`.

## The fix

The line shows only when at least one phone system is listed.

- Sparx, `surfaces/crm/phone-systems-list.tsx`: the foot line is wrapped in
  `rows.length > 0`.
- Piggles, 253 lines, was split with the code moved unchanged:
  `phone-systems-table.tsx` (the rows and disconnecting one) and `phone-systems-list.tsx`
  itself, now 202 lines, with the line in `TokenNote`, drawn only beside a row.

Tests: `surfaces/crm/phone-token-note.test.ts` in both consoles. Each was run against
the old file (red) and the new one (green). CRM tests: sparx 70, Piggles 75 pass. Lint
clean. Typecheck not run.

## Confirmed by

P01, 2026-10-13: Customers › Phone systems with none connected shows only the empty
state in light, dark and at 360px. Piggles, as The Marrow Review: the same after the
split. A list with a number in it is not checked on screen (neither business has one).

## Rating effect

—
