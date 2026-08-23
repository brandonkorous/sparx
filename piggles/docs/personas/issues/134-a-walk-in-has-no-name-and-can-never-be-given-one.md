# 134 — A walk-in has no name, and can never be given one

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › Bookings › Take a booking, and the booking that results
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Act 10's third job was "add a walk-in". The form invites exactly that, in its own
words:

> **Who it is for**
> Link the customer this is booked for… **Leave it blank for a booking with no
> account — a walk-in you are writing down.**

There was nothing to write it in. Leave the customer blank and the booking is
taken, and from that moment on the person who walked in is called **"No one
assigned"** — in the list, in the diary, for ever. Nia can say the name out loud
to the chair beside her and Piggles has nowhere to put it.

It could not be repaired afterwards either. Four separate doors, all shut:

- **The create form** has a customer picker and no name field.
- **The customer picker** cannot make a customer: type a name that is not in the
  book and it says "No one matches that. Try a different word."
- **`addAttendee`** throws `This booking is not a class session` for anything
  that is not a class, so the `guestName` column an appointment already has can
  never be filled through the API.
- **`UpdateBookingInput`** has no `customerId`, so a booking's customer is set at
  creation and can never be attached later — not even when the walk-in turns out
  to be Rob, who has a record.

And the booking pane said nothing about any of it: `BookingWho` returned `null`
when there was neither a customer nor a guest name, so the pane looked like a
complete record of a booking it could not say one thing about the person for.

## Why it matters

A walk-in is not an edge case in a two-chair salon; it is a Saturday. The product
asked for the name in its own copy and then dropped it on the floor, which is
worse than never asking — Nia types nothing, assumes it does not matter, and the
row that comes back says "No one assigned" beside the customers whose names are
right there.

It is also the shape this repo keeps meeting: `bookingWhoLabel` already READS
`attendees[0].guestName`, and the seeded bookings all have one. The field, the
column and the renderer were all in place. Nothing could write it.

## Where it lives

- [surfaces/scheduling/booking-create-who.tsx](../../../apps/workbench/surfaces/scheduling/booking-create-who.tsx) (new)
- [surfaces/scheduling/booking-create.tsx](../../../apps/workbench/surfaces/scheduling/booking-create.tsx)
- [surfaces/scheduling/booking-who.tsx](../../../apps/workbench/surfaces/scheduling/booking-who.tsx)
- [surfaces/scheduling/booking-notices.tsx](../../../apps/workbench/surfaces/scheduling/booking-notices.tsx), [booking-manage.tsx](../../../apps/workbench/surfaces/scheduling/booking-manage.tsx)

## The fix

**A name field, where the copy already promised one.** "Who it is for" moved into
its own file and grew an **Or just their name** field, shown only while no
customer is chosen — with a customer picked it disappears rather than inviting a
second, competing name for the same person. It sends one attendee carrying the
name, which `CreateBookingInput` has always accepted.

> **Or just their name**
> _Tomás from next door_
> For a walk-in with no account. It shows on the booking and in your diary, and
> it does not create a customer record.

**The pane says when there is nobody.** `BookingWho` no longer returns null:

> **Who it is for** — Nobody is recorded on this booking.
> It was taken without an account and without a name, so nothing about it can
> reach anyone and it will not appear on anybody's record. You can write who it
> was in the private note below.

**"What reaches them" stops addressing a customer who does not exist.** It used
to say "everything this customer is told" and "nothing was ever sent to this
customer" about a booking with no customer, which reads as a delivery failure
rather than as there being nobody to deliver to. The split is on whether there is
an ACCOUNT, not whether there is a person — `reachableChannels` in the scheduling
engine returns nothing without a `customerId`, so a walk-in written down by name
is as unreachable as an empty booking, and the pane now says why:

> Nothing was sent and nothing will be. Confirmations and reminders go to the
> email or phone on a customer's record, and this booking has no account attached
> — a name written on it is not an address.

## What the fix does not do

It does not let a booking's customer be **changed** after the fact.
`UpdateBookingInput` still has no `customerId`, so a walk-in who turns out to be
a regular cannot be linked to their record retrospectively. That is a scheduling
engine change with a real question attached — what happens to the confirmation
and the reminders when an account arrives after the booking was taken? — and it
is a decision rather than a repair.

## Confirmed by

> Re-ran act 10 as Nia on the phone. Took a walk-in for a Dry cut at 6 PM, typed
> "Tomas Herrera" in the new field, pressed Take booking. The pane header reads
> "With Nia Okafor · **For Tomas Herrera**" and the Who section names him. The
> list shows "Dry cut · Appointment · Tomas Herrera" one row above the earlier
> nameless walk-in, which still reads "No one assigned" — as it should, since
> nobody ever wrote one down.
