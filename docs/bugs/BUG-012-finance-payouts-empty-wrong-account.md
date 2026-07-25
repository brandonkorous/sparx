# BUG-012 — Finance → Payouts shows "No payouts yet" despite real Stripe payouts

Status: **FIXED (code) 2026-07-25 — awaiting deploy**
Severity: **High** — a launch-critical finance surface reads empty for every sparx Pay
tenant whose `tenant.stripeAccountId` has drifted from their live Express account; the
merchant sees "No payouts yet" while real deposits are hitting their bank
Found: 2026-07-25, prod Finance→Payouts verification on `keen-cedar-6433` (v1.165.0)
Surfaces: `services/api-rest/src/lib/stripe-payouts.ts`,
`services/api-rest/src/routes/v1/finance/payouts.ts`

## Symptom

`Finance → Payouts` renders **"No payouts yet."** `GET /v1/finance/payouts` returns
`200 { data: [], total: 0 }`. But the tenant's connected Express account
(`acct_1TwbFDF5zEYX8zFH`) has **real Stripe `payout` objects** — e.g.
`po_1TvoCNFY8gqB2fvj2JdOOKzs` ($100.90, automatic, `status: paid`, to a bank account).
Verified via the Stripe API (`GetPayouts` with `stripe_account: acct_1TwbFDF5zEYX8zFH`).

Two corroborating probes (authenticated, in-session):

- `GET /v1/finance/payouts/po_1TvoCNFY8gqB2fvj2JdOOKzs` → **404 "Payout not found"**.
  `getConnectedPayout` retrieves the payout against the resolved account; a real payout
  404s only if the resolved account is **not** the one the payout lives on.
- `GET /v1/finance/payouts/sparx_pay~2026-07-26` → **200** with the derived deposit for
  O-000003 ($30). So the **derived model has data** — the list is hiding it.

## Root cause — TWO compounding defects

**1. Wrong account source (primary).** `stripe-payouts.ts` resolves the connected
account from **`tenant.stripeAccountId`** (the root Tenant column):

```ts
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { stripeAccountId: true },
});
return tenant?.stripeAccountId ?? null;
```

But the **live** sparx Pay Express account is stored in the **payment secret store**,
which is where the charge path reads it (`gateways/sparx-pay.ts` → `merchantAccountId`):

```ts
getPaymentSecretReader().read(credentialRef(tenantId, SPARX_PAY_ID, 'stripe_account_id'));
```

These have **diverged**. `tenant.stripeAccountId` holds a stale/old account (a relic of
the Standard→Express onboarding migration, docs/94 ADR — the old Standard-OAuth path used
to write this column) that is non-null but has no payouts, while charges correctly settle
to `acct_1TwbFDF5zEYX8zFH` from the secret store. So payouts query the **wrong account** →
`stripe.payouts.list` returns `[]`, and the detail `retrieve` throws → 404. `getPaymentConfig`
(also secret-store-backed) reports the correct account + `payoutsEnabled: true`, so the UI
looks configured while payouts read empty.

**2. Empty result blocks the derived fallback (secondary).** In the list route:

```ts
const real = await listConnectedPayouts(auth.tenantId, 100); // ConnectedPayout[] | null
if (real) {                     // <-- an EMPTY ARRAY is truthy
  return paged(real.filter(...).slice(...), ...);   // returns [] — never reaches derived
}
```

Even once the account source is fixed, a sparx Pay tenant with a connected account but
**zero payouts so far** (brand-new, or between settlement cycles) would still show an empty
list instead of the derived in-transit deposits that approximate money on the way. The
guard must fall through to derived when the real list is empty, not just when it is null.

## Fix

1. **Resolve the account from the same source charges use.** `connectedAccountId` in
   `stripe-payouts.ts` now reads `getPaymentSecretReader().read(credentialRef(tenantId,
SPARX_PAY_ID, 'stripe_account_id'))` (catching `PaymentSecretNotFoundError` → `null`),
   exactly like `SparxPayGateway.merchantAccountId`. Payouts now read from the account
   money actually settles to — `tenant.stripeAccountId` is no longer consulted here.
2. **Fall back to derived on an empty real list.** The list route now only short-circuits
   to the real payouts when `real` is **non-empty**; an empty real result falls through to
   the derived model so in-transit deposits still show. (The detail route already 404s a
   `po_` id cleanly and has no derived equivalent, which is correct.)

No schema change. Both files are api-rest-local.

## Verify after deploy

- `GET /v1/finance/payouts` on `keen-cedar-6433` returns the real `po_…` payouts
  (`po_1TvoCN…` etc.), and `GET /v1/finance/payouts/po_1TvoCN…` returns its detail with the
  settled sales — no more 404.
- A sparx Pay tenant with a connected account but no Stripe payouts yet shows the derived
  in-transit deposits (e.g. `sparx_pay~<date>`), not an empty list.
- A non-sparx-Pay tenant (Square/manual) is unaffected — still the derived model.
