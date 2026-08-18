# BUG-012 — Finance → Payouts showed nothing while real payouts were still pending

Status: **CORRECTED 2026-07-25 — original diagnosis was wrong; real fix is the derived fallback**
Severity: **Low** (was filed High on a mistaken premise)
Found: 2026-07-25, prod Finance → Payouts verification on `keen-cedar-6433` (v1.167.0)
Surfaces: `wizeworks/services/api-rest/src/routes/v1/finance/payouts.ts`,
`wizeworks/services/api-rest/src/lib/stripe-payouts.ts`

## What actually happened (corrected)

`Finance → Payouts` read **"No payouts yet"** on a sparx Pay tenant. I initially
concluded the endpoint was resolving the **wrong connected account** and hiding real
Stripe `po_…` payouts — and "fixed" it by resolving the account from the payment
secret store instead of `tenant.stripeAccountId`.

**That diagnosis was wrong.** The `po_…` payouts I took as proof of "real payouts on
the merchant account" (`po_1TvoCN…` $100.90 paid) are on the **sparx PLATFORM account**,
not the merchant's connected account — their `destination` is the platform's bank
(`ba_1Tn6bk…`), and the connected account's own bank is `ba_1TwgBi…`. The Stripe MCP was
ignoring the `stripe_account` scoping argument and returning platform data for every
query, which is what misled the whole investigation.

The merchant's connected account (`acct_1TwbFDF5zEYX8zFH`) has **no real Stripe payouts
yet** — its funds are all _pending_ (balance: $140.82 pending / $0 available; the daily
payout hasn't executed). So `stripe.payouts.list` correctly returned empty, and "No
payouts yet" was essentially **correct**.

`tenant.stripeAccountId` was **never stale** either: `getPaymentConfig`, the sparx-Pay
balance endpoint, and the status refresh all resolve the account from it
(`payments-onboarding.ts` `tenantAccountId`), and it returns the right
`acct_1TwbFDF5zEYX8zFH`. The account source was fine all along.

## The one real (minor) fix that stays

When sparx Pay is the active gateway and the connected account has **no real Stripe
payouts yet** (brand-new, or between settlement cycles), the list should still show the
**derived in-transit deposits** (money on the way) rather than an empty list. The route
guarded the real path with `if (real)` — and an **empty array is truthy**, so it returned
`[]` and never fell through to the derived model. Changed to `if (real && real.length > 0)`
so an empty real result falls through to derived. That's the whole fix.

The account-source change (secret store) has been **reverted**: `connectedAccountId` reads
`tenant.stripeAccountId` again, matching `getPaymentConfig` and the rest of the finance
surface. Reading a second copy from the secret store was unnecessary and diverged from the
canonical source.

## Lesson

Don't trust a Stripe MCP read's `stripe_account` scoping — verify which account an object
belongs to by its own fields (here, `destination` bank account) before concluding it
belongs to a connected account. The entire "wrong account" theory rested on that
unverified assumption.

## Verify after deploy

- On a sparx Pay tenant whose connected account has no payouts yet, Finance → Payouts
  shows the derived in-transit deposits (e.g. `sparx_pay~<date>`), not an empty list.
- Once the connected account executes a real Stripe payout, the list shows the real
  `po_…` deposit (resolved via `tenant.stripeAccountId`, the same account charges settle to).
