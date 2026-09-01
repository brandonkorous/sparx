# 361 — The set-up screen crashed every time it was opened

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · opening My Piggles › Get set up
**Surface:** mypiggles › Home › Get set up (and its "describe it in a sentence" twin)
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** the wizard, open, on the Modules step

## What happened

Devi opened **Get set up** from the rail. The pane showed a warning triangle and:

> **This panel ran into a problem**
> Nothing else in your workspace was affected. Try loading it again.

Trying again did the same thing. So did a reload. The console error:

```
Error: useStoryModel must be used within a StoryModelProvider
    at useStoryModel
    at WizardInner
    at ClassicWizard
    at OnboardingWizardSurface
```

Both onboarding surfaces do this. `workbench.onboarding` (the step-by-step wizard)
and `workbench.onboarding.story` (the write-it-in-a-sentence version) each render a
flow that calls `useStoryModel()`, and that hook throws by design when no provider
is above it.

**Nothing in the console mounts one.** `StoryModelProvider` has exactly one
reference in the whole app: its own definition.

## What should have happened

The screen opens.

## How to reproduce

Every time, for everyone.

1. Sign in. Open **Get set up** from the rail (or go to `/get-set-up/steps`).
2. "This panel ran into a problem."
3. Same for **Describe your business** (`/get-set-up/describe-your-business`).

## Why it matters

It is the screen a new business is sent to first, and the only way back into setup
afterwards. It has been unreachable, and it fails as a caught pane crash rather than
as anything an owner could report usefully: "the panel ran into a problem" names
nothing, and the person reading it has no idea whether their account is broken.

That it was found by a persona run rather than by anybody using the product says
something on its own. Typecheck is clean, lint is clean, and there is no test that
renders either surface, so nothing anywhere reported it.

## Where it lives

- [use-story-model.tsx](../../../apps/workbench/lib/onboarding/use-story-model.tsx) — the provider nobody mounted
- [onboarding-surfaces.tsx](../../../apps/workbench/surfaces/onboarding/onboarding-surfaces.tsx) — where it belongs

## The fix

The comments say what happened. `use-story-model.tsx` describes the model as
"held here and lifted into **the gate**", and `story-flow.tsx` says "**the gate**
owns the surrounding chrome + the switch to the classic wizard". The gate was the
first-run, full-viewport onboarding shell. It is gone from this console, and the
two reopenable surfaces that replaced it took the flows but not the provider.

So each surface mounts one. Per surface rather than one in the shell, and that is
a deliberate choice with a real trade: switching between the two flows closes one
pane and opens the other, which is a mount boundary whatever we do, and the story
that has to survive it is already persisted server-side — both flows seed from
`useOnboarding().story`. Hoisting an onboarding context into the shell for every
session, to preserve edits made since the last save, buys less than it costs.

## Confirmed by

> Opened **Get set up** as Devi. The wizard renders: the step rail across the top,
> the switchboard with her apps in their saved state, and the summary card beside it
> reading "Your setup" with her web address and Continue.

## Rating effect

`workbench.onboarding` and `workbench.onboarding.story` — both previously unrated,
and unrateable. Scored in [rating.md](../rating.md) once [362] is proved on screen.
