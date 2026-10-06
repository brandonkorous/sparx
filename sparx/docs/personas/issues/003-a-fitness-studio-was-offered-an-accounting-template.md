# 003 — A fitness studio was offered an accounting firm's template

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › Your story › "Your starting point"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — "A fitness studio" now starts from Fitness (Bold)
**Blocked on:** —

## What happened

On the "So, what's your story?" step, Doty pressed the **A fitness studio**
example by mistake on his way to **A distributor**. The setup panel on the right
said:

> Your starting point — **Accounting (Advisory)**. A premium, advisory-led template
> for CPA and wealth firms. Book consultations from day one.

for a story that read "I want to start a fitness studio for people, where they can
sign up for classes and order online". A **Fitness (Bold)** template exists in the
catalog and every module it needs was on.

## What should have happened

A fitness story starts from the fitness template. A story whose trade has no
template of its own starts from a blank site, never from another trade's.

## How to reproduce

1. Sign up, reach "So, what's your story?".
2. Press **A fitness studio**.
3. Read "Your starting point": Accounting (Advisory). Every time.

## Why it matters

The template is installed as the business's first website. A gym owner who
presses "Build my fitness studio" gets pages written for a CPA firm, under her
name, and has to find and rewrite every one. It is also the first proof sparx
offers that it understood her story, and it says the opposite.

## Where it lives

`pickBlueprint` in `sparx/apps/workbench/lib/onboarding/story-state.ts`, with an
identical copy in `piggles/apps/workbench/lib/onboarding/story-state.ts`. It
ranked candidates by `vertical`, which has four values (`retail`, `b2b`,
`content`, `services`), then by least content. `services` holds 112 templates
across accounting, dentistry, yoga, plumbing and more; "Accounting (Advisory)"
is the least content-rich of them, so every services story that did not need
commerce got it.

## The fix

- `@wizeworks/story-schemas`: every `Industry` now carries `blueprintKeys`, the
  key fragments that make a template that industry's own (fitness:
  `fitness`, `yoga`, `athletic`; wholesale: `b2b-`; auto parts: `auto`, `garage`;
  …). Brand-blind: no brand prefix in any of them.
- `pickBlueprint` moved into `@wizeworks/story-schemas/src/blueprints.ts`. When
  the industry names templates, only those qualify, and none installable means a
  blank site. With no industry chosen, the vertical match still decides.
- Both consoles' local copies are deleted and re-export the shared one, so
  Piggles gets the same fix and the two cannot drift again.
- `blueprints.test.ts`: 4 tests. Restoring the vertical-only match turns 2 of them
  red (the fitness pick and the blank-not-wrong fallback); proved before trusting
  them green.

## Confirmed by

> Re-ran P01 act 1. Pressed **A fitness studio**: "Your starting point — **Fitness (Bold)**. A loud, high-energy template for gyms & studios. Book classes and 1:1s from day one." Then **A distributor**: a blank Builder site (every b2b template needs CMS and Email, which that story had not turned on).

Checks: story-schemas tests 9/9, tsc clean; sparx and Piggles workbench `tsc --noEmit` exit 0.

Not re-proved in the Piggles console on screen (its dev app was not running); the change there is the same deleted copy re-exporting the shared function.

## Rating effect

—
