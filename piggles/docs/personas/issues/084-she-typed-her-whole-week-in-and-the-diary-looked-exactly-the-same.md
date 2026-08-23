# 084 — She typed her whole week in, and the diary looked exactly the same

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 3
**Surface:** mypiggles › Bookings › Calendar
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P02 · Nia · on screen 2026-08-21

## What happened

Nia set the salon's week: Tuesday to Saturday, 09:00 to 13:00 and 13:45 to
17:30, Monday and Sunday closed, and a week's closure in August. Twenty-eight
fields across two people. Saved.

Then she opened the diary to look at her week, filtered to herself, and got a
plain grid. **Every hour of every day looks identical.** Monday is not marked
closed. The lunch break is not blocked out. The hours she is open are not
distinguished from the hours she is not.

The only sentence on the screen says:

> **Nothing booked this week**
> This person or resource has an open diary here. Try a different week, or clear
> the filter.

Two things wrong with that sentence, on top of the missing shading:

- **"open diary" is not true.** Her diary is shut on Mondays, shut on Sundays,
  and shut for forty-five minutes every lunchtime. Told she has an open diary
  right after setting hours, the reasonable conclusion is that the hours did not
  save.
- **"resource"** is the schema's word for a person or a chair, and it is on
  screen in front of the owner.

## What should have happened

The hours she just typed should be visible in the place she goes to look at her
week. Closed time reads as closed; open time reads as open. She should be able to
glance at Monday and see it is shut, and glance at one o'clock and see the gap.

This is not a nicety. **Piggles' whole pitch to her is the diary**, and the
diary's job at this moment is to say _yes, that is your week_. Right now the only
way she can check her own opening hours is to reopen the form she just filled in
— which tells her what she typed, not what the system believes.

## How to reproduce

Every time.

1. Bookings › Setting it up › Availability. Pick a person, set some days on and
   others off, add a second block to make a lunch break. Save hours.
2. Bookings › Calendar. Filter to that person. Any week.

The grid is uniform from top to bottom, seven days across.

## Why it matters

An owner cannot confirm the most important setup step in the product. Under
RULE #1's table this is the "it told her nothing happened, and something did"
row — and the empty-state sentence actively tells her the opposite of what she
just configured.

It also hides real mistakes. A lunch typed as 13:45 to 05:30 instead of 17:30
would look exactly like a correct one on this screen, and would first show up as
a client booking a slot Nia is not there for.

## Where it lives

[surfaces/scheduling/calendar.tsx](../../../apps/workbench/surfaces/scheduling/calendar.tsx)
and [calendar-timegrid.tsx](../../../apps/workbench/surfaces/scheduling/calendar-timegrid.tsx).
The grid draws hour lines and booking blocks and nothing else; it is never told
what hours anyone works. The data is already there and already fetched
elsewhere — `useResourceWindows` and `useExceptions` in
[setup-data.ts](../../../apps/workbench/surfaces/scheduling/setup-data.ts).

Empty-state copy: `calendar.tsx`.

## The fix

**The diary draws the hours nobody is open for.**

- New [calendar-hours.ts](../../../apps/workbench/surfaces/scheduling/calendar-hours.ts)
  turns a person's weekly hours plus their closures into bands, quantised into
  the same 15-minute slot classes the booking blocks use — so no inline style is
  involved and the house rule in `calendar-grid.ts` still holds.
- A closure wins over the weekly pattern for the days it covers, and a
  business-wide closure (no person named) covers everyone. A day with no hours
  at all becomes one full-height band, which is what makes "Monday is shut"
  visible rather than merely inferable from an absence of bookings.
- `GridColumn` gained `closed`, drawn behind the bookings as one flat wash
  rather than stripes, so it reads as "nothing happens here" and never competes
  with a booking.
- **Only when one person is chosen.** With everybody on screen there is no
  single week to draw, and inventing one would be worse than drawing none.

**The empty line tells the truth now**, and is theme-independent — "the parts
left white" would be backwards in dark mode, where the shut hours are the dark
ones:

> The shaded parts are when they are not working. Nothing is booked in the rest yet.

…and, on a week she does not work at all: "They are not working at all this
week, so nothing can be booked in it." The word "resource" is gone from the
sentence; the pane title's "New resource" went with it.

**Housekeeping the file-size rule forced** (piggles RULE #0.5, on a file that was
already 354 lines before this): `calendar.tsx` is now 190, with
`calendar-columns.tsx` (127) holding the column builders and the empty line, and
`calendar-toolbar.tsx` (159) holding the toolbar. Four `color="neutral"` came
across with the toolbar and were dropped — those are secondary chrome, and a bare
`.btn` resolves to `base-content` without naming a color (root RULE #4).

## Confirmed by

Re-run as Nia on 2026-08-21. Bookings › Calendar, week view, filtered to
**Nia Okafor**, week of 17–23 August:

- **Monday and Sunday are shaded top to bottom.** Her two closed days, visible
  at a glance.
- Tuesday to Saturday are clear from 9 AM to 1 PM, **shaded across all five days
  between 1:00 and 1:45**, clear again to 5:30, shaded below.
- Above 9 AM is shaded on every day.

That is her week, exactly as typed. Checked in **dark mode** as well: the reading
inverts correctly (open hours are the lighter panels, shut hours the darker
ground) and stays legible. At **360px** in an iframe the shading holds and every
toolbar control is present behind the overflow menu.
