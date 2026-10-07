# 113 — A client's record, in a booking business, has no appointments on it

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P02 · Halo & Hem · act 7
**Surface:** mypiggles › Customers › a customer
**Filed:** 2026-08-22
**Fixed:** 2026-10-06
**Confirmed by:** on screen at Halo & Hem; 6 tests, 3 proven red; the migration dry-run in a rolled-back transaction

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

## What changed (act 325)

The scheduling work this waited on was committed in `c5eca5886`.

**Point 3, a booking makes a customer.** `recognizeBookedCustomers`
(`wizeworks/packages/scheduling/src/booked-customer.ts`) applies the order
rollup's rule in the same write that puts a person on a booking: forward only,
`customer` and `evangelist` untouched, `leadStatus` cleared. It runs where a
person is booked: `createBooking` (so the website, the console, the AI tools, a
repeating series and the waiting list all get it), a class seat, a seat taken
off the waiting list, and staff moving someone into a seat by hand. A waiting
list place alone does not count.

The people already stuck are moved by migration
`20270530000024_a_client_who_booked_or_bought_is_a_customer`, written and not
run. It also moves the people the ORDER rule never reached: issue 280 promoted
a buyer only at their next order, so Priyanka herself read "Lead" above two
paid orders. Dry run in dev: 65 people moved (53 with bookings, 38 with orders).

**Point 1, the record leads with the diary.** A **Visits** row in the Bookings
color sits at the top of the overview whenever the person has a visit behind
them or one to come: Next visit, Last visit, Visits so far, Booked ahead. A last
visit is a past booking the business accepted and nobody called off or marked
missed, not only one marked done: Priyanka's August appointment still read
"confirmed" in October. "Nothing here yet" no longer shows under a booked
client. A person's bookings now include the classes they hold a seat in, so a
studio member's Bookings tab stops reading "Never booked in".

**Point 2, money says what it counts.** "Paid you so far" is now **Paid for
orders**, beside "Their orders come to", "Orders" and "Last order". Booking money
is in the Visits row as Booked ahead, at today's prices; past visits are not
summed, because a booking keeps no price of its own. In a business with no shop,
the orders row is hidden for anyone who never ordered.

**Two more found on the way.**

- Opening a booking looped: two pieces of code set the tab title to different
  words and undid each other until React stopped with "Maximum update depth
  exceeded". The older one (the service name) is removed; the tab keeps
  "Probe Only · Oct 15, 2026" (issue 842's title).
- Every record said "Customer since" its creation month, under a Lead badge too.
  It is **Known since** now, in both consoles.

## Proof

At Halo & Hem, as the owner:

- Priyanka's record leads with Last visit "a month ago", Aug 28 · Full head
  highlights, 1 visit so far, then her orders row with "Paid for orders $67.00".
- "Probe Only", a lead with nothing on her record, was booked for Cut and finish
  on October 15 through New booking. Her record turned to **Customer** and led
  with Next visit Oct 15, 2026, 2:00 PM, and Booked ahead $65.00, 1 visit.
- The booking pane opened with no console errors.

`booked-customer.test.ts`: 6 tests. Against the old code 3 fail: the class seat,
the seat given by hand, and the class in a person's bookings. Scheduling 178
tests, both consoles' typecheck, ESLint, prettier and the plain-words check
clean. The sparx console got the same change and was typechecked, not driven.

## Rating effect

`Customers › a customer` is scored in [rating.md](../rating.md).
