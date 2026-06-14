# Sparx Platform — Stripe Integration Map & Go-Live Tracker

**Version:** 1.3
**Author:** Brandon Korous
**Last Updated:** 2026-06-13

---

> **⚠️ Superseded for COMMERCE payments (Part B) and the transaction fee.**
> The commerce payment architecture in this doc — `@sparx/provider-stripe`, the
> per-installation webhook B-G1, the Sparx Pay Connect onboarding B-G2.1 — has been
> **rebuilt** as the vendor-agnostic `@sparx/payments` gateway. See
> [docs/94-ADR-payment-gateway.md](94-ADR-payment-gateway.md), the authority for
> everything tenant→shopper.
>
> The **Phase 7 tiered transaction fee** — `recordTransactionFee`, `meterOrderFee`, and
> the `transaction_fee` meter — has been **removed**. There are no tiers, only modules,
> so the only platform payment fee is **Sparx Pay's flat 0.5%**, collected at charge
> time via Stripe `application_fee_amount` and recorded on `payment_intents.platform_fee`
> (docs/94 §8).
>
> **Part A below — platform module billing (`@sparx/billing`) — remains current**, minus
> the fee rows.

## Purpose

The single source of truth for **Part A platform module billing** (`@sparx/billing`,
WizeWorks→tenant) — what's built, what's left, and the exact ops to go live. It
inventories every Stripe object we need, maps what the connected account has today, and
sequences the remaining code + ops into checklists. When an item lands, flip its box
here. (Commerce payments — Part B — now live in docs/94.)

**Connected account at evaluation time:** `acct_1TgMUkCP0shAXvn5` — _Sparx sandbox_
(test mode). Empty: 0 products, 0 prices, 0 billing-portal configurations.

Status legend: ✅ done · 🟡 partial (built with a known gap) · ⬜ not started ·
🔧 manual ops (Brandon, not code).

---

## Two Stripe integrations at a glance

The platform talks to Stripe in **two completely separate ways**. They share no keys,
no account, and no code path — conflating them is the classic footgun.

| Dimension      | **A · Platform billing**                            | **B · Commerce payments** (now docs/94)                                                  |
| -------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Who pays whom  | tenant → **WizeWorks** (us)                         | shopper → **tenant**                                                                     |
| Stripe account | one platform account (`STRIPE_SECRET_KEY`)          | Sparx Pay = platform account (Connect destination charges); Stripe Direct = tenant's own |
| Code           | `@sparx/billing`                                    | `@sparx/payments` (gateway abstraction — docs/94)                                        |
| What           | per-module subscriptions                            | Sparx Pay / Stripe Direct at checkout + invoice pay-links + B2B card                     |
| API version    | `2024-11-20.acacia`                                 | `2024-11-20.acacia`                                                                      |
| Webhook        | `…/v1/public/webhooks/stripe/billing`               | `…/v1/public/webhooks/{sparx-pay,stripe-direct}`                                         |
| Status         | engine built; **not yet provisioned/live** (Part A) | re-architected on `@sparx/payments` — see docs/94                                        |

Platform fee: the only payment fee is **Sparx Pay's flat 0.5%**, taken at charge time
via `application_fee_amount` (docs/94 §8). There is no metered transaction fee.

---

# Part A — Platform billing (WizeWorks charges tenants)

## 1. Status dashboard

| Area                                           | Status | Note                                                                                                                             |
| ---------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------- |
| Billing engine (`@sparx/billing`)              |   ✅   | Customer/subscription sync, webhook reconcile, portal, state read — built                                                        |
| ~~Phase 7 transaction fee~~                    |   ❌   | **REMOVED** — no tiers, only modules. Sparx Pay's flat 0.5% (charge-time `application_fee`) is the only payment fee (docs/94 §8) |
| Module Products + Prices in Stripe             |   ⬜   | 10 products, ~19 prices — none exist yet (§4)                                                                                    |
| Billing **webhook endpoint** + secret          |   ⬜   | None — subscription/invoice events won't reach us (§6)                                                                           |
| Billing **portal configuration**               |   ⬜   | None — `POST /v1/billing/portal` will error until one exists (§6)                                                                |
| Secret Manager values                          |  🔧⬜  | `STRIPE_SECRET_KEY`, price IDs, webhook secret (§7)                                                                              |
| DB migration `20260813000000_platform_billing` |   ⬜   | Author-complete; not yet applied via DB Migrate workflow                                                                         |
| `syncModuleItems` cancel-on-empty              |   ✅   | One item per billable module; cancels the subscription when the last module is disabled (no fee anchor)                          |
| Phase 3 trial banner / choose-plan             |   ✅   | C4 — trial/past-due/cancel banner; plan+interval switch via portal `subscription_update`                                         |
| Phase 8 enterprise provisioning                |   ✅   | C5 — Enterprise dashboard card + `settings.billing.planType` flag + runbook (§10)                                                |
| Stripe-flow behaviour tests                    |   ✅   | `service.behavior.test.ts` mocks Stripe+DB: subscription create, cancel-on-empty, reconcile flags                                |

