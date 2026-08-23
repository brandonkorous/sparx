# 113 — A client's record, in a booking business, has no appointments on it

**Status:** open
**Severity:** major
**Found by:** P02 · Halo & Hem · act 7
**Surface:** mypiggles › Customers › a customer
**Filed:** 2026-08-22
**Fixed:** —
**Confirmed by:** —

## What happened

Priyanka Deshmukh has a **$180 color appointment booked for Friday**. Her record
in the console says:

> **Nothing here yet** — Priyanka Deshmukh has no deals, tasks, orders or logged
> activity so far. As soon as any of that happens — or you log a note — it will
> show up here.

Her tabs are: Overview · Notes · Orders · Invoices · Deals · Tasks ·
Subscriptions · Activity · Documents · Details. **There is no appointments tab,
and no appointment anywhere on the record.** Her summary reads Total spent $0.00,
Orders 0, Average order —, Last order None yet.

She is also labelled **Lead**.

## Why it matters

For a salon, a client record answers two questions: **when are they next in**,
and **when were they last in**. Neither is on this screen. Everything that IS on
it — orders, invoices, average order value, deals, subscriptions — is the
vocabulary of a shop, on the record of somebody who has never bought a product
and never will.

The result is a record that describes a real, booked, paying client as having
nothing and being worth nothing. "Total spent $0.00" for someone with $180 on
Friday is not a blank, it is a wrong number
([[feedback_never_present_absence_as_measurement]]) — an appointment is revenue,
and the summary is measuring only one of the two ways this business earns.

**"Lead"** compounds it. She has booked and paid attention; she is a client. The
word is sales-CRM language that a salon owner has no use for, and here it is
attached to the wrong person.

## How to reproduce

Every time. Book somebody in, then open their record.

## The fix

**A record in a booking business leads with the diary.**

1. **Appointments belong on the record** — next appointment and recent ones, at
   the top of the overview, because for this kind of business they ARE the
   relationship. This is the other half of
   [111](111-the-appointment-does-not-know-who-it-is-for-so-an-allergy-sits-four-screens-away.md):
   the booking does not know the person and the person does not know the booking.
2. **Money counts bookings.** "Total spent" that ignores every appointment is
   wrong for any business that sells time; either it counts them, or it says what
   it is counting.
3. **"Lead" needs to earn itself.** Somebody with a booking is a customer. Where
   the distinction has no meaning for the trade, the label should not be the
   first thing on the record.

Point 1 is the one that matters most and is the smallest — the bookings list is
already filterable and the customer id is in hand.

## Rating effect

`Customers › a customer` is scored in [rating.md](../rating.md).
