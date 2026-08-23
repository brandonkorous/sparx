# 111 — The appointment does not know who it is for, so an allergy sits four screens away

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 7
**Surface:** mypiggles › Bookings › a booking
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on Priyanka's Friday color appointment 2026-08-22

## What happened

Act 7 asks for one thing in the client's own words: put Priyanka's ammonia
allergy on her record, and check it is **visible from the booking, not buried
three screens away**.

It is buried four screens away.

Her record took the note perfectly — CRM › Priyanka Deshmukh › Notes › Note,
saved onto her timeline with a time against it:

> ALLERGY: ammonia. Ammonia-free color line only — check every tube before
> mixing. She reacts within minutes.

Her **Full head highlights** appointment on Friday shows, in full: the service,
the status, when it is, who it is with, and the words `For Priyanka Deshmukh`.
That last is **plain text — not a link**. There is no route from the appointment
to the person it is for at all. Getting to the allergy means leaving the booking,
opening Customers, searching her name, opening the record, and choosing the Notes
tab.

## Why it matters

**Nia mixes color standing at that screen.** The appointment is what is open in
front of her at the moment the decision is made, and it is the one screen that
does not carry the fact that decides it. A note that is technically on file and
practically unreachable is worse than no note, because everybody believes it has
been dealt with.

It is not only allergies. Nothing the salon knows about the client reaches the
appointment: no phone number to ring when she is late, no email, no "third visit
this year", no previous color formula. A booking business's booking screen is
about the service and silent about the person.

## The data is already loaded

The pane calls `useCustomer(booking.customerId)` and uses the result for exactly
one thing — the display name
([surfaces/scheduling/bookings-detail.tsx](../../../apps/workbench/surfaces/scheduling/bookings-detail.tsx),
`const bookedCustomer = useCustomer(booking.customerId)`). Their email and phone
come back in the same response and are dropped on the floor.

So this is not a missing capability. The screen fetches the person and then does
not introduce them.

## The fix

**The appointment names who it is for, and says what is known about them.**

1. `For <name>` becomes a link that opens their record — one click, not four
   screens, and the same cross-link every other pane in the console offers.
2. A short block beside it: their phone and email (both already in hand), so the
   "she's late, ring her" case needs no navigation at all.
3. **Their notes, on the booking.** A client note is written precisely so it is
   read at the chair. It belongs where the appointment is, not one tab deeper on
   a different record.

The last one wants care rather than a dump of every note ever logged: the most
recent few, newest first, with a way through to the rest.

## What this is NOT

Not a request for a bespoke "allergies" field. A salon writes an allergy, a
plumber writes "dog in the yard", an accountant writes "prefers a call".
[[feedback_industry_agnostic_no_diesel]] — the general shape is "what we know
about this person, where we are about to serve them", and it is one block.

## Confirmed by

Re-run 2026-08-22. Priyanka's **Full head highlights** on Friday now opens with:

> **Who it is for** — What you know about them, where you are about to serve them.
> · **Open their record**
> Priyanka Deshmukh · priyanka.d@example.test
> **ALLERGY: ammonia. Ammonia-free color line only — check every tube before
> mixing. She reacts within minutes.**

The note is on the appointment, marked down the left edge in `warning`, above the
fold. **Open their record** puts her CRM pane up in one click.

The pane was 835 lines and could not take another block without breaking piggles
RULE #0.5, so it came apart on its own seams first — `booking-create.tsx`,
`booking-create-fields.tsx`, `booking-resource-picker.tsx`, `booking-manage.tsx`,
`booking-lifecycle.tsx`, `booking-editing.tsx`, `booking-endings.tsx`,
`booking-who.tsx` and `booking-money.ts`, none over 251 lines, with
`bookings-detail.tsx` left holding only the choice between taking a booking and
managing one.

## What is still open

`CustomerLite` gained `phone` — the API had always returned it and the type never
said so, which is why a booking could not show a number. Priyanka has none on
file, so her block shows an email and no phone; that is the record being thin,
not the block.

## Rating effect

`Bookings › a booking` is scored in [rating.md](../rating.md).
