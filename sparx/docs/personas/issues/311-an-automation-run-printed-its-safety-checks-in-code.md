# 311 — An automation run printed its safety checks in code

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Automations › a rule › a run; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

A run’s step listed its "Policy checks" as `tenant-active`, `kill-switch` and `module-active`, in small code type. The sentence above the steps already calls them safety checks.

## What should have happened

Each check reads as what it asked, under "Safety checks".

## How to reproduce

1. Open Automations › any rule › Results › a run.

## Why it matters

An owner reading why a step ran or stopped needs words, not the engine’s names.

## Where it lives

`surfaces/automations/run-detail.tsx`.

## The fix

`GATE_WORDS` names the four checks the engine records ("Your account is active", "Automations are not paused", "The part of your account it uses is switched on", "The address it sends to is allowed"). An unknown one reads its name with spaces. The heading is "Safety checks".

No test: words on the page.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. The run of "Wholesale order waiting: ask their approvers" reads "Safety checks / Allowed / Your account is active / Allowed / Automations are not paused / Allowed / The part of your account it uses is switched on".

Not checked: Piggles on screen.

## Rating effect

See the pane's row in `rating.md`.