---

## 2. Phase 7 evaluation — transaction-fee metering · ❌ REMOVED

> This section is **historical**. The tiered transaction fee was removed (no tiers,
> only modules). The only payment fee is now Sparx Pay's flat 0.5% via
> `application_fee_amount` (docs/94 §8). `recordTransactionFee`, `meterOrderFee`, the
> `transaction_fee` meter, and the fee subscription item no longer exist. The original
> evaluation is preserved below for context.

**What was built** (this session, present on `feat/invoicing-standalone-pricing-and-aging`):

- `recordTransactionFee({ tenantId, orderTotalCents, identifier })` in
  `packages/billing/src/service.ts` — derives the tier from the tenant's **explicit**
  billable-module mix (0.5% Commerce / 0.3% with CRM / 0% once monthly spend ≥ $299),
  computes `feeCents = round(orderTotalCents × rate)`, and emits
  `stripe.billing.meterEvents.create({ event_name: 'transaction_fee', payload: { value, stripe_customer_id }, identifier: 'txfee_<orderId>' })`.
- `meterOrderFee()` helper in `services/api-rest/src/lib/transaction-fee.ts` — resolves
  the order's grand total and calls the engine, guarded + best-effort.
- Wired at **both** `order.placed` emit sites: site checkout `/complete`
  (gated on a new `freshlyPlaced` flag so an idempotent retry never double-bills) and
  the B2B approval queue `/approve`.

**Verdict: the code is correct at the SDK layer, but emitting meter events does not
bill anyone yet.** Confirmed against Stripe's usage-based-billing docs: a meter event
only becomes a line item when a **metered price referencing that meter is a
subscription item on the customer's subscription**. Three things must exist first
(§3, §5). Until then, `recordTransactionFee` is either a guarded no-op (no
`STRIPE_SECRET_KEY`) or — once the key is set but the meter isn't — a caught,
non-fatal error. No double-charge risk either way.

**The design is sound and intentionally keeps tiering in our code:** Stripe metered
prices are flat per-unit and can't express per-tenant percentage tiers. So we compute
the dollar fee ourselves and meter it as **cents**, against a metered price of exactly
**$0.01 per unit** — `feeCents × $0.01 = the fee`. Stripe just multiplies; all the
0.5/0.3/0% logic stays in `transactionFeeRate()`.

✅ Code · 🟡 End-to-end billable (blocked on §3 + §5)

---

## 3. The metered-fee chain (how a fee reaches an invoice)

```
order placed
  └─ meterOrderFee() → recordTransactionFee()
       └─ stripe.billing.meterEvents.create({ event_name:'transaction_fee',
                                               payload:{ value:<feeCents>, stripe_customer_id } })
            ▼ (aggregates only if all three below exist)
     [1] Billing Meter  event_name='transaction_fee', aggregation=sum,
                        customer_mapping.by_id on 'stripe_customer_id',
                        value_settings.event_payload_key='value'
     [2] Metered Price  product "Sparx Transaction Fees", currency=usd,
                        unit_amount=1 ($0.01), recurring{ interval:month,
                        usage_type:metered, meter:<meter id> }
     [3] Subscription item for [2] on the tenant's subscription (no quantity)
            ▼
     end of billing period → fee line item on the tenant's invoice
```

- **[1] Meter** — create once per mode (test, then live). Not creatable via the Stripe
  MCP (§8); use the committed provisioning script or Stripe CLI:
  `stripe billing meters create --display-name="Transaction Fees" --event-name=transaction_fee -d "default_aggregation[formula]"=sum -d "customer_mapping[type]"=by_id -d "customer_mapping[event_payload_key]"=stripe_customer_id -d "value_settings[event_payload_key]"=value`
