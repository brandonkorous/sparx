# 114 — The reason a deal was lost was wiped by the save that lost it

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (Høgberg's dealer program, lost)
**Surface:** workbench › CRM › a deal › Step and "Why it was lost" (both consoles); `dealService.moveStage`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty moved "Dealer parts program for 4 Idaho shops" from Quote sent to Lost. "Why it was lost" appeared, he typed "Lars went with a regional distributor in Boise. Their price was 8% under ours and they deliver daily." and pressed Save. "Deal saved". The box came back empty and `closed_reason` was empty.

Also on the same screen: on the Lost step the Likelihood box still read 50 beside "Leave it blank to use the step's 0%."

## What should have happened

The reason is kept. A Won or Lost deal's chance shows as the fact it is.

## Why it matters

The form's own help says the reason "is what tells you why you win and lose once there are enough of them". Every one typed through this form was thrown away.

## Where it lives

Save on an existing deal sends the fields (the reason among them), then moves the step through its own endpoint so the step-changed event fires. The move was sent without the reason, and `moveStage` sets `closedReason: input.closedReason ?? null`, wiping what the first request had just written.

## The fix

- `surfaces/crm/deal-detail.tsx`, both consoles: the reason travels with the move. On a Won or Lost step the Likelihood box shows the fixed chance, cannot be edited, and reads "A won deal was 100% likely and a lost one 0%." ([110]'s rule.)
- `crm/src/services/deal-service.ts`: closing a deal keeps a reason written while it was still open; closing from a step that was already finished replaces the old outcome's reason. A caller that forgets the reason no longer erases one.

Test, proved red:

- `crm/src/services/deal-close-reason.test.ts`: going back to `input.closedReason ?? null` reddens 1 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: the deal back to Quote sent (Likelihood 50), then Lost with the reason, Save: the reason stays in the box, Likelihood reads 0 and is locked, and the database holds the full sentence with `closed_at` set.

## Rating effect

—
