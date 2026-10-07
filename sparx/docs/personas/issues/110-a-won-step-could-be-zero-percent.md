# 110 — A hand-made Won step was 0% likely, and its deals would have been too

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (building the "Fleet accounts" pipeline)
**Surface:** workbench › CRM › Pipelines › a pipeline's steps (both consoles); `pipelineService`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty made a pipeline and pressed "Add a step" six times. Each new step is open at 0%. He named the last two Won and Lost and set what they mean. Won stayed at 0%: the Chance box was greyed and read 0, and the database held 0.00.

Moving a deal copies the step's chance onto the deal (`deal-service.ts`), so every deal he won there would have read "0% likely" on the deal, in reports (the Probability column) and in scoring (`deal.probability`). The forecast was safe only because it counts won deals separately.

On the same screen:

- Every row carried a badge ("In progress", "Won", "Lost") repeating the Means box beside it, and its changing width pushed the Won and Lost rows' columns out of line.
- The section said "Steps" and "Add a step", while the empty state, the new row's name, the toasts, the confirm and the button labels said "stage" (Piggles already said "step").
- The "Archived" badge was `neutral`, never approved (RULE #4).

## What should have happened

A finished step's chance is a fact: won is 100%, lost is 0%. The editor shows it and does not offer to change it.

## Why it matters

A won deal at 0% is a measurement that says the opposite of what happened, and it lands in every report that lists deals.

## Where it lives

`pipelineService.createStage` and `updateStage` stored whatever chance was sent. The editor sends 0 for a new step and never sent a chance when Means changed.

## The fix

- `crm-schemas/src/common.ts`: `fixedStageChance(stageType)`: 100 for won, 0 for any other finished type, null while open.
- `crm/src/services/pipeline-service.ts`: applied in `createStage` and `updateStage`. Deals already on a step that becomes Won take 100% too.
- Migration `20270530000027_a_finished_step_has_a_fixed_chance`: finished steps take their fixed chance; deals on a Won step take 100%. Applied locally: Gillett's Won step.
- `surfaces/crm/pipeline-detail.tsx`, both consoles: the Chance box shows the fixed value and is locked on a finished step; the repeat badge is gone and the Means box carries the color (`success` for Won, `danger` for Lost); "Archived" / "Put away" is `warning`, like a removed contact. Sparx now says "step" everywhere on the screen.

Test, proved red:

- `crm/src/services/pipeline-stage-chance.test.ts`: storing what was sent reddens 3 of 5.

## Confirmed by

On screen, 2026-10-06, as Doty: Won shows 100% (locked, green Means box), Lost 0% (red). The columns line up. "Add a step" made "New step"; setting it to Won showed 100% and the database stored 100.00 with nothing typed. "Remove step" then asked "Remove New step?" in the same words.

## Rating effect

—