- **[2] Metered price** — `unit_amount=1`, `recurring.usage_type=metered`,
  `recurring.meter=<meter id>`. Store its id as `STRIPE_PRICE_TRANSACTION_FEE`.
- **[3] Subscription item** — `syncModuleItems` must add this price to every
  subscription it creates/reconciles (§5). It's a $0 line when there's no usage
  (flexible billing mode suppresses zero-amount usage lines), so attaching it
  unconditionally is safe.

⬜ all three

---

## 4. Stripe object inventory — module subscriptions

Source of truth for monthly price = `packages/billing/src/price-catalog.ts`
(`MODULE_MONTHLY_CENTS`). One Product per module; monthly + annual Price each. Annual
default = **2 months free (10× monthly)** — _confirm_ vs the figures in
[docs/67 §Phase 1](67-billing-build-plan.md) before creating.

| Module    | Monthly | Annual (10×) | Env (price IDs)                              | Done |
| --------- | ------: | -----------: | -------------------------------------------- | :--: |
| Builder   |     $10 |         $100 | `STRIPE_PRICE_BUILDER_MONTHLY` / `_ANNUAL`   |  ⬜  |
| Commerce  |     $49 |         $490 | `STRIPE_PRICE_COMMERCE_MONTHLY` / `_ANNUAL`  |  ⬜  |
| CMS       |     $49 |         $490 | `STRIPE_PRICE_CMS_MONTHLY` / `_ANNUAL`       |  ⬜  |
| CRM       |     $49 |         $490 | `STRIPE_PRICE_CRM_MONTHLY` / `_ANNUAL`       |  ⬜  |
| Email     |     $29 |         $290 | `STRIPE_PRICE_EMAIL_MONTHLY` / `_ANNUAL`     |  ⬜  |
| B2B       |     $99 |         $990 | `STRIPE_PRICE_B2B_MONTHLY` / `_ANNUAL`       |  ⬜  |
| AI/MCP    |     $49 |         $490 | `STRIPE_PRICE_AI_MONTHLY` / `_ANNUAL`        |  ⬜  |
| Dropship  |     $29 |         $290 | `STRIPE_PRICE_DROPSHIP_MONTHLY` / `_ANNUAL`  |  ⬜  |
| Invoicing |     $19 |         $190 | `STRIPE_PRICE_INVOICING_MONTHLY` / `_ANNUAL` |  ⬜  |
| Chat      |     $19 |         $190 | `STRIPE_PRICE_CHAT_MONTHLY` / `_ANNUAL`      |  ⬜  |

Plus two non-module prices:

| Object           |  Amount | Env                                              | Done |
| ---------------- | ------: | ------------------------------------------------ | :--: |
| Transaction Fees | $0.01/u | `STRIPE_PRICE_TRANSACTION_FEE` (§3)              |  ⬜  |
| Managed Hosting  | $750/mo | `STRIPE_PRICE_MANAGED_HOSTING_MONTHLY` (Phase 8) |  ⬜  |

> Invoicing/Chat are **bundled-free** with their parents at the module-graph layer,
> so a bundled tenant never gets an explicit flag and is never billed for them — but
> the standalone Products/Prices must still exist for tenants who buy them alone.

---

## 5. Code work remaining

| #   | Change                                                                                                                                                                                                                                                                              | File(s)                                                                                          | Done |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | :--: |
| C1  | Add `STRIPE_PRICE_TRANSACTION_FEE` accessor (the metered price id)                                                                                                                                                                                                                  | `packages/billing/src/price-catalog.ts`                                                          |  ✅  |
| C2  | `syncModuleItems` attaches the transaction-fee metered item to every subscription it creates/reconciles (create path + existing-sub reconcile path)                                                                                                                                 | `packages/billing/src/service.ts`                                                                |  ✅  |
| C3  | Provisioning script — idempotent create/update of products, prices, meter, metered price, portal config + webhook keyed by deterministic `lookup_key`/metadata; prints the env block to paste into Secret Manager. **Built** — run it (ops, §7) with the sandbox key.               | `packages/billing/scripts/provision-stripe.ts` (`pnpm --filter @sparx/billing provision-stripe`) |  ✅  |
| C4  | Phase 3 — `TrialStatusBanner` (trial-ending / past-due / scheduled-cancel) on the billing page; "choose plan" done Stripe-native via portal `subscription_update` (module products + both intervals) — no duplicate custom plan UI. _Follow-up: surface the banner dashboard-wide._ | `apps/dashboard/.../settings/billing/_components/trial-status-banner.tsx`, `provision-stripe.ts` |  ✅  |
| C5  | Phase 8 — enterprise: `EnterprisePlanCard` + `planType` in `getBillingState` (reads `settings.billing.planType`, no migration) + runbook (§10)                                                                                                                                      | `enterprise-plan-card.tsx`, `packages/billing/src/service.ts`, docs §10                          |  ✅  |
| C6  | Behaviour tests (mock Stripe + `@sparx/db`) — `recordTransactionFee` tiers/guards, `reconcileFromSubscription` flag sync, `syncModuleItems` fee-item attach. _DB-backed integration stays CI-only._                                                                                 | `packages/billing/src/service.behavior.test.ts`                                                  |  ✅  |

