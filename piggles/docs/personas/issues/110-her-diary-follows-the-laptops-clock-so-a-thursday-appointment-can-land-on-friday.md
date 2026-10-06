# 110 — Her diary follows the laptop's clock, so a Thursday appointment can land on Friday

**Status:** fixed (2026-09-30), confirmed on screen under a second clock in act 324
**Severity:** major
**Found by:** P02 · Halo & Hem · act 7
**Surface:** mypiggles › Bookings › Calendar
**Filed:** 2026-08-22
**Fixed:** 2026-09-30, `calendar-zone.ts`
**Confirmed by:** P03's run, act 324: Halo & Hem's calendar on a Lisbon clock

## What happened

Act 7's first line is "both bookings appear on the right day, with the right
person". On Nia's own laptop in Sacramento, they do — the calendar draws her
Thursday 9 AM to 6 PM with every client where she put them, and it was the screen
that made [108](108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md)
obvious, because it disagreed with the list beside it.

It is right by coincidence. The calendar reads **the browser's** timezone —
`Intl.DateTimeFormat(undefined, …)` and `date.getHours()` throughout — so it
draws the salon's day wherever the laptop happens to be. With the same page's
clock set to Lisbon, Nia's Thursday becomes:

| Sacramento (the salon)          | Lisbon (the laptop)      |
| ------------------------------- | ------------------------ |
| The day runs 8 AM – 6 PM        | 4 PM – 2 AM              |
| 1:15 PM · Cut and finish · Dara | 9:15 PM                  |
| 2:00 PM · Cut and finish · Nia  | 10:00 PM                 |
| 3:00 PM · Cut and finish · Nia  | 11:00 PM                 |
| 4:00 PM · Cut and finish · Nia  | **12:00 AM — on Friday** |

The last row is the one that matters. It is not shifted, it has **moved to a
different day**. An owner looking at Thursday sees three clients and would leave
after the third; the fourth is filed under a day she has not looked at.

## Why it matters

A diary that follows the device is a diary that changes when you travel. The
people this reaches are not exotic:

- The owner checking next week from a holiday, or from a hotel on a course.
- A manager or receptionist in another state doing the booking-in.
- Any laptop whose clock is still on the timezone of the last place it was
  opened — which is most laptops, most of the time, for a day or two.
- A business with **two premises in two zones**, which has one calendar and one
  browser between them.

And it is silent, in the way this run keeps finding
([[feedback_absent_behaves_like_fine]]): the grid rescales its hour bands to
match, so the screen is internally consistent and looks completely normal. There
is nothing on it that says which clock it is drawn in.

## How to reproduce

Every time, whenever the device's timezone is not the business's.

1. Open Bookings › Calendar with the browser in another timezone.
2. Every appointment is drawn at the device's reading of it, and any appointment
   whose local time crosses midnight is on the wrong day.

## Where it lives

[surfaces/scheduling/calendar-data.ts](../../../apps/workbench/surfaces/scheduling/calendar-data.ts),
[calendar-grid.ts](../../../apps/workbench/surfaces/scheduling/calendar-grid.ts) and
[calendar-hours.ts](../../../apps/workbench/surfaces/scheduling/calendar-hours.ts)
— about fourteen places, all of them the same shape: `startOfWeek` / `startOfDay`
/ `addDays` built on `setHours(0,0,0,0)`, `minutesOfDay` built on
`date.getHours()`, the day-column match built on `getDate()`, the working-hours
band matched on `date.getDay()`, and every label formatted with
`Intl.DateTimeFormat(undefined, …)`.

None of it is careless — it is a grid written in "local wall time", which is
exactly right when local IS the business. Nothing ever told it otherwise.

## The fix

**Draw the diary in the clock of the place, the same rule the rest of scheduling
now follows.** `findBookingPlace`
([booking-receipt.ts](../../../../wizeworks/packages/scheduling/src/booking-receipt.ts))
already answers "which zone is this business in" for the booking engine
([108](108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md))
and for the public booking page
([109](109-the-booking-page-shows-its-times-in-the-visitors-timezone-not-the-salons.md)).
The calendar is the third face of the same question and should read the same
answer.

Concretely: the surface takes a `tz`, and the fourteen sites become
zone-aware — day boundaries via a two-pass `localWallToUtc`, minutes-of-day and
day-matching via the calendar parts read in `tz`, labels via
`Intl.DateTimeFormat(locale, { timeZone: tz, … })`, and the click-to-create
mapping from a Y offset back to an instant reversed through the same function.
`calendar-data.ts` is 441 lines, so the date arithmetic comes out into its own
file on the way past (piggles RULE #0.5).

**Where every active place shares one zone — which is every one-premises business
— that is unambiguous.** When they genuinely differ, there is no single right
answer and the honest fallback is the device's clock plus a line saying so. A
per-location column or a zone chooser is the better long-term answer for a
two-premises business, and that is a product decision rather than a repair.

**Recommended, and not yet done.** Everything above is settled apart from the
multi-zone case; this is next after act 7's remaining steps rather than an open
question.

## Act 324: it was fixed, and this file was never told

`surfaces/scheduling/calendar-zone.ts` landed on 2026-09-30 in the persona pass
(`7b90e2324`): a booking is placed by the day and minute on its own place's
clock, columns are plain calendar dates, and closures are read on the
business's clock. Its tests say the cases this file names, in so many words:
"puts a 10:00 booking at 10:00 whatever the viewer clock says", "files it under
its own day", "reads a closure on the business's clock, not the viewer's". 11
tests pass.

Then looked at under a second clock. A separate Playwright browser set to
Europe/Lisbon, signed in as Halo & Hem, its clock set to Thursday, August 27,
2026, on the calendar: the week of August 24 – 30, the salon's own hours down
the side, and the booking at the bottom of the table above, **4:00 PM · Cut and
finish · Colette Mbeki**, on **Thursday at 4:00 PM**, not at midnight on Friday.
Every block sits at the salon's time.

## What it does NOT affect

Nia, on her own laptop, in her own salon. Her diary is correct today, and the
times recorded in [108](108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md)'s
confirmation are real. This is a defect that waits for the first time she opens
the console somewhere else.

## Rating effect

`Bookings › Calendar` is scored in [rating.md](../rating.md).
