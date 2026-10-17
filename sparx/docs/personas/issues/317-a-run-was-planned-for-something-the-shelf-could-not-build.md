# 317 — A run was planned for something the shelf could not build

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Inventory › Assemblies › Plan a run, and a run's "Hold the parts"; api-rest stock service; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

Doty wrote a recipe, "LLY pump install kit" (the AP0128 kit from one O-Ring and one bottle of additive). The recipe page said "You could make 0" at the shop. The plan form said nothing about that, so ASM-000001 was planned. Only on "Hold the parts" did a refusal come: "Not enough 4062328 to commit to this run", naming the part by its code. The recipe form also said "Quantities are for ONE RUN" in capitals.

## What should have happened

The plan form says how many the chosen place can make from what is free, and what runs out first, while the run is being planned. A refusal names the part.

## How to reproduce

1. Write a recipe whose parts are not free at a location, and switch it on.
2. Inventory › Assemblies › Plan a run, pick that recipe and location.

## Why it matters

Planning is how parts get scheduled, so it stays allowed. But a plan that cannot be built should say so where it is made, not one step later in a code.

## Where it lives

`surfaces/inventory/assembly-detail.tsx` and `plan-run-words.ts` (new) in each console; `surfaces/inventory/bom-detail.tsx`; `wizeworks/packages/inventory/src/services/assembly-orders.ts` (`assertEnoughAvailable`).

## The fix

- `planRunNote(buildable, requested, place)`: "Up to N can be made at … from what is free.", or a warning "None can be made at … from what is free: … runs out first. You can still plan it, and hold the parts once they are in." The plan form reads the recipe's buildable count for the chosen place, for a build only.
- The hold refusal names the part and its code: "Not enough Cummins Fuel Injection Crossover Tube O-Ring (4062328) to commit to this run".
- The recipe form reads "one run" in plain case.

Test: `plan-run-words.test.ts`, 4 per console. Treating every count as enough turns 2 red. No test covers the refusal words.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. With the LLY recipe at Main Office & Shop, the plan form shows "None can be made at Main Office & Shop (Heritage Crest) from what is free: Cummins Fuel Injection Crossover Tube O-Ring runs out first. You can still plan it, and hold the parts once they are in." On ASM-000001, "Hold the parts" refuses with "Not enough Cummins Fuel Injection Crossover Tube O-Ring (4062328) to commit to this run: it needs 1 and 0 are free here."

Not checked: Piggles on screen (tests only).

## Rating effect

See the pane's row in `rating.md`.
