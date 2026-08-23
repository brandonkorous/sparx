# 152 — The salon has two of her, and the appointment is on the one she cannot see

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · standing check — the buyer's side
**Surface:** haloandhem.com › Book, then Account › My bookings; and mypiggles › Customers
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Imani Reyes booked a blow dry on Nia's website the way anyone does: name, email,
phone, pick a time. She got the confirmation.

> **You're booked**
> Blow dry with Nia Okafor is confirmed for Tuesday, August 25 at 3:00 PM. A
> confirmation is on its way to imani.reyes@example.com.

Then she made an account, using **the same email address she had just booked
with**, and went to her bookings.

> **My bookings**
> You have no upcoming bookings.

So she booked again — this time signed in, on her own account, with her own
email in the form. Same result.

> **My bookings**
> You have no upcoming bookings.

Two appointments in Nia's diary and an empty page in front of the woman who made
them both.

On Nia's side it is worse than empty. Her customer list now reads:

> Imani Reyes · imani.reyes@example.com · Lead
> Imani Reyes · imani.reyes@example.com · Lead

Two rows, same name, same address, adjacent, nothing marking them as the same
person. One holds the appointments. The other holds the login.

## Why it happened

`customers.property_id` is the site a customer belongs to, and NULL means
"belongs to the business, not to any one site". The public booking form never
set it, so the customer it created for Imani came out global.

Registering an account resolves the per-site membership in
`ensureMembership` (`wizeworks/packages/customer-auth/src/membership.ts`). It
looks for an existing guest row to adopt:

```ts
const guest = await tx.customer.findFirst({
  where: { propertyId, email, authUserId: null, deletedAt: null },
```

`propertyId` there is the site she signed in on. Imani's booking row had NULL.
NULL is not that site, the adoption missed, and a second customer was created.

The design was right and one path did not follow it: the schema's own comment
says the console's create route defaults a new customer to the active site. The
booking form was the one door that did not, so **ten of this salon's eleven
customers had no site on them** — every client from every act, plus Dara's
chair-rent record. Each of them was one registration away from being duplicated.

Booking while signed in failed for a second, smaller reason: `findOrCreateCustomer`
matches on the email in the form and never looks at who is signed in. The session
is a fact and the typed email is a guess, and it was using the guess.

## The fix

Three parts, because the hole had three edges.

**The site gets written down.** `findOrCreateCustomer` in
`services/api-rest/src/routes/v1/public/scheduling.ts` now takes the service's
`propertyId` — the same value `createBooking` already stamps on the booking
itself — and puts it on the customer it creates. A booking made through a site
now belongs to that site, like everything else made there.

**The signed-in customer wins over the typed email.** When a booking comes in
with a customer session on it, that customer is used directly. Nobody is matched
by a string when the answer is already known.

**An absent site stops reading as a different one.** `ensureMembership` now also
adopts a guest row that belongs to no site, and stamps the site onto it as it
does. Signing in on a site is evidence of belonging to it, so the row is
completed rather than duplicated. A row already claimed by a *different* site is
still left alone, which is what keeps docs/58 D6 true: a first sign-in on a
sister site still gets a fresh membership and fresh consent.

The ten rows already written global are repaired by
`20270406000000_customers_belong_to_the_site_they_came_from`, which fills
`property_id` **only for tenants that have exactly one site** — where there is no
guess to make. A multi-site tenant's global customers are left global, because
there the absence might be the truth.

## Still open

Nia's two Imanis are not merged by this. Merging live customer records is her
decision, not a migration's, and the console has a merge tool for it. What the
fix guarantees is that it stops happening.

## Confirmed by

Re-run as Imani on `haloandhem.com`, after the fix, with a fresh client:

- Booked as a guest, made an account with the same address, and the appointment
  was on the account. One customer row, not two.
- Booked again while signed in; it landed on the same record.
- Nia's Customers list shows the client once.
