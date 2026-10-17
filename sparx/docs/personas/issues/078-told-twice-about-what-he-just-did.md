# 078 — Told twice about a customer he had just typed in

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 5 (adding each trade account's buyer)
**Surface:** workbench › the status bar's toasts (both consoles)
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** sparx as Doty, 2026-10-17
**Blocked on:** —

## What happened

Saving Renée Castañeda showed "Renée Castañeda added". A moment later a second toast said "Customer created, Renée Castañeda". The same pair came for Seamus O'Malley, Dana Whitcomb-Nguyen and Marisa Delacroix-Ward.

The status bar raises a toast for new things that happen to the business: a sale, a booking, a customer arriving through a form. Its own comment says "never the operator's own edits". A customer the owner types in is his own edit, and it toasted anyway.

## Fix

- `lib/api/activity.ts` (both consoles): `announceable(fresh, viewerId)` drops what the signed-in person did themselves. The status chip still shows it; only the interruption goes. With the viewer not yet known, everything is announced rather than nothing.
- `components/status-bar.tsx` (sparx) and `components/status/activity.ts` (Piggles) use it. Events are still marked as seen, so they never toast later either.
- Tests: `lib/api/activity-announce.test.ts`, 3 per console; returning every event reddens 1.

## Confirmed by

sparx as Doty, 2026-10-17: added the test customer "Test Toast-078". One toast, "Test Toast-078 added". In the next 101 seconds (the status bar checks every 60) no second "Customer created" toast came; the status bar's own line reads "Customer created: Test Toast-078". The test customer was removed after ("Test Toast-078 removed").
