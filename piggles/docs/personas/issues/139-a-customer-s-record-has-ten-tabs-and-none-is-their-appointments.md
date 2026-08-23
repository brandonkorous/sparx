# 139 — A customer's record has ten tabs and none is their appointments

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › Customers › a customer
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Act 10's last job was "look up Rob's last visit". Rob's record has ten tabs:

> Overview · Notes · Orders · Invoices · Deals · Tasks · Subscriptions · Activity
> · Documents · Details

Not one of them is his appointments. For a salon — or a clinic, a studio, a
garage, a dog groomer — that IS the customer history. "When was Rob last in, who
did him, what did he have" is the question you ask before he sits down, and the
only way to answer it was to open the diary and scroll through a week at a time
looking for his name.

## Why it matters

Piggles sells to service businesses. A record that lists a person's invoices,
their deals and their subscriptions but not the times they came in is a CRM built
for someone else. And the Overview says "Last order today" — a fact about
commerce — where a salon wants "last in on the 14th, cut and finish, with Nia".

## Where it lives

- [surfaces/crm/customer-bookings.tsx](../../../apps/workbench/surfaces/crm/customer-bookings.tsx) (new)
- [surfaces/crm/customer-detail.tsx](../../../apps/workbench/surfaces/crm/customer-detail.tsx)
- [surfaces/scheduling/bookings-data.ts](../../../apps/workbench/surfaces/scheduling/bookings-data.ts) — `BookingQuery.customerId`

## The fix

A **Bookings** tab, sitting before the money tabs because for a service business
it is the history and the money is the consequence. Newest first, past and future
in one run, because "when were they last in" and "are they coming back" are the
same glance. Each row opens the booking.

The data needed nothing new: the booking list endpoint has always taken a
`customerId` filter and nothing had ever passed one — the console's own query
type did not carry the field. Three lines in the data layer and a tab.

It wears the Bookings app's hue rather than the CRM's, because colour follows
functionality: these rows belong to another app and say so.

## Confirmed by

> Re-ran act 10 as Nia on the phone. Rob Alvarez › Bookings: "Aug 28, 2026 · 5:30
> PM · Barbering, skin fade · Confirmed". His appointment, on his record, without
> opening the diary.
