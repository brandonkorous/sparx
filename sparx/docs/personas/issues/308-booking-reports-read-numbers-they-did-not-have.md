# 308 — Booking reports read numbers they did not have

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Scheduling › Reports; sparx console
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

"Didn’t turn up" read 0% when nothing had finished, so there was nothing to measure. Diary use rounded 0.25% to "0%". One label read like a status code.

## What should have happened

No figure where nothing was measured, "under 1%" for a small share, and labels in plain words.

## How to reproduce

1. Open Scheduling › Reports with few bookings.

## Why it matters

A 0% no-show rate reads as good news. Here it meant "nothing to measure".

## Where it lives

`surfaces/scheduling/reports.tsx`.

## The fix

"Didn’t turn up" shows a dash with "no finished bookings to measure yet". Diary use shows "under 1%". The label reads "Confirmed, not yet marked done".

No test: words on the page.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Booking reports reads "Didn’t turn up / — / no finished bookings to measure yet" and "under 1% of your open time was booked. 3.5 hrs booked out of 1,416 hrs of opening time".

## Rating effect

See the pane's row in `rating.md`.
