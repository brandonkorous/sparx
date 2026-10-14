# 153 — Naming a new email renamed the Welcome email

**Status:** fixed
**Severity:** critical
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Email designs (the email designer)
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

In the email designer, Doty pressed "+" for a new email. The name box opened on "Untitled email", so he typed "Fleet winter readiness, November 2026" and pressed Enter. The switcher showed his new name. But the canvas still showed the Welcome email, with its "Published" badge.

The database says what happened:

- The new email is still called "Untitled email", with no design.
- The automatic Welcome email (`key = welcome-customer`, the one sparx sends each new customer) is now called "Fleet winter readiness, November 2026".

Any edit and Save would have written his fleet email over the Welcome email that every new customer gets.

## What should have happened

"+" opens the new, empty email. The name typed goes to that email. The Welcome email is not touched.

## Why it matters

A business's automatic emails were one keystroke away from being overwritten by a marketing email, with nothing to warn the owner. The screen showed the new name, so nothing looked wrong.

## Where it lives

`sparx/apps/workbench/surfaces/builder/email/email-editor.tsx`:

- `createNew` creates the email and sets it active. The email list is refetched AFTER that (`useCreateEmail` only invalidates it). Until then, the effect that "settles the active email" finds the new id missing from the list and falls back to the first email, which is Welcome.
- The name box stays open through that switch. `commitName` renames `active`, the email that is active when Enter is pressed, not the one the box was opened for. So the rename went to Welcome.

## The fix

`sparx/apps/workbench/surfaces/builder/email/email-switching.ts` (new) holds the two choices, and the editor uses them:

- `withCreatedEmail`: "+" writes the new email into the email list the moment it is made, before it becomes active. The settle step (`emailToShow`) finds it and stays on it.
- `renameToCommit`: the name box remembers the email it was opened for (`renamingFor`, an id) and commits to that email only. `useRenameEmail` takes the id at the moment of the rename, so it is no longer bound to whichever email is showing. Moving to another email closes the name box.
- The name box selects its text each time it appears (a callback ref), not once on entering rename mode. The box lives in the editor's toolbar, and "+" now rebuilds the editor for the new email. The first version of this fix left the box without the cursor, so typing went nowhere. Found on screen, fixed the same day.

Test, proved red: `surfaces/builder/email/email-switching.test.ts`. A new email is in the list and stays shown; it is not listed twice after the refetch; it takes the name typed for it even if another email shows by then; a box opened for an email that is gone renames nothing. With the list left without the new email, and the rename sent to the first email (what the old code did), 3 of its 5 tests fail.

## Confirmed by

P01 on screen, 2026-10-08, as Doty:

- First, the damage was put right: the automatic Welcome email was renamed back to "Welcome".
- "+" now opens an empty Draft email, and "Fleet winter readiness, November 2026" went onto it. In the database it is on the new email, and `welcome-customer` is still "Welcome".
- After the focus fix: "+" and typing with no click put the text in the name box.
- The three empty "Untitled email" rows left by these tests were deleted with "Delete this email". Its confirm names the email and says it cannot be undone.

## Rating effect

—
