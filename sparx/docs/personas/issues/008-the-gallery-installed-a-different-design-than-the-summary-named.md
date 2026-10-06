# 008 — The gallery installed a different design than the summary named

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › step-by-step › "Pick a starting point"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — the first card is "Auto (European Specialist)", marked "Fits your story" and Selected, and the summary names the same design
**Blocked on:** —

## What happened

Doty reached "Pick a starting point". Three things on one screen disagreed.

1. **The summary and the gallery named different designs.** "Your setup" said
   **Your starting point — Auto (European Specialist)**, the design his story
   matched. The gallery had **Universal Starter** marked, and Continue installed
   the gallery's choice, not the one the summary named.
2. **The chosen card could not be seen.** Once the two agreed, the selected card
   was number 121 of 190, about 22,000 pixels down the page. The first screen
   showed four other designs and no selection.
3. **The heading was false.** "Filtered to the modules you chose" sat above a
   counter reading "190 of 190 starting points". The code says, on purpose, that
   the gallery is never filtered by modules. The modules step had the twin claim:
   "Your picks narrow the starting points next."

## What should have happened

The design the story matched is the one marked, the one first in the list, the
one the summary names and the one Continue installs. The copy says what the
screen does.

## How to reproduce

1. Write a story whose trade has a template (auto parts), switch to step-by-step.
2. Continue to "Pick a starting point".
3. The summary names one design; the gallery marks another (or none on screen).

## Why it matters

The starting point is installed as the business's first website. An owner who
reads "Auto (European Specialist)" in the summary and presses Continue got a
different site. And a selection nobody can see is no selection: he would have
scrolled 190 cards to find out what he was about to install.

## Where it lives

- `sparx/apps/workbench/surfaces/onboarding/wizard/wizard.tsx`: the gallery's
  selection defaulted to `GOLDEN_BLUEPRINT_KEY`; the summary used the story match.
- `surfaces/onboarding/wizard/step-blueprint.tsx`: catalog order only.
- `wizard.tsx` `HEAD.template` / `HEAD.modules`: the two filtering claims.

## The fix

- `wizard.tsx`: `choice` is only what the owner explicitly picked;
  `selected = choice ?? autoPick?.key ?? GOLDEN_BLUEPRINT_KEY`, where `autoPick`
  is the shared `pickBlueprint` (issue 003). The gallery, the summary, the CTA
  and the install all read `selected`.
- `step-blueprint.tsx`: new `recommendedKey` prop. The story's match is drawn
  first and carries a "Fits your story" badge. The order keys on the
  recommendation, never on the click, so a card never jumps when picked.
- Copy: "The one that fits your story is first. Pick any one to load it into
  your setup." and "Next, you pick a starting design for your site."

**Piggles has the same defect** (gallery defaulted to the brand's golden key,
summary auto-picked). Fixed in the same shape: new
`piggles/apps/workbench/surfaces/onboarding/wizard/use-starting-point.ts` owns the
selection, the install and what the summary names; `step-blueprint.tsx` draws the
match first with "Fits your story" (the card moved to `blueprint-card.tsx` to keep
the files under Piggles' 250-line rule). Not re-proved on the Piggles screen.

## Confirmed by

> Re-ran P01 act 1. "Pick a starting point": the first card is **Auto (European
> Specialist)** with "Fits your story" and "Selected"; the summary reads "Your
> starting point — Auto (European Specialist)". The heading no longer claims a
> filter.

Checks: sparx workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.

## Rating effect

Recorded with the first-run setup row.
