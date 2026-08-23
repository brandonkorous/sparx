# 133 — The week's date range loses its first month

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › Bookings › Calendar, week view, every screen size
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

The diary's week heading read:

> **17–Aug 23, 2026**

It should read "Aug 17 – 23, 2026". The start month is simply gone, and what is
left reads as a range from the 17th of some month to the 23rd of August.

Not an edge case: it is the `sameMonth` branch, which is four weeks in five.

## The cause

`weekLabel` assembled the string from three separately-formatted pieces and
pasted them together assuming the day comes before the month:

```ts
if (sameMonth) return `${day(start)}–${dayMonthYear(end)}`;
```

Its own doc comment says the output is `"12–18 May 2026"`, which is what that
line produces in a day-first locale. `Intl.DateTimeFormat(undefined, …)` uses the
RUNTIME's locale, and this one is `en-US`, where `dayMonthYear(end)` is
"Aug 23, 2026" and `day(start)` is bare "17".

A hand-assembled range is a guess about where a locale puts the parts. There was
no need to guess.

## Where it lives

- [surfaces/scheduling/calendar-data.ts](../../../apps/workbench/surfaces/scheduling/calendar-data.ts) — `weekLabel`

## The fix

`Intl.DateTimeFormat.prototype.formatRange`, which exists for exactly this and
knows both where each locale puts the parts and which parts a range may share:

| week          | before                       | after                        |
| ------------- | ---------------------------- | ---------------------------- |
| same month    | `17–Aug 23, 2026`            | `Aug 17 – 23, 2026`          |
| across months | `28 Apr – May 4, 2026`       | `Apr 28 – May 4, 2026`       |
| across years  | `28 Dec, 2026 – Jan 3, 2027` | `Dec 28, 2026 – Jan 3, 2027` |

Three hand-written branches became one call, and the locale assumption went with
them.

## Confirmed by

> Re-ran act 10 as Nia. The diary's bar reads **Aug 17 – 23, 2026**.
