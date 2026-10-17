# 285 — Availability's time boxes cut "AM" and "PM" in half

**Status:** fixed (sparx); Piggles listed as debt
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · rating Scheduling › Availability (Turbo balancer)
**Surface:** time boxes on Scheduling › Availability (weekly hours and date exceptions) and Chat settings, sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

The Turbo balancer's weekly hours read "07:30 A" and "05:30 P": the clock icon sat on the
"M". At 360px the same.

## What should have happened

"07:30 AM" and "05:30 PM", in full.

## How to reproduce

1. Sign in as Doty. Scheduling › Availability.

Every time, in a browser that shows a 12-hour clock.

## Why it matters

Opening hours that a customer books against, half unreadable at the point of setting them.

## Where it lives

Six `type="time"` inputs in `surfaces/scheduling/availability-settings.tsx` and
`surfaces/chat/settings.tsx` carried `max-w-32` (128px). A 12-hour time with its icon and
padding needs about 144px.

## The fix

- The six boxes are `max-w-36` (144px).
- `surfaces/time-boxes-fit.test.ts` (new) reads every time input with the TypeScript parser
  and fails on a cap under 9rem. Its first version matched text and missed two boxes
  whose attributes ran long, so it passed while they were still capped; rewritten on the
  parser, it was red on those two, then green.
- Piggles has the same six in `availability-settings.tsx` (1,009 lines) and
  `chat/settings.tsx` (632 lines), both over its 250-line rule, so they wait on those
  splits.

Lint clean.

## Confirmed by

sparx as Doty, Availability: "07:30 AM" to "05:30 PM" in full, in the wide view and at
360px.

## Rating effect

scheduling.availability: hours readable where they are set.
