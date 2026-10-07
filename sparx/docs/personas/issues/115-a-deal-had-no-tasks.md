# 115 — A deal page showed no tasks and could not add one

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (a follow-up on the Wasatch Front deal)
**Surface:** workbench › CRM › a deal (both consoles); task status badges everywhere
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty wanted to note "Send Renée the 2027 service plan pricing sheet" against the Wasatch deal. The deal page had no tasks section and no way to add one. A task can belong to a deal: the column, the API's `deal_id` filter and the task form's `dealId` preset all existed, and no screen ever passed one.

It was worse than a missing button. An automation had already made "Follow up: Service plan for all 38 RAM 3500s, 2027", due Oct 7, linked to the deal, and nothing on the deal showed it.

Also: a canceled task's badge, and a canceled subscription's, were `neutral`, never approved (RULE #4).

## What should have happened

A deal shows its follow-ups and adds one already linked to it and to its person.

## Why it matters

The follow-up is how a deal moves. A task the system wrote for the owner, on a page that cannot show it, is a promise nobody sees.

## The fix

Both consoles:

- New `surfaces/crm/deal-tasks.tsx`: a **Tasks** section on the deal page (title, due day, status) with **Add a task**, which opens a new task linked to the deal and its person (`taskForDealParams` in `tasks-data.ts`).
- `tasks-data.ts`: a canceled task has no tone (colorless, like a written-off invoice); the badges that show it drop the soft tint when there is no tone. `customer-related.tsx`: the same for a canceled subscription.

Test, proved red:

- `surfaces/crm/deal-tasks.test.ts`, both consoles: dropping the deal from the new task's links and painting Canceled reddens 3 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: the Wasatch deal's Tasks section lists "Follow up: Service plan for all 38 RAM 3500s, 2027 · Oct 7, 2026 · To do". Add a task opened with Renée Castañeda and the deal already set and Doty as owner; "Send Renée the 2027 service plan pricing sheet", due Oct 9, 10:00 AM, High, with her budget-meeting note, saved.

## Rating effect

—
