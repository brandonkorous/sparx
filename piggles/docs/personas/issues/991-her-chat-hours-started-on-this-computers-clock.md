# 991 — Her chat hours started on this computer's clock

**Status:** fixed (code)
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 10, in the review of issue 990
**Surface:** mypiggles › Messages › Chat settings › Opening hours (both consoles)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** not yet on screen
**Blocked on:** screen proof

## What happened

Turning chat opening hours on filled the time zone with this computer's zone. For a
business in London set up on a laptop in California, the hours opened and closed eight
hours late.

The zone was a free text box: "Your hours are read in this time zone, e.g.
America/New_York or Europe/London." A business owner who typed "London" or "GMT" saved a
value the clock cannot read.

## The fix

- `surfaces/chat/hours-zone.ts`: `startingHoursZone(businessZone, device)`. New hours
  start on the business's zone from Business details, or this computer's only while she
  has none.
- The box is the house time zone picker, searched by city (`timezoneOptions`), the same
  control as the CRM's promise hours. Choosing is the check.

## Proof

- `surfaces/chat/hours-zone.test.ts` in each console, 2 cases. Red: returning this
  computer's zone fails 1. Restored, 2 of 2. Chat tests pass (Piggles 42, sparx 34).
  Lint and format clean. The full console typecheck runs out of memory.
- Not yet on screen.
