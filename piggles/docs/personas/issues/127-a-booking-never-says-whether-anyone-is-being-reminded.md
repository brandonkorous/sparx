# 127 — A booking never says whether anyone is being reminded

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 9
**Surface:** mypiggles › Bookings › a booking
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Act 9's job was to write down what a reminder actually does. There was nowhere to
read it. A booking pane shows what the booking IS, what it costs, who it is for,
notes, and a **History** of everything that has happened to it — and not one word
about what has been sent to the customer or what still will be.

The platform has always kept the record. `scheduling_booking_notifications` holds a
row per notice per channel: the confirmation the moment a booking is taken, a change
notice when it moves, a cancellation notice, and a reminder at each offset the rule
set asks for. Act 7 already proved it works, by reading it in the database.

Nothing had ever shown it. So a booking with three reminders queued and a booking
that will remind nobody looked exactly the same — which is what let
[126](126-seven-of-her-ten-services-remind-nobody-and-the-switch-is-labelled-as-something-else.md)
run for a fortnight across seven services.

## What should have happened

If the product is going to text somebody at nine in the morning, the screen about
that booking says so.

## How to reproduce

1. Bookings › any booking. Before the fix, every time: History, and nothing about
   notifications.

## Why it matters

Two questions a salon owner asks about an appointment, neither answerable: _did
they get the confirmation?_ and _will they be reminded?_ The second one matters
most for the bookings taken before their service had a rule set — attaching one now
does not schedule reminders retroactively, so those bookings stay unreminded and
there was no way at all to tell which ones.

## Where it lives

- [surfaces/scheduling/booking-notices.tsx](../../../apps/workbench/surfaces/scheduling/booking-notices.tsx) (new)
- [surfaces/scheduling/booking-manage.tsx](../../../apps/workbench/surfaces/scheduling/booking-manage.tsx)
- [packages/scheduling/src/booking-notices.ts](../../../../wizeworks/packages/scheduling/src/booking-notices.ts) (new) — `getBookingNotices`
- `GET /v1/scheduling/bookings/:id/notices`

## The fix

A **What reaches them** section on the booking pane, above History — because "will
they be reminded" is a question about tomorrow and the history is a question about
yesterday. It reads the ledger and says each notice in plain words, with its channel
and its time, in the booking's own zone:

> Sent · The booking confirmation by email — Sat, Aug 22, 12:17 PM
> To go · A reminder by email — Wed, Aug 26, 4:00 PM
> To go · A reminder by email — Thu, Aug 27, 4:00 PM
> To go · A reminder by email — Fri, Aug 28, 2:00 PM

and when nothing is coming, it says that instead of rendering an empty list:

> No reminder is due before this one. Reminders are part of the booking rules on the
> service, so a service with no rule set reminds nobody.

Two deliberate restraints. Notices the platform **called off** (dropped when a
booking moved or ended) are hidden — that is bookkeeping, not something that
happened to the customer. And the explanation only appears while the booking is
still ahead: on a finished or missed booking "no reminder is due" is just the
passage of time, and blaming the rule set for it would be false. That second one
was caught by clicking a no-show two minutes after building it.

## Confirmed by

> Re-ran act 9 as Nia. Priyanka's Friday colour: confirmation sent, three reminders
> listed with their dates. Margot's Friday cut: confirmation and change notice sent
> on both email and text, then the line saying no reminder is due and why — which is
> true, and was invisible an hour earlier. Yusuf's completed cut: what was sent, and
> no explanation, because none is owed.
