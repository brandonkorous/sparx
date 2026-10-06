# 014 — Setup said "Failed to fetch"

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › Continue / Build / Launch errors
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — the same failure now reads "We could not save this step just now. Nothing you chose is lost. Press Continue again in a moment."
**Blocked on:** —

## What happened

Doty pressed Continue while the server was restarting. Under the button, in red:
**Failed to fetch**.

## What should have happened

A sentence he can act on: what failed, whether he lost anything, what to do.

## Why it matters

"Fetch" is a programmer's word. It does not say whether his choices were saved or
whether to press again, so a careful owner stops.

## Where it lives

Setup printed `error.message` raw in eight places, both consoles:
`wizard.tsx` / `wizard-inner.tsx` (Continue), `story-composer.tsx` (Build),
`story-tail.tsx` ×2 (payments, launch). A network failure's message is the
browser's own text. (`step-domain.tsx` already did this right.)

## The fix

All eight now call the house helper `apiErrorMessage(error, fallback)`
(`lib/api-error.ts`): a server's own 4xx sentence still shows ("that address is
taken"); a network failure or 5xx shows the plain fallback, written per step.

## Confirmed by

> Re-ran P01 act 1 during an api-rest restart. Continue on "Switch on what you
> use": "We could not save this step just now. Nothing you chose is lost. Press
> Continue again in a moment." Pressed Continue again once the API was back: the
> step moved on.

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.

## Rating effect

—
