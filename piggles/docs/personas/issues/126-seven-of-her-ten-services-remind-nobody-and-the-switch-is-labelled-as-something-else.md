# 126 — Seven of her ten services remind nobody, and the switch is labelled as something else

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 9
**Surface:** mypiggles › Bookings › Services › a service › What it costs
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Act 9 was meant to be "set up the reminder that goes out the day before". It was
already set up. **Booking rules › Salon cancellation** has _1 day before_ and
_2 hours before_ ticked, and has since act 3.

Then the diary said otherwise. Of her five upcoming appointments, **three had no
reminder scheduled at all** — Colette on Thursday, Rob and Margot on Friday. Not
late, not failed: never created.

The cause was one dropdown, under a heading about money:

> **What it costs**
> The price a customer pays, and which deposit rules apply.
>
> Booking rules: [ **No deposit or cancellation rules** ▾ ]
> The deposit and cancellation terms a customer agrees to when booking this service.

Every word of that is true. A $65 haircut takes no deposit and Nia is happy for
people to cancel; "No deposit or cancellation rules" is the sensible answer and she
gave it, on **seven of her ten services** — including _Cut and finish_, which
carries six of her ten bookings.

Nothing on that screen, or any other, says the same dropdown decides whether a
reminder is ever sent. Reminders hang off the rule set. No rule set, no reminders,
silently, forever.

## What should have happened

A control that governs three things says three things — especially when the option
labelled as the absence of two of them quietly turns off the third.

## How to reproduce

1. Bookings › Booking rules › any rule set. Tick _1 day before_. Save.
2. Bookings › Services › any service where Booking rules is empty.
3. Take a booking on it. Every time, before the fix: no reminder is scheduled, and
   nothing says so.

## Why it matters

Reminders are most of why a salon buys booking software. She turned them on, the
screen showed them on, and for the service most of her clients book they had never
been on. The gap is invisible from both ends: the rule set does not say which
services use it, and the service says nothing about reminders at all.

It is the shape that hides best — an absent row renders exactly like a correct one,
so there is nothing to notice.

## Where it lives

- [surfaces/scheduling/service-price.tsx](../../../apps/workbench/surfaces/scheduling/service-price.tsx) — `ServiceRules` (new)
- [surfaces/scheduling/setup-data.ts](../../../apps/workbench/surfaces/scheduling/setup-data.ts) — `reminderSummary`
- [surfaces/scheduling/policies-list.tsx](../../../apps/workbench/surfaces/scheduling/policies-list.tsx)
- `layReminders` in [packages/scheduling/src/notifications.ts](../../../../wizeworks/packages/scheduling/src/notifications.ts) — returns `[]` for a null policy

## The fix

**At the point of choice.** The field left "What it costs" for a section of its own,
**The rules it follows** — "What a customer agrees to when they book this, and what
reaches them before they turn up." The empty option now reads **"No rules — and no
reminders"**, and choosing it shows a warning rather than a hint:

> Nobody booking this gets a reminder. Reminders live in a rule set alongside
> deposits and cancellation terms, so a service with no rule set sends nothing
> before the appointment. Pick one, or make one under Booking rules.

Choosing a rule set says what that decision does, from data already in hand:

> No deposit · 24h cancellation notice · Reminder 1 day and 2 hours before. Change
> any of it under Booking rules.

**Where she manages them.** The Booking rules list grew a **Before the booking**
column, so "which of my rule sets actually reminds anybody" is answerable by
looking. Reminders are not a term a customer agrees to — they are what the product
does — so they get their own column rather than a clause in the summary.

## What the fix does not do

Attaching a rule set now does **not** retro-schedule reminders for bookings already
taken. The ledger is written inside the booking transaction, which is what makes a
confirmed booking and its reminders atomic, so a booking taken while the service had
no rules stays unreminded. That gap is now _visible_ rather than silent — see
[127](127-a-booking-never-says-whether-anyone-is-being-reminded.md) — but catching
those bookings up is a change to the scheduling engine with a real question attached
(does editing a rule set's offsets re-lay every future booking's reminders?), and
that is a decision rather than a repair.

## Confirmed by

> Re-ran act 9 as Nia. Opened _Cut and finish_: the new section shows the warning in
> full. Chose **Salon cancellation** and the line under the field became "No deposit
> · 24h cancellation notice · Reminder 1 day and 2 hours before". Saved. Did the same
> for the other six — five onto Salon cancellation, and the free _Colour
> consultation_ onto **Standard**, which asks the same notice without the $25 late
> fee. All ten of her live services now carry a rule set with reminders.
