# 113 — A new deal with no estimate was stored as 0% likely

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 7 (the first fleet deal)
**Surface:** workbench › CRM › a new deal › Likelihood (both consoles); `dealService.create`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty opened "Service plan for all 38 RAM 3500s, 2027" on the Proposal sent step (50%) and left Likelihood blank. The box showed a grey "0", and the deal was stored at 0.00.

The forecast reads a deal's 0 as "use the step's chance", so it counted 50%. Everything else read the stored 0: the deal page, the deals list, the Probability column in reports and `deal.probability` in scoring. And moving a deal to a step copies the step's chance onto it, while creating one on that step did not.

## What should have happened

A blank Likelihood means the step's chance, says so, and is stored as that.

## Why it matters

The same deal read 50% likely in the forecast and 0% everywhere a person looks at it.

## The fix

- `crm/src/services/deal-service.ts`: on create, no estimate (0) takes the step's chance, a typed estimate is kept, and a finished step's chance is fixed (`fixedStageChance`, [110]).
- `surfaces/crm/deal-detail.tsx`, both consoles: the empty box shows the step's chance as its hint, and the help reads "Leave it blank to use the step's 50%."
- Migration `20270530000028_a_deal_with_no_estimate_takes_its_step`: open deals stored at 0% on a step with a chance take that chance, the number the forecast already counted. Applied locally: the Wasatch deal.

Test, proved red:

- `crm/src/services/deal-create-chance.test.ts`: storing what was sent reddens 2 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: a new deal for O'Malley Ranch on Fleet accounts › First call showed "10" as the hint and "Leave it blank to use the step's 10%."; saved blank, "Pre-harvest turbo checks, 9 trucks" shows Likelihood 10. The Wasatch deal reads 50 in the database after the migration.

## Rating effect

—