> ✅ C1 + C2 landed — Phase 7 now bills end-to-end **once the meter + metered price
> are provisioned (C3)**. The fee item rides every subscription create + reconcile.

---

## 6. Webhook + portal (Stripe-side, not module-toggle ops)

- **Webhook endpoint** — `POST …/v1/public/webhooks/stripe/billing`, events:
  `customer.subscription.created/updated/deleted`,
  `customer.subscription.trial_will_end`, `invoice.payment_succeeded`,
  `invoice.payment_failed`. Handler already built; needs the endpoint registered and
  its signing secret in `STRIPE_WEBHOOK_SECRET_BILLING`. **Not creatable via the MCP**
  (§8) — Stripe CLI/Dashboard or the provisioning script. ⬜
- **Portal configuration** — `POST /v1/billing/portal` calls
  `billingPortal.sessions.create`, which **requires a portal configuration to exist**
  (the account has none). Create one (allow plan switch + payment-method update +
  cancel) via MCP or the provisioning script. ⬜

---

## 7. Ops checklist (Brandon)

- 🔧⬜ Set `STRIPE_SECRET_KEY` in Secret Manager (sandbox key first, then live).
- 🔧⬜ Run the provisioning script; paste the printed `STRIPE_PRICE_*` block into
  Secret Manager (incl. `STRIPE_PRICE_TRANSACTION_FEE`).
- 🔧⬜ Register the billing webhook; set `STRIPE_WEBHOOK_SECRET_BILLING`.
- 🔧⬜ Apply `20260813000000_platform_billing` via the DB Migrate workflow (Cloud SQL
  is private-IP — pipeline only).
- 🔧⬜ Roll consumers so the new env reaches `api-rest` (bootstrap app-env).
- 🔧⬜ Smoke test in sandbox: toggle a module → subscription item appears; place a
  test order → meter event recorded → preview invoice shows the fee.

---

## 8. MCP capability boundary (discovered during evaluation)

The connected Stripe MCP exposes a **curated** operation set. Confirmed during this
evaluation:

- **Available:** products, prices, customers, subscriptions, coupons, invoices,
  billing-portal configurations (read + write).
- **NOT available:** billing **meters** (`GetBillingMeters` → "not available") and
  **webhook endpoints** (`GetWebhookEndpoints` → "not available").

→ The meter and webhook **cannot** be created through the MCP. Our committed
provisioning script (C3) uses the Stripe **SDK** with the secret key directly, so it
is not bound by the MCP allowlist and can create everything in one reproducible pass.
The MCP stays useful for evaluation reads and ad-hoc verification.

---

## 9. Build sequence

All Part A **code** (C1–C6) is ✅ built + verified (lint/typecheck/test green). What
remains is **ops**, not code:

1. ✅ **C1–C6** — metering gap closed, provisioning script, trial banner + portal
   plan-switch, enterprise card + runbook, behaviour tests.
2. **Ops (§7)** — run `provision-stripe` with the sandbox key; set secrets; register
   the webhook; apply the migration; smoke test end-to-end.
3. **Go live** — re-run the provisioning script with the live key; set live secrets.

When every box in §1 is ✅, billing is live and this doc can move to "Shipped" in
memory.

---

## 10. Enterprise provisioning runbook (Phase 8 / §C5)

