# 136 — A closed Sunday reads as an empty one

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › Bookings › Calendar — the default "everyone" view
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Stepping the diary to Sunday, the day nobody at Halo & Hem works:

> **Nothing booked this day**
> Nothing is booked yet. New bookings appear here as soon as they are made.

Which invites Nia to expect bookings on a day the salon is shut, and to wonder
why none arrive.

[084](084-an-empty-week-is-told-it-is-an-open-diary.md) fixed exactly this — for
the view showing ONE person. `emptyLine`'s first line was:

```ts
if (!resourceId) return 'Nothing is booked yet. New bookings appear here…';
```

and the diary opens showing everybody, so the fix reached the view nobody starts
in. `useShutHours` returned `known: false` whenever no single resource was
chosen, so the surface could not have answered even if the sentence had asked.

## Why it matters

A closed day is not an empty one, and the difference is most of why anybody
opens a diary. It is also RULE #4's shape: the screen had no measurement of the
working hours and printed a sentence that only makes sense if it does.

## Where it lives

- [surfaces/scheduling/calendar-columns.tsx](../../../apps/workbench/surfaces/scheduling/calendar-columns.tsx) — `useShutHours`, `emptyLine`
- [surfaces/scheduling/setup-data.ts](../../../apps/workbench/surfaces/scheduling/setup-data.ts) — `useResourcesWindows`

## The fix

The everyone view reads everybody's hours. There is only a per-resource endpoint,
so it fans out over it — a shop has a handful of chairs, the reads are cached per
resource, and they are the same cache entries the single-resource view fills, so
switching between "everyone" and one person costs nothing the second time.
`rows` stays undefined until EVERY resource has answered: a partial set would say
"nobody works today" about a day somebody works, which is worse than waiting.

> **Nothing booked this day**
> Nobody is working this day, so nothing can be booked in it.

Two deliberate restraints. The shaded closed-hours bands are still drawn only for
a SINGLE person in view — with several on screen there is no one set of hours to
draw, and shading the union would claim the shop is open when only one chair is.
And `worksOn` for the group answers "anybody at all", which is the only question
the merged view can honestly answer and is the one being asked.

## Confirmed by

> Re-ran act 10 as Nia. Sunday, August 23: "Nobody is working this day, so
> nothing can be booked in it." Saturday still reads normally.
