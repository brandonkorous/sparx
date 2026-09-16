# 501 — The guard against an empty schedule could not see a zone

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, reviewing the fix filed as [499](499-a-counting-schedule-that-covers-nothing.md)
**Surface:** counting schedules, both consoles, plus the service and the API
**Filed:** 2026-09-14

## What was wrong

[499](499-a-counting-schedule-that-covers-nothing.md) added a covered-items count
to the new-schedule form, so a setup that would cover nothing says so before it
is saved. It counts by **location** and **class**.

The form also offers a third narrowing:

> **Narrow to one zone (optional)**
> Leave blank for the whole location. A zone is whatever you named it on your
> shelves.

The generator honours that zone. `selectSliceToCount` requires the item to sit in
a bin whose zone matches. The count did not look at it at all — the parameter was
not even in its signature.

So a schedule narrowed to a zone holding nothing reported the whole location and
saved quietly. **The number built to catch a schedule that covers nothing was
itself the thing saying "73 items" over a schedule that covers nothing.**

Measured against Devi's own data. She has three zones, and every one of them is
empty, because she has bins named but has never assigned stock to them:

```
narrowed to        the count said     the generator would pick
(whole location)   73                 73
Pick face          73                  0
Bulk               73                  0
Inbound            73                  0
```

Three ways to save a schedule that never raises a count, each one reassured by a
figure reading 73.

The same hole was in the SAVED schedule's pane, which is where the number had
lived before 499 moved it forward. A zone-scoped schedule read "73 items
currently covered" for the whole of its life.

## Why it happened

Both counts were a small Prisma `count` on location and class. The generator is a
raw query with a zone clause. Two different questions, one of them shown to the
person answering the other.

The recorded note from the 499 session called this "over-reports" and left it.
That was too gentle twice over: it is not over-reporting, it is the failure mode
of the feature, and recording a defect is not fixing one.

## What changed

One function, `countCoveredLevels`, mirroring `selectSliceToCount`'s WHERE clause
exactly, used by both the saved pane and the form. The zone goes through the API
as `zone_name` and through the hook's query key, so the number changes as the
field is typed.

Mirroring also picked up a second thing the Prisma count missed: the generator
skips levels whose variant is deleted, and the count counted them as covered.

## Proven both ways

With no zone, 73. With any of Devi's three zones, 0 — which makes the form say
**"Nothing is covered by this"** rather than reassuring her.
