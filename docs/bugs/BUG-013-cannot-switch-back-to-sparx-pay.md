# BUG-013 — Can't switch back to sparx Pay after choosing another provider

Status: **FIXED (code) 2026-07-25 — awaiting deploy**
Severity: **Medium** — a merchant who tries another gateway is stranded off sparx Pay;
the platform also silently stops earning its 0.5% because the merchant can't return
Found: 2026-07-25, prod payment-provider verification on `keen-cedar-6433` (v1.167.0)
Surface: `services/api-rest/src/lib/payments-onboarding.ts` (`getPaymentConfig`)

## Symptom

A tenant with a fully-onboarded, healthy sparx Pay Express account switches the active
gateway to another provider (e.g. "Your own Stripe" / `stripe_direct`). Now the **Payment
providers → sparx Pay** pane shows **"Details still needed — sparx Pay is waiting on the
rest of your details before it can take payments"** with a **"Continue setup"** button —
**no "Make this my active provider" button.** So the merchant cannot switch back to sparx
Pay through the UI, even though the connected account is perfectly chargeable.

`GET /v1/commerce/payments/config` returns, while another gateway is active:

```json
"sparxPay": { "accountId": "acct_1TwbFDF5zEYX8zFH",
              "chargesEnabled": false, "payoutsEnabled": false, "detailsSubmitted": false }
```

…but Stripe's own account object says `charges_enabled: true`, `payouts_enabled: true`,
`details_submitted: true`, zero requirements due. The app is reporting the account as
unfinished when it is fully ready.

## Root cause

`getPaymentConfig` only fetches the **live** Stripe account status when sparx Pay is the
**active** gateway:

```ts
if (config.gatewayId === 'sparx_pay' && accountId) {
  const live = await fetchAccountStatus(accountId);
  if (live) {
    sparxPay = { accountId, ...live };
    isActive = live.chargesEnabled;
  }
}
```

When another gateway is active, the `sparxPay` block keeps its default
(`chargesEnabled/payoutsEnabled/detailsSubmitted = false`). The Payment providers pane
reads those `false`s and renders the "not finished / Continue setup" state, which has no
"Make this my active provider" affordance — a one-way door off sparx Pay.

(`refreshSparxPayStatus` (`GET /v1/commerce/payments/sparx-pay/status`) doesn't help while
inactive for the same reason, so a status refresh doesn't unstick it either.)

## Fix

Fetch the live account status whenever a connected **account exists**, regardless of which
gateway is active, so the `sparxPay` block always reflects the account's true readiness and
the pane can offer "Make this my active provider" for a healthy account. The `isActive`
override still only follows sparx Pay's `charges_enabled` when sparx Pay is the active
gateway — so a tenant on `stripe_direct` isn't mis-reported as "collecting via sparx Pay".

## Workaround (used this session)

The `POST /v1/commerce/payments/gateway { gatewayId: 'sparx_pay' }` endpoint (what the
"Make active" button calls) does **not** gate on the mis-computed status, so switching back
via the API works and self-heals the display (the now-active gateway gets live-checked).

## Verify after deploy

- Onboard sparx Pay, switch to another provider, reopen Payment providers → sparx Pay:
  it shows the account as ready with a **"Make this my active provider"** button (not
  "Continue setup"), and clicking it restores sparx Pay.
- A tenant actually on `stripe_direct` still reports `isActive`/"collecting" for
  stripe_direct, not sparx Pay.
