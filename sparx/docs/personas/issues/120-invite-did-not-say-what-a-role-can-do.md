# 120 — Inviting someone gave a bare list of roles with no word on what each can do

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 8 (inviting Mike Van Der Berg, service manager)
**Surface:** workbench › Team › Invite someone (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

"What they will do" listed Admin, Editor, Website, Marketing, Support, Partners, Warehouse and View only, with nothing else. `surfaces/team/roles.ts` holds one plain sentence per role, written for exactly this decision and always naming a limit ("Cannot touch billing", "Cannot see what anything cost you"). The invite dialog never showed it. The Cancel button was also `color="neutral"`, never approved.

## What should have happened

The chosen role's sentence shows under the list and changes with it.

## Why it matters

The question an owner asks when inviting a service manager or a bookkeeper is "what will they see and change, and can they see the money". A bare word answers none of it, and people guess generously.

## The fix

`surfaces/team/index.tsx`, both consoles: the role field draws `roleDescription(role)` under the list; Cancel is colorless.

Test, proved red:

- `surfaces/team/invite-role-words.test.ts`, both consoles: removing the description reddens 1 of 2 (a source check, since the console keeps no render tests); every offered role has a real sentence.

## Confirmed by

On screen, 2026-10-06, as Doty: with Editor chosen the dialog read "Does the everyday work: products, content, orders and customers. Cannot invite people or change what anyone is allowed to see." He invited mike.vanderberg@gillettdiesel.test as Editor; the team list shows him Invited.

## Rating effect

—