Enterprise tenants (Gillett Diesel) run on a bespoke agreement — custom pricing,
managed hosting — so they're provisioned **manually**, not through self-serve. The
dashboard already renders the [Enterprise card](<../apps/dashboard/app/(dashboard)/settings/billing/_components/enterprise-plan-card.tsx>)
whenever a tenant is flagged enterprise (no per-module breakdown; "contact your
account team"; portal stays open for invoices + payment method).

To provision one:

1. **Stripe customer** — reuse the tenant's existing `stripe_customer_id` (created
   the first time any module toggled), or create one and set it on the tenant row.
2. **Custom subscription** — in the Stripe Dashboard, create the subscription with
   the negotiated per-module items, the **managed-hosting** price
   (`STRIPE_PRICE_MANAGED_HOSTING_MONTHLY`), and the **transaction-fee** metered item
   (so usage still bills, or omit it if the contract waives fees).
3. **Module flags** — enable the contracted modules for the tenant (Settings →
   Modules, or the same `settings.modules.<slug>.enabled` path).
4. **Flag enterprise** — set `settings.billing.planType = "enterprise"` on the tenant
   row. This is the single switch the dashboard + `getBillingState` read; no schema
   column (it rides the existing settings JSON, so no migration).
5. **Verify** — the billing page shows the Enterprise card; the webhook still
   reconciles subscription status (past-due banner works); the portal opens for
   invoices.

> `planType` lives in `settings.billing` precisely so enterprise is a data op, not a
> deploy. The metered fee item still works for enterprise (it's just another item on
> their custom subscription).

---

# Part B — Commerce payments (tenants charge their shoppers)

A second, fully separate Stripe surface: each **tenant** connects **their own**
Stripe to accept their shoppers' payments at site checkout. This is a provider
in the integration framework ([docs/88](88-integrations-catalog.md)), not platform
infrastructure — it never touches `STRIPE_SECRET_KEY`.

## B1. What it is

`@sparx/provider-stripe` is a **provider bundle**. The package is stateless and
derives a Stripe client per call from the install config + Secret Manager
(`secretKeyRef`). Two install cards share one implementation:

- **Stripe** (`stripe`) — explicit bring-your-own-keys: `publishableKey` +
  `secretKeyRef` (Secret Manager) + optional `webhookSecretRef`, `enableStripeTax`,
  `apiVersion`, `statementDescriptor`. Per-install, RLS-scoped.
- **Sparx Pay** (`sparx-pay`) — white-label of the same impl ("powered by Stripe"),
  surfacing only business legal name + ACH + EIN.

Capability kinds: `payment`, `tax`, `subscription_billing`.

## B2. Status

| Capability                                                          | Surface                                                     | Status                                                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Payment intents (create / capture / void / refund / attachCustomer) | `payment.ts` → `checkoutService.createPaymentIntent`        | ✅ real SDK impl, idempotency-keyed, full Stripe→framework error mapping                                                          |
| Webhook signature **verification**                                  | `verifyWebhook` + `integration-framework/webhook-router.ts` | ✅ verifier built                                                                                                                 |
| Webhook **ingress route**                                           | `…/v1/webhooks/providers/{slug}/:installationId`            | ✅ **B-G1** — route resolves install (unscoped) → per-install secret → `verifyInboundWebhook` → dedupe/persist → shared reconcile |
| Stripe Tax                                                          | `tax.ts` (gated on `enableStripeTax`)                       | ✅ impl present (exported in bundle)                                                                                              |
| Shopper subscriptions                                               | `subscription.ts` + `/v1/commerce/subscriptions/*`          | ✅ impl present (exported in bundle)                                                                                              |
| Install / config / test / enable / uninstall                        | `/v1/commerce/providers/*`, Settings → Integrations         | ✅                                                                                                                                |
| Sparx Pay managed Connect onboarding                                | `sparx-branded.ts`                                          | ⬜ **marketed but not implemented** (§B3)                                                                                         |

