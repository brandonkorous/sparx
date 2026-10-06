# 017 — Each setup step opened scrolled down

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup (both flows)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — Workspace, Domain and Payments each opened at their heading
**Blocked on:** —

## What happened

After the long "Pick a starting point" gallery, Doty pressed the button at the
bottom of the summary. "Name your workspace" opened with its heading scrolled off
the top: the step kept the last step's scroll position.

## What should have happened

A new step opens at its top.

## Where it lives

`surfaces/onboarding/onboarding-layout.tsx` (both consoles): one scrolling frame
for every step, never reset.

## The fix

Both consoles: the layout scrolls its frame to the top whenever the current step
changes.

## Confirmed by

> Re-ran P01 act 1: Workspace, Domain and Payments each opened with the heading
> at the top of the frame.

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.

## Rating effect

—
