# 140 — The bookings list on a phone spends five lines on a date

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › Bookings › Bookings, at 390px
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Four columns of a table squeezed into 357px. The When column got about 60 of
them, so every date wrapped:

```
Aug        Cut and          Cancelled
31,        finish
2026       Appointment ·
5:00       Refusal
PM         Probe
```

Five lines for a date, three for a service name, and the State badge clipped at
the right edge. Two and a half bookings on a screen. The one question the list
exists to answer — what is coming up — took a paragraph per row to not answer.

## The fix

**A date breaks nowhere.** `whitespace-nowrap` on the When cell turns five lines
into two.

**And then three columns still do not fit**, so one of them stops being a column.
State is the one that travels: a badge is small and belongs to the booking rather
than to a column, so below `@md` it moves INTO the What cell and the State column
goes. `With` was already `@2xl` only.

Five bookings on a screen instead of two and a half, service names on one line,
no horizontal scroll at all.

## Confirmed by

> Re-ran act 10 as Nia at 390px. "Aug 31, 2026 / 5:00 PM" on two lines, "Cut and
> finish · Appointment · Refusal Probe" on two, the Cancelled badge under it, and
> five rows visible where two and a half were before. Checked the desktop console:
> four columns, unchanged.
