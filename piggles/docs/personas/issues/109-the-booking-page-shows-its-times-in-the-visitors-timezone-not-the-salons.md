# 109 — The booking page shows its times in the visitor's timezone, not the salon's

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 6
**Surface:** the published site — the booking page, and the class booking page
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · a client booking from out of town · on the live site 2026-08-22

## What happened

Every time on Halo & Hem's booking page was drawn in **the reader's** timezone.
Not the salon's — the one on the laptop looking at it.

```ts
new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
```

No `timeZone`, so `Intl` uses the browser's. For anyone in Sacramento that is
right by coincidence. For a client in Chicago, every slot on the grid read three
hours late, the confirmation agreed with the grid, and nothing on the page said
which clock either of them meant.

The **day** was drawn the same way. The grid asks for "Aug 27" as
`new Date('2026-08-27T00:00')` — midnight where the READER is — so a visitor far
enough east got a grid holding the tail of one salon day and the head of the
next, under a single heading.

## Why it matters

**You have to physically turn up.** A haircut is not a video call: the only clock
that means anything is the one on the wall where it happens. A time rendered in
the customer's own zone is not a helpful translation, it is a different
appointment.

And it is the failure that never announces itself. "12:00 PM" is a perfectly
ordinary-looking time; nothing about it says it was converted. The client arrives
three hours late, and both sides believe the other got it wrong.

Nia's own clients are mostly local, so this would have sat there quietly until
the first person booked from a trip — or from a laptop still set to the timezone
of the place they last travelled to.

## How to reproduce

Every time, on any tenant whose visitor is not in the business's own zone.

1. Set the browser to another timezone.
2. Open a booking page. Every time is shifted, with nothing saying so.

## Where it lives

[wizeworks/apps/site/components/booking/booking-widget.tsx](../../../../wizeworks/apps/site/components/booking/booking-widget.tsx)
and
[class-booking-widget.tsx](../../../../wizeworks/apps/site/components/booking/class-booking-widget.tsx)
— the four formatters, the date window, and the day the picker opens on. The
business's zone was never sent to the page: `PublicService` carried duration,
price, capacity, lead time and the word for a stylist, but not the one fact every
time on the screen depends on.

The zone itself has existed all along, on `BusinessLocation.timezone`, described
in its own schema comment as "what a customer is shown". Nothing showed it.

## The fix

**The business's clock, on the page, in one place.**

1. `/v1/public/scheduling/services` now carries `timezone`, resolved from where
   each service happens (its location, else the business's only one) by the same
   `findBookingPlace` the confirmation and the `.ics` use — so the page's clock
   and the calendar entry's cannot disagree.
2. [booking-clock.ts](../../../../wizeworks/apps/site/components/booking/booking-clock.ts)
   holds every time-and-day function both widgets use: `formatTime`,
   `formatDateTime`, `startOfDay`, `dayOf`, `today`. One file, so the appointment
   widget and the class widget cannot drift into two different answers.
3. **The reader is told, but only when it matters.** "All times shown are our
   local time (PDT)" appears under the grid, and the confirmation names the zone
   — but only for a reader whose own clock would say something else. It is
   compared by what the two clocks READ, not by zone name, so somebody in
   Vancouver is not told about Los Angeles for no reason. Most people are local
   and get no extra words at all.
4. **A null zone falls back to the reader's own.** A business with several places
   where the service names none genuinely cannot be pinned to one clock, and
   picking a branch for them would be a guess.

The day window went with it: `startOfDay(date, tz)` resolves midnight where the
business is, two-pass, so the day of a clocks-change is right rather than an hour
off for everything after the transition. That is deliberately the same algorithm
as `@wizeworks/time`'s `localWallToUtc`, which the server side uses — copied
rather than imported because that package is not a dependency of this app, and
two implementations that disagreed about the hour the clocks change would be
worse than the duplication.

## Confirmed by

Re-run on the live site 2026-08-22, with the page's default clock made to behave
like a browser in New York:

|                  | Before             | After                                           |
| ---------------- | ------------------ | ----------------------------------------------- |
| Thursday's grid  | 12:00 PM … 7:30 PM | **9:00 AM … 4:30 PM** — the salon's own hours   |
| Under the grid   | nothing            | **"All times shown are our local time (PDT)."** |
| The confirmation | "4:00 PM"          | **"Thursday, August 27 at 4:00 PM PDT"**        |

And for a local reader, unchanged and unadorned: Yusuf Karadeniz's booking
confirms as "Saturday, August 22 at 3:00 PM", with no zone named, because his
clock says the same thing.

## Rating effect

The published booking page is scored in [rating.md](../rating.md).
