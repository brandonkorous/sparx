# 272 — The trial banner said "ends in 2 days" for a trial that ends tomorrow

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating Money › Your sparx bill
**Surface:** the trial and grace banner and the top-bar chip on every screen, sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

On Oct 14, the banner on every screen said "Your free trial ends in 2 days", and the
chip said "Trial · 2d". The bill under it said "Free trial ends Oct 15, 2026". The trial
ends at 3:37am Mountain time on Oct 15, 25 hours away.

## What should have happened

"Your free trial ends tomorrow." People count days on the calendar.

## How to reproduce

1. A business whose trial ends tomorrow, more than 24 hours from now.
2. Look at any screen's banner.

Every time the time left is just over a whole number of days.

## Why it matters

Two screens disagree about the day the trial ends, and the banner gives the owner a
day she does not have.

## Where it lives

`wizeworks/packages/billing/src/gate.ts` `daysUntil` rounds 24-hour blocks UP: 25 hours
is 2. The consoles printed that number: sparx `lib/billing/notice.ts`, Piggles
`lib/billing/lifecycle.ts`.

## The fix

- `lib/billing/days-left.ts` (new, both consoles): `calendarDaysLeft` counts calendar
  days to the trial end (or the grace end) on the person's own calendar, and falls back
  to the server's count when there is no end. `whenWords` says "today", "tomorrow" or
  "in 3 days"; `staysWords` says "until the end of today", "until tomorrow" or "for 5
  more days".
- Both banners and the sparx chip use them. The server count is unchanged, since other
  callers use it as a threshold.
- Piggles' test fixture paired one fixed past end date with many day counts; it now
  carries no end date, so each test's count drives it. One expectation moved from "ends
  in 1 day" to "ends tomorrow".

Tests: `lib/billing/days-left.test.ts` (4) in both consoles, plus a banner test in each
(`notice.test.ts`, `lifecycle.test.ts`) that was red, then green. sparx lib/billing and
components 222/222; Piggles 229/229. Scoped type checks and lint clean.

## Confirmed by

sparx as Doty on Oct 14: "Your free trial ends tomorrow", chip "Trial · 1d", in the
wide view and at 360px.

## Rating effect

Every screen's banner: one day, said the same way the bill says it.
