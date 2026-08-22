# 098 — A place in her Bookings was called "Maison Élan"

**Status:** open
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › Bookings › Places
**Filed:** 2026-08-22
**Fixed:** — (Nia's own copy removed; the cause stands)
**Confirmed by:** —
**Blocked on:** decision — what a blueprint may write into a tenant's operating data

## What happened

Nia's Bookings module contains two places. One is hers. The other is called
**Maison Élan** — the demo salon the `sparx-salon-editorial` starter was written
around, created 0.4 seconds after her account existed, before she had answered a
single question about her own business.

```
Main location  2026-08-21 22:24:46.809+00
Maison Élan    2026-08-21 22:24:47.182+00
```

It is not a draft, a preview or a sample. It is a live row in the table her
booking page reads, it was marked **In use**, and it carried seven of the demo
services and three of the demo staff.

## Why this is different from placeholder page copy

The platform has a documented position on demo content, and it is a good one. It
lives in
[wizeworks/services/api-rest/src/lib/marketplace/blueprint-bundles.test.ts](../../../../wizeworks/services/api-rest/src/lib/marketplace/blueprint-bundles.test.ts):

> Placeholder prose on a page is fine — "Maeve began with two chairs" is visibly
> someone else's story, it sits on the screen the tenant opens first, and
> rewriting it IS the act of making the site theirs. An email is the opposite on
> every count: it lives in a surface they may never open, it reads as finished…

There is a mechanical guard enforcing exactly that for emails, keyed off each
blueprint's own `brand.businessName`, so a demo name can never reach a tenant's
mailing list.

**A scheduling location is on the email side of that line, not the page side**,
and nothing checks it:

| Test                                      | A page's prose | This location                                                  |
| ----------------------------------------- | -------------- | -------------------------------------------------------------- |
| Sits on the screen she opens first        | yes            | no — Bookings › Places, three levels in                        |
| Visibly somebody else's                   | yes            | no — it looks like a place she set up                          |
| Rewriting it is the act of making it hers | yes            | no — she has one salon and does not need a second place at all |
| Reaches a customer                        | when published | on any booking filed against it                                |

The reasoning that makes demo prose acceptable is the reasoning that makes this
unacceptable, and it was never applied here because the guard only ever looked at
emails.

## Why it matters

She has one salon. A second place, named after a business she has never heard of,
is not a starting point she edits — it is a row she has to work out the meaning of
before she can delete it. And until [097](097-her-bookings-said-two-places-were-in-use-by-people-she-had-deleted.md)
was fixed, the delete talked her out of it.

The blast radius is bigger than the name, too. Everything the blueprint installs
into Scheduling — resources, services, policies — is real operating data on day
one, and the whole set is somebody else's business until the owner clears it.

## How to reproduce

Every time, for any tenant whose starter site ships a booking flow.

1. Sign up, pick the salon look at onboarding.
2. `mypiggles` › Bookings › **Places**.

## Where it lives

The blueprint declares its own demo business, correctly:

```ts
brand: { businessName: 'Maison Élan', tagline: 'Considered hair, calmly done.' },
```

The installer renames the **site** with the tenant's name, so her header, footer
and wordmark all read Halo & Hem. It does not carry that rename into the rows it
writes, so the location — and the three stylists, and the seven services — keep
the names the pack was authored with.

## The fix

Not made, because it is a product decision with three defensible answers:

- **Name the location after the tenant.** The installer already knows the business
  name; a place created at install becomes "Halo & Hem" rather than "Maison Élan".
  Smallest change, and it makes the row read like something she set up.
- **Do not install a second place at all.** Provisioning already creates
  `Main location`; a blueprint attaching its services to that one instead leaves a
  tenant with exactly one place, which is what a one-salon business has.
  Cleanest, and it removes the row rather than renaming it.
- **Extend the email guard to operating data.** The mechanical check that already
  refuses `brand.businessName` in an email is extended to the rows a bundle
  installs — locations, resources, service names. Slowest, and the only one of the
  three that stops the next pack doing it again.

The second and third together are the honest fix. Renaming alone leaves three
stylists called Ava, Maya and Noor in her staff list.

## What Nia did

Removed **Maison Élan** from Places, renamed `Main location` to **Halo & Hem**,
set its timezone to Pacific and typed her real address into it. Recorded in act 5.

Two smaller things noticed on the same screen and not filed separately:

- **A new place defaults to `UTC`**, for a business whose owner has already told
  the product where she is. Hers said UTC until she changed it, and the field's own
  helper text says "this is what a customer is shown".
- **The latitude and longitude examples are `51.5072` / `-0.1276`** — central
  London, on a product priced in dollars.

## Rating effect

`Bookings › Places` is scored in [rating.md](../rating.md).
