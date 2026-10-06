# 012 — A server blip dropped Doty out of setup

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › shell › first-run gate
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 during a real api-rest restart — "Reconnecting…" held for about 20 seconds, then setup returned by itself
**Blocked on:** —

## What happened

Halfway through setup Doty reloaded the page while the API was restarting. The
setup read failed three times (503) in about a second, and the shell showed the
full workspace instead of setup: an empty dock, a cookie question, and no way
back to setup except reloading again.

## What should have happened

A short blip is waited out. Setup comes back by itself, and the screen says it
is reconnecting.

## Why it matters

The shell "fails open" so a finished tenant is never locked out by one bad
endpoint. But during an outage long enough to fail three quick tries, the
workspace cannot load anything either, so showing it gains nothing and loses the
new owner's place. In production this is a rolling deploy at the wrong second.

## Where it lives

- `sparx/apps/workbench/components/workbench-shell.tsx`: `onboardingError` →
  render the shell.
- `lib/onboarding/reads.ts` `useOnboarding`: default 3 quick retries.

## The fix

- `useOnboarding` retries a blip (no answer, a 5xx, a 429) until it clears, with
  backoff capped at 5 seconds. A real answer (a 4xx) still fails open after three
  tries.
- The hold screen says "Reconnecting. Your work is safe, and this page carries on
  by itself." once the first try has failed, instead of sitting blank.

Piggles has no shell-level onboarding gate, so nothing there to change.

## Confirmed by

> Re-ran P01 act 1 and reloaded while api-rest restarted (its health check
> returned nothing for about 20 seconds). The screen read "Reconnecting. Your work
> is safe, and this page carries on by itself." with a spinner. When the API came
> back, `GET /v1/tenant/onboarding` returned 200 and "Switch on what you use"
> appeared with the plan at $440/mo, with no click and no reload.

Checks: sparx workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.

## Rating effect

—
