# 080 — Five "set up prices and terms" tasks for work already done

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 5 (the five trade accounts)
**Surface:** the built-in automation "New wholesale customer: set-up task" (automation-actions seeds)
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** tests below. On screen, 2026-10-02: Doty marked the five existing tasks done (Tasks shows "0 to do"); a new account added complete makes none once this tenant's automations are refreshed (the daily seed refresh writes the new condition onto the installed copy).
**Blocked on:** —

## What happened

Searching "Høgberg Diesel" listed a task: "Set up prices and terms for Høgberg Diesel & Performance". Every one of the five accounts had one, open and due tomorrow, though each was added with its tier, its days to pay and its credit limit on the add screen. A built-in automation opens the task for every new wholesale customer, whatever was filled in. Its own comment says the job is the missing credit limit on a customer added another way; the rule never checked for it.

## Fix

- `automation-actions/src/seeds/b2b.ts`: the task opens only when no terms were chosen, or when the account is on terms with no credit limit. An account that pays before dispatch needs no limit. The description says so.
- `src/seeds/b2b-setup-task.test.ts`: 4 cases; the old always-open rule reddens 2.
- Typecheck clean (automation-actions); seed tests 8 pass.
- Closing the five on screen (Mark done on each) left the list saying "Add your first one", to an owner with five tasks done; the list opens on "To do". `tasks-list.tsx` (both consoles) now says finished ones are under Done in the filter.
