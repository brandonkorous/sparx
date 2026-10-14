# 220 — A fleet buyer's confirmation said "Due on collection" for an order billed to her account

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 11, on the other side (the email, read in `.dev-outbox`)
**Surface:** the order confirmation email
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01, 2026-10-11 (see below)
**Blocked on:** —

## What happened

Renée ordered S&B's cleaning kit on Wasatch Front's account (30 days to pay), to be
shipped by UPS Ground (O-000026). Her confirmation email ended its money table with:

> Total $43.27 · **Due on collection $43.27**

Nothing is being collected: it is shipped. Nothing is due at a handover: it is billed to the
account, and the invoice email that came with it said "due by November 10, 2026".

## What should have happened

The row only where it is true: an order the customer collects and pays for when they do
(a made-to-order piece with a deposit, issue 026). Not for an order billed to an account,
and not for one that is shipped.

## How to reproduce

1. Any order on account terms, or any shipped order not yet paid.
2. Read its confirmation email. Every time.

## Why it matters

Money words that are false, in the customer's inbox, next to an invoice that says otherwise.
A fleet's accounts team reads both.

## Where it lives

`wizeworks/services/api-rest/src/lib/email-data.ts` `resolveOrder`: `balanceDue` is total
minus paid for every order; the template labels it "Due on collection"
(`builder-schemas` `default-emails-silica.ts`).

## The fix

- `services/api-rest/src/lib/collection-balance.ts` `dueOnCollectionCents`: only for an
  order the customer collects and nobody bills to an account.
- `lib/email-data.ts` binds `order.balanceDue` through it (terms from the order's
  `paymentTermsRequested`).

Shared: every brand's order emails. Tests, red first: `collection-balance.test.ts` (5).
Lint clean.

## Confirmed by

P01, 2026-10-11, reading Renée's real confirmation for O-000027 in `.dev-outbox` (08:59):
"Total $28.41", then "Shipping to", with no "Due on collection" row. O-000026's, sent
before, had "Due on collection $43.27".

## Rating effect

—
