# 279 — One press of "Work it out now" turned the standard settings into "Your settings"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating Stock › Planning settings
**Surface:** Stock › Planning settings (badge and note) and Cost to keep's "standard estimate" box, both consoles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

Before the first planning run, Cost to keep said "This uses the standard estimate: 25% a
year …". Doty pressed "Work it out now" on another screen. After that, Planning settings
wore a "Your settings" badge, its "You are on the standard settings" note was gone, and
Cost to keep stopped saying the 25% was a standard figure. Doty had chosen nothing.

## What should have happened

"Standard settings" until she changes a value.

## How to reproduce

1. A business that has never saved Planning settings.
2. Press "Work it out now" on any planning screen (or let the nightly run happen).
3. Open Planning settings.

Every business, after its first planning run.

## Why it matters

It says the owner made a choice she did not make, and hides the note that tells her
these figures are only standard ones.

## Where it lives

`wizeworks/packages/inventory/src/services/planning-policy.ts`: `markSweepCompleted`
creates the settings row only to stamp the run time, and `loadPlanningPolicy` called any
existing row "configured". `planning-reports.ts` read that flag for the rate note.

## The fix

- `loadPlanningPolicy`: "configured" means at least one value differs from the standard
  one, which is what the badge claims.
- Cost to keep: "uses the standard estimate" when the rate is the standard rate.

Test: `src/services/planning-settings-yours.test.ts` (3), red, then green; inventory
services 162/162. Package type check and lint clean.

## Confirmed by

sparx as Doty, Planning settings, after the run: "Standard settings", with "You are on
the standard settings. Nobody has chosen here yet …".

## Rating effect

inventory.planning.settings: says whose choice it is, truthfully.