**Net:** a tenant who pastes their own Stripe keys can take live card payments at
checkout today (the site confirms client-side and finalizes on `/complete`,
so the happy path doesn't depend on inbound webhooks). The two ⬜ rows are the gaps.

## B3. Gaps

**G1 — provider webhook ingress.** ✅ **Built (B-G1).** New route
[`webhooks/providers.ts`](../services/api-rest/src/routes/v1/webhooks/providers.ts):
`POST /v1/webhooks/providers/:slug/:installationId` resolves the install with the
**unscoped** client (the established public-webhook pattern — no migration / no
`SECURITY DEFINER` needed: a public webhook has no tenant context, and `order_payments`
is read unscoped the same way by the single-account webhook), resolves the install's
own `webhookSecretRef` from Secret Manager, verifies via `verifyInboundWebhook`,
dedupes + persists to `commerce_provider_webhook_events` (unique slug+event-id), then
runs the **shared** reconciliation extracted into
[`lib/stripe-payment-reconcile.ts`](../services/api-rest/src/lib/stripe-payment-reconcile.ts)
(the single-account `webhooks/stripe.ts` now imports the same module). Handles
`payment_intent.succeeded` / `payment_failed` / `charge.refunded`; idempotent; non-Stripe
providers persist-only. No separate worker — reconciliation is inline + idempotent,
matching the billing webhook. Async signals (ACH, disputes, dashboard refunds) now land.

**G2 — Sparx Pay managed Connect.** Built as two slices (Stripe-hosted-first — no
custom onboarding/account UI):

- **Slice 1 — onboarding ✅ BUILT.** [`lib/sparx-pay-connect.ts`](../services/api-rest/src/lib/sparx-pay-connect.ts)
  - [`routes/v1/commerce/sparx-pay.ts`](../services/api-rest/src/routes/v1/commerce/sparx-pay.ts):
    creates an **Express** connected account on the platform Stripe account (reuses
    `getBillingStripe` — the platform account doubles as the Connect platform), onboards
    via Stripe's **hosted Account Link** flow, stores `acct_…` on the install's
    `providerAccountId`, syncs status from `charges_enabled` (pull model), and mints
    **Express dashboard** login links. Routes: `POST …/sparx-pay/onboard`,
    `GET …/sparx-pay/status`, `POST …/sparx-pay/dashboard-link`. `reconcileAccountUpdated`
    is ready for a Connect `account.updated` push if/when we wire one.
- **Slice 2 — charge routing + application fee ⬜ (money path).** Route Sparx Pay
  checkout charges through the connected account (`stripeAccount` direct **or**
  `on_behalf_of` + `transfer_data.destination`) with `application_fee_amount` = the
  platform fee. Touches `@sparx/provider-stripe` (the client must branch: platform key
  - connected account for `sparx-pay`, vs `secretKeyRef` for `stripe`) and the §B4 fee
    intersection (commerce reads the platform fee rate). Needs a charge-model decision
    (direct vs destination) and careful, separately-verified work — it moves real money.

## B4. The intersection — how the platform collects its transaction fee

The one place Part A and Part B meet. The platform fee (0.5 / 0.3 / 0%) can be
collected two ways, and **which is possible depends on how the tenant takes payment**:

- **BYO-keys Stripe (every tenant today)** — the charge lands in the **tenant's own**
  Stripe account, which we don't control, so we **cannot** take a Connect
  `application_fee`. The only way to bill the fee is to invoice it on the tenant's
  **platform** subscription — which is exactly **Phase 7's metered transaction-fee
  item** (Part A §2–3). _This is why Phase 7 exists._
- **Sparx Pay (if/when Connect ships, G2)** — charges run through our platform
  Connect, so the fee could be taken inline as `application_fee_amount` per charge,
  no metering. Phase 7's metered path then becomes the fallback for non-Connect
  tenants; the two coexist and are never both applied to one order.

**Decision captured:** Phase 7 (metered fee on the platform subscription) is the
correct and currently-only fee-collection mechanism. Don't swap it for Connect fees
until Sparx Pay's managed-Connect path exists; then gate per-order on which payment
rail the order used.

## B5. Commerce-side work remaining

| #      | Change                                                                                                                                         | Status |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| B-G1   | ✅ Provider webhook ingress route + shared reconciliation + dedupe/persist (no migration; unscoped-read pattern). Inline reconcile, no worker. |   ✅   |
| B-G2.1 | ✅ Sparx Pay Connect **onboarding** — Express account + hosted Account Link + status sync + Express dashboard link                             |   ✅   |
| B-G2.2 | Sparx Pay **charge routing** via Connect + `application_fee` (money path; provider-client branch + §B4 fee) — needs charge-model decision      |   ⬜   |
| B-V    | Verify `tax.ts` / `subscription.ts` behaviour end-to-end against a sandbox install                                                             |   ⬜   |

> Part B is **out of scope for the billing go-live** (Part A). It's captured here so
> "all Stripe" lives in one map; sequence it after Part A unless site payments
> need the webhook ingress sooner.
