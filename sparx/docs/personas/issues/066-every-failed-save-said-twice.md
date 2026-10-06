# 066 — In the sparx console, every failed save was announced twice

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 3 (adding engines while the API restarted)
**Surface:** workbench › every screen that saves
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On screen, 2026-10-02: applying the opening-stock import failed with a server error while the API was in a bad state. The screen showed one message, "Could not apply it · Nothing was changed.", and no second "That didn't save". The next attempt succeeded and nothing stayed behind.
**Blocked on:** —

## What happened

Adding "6.0L Power Stroke" to the F-350 while the API was restarting showed "Could not
add that · Nothing was changed." AND "That didn't save · We couldn't reach the server
just then…", for one failure. A failed counter sale earlier showed its own red banner
"The sale was not written down" plus two more "That didn't save" toasts. These toasts
never close by themselves, so a few retries left a column of identical red boxes, and
they stayed after the retry succeeded.

The cause is the console's failed-save safety net
(`sparx/apps/workbench/components/write-failure-reporter.tsx`). It stays quiet only
when `mutation.options.onError` is set. A handler passed at the call,
`mutate(vars, { onError })`, which is how almost every screen does it, never appears
there: TanStack keeps it private. So every screen that apologized in its own words got
a second, permanent toast. `@wizeworks/query` already records the answer
(`callerHandledError`) and supports `shownInPlace` for a screen that shows the error
itself; the Piggles copy of this file was fixed for exactly this (Piggles issue 304),
and also closes the toast when the same write later succeeds and replaces a repeated
failure instead of stacking it. The sparx copy never got that change.

## Fix

The sparx reporter is now the Piggles one: it honors `callerHandledError` and
`shownInPlace`, withdraws a failure toast when the same write succeeds, and replaces
rather than stacks a repeated failure. The rules live in `@wizeworks/query`
(`mutation.ts`, `announcements.ts`) and are tested there. Workbench typecheck clean.

## Still open

Earlier the same afternoon, with the API returning 503 to the preflight request as well,
the same Apply showed no message at all. It could not be repeated on purpose; the
check above is the case that happened again.
