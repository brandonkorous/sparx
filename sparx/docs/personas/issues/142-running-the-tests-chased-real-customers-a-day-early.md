# 142 — Running the tests chased real customers a day early

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (reading the run history of "Chase overdue wholesale invoices")
**Surface:** the automation integration tests; the dev database
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06
**Blocked on:** —

## What happened

"Chase overdue wholesale invoices" has four runs for Gillett on Oct 6. Two are real (O'Malley at 16:52 UTC, Høgberg at 17:34 UTC). The other two (17:24 and 17:44 UTC) carry `occurredAt` 2026-10-07 and a dedupe key for Oct 7: a run for tomorrow, made today.

They came from `automation-actions/test/integration/b2b-escalation.test.ts`, which calls `runScheduleTick(deps, appDb, new Date(Date.now() + DAY))`, and `scanners.test.ts` (now + 30 minutes). The scheduler takes every tenant's scheduled rules, so each test run also ran the real businesses' rules in the shared database, with a clock a day ahead. It used up tomorrow's slot: O'Malley's real Oct 7 run will be skipped as already done.

## What should have happened

A test runs its own tenant's rules and nobody else's.

## Why it matters

Only in development: no test runs against a live database. But it is the database every persona run, and the other agent's runs, are recorded in. With issue 139 fixed, a test run would also send real reminder emails (to the dev console) to real dev customers, a day early.

## Where it lives

- `wizeworks/packages/automation/src/engine/schedule-tick.ts`: no way to limit a tick to some tenants.
- Callers in `automation-actions/test/integration/` and `automation/test/integration/engine.test.ts`.

## The fix

The same leak was in the run tick: a test's `runAutomationTick` carried out ANY tenant's waiting runs, with the test's fake email sender. A real business's email could be "sent" into a test and never reach the worker.

- `automation/src/engine-types.ts`: `EngineDeps.onlyTenants`, a set of tenant ids. Unset (the worker) serves every tenant.
- `schedule-tick.ts` and `run-tick.ts`: both skip a tenant outside the set.
- Every test that ticks now passes the tenants it made: `automation/test/helpers.ts` (`makeDeps` and `createTenant` share `testTenants`), and the eight `automation-actions/test/integration` files that tick (each `deps` carries `ourTenants`, filled where the file creates its tenant).

Test, proved red:

- `automation/test/integration/engine.test.ts`, "leaves a tenant outside onlyTenants alone, in both ticks": two tenants with the same daily rule; a tick for one makes no run for the other, and its run tick does not carry out the other's waiting run. Without the filter in both ticks it fails; without it in the run tick only, it fails on "expected 'completed' to be 'running'".

## Confirmed by

Ran the automation and automation-actions suites against the dev database after the change (153 and 148 tests). No new run appeared on Gillett (`automation_runs` with an `occurredAt` ahead of its `started_at`: none since 17:44 UTC Oct 6).

## Rating effect

—
