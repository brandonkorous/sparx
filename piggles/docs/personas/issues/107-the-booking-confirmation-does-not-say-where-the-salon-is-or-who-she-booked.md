# 107 — The booking confirmation does not say where the salon is, or who she booked

**Status:** open
**Severity:** major
**Found by:** P02 · Halo & Hem · act 6
**Surface:** the published site — the confirmation step of the booking widget
**Filed:** 2026-08-22
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope — the confirmation is a shared widget, and the same words go into the email nobody can read in dev

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

Not made in this run — it is one widget shared by every tenant, and the same
sentence belongs in three places that should not drift apart:

1. **The confirmation panel** — add the address, and "with Nia Okafor" when a
   resource was chosen.
2. **The `.ics` file** — its `LOCATION` field is what a phone shows on the day and
   what a maps app will route to.
3. **The confirmation email** — the one a customer keeps. Not verifiable in dev
   (`email.send` is a logged no-op), so changing it here without being able to read
   the result is how a template ships broken.

Doing one and not the others is what makes a business's own details disagree with
each other, which is a defect this run has already filed twice
([089](089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md),
[094](094-the-blocks-for-how-to-reach-us-shipped-a-strangers-phone-number.md)).
Bind all three to Site identity in one change, and confirm the email by reading
what the worker renders.

## Rating effect

The published booking page is scored in [rating.md](../rating.md).
