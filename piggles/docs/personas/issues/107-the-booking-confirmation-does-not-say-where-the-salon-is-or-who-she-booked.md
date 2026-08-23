# 107 — The booking confirmation does not say where the salon is, or who she booked

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 6
**Surface:** the published site — the confirmation step of the booking widget
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · two clients · on the live site and in the downloaded `.ics` 2026-08-22

## What happened

Act 6 asks one question of the confirmation: **does it say where, when, and what
happens next?** Margot booked a cut with Nia and got this, in full:

> **You're booked**
> Cut and finish is confirmed for Thursday, August 27 at 2:00 PM. A confirmation
> is on its way to margot@example.test.
> Add to calendar · Google · Outlook · Apple / .ics

| The question          | The answer                                         |
| --------------------- | -------------------------------------------------- |
| **When**              | yes — Thursday, August 27 at 2:00 PM               |
| **What happens next** | yes — an email is coming, and three calendar links |
| **Where**             | **no**                                             |
| **Who**               | **no**                                             |

## Why it matters

**Where.** Margot has never been to this salon. The one thing she needs at 1:55 PM
on Thursday is `214 Bower Street, Suite B` — and the confirmation does not carry
it. The address is in the footer of the same page, which is not the same as being
in the thing she screenshots or forwards to herself. The `.ics` file is the other
place it should be and the place she is most likely to actually have on the day.

**Who.** She has just chosen a stylist — the picker
([104](104-a-two-chair-salon-could-not-let-a-client-choose-their-stylist.md)) is
directly above this message. A confirmation that does not name Nia leaves her
unsure the choice took, and it is the whole point of the feature: "you book a
person, not a slot" is only true if the receipt says which person.

For this business it is the difference between a confirmation and a receipt. A
salon's confirmation is read twice — once now, once in the car.

## How to reproduce

Every time. Book anything on any tenant's site and read the confirmation panel.

## Where it lives

[wizeworks/apps/site/components/booking/booking-widget.tsx](../../../../wizeworks/apps/site/components/booking/booking-widget.tsx)
— the confirmation branch. It has `service.name`, the start time and the customer's
email, and prints exactly those. The booking response it is rendering already
carries more than it uses, and the site already knows the address: it is
`site.identity.address`, the same value the footer and the contact page bind to.

The chosen resource is in the widget's own state (`chosenResourceId`) and in the
`providers` list it drew the picker from, so the name needs no extra request.

## The fix

**One resolver, read by all three surfaces**, so they cannot come apart:
[booking-receipt.ts](../../../../wizeworks/packages/scheduling/src/booking-receipt.ts)
answers "where is this booking, and who is it with" once.

`findBookingPlace` takes the booking's own location, else the one its service is
filed under, else — when the business has exactly ONE active place — that one.
The last step is what made this worth doing at all: **Nia's `location_id` is null
on every row she owns**, because a two-chair salon never picks a location
anywhere, so a stricter reading would have left the confirmation silent about an
address she had already typed into Places. With two or more places and none
named it returns null, because sending somebody to the wrong branch is worse than
saying nothing.

1. **The confirmation panel** now names the person in the sentence itself, and
   puts the address on its own line beneath it, in an `<address>` element so a
   screen reader announces it as one.
2. **The `.ics`** carries the address in `LOCATION` — the field a phone shows on
   the day and a maps app routes on. It carried the place's NAME before, which is
   the one thing the customer already knew.
3. **The confirmation email**'s "Location" row reads the same line. It was
   already in the template, and was already conditional — and it had been
   rendering EMPTY all along for exactly the reason above, so the row simply
   never appeared.
4. **The customer portal's** "Add to calendar" links carry it too, so a booking
   re-added to a calendar a week later is not missing what the first one had.

**Null rather than a name.** When no address is on file, the customer-facing
answer is nothing at all: telling somebody who has never been to Halo & Hem that
their appointment is at "Halo & Hem" is an absence dressed as an answer
([[feedback_never_present_absence_as_measurement]]).

## Confirmed by

Re-run 2026-08-22, as a client booking a cut with Nia on the live site:

> **You're booked**
> **Cut and finish with Nia Okafor** is confirmed for Saturday, August 22 at 3:00 PM.
> A confirmation is on its way to yusuf@example.test.
> **Halo & Hem, 214 Bower Street, Suite B, Sacramento, CA 95811, United States**

And the `.ics` that confirmation offers, fetched from its own signed link:

```
DTSTART:20260822T220000Z
SUMMARY:Cut and finish
DESCRIPTION:With Nia Okafor
LOCATION:Halo & Hem\, 214 Bower Street\, Suite B\, Sacramento\, CA 95811\, United States
```

**What is NOT proven on a screen:** the email body. `email.send` is a logged
no-op in dev and no rendered body is kept — the ledger shows the confirmation
dispatched (`sent`, both email and SMS) and `email_events` records it accepted,
but nothing stores what it said. What CAN be said precisely is that the email's
Location row is fed by the same `findBookingPlace` call whose output was read
above, out of the `.ics` — one function, one value, three readers. The absence of
any way to read a rendered transactional email in development is worth its own
attention and is not recorded here.

## Rating effect

The published booking page is scored in [rating.md](../rating.md).
