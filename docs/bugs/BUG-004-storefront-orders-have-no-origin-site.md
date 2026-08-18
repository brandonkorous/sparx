# BUG-004 — Storefront orders carry no origin site, so the merchant's money is invisible

Status: **✅ FIXED — VERIFIED IN PRODUCTION 2026-07-24**
Severity: **Critical** — a merchant takes real money and Finance → Payments reads "No payments yet"
Found: 2026-07-24, production payments E2E (order `O-000002`, tenant `keen-cedar-6433`)
Surfaces: `wizeworks/services/api-rest/src/routes/v1/public/cart.ts`, `wizeworks/packages/commerce/src/services/checkout-service.ts`

## Symptom

`O-000002` was paid — the order pane shows **Paid**, "Money in: $25.00 · sparx_pay ·
Taken". But **Finance → Payments showed "No payments yet"**, and Payouts likewise had
nothing to attribute.

## Root cause

The order is created with **`propertyId: null`**, even though it was placed on the
storefront (`channel: storefront`, `source: commerce_checkout`).

`GET /v1/finance/payments` gates on the payment's ORDER being in scope:

```ts
const orderWhere = { ...(scope ? { propertyId: scope } : {}) };
const where = { ..., order: orderWhere };
```

The workbench always has a site active, so `scope` is that site's id, and a null-site
order can never match. Proof: the identical request with `?property=all` returns the
payment immediately.

Why the order had no site: wizeworks/apps/site's `resolveActivePropertySlug()` returns **null for
the PRIMARY site by design** — the storefront identifies the primary site by the
_absence_ of `?property=`. So `POST /v1/public/commerce/cart` received no property slug
and deliberately stored `propertyId: null` ("we never default to primary so a multi-site
cart is never mis-tagged"), and `complete()` copied that null onto the order.

That reasoning was half-right: an UNKNOWN slug shouldn't be mis-tagged onto primary, but
"no slug at all" is precisely how the primary site announces itself. The rest of the
codebase already treats it that way — `defaultCurrency()` in the same file resolves
no-property → primary, and `ensureCheckoutCustomer()` does too, commenting _"the primary
site sends no `?property=`"_. So the CUSTOMER was being attached to the primary site
while the ORDER beside it was left site-less.

Net effect: **every primary-site order** — i.e. every order for every single-site
tenant — is invisible in every site-scoped money view.

## Fix

1. **Cart creation (root cause)** — when no `?property=` is supplied, resolve the
   tenant's primary site instead of storing null. A genuinely unknown slug still
   resolves to null rather than being mis-tagged, which is the case the old comment
   was actually guarding.
2. **`checkout-service.complete()` (backstop)** — resolve `originPropertyId` once
   (`cart.propertyId ?? primary`) and stamp it on BOTH the customer and the order, so
   carts opened before the fix, and any non-storefront caller, still produce
   site-attributed orders.

## Verify after deploy

- Place a storefront order → `GET /v1/orders/:id` shows a non-null `propertyId`.
- Finance → Payments lists it **with the site selected** (not only under "all sites").
- Existing orders placed before the fix keep `propertyId: null` and remain visible only
  in the all-sites view — backfilling those is a separate decision.

## Verified in production 2026-07-24

New order **O-000003** came out with `propertyId: 2eed718f-…` (the primary site),
and `GET /v1/finance/payments` **scoped to that site** returned it —
`{ order: O-000003, amount: 30, status: captured }`. Before the fix that same
site-scoped call read "No payments yet."

As predicted, the pre-fix orders **O-000001 / O-000002** still carry
`propertyId: null` and surface only under the all-sites view. Backfilling those two
is optional and left as a separate decision (only two rows, both in a sandbox tenant).
