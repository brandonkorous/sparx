# 236 — An empty mailbox list pointed at a row that was not there

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · pane ratings (Customers › Mailboxes, none connected)
**Surface:** Customers › Mailboxes, sparx console and Piggles, no mailbox connected
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Mailboxes in Doty's workbench (light, dark, 360px)
**Blocked on:** —

## What happened

Doty has no mailbox connected. The pane says "No mailbox connected yet" with a Connect
button. Under it, at the foot of the pane, a line said: "sparx checks connected
mailboxes every few minutes. Use the refresh button on a row to check one right now."

There is no row and no refresh button on one. The line tells him to click something
he cannot find.

## What should have happened

The line about checking a mailbox shows only when there is a mailbox to check. With
none, the empty state says all there is to say.

## How to reproduce

1. Customers › Mailboxes, on a business with no mailbox connected.
2. Read the line at the foot of the pane.

## Why it matters

A sentence that points at a control is a promise. A non-technical owner who looks for
the button and does not find it thinks something is broken or missing.

## Where it lives

- `sparx/apps/workbench/surfaces/crm/mailboxes-list.tsx`: the foot `<p>` renders in
  every state.
- `piggles/apps/workbench/surfaces/crm/mailboxes-list.tsx`: the same line through
  `productCopy('crm.mailbox.checkNote', …)`.

## The fix

The line shows only when at least one mailbox is listed.

- Sparx, `surfaces/crm/mailboxes-list.tsx`: the foot line is wrapped in
  `rows.length > 0`.
- Piggles had the same line in a 282-line file. To change it there the file was split,
  code moved unchanged, each file under 250 lines and each function under 50:
  `mailboxes-table.tsx` (the rows), `use-mailbox-moves.ts` (check now, disconnect), and
  `mailboxes-list.tsx` itself, now 207 lines, with the line in `CheckNote`, drawn only
  beside a row.

Tests, red first: `surfaces/crm/mailbox-check-note.test.ts` in both consoles (1 each,
both red on the old files). CRM tests: sparx 68, Piggles 74 pass. Lint clean. Typecheck
not run.

## Confirmed by

P01, 2026-10-13: Customers › Mailboxes with none connected shows only the empty state
and its Connect button in light, dark and at 360px. The foot line is gone. Piggles, as
The Marrow Review: the pane loads after the split with the same result. A list with a
mailbox in it is not checked on screen (neither business has one).

## Rating effect

—
