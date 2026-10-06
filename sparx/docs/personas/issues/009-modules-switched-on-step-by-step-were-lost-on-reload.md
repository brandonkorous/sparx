# 009 — Modules switched on in step-by-step were lost on reload

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › step-by-step › "Switch on what you use"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — Social, Campaigns and Your team switched on, page reloaded, plan still $440, saved story holds all three
**Blocked on:** —

## What happened

Doty switched on **Social**, **Campaigns** and **Your team** in step-by-step. The
plan went to $440. He came back later and the plan read **$411**: the three were
off again in setup, while the tenant's module flags still said on.

## What should have happened

A switch flipped in either editor is saved, and a reload shows what he chose.

## How to reproduce

1. In step-by-step, switch on a module the story does not mention.
2. Reload.
3. The module is off and the plan is lower. Every time.

## Why it matters

The plan is what he agrees to pay. A plan that silently drops three choices on
reload makes him re-check every row, every visit, and the screen and the saved
flags disagree about what he bought.

## Where it lives

- The story and the step-by-step wizard share one model
  (`lib/onboarding/use-story-model.tsx`), and a reload rebuilds the plan from the
  SAVED story. Only the story screen (`story-composer.tsx`) saved it.
- Found while confirming the fix: the save marked the story saved BEFORE the
  request went out and swallowed a failure, so one 503 lost the change for good.

## The fix

- New `sparx/apps/workbench/lib/onboarding/use-story-draft.ts`
  (`useStoryDraftSave`), used by both `story-composer.tsx` and `wizard.tsx`.
- The story counts as saved only once the server says so; a failed save tries
  again after 3 seconds.

**Piggles had the same gap**, found by `check:console-parity`: its wizard never
saved the story, and its composer marked a draft saved before the request. Same
hook built at `piggles/apps/workbench/lib/onboarding/use-story-draft.ts` and used
by its composer and `wizard-inner.tsx`. Parity check green. Not re-proved on the
Piggles screen.

## Confirmed by

> Re-ran P01 act 1, step-by-step. Switched Social, Campaigns and Your team off
> and on; network shows `PATCH /v1/tenant/onboarding` 200. Reloaded: plan
> **$440/mo**. Database `settings.onboarding.story.lines` =
> `[["wholesale",…,"ai"],["crm","social","promos","staff"]]`.

Checks: sparx workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.

## Rating effect

Recorded with the first-run setup row.
