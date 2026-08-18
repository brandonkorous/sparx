# Stripe test → live cutover runbook

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-25

---

> **The one ordered checklist to flip production from Stripe TEST mode to Stripe LIVE
> mode.** Everything in prod today (keys, connected accounts, webhooks, orders) is Stripe
> _sandbox_. This runbook records every value that changes, exactly where it lives, the
> command that applies it, and the order to do it in. Companion: [docs/94](94-ADR-payment-gateway.md)
> (payment architecture), [docs/92](92-billing-stripe-go-live.md) (Part A billing tracker),
> and the `project_payments_go_live_config` memory (out-of-repo step list).

## 0. What "switch to live" actually means

A Stripe **account** has a **test mode** and a **live mode** side-by-side. "Switching to
prod" is **not** a new account — it's using the **live-mode keys** of the same sparx
Stripe org, after completing **live-mode activation**:

- **Platform account activation** — business details, representative identity, and a
  **bank account** (payouts can't run without it). Do this in the Stripe dashboard, live
  mode. Connect must be enabled in live mode too (branding, statement descriptor,
  application-fee support — the platform already uses `application_fee_amount`).
- Only then do `sk_live_…` / `pk_live_…` and live Connect onboarding work.

### The golden rule — test objects are DEAD in live

Every Stripe object id is **mode-scoped**. Nothing created in test survives:

| Test object                                                  | In live mode                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `sk_test_…` / `pk_test_…`                                    | replaced by `sk_live_…` / `pk_live_…`                      |
| connected `acct_…` (e.g. keen-cedar `acct_1TwbFDF5zEYX8zFH`) | **gone** — every tenant re-onboards sparx Pay in live (§4) |
| `cus_…`, `pi_…`, `po_…`, `re_…`                              | gone — no history carries over                             |
| `price_…` / `prod_…` (billing, §5)                           | gone — re-run the provisioner with the live key            |
| `whsec_…` (every endpoint)                                   | gone — live-mode endpoints issue new signing secrets (§3)  |

So there is **no data migration** — the code is identical; only the credentials and the
Stripe-side objects are re-created in live mode. Existing sandbox orders on
`keen-cedar-6433` stay as test artifacts.

---

## 1. The complete value inventory

Three places hold Stripe config. Each row is a test→live swap.

### 1a. GitHub repo **Variables** (build-time, ship in the browser bundle)

`Settings → Secrets and variables → Actions → **Variables**` (NOT secrets — a publishable
key is public by design). Injected as Docker build-args in
[build-images.yml](../.github/workflows/build-images.yml) L142–147.

| Variable                                    | Test → Live               | Consumed by                      |
| ------------------------------------------- | ------------------------- | -------------------------------- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`        | `pk_test_…` → `pk_live_…` | `wizeworks/apps/site` storefront |
| `NEXT_PUBLIC_MARKET_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` → `pk_live_…` | `sparx/apps/market`              |

> ⚠️ **Build-time inlining.** `NEXT_PUBLIC_*` is baked into the image at build. Setting it
> on the pod does nothing. It only takes effect on the **NEXT image build**, so set these
> **before** cutting the tag in §7. A stale test pk here = the storefront charges through
> the test publishable key while the server uses the live secret key → every charge fails.

### 1b. GCP **Secret Manager** → `sparx-app-secrets` (server-side)

Synced by `bootstrap.yml -f components=app-secrets` (KEYS list L225–264). Secret name
uppercases + dash→underscore to the env var ([env.ts](../services/api-rest/src/env.ts) L151–156).

| Secret Manager name               | Env var                           | Test → Live                                      | Notes                                                                                       |
| --------------------------------- | --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `stripe-secret-key`               | `STRIPE_SECRET_KEY`               | `sk_test_…` → `sk_live_…`                        | platform account secret; sparx Pay + billing + Connect all use it                           |
| `stripe-webhook-secret-sparx-pay` | `STRIPE_WEBHOOK_SECRET_SPARX_PAY` | `whsec_…` → **two live** `whsec_…`, comma-joined | one url, two live endpoints (§3) — account-scoped + connected-acct                          |
| `stripe-webhook-secret-billing`   | `STRIPE_WEBHOOK_SECRET_BILLING`   | `whsec_…` → live `whsec_…` (comma list ok)       | Part A billing endpoint (§5)                                                                |
| `stripe-webhook-secret`           | `STRIPE_WEBHOOK_SECRET`           | legacy, **unused**                               | leave as-is; superseded by the per-gateway secrets                                          |
| `stripe-client-id`                | `STRIPE_CLIENT_ID`                | **DEAD config**                                  | Connect OAuth was removed (Express Account-Links need no client_id); can de-provision later |

Update a value (**you paste live secrets — I never enter keys**):

```bash
printf %s "sk_live_…" | gcloud secrets versions add stripe-secret-key --project="$PROJECT_ID" --data-file=-
```

### 1c. Per-tenant install secrets (`stripe_direct` only)

The **bring-your-own-Stripe** (`stripe_direct`) leg stores the merchant's own
`pk`/`sk`/`whsec` **per install in Secret Manager** (via `PROVIDER_SECRET_KEY`
encryption), NOT in an env var. A `stripe_direct` tenant re-pastes their **live** keys in
`Selling → Setup → Payment providers → Your own Stripe`, and we surface their live webhook
URL `…/v1/public/webhooks/stripe-direct/:tenantId`. Nothing platform-side changes for this
leg at cutover — it's per-tenant.

---

## 2. Two integrations, both cut over

| Track                          | Who pays whom      | Cutover work                                                                                                   |
| ------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Part B — commerce payments** | shopper → tenant   | §1a + §1b keys, §3 webhooks, §4 tenant re-onboarding. **This is what's tested; do it first.**                  |
| **Part A — platform billing**  | tenant → WizeWorks | §5 — re-provision module prices in live, register the billing webhook. **Not live yet** either way; can trail. |

---

## 3. Live-mode Stripe webhook endpoints (Part B)

In the Stripe dashboard, **live mode** (test and live are separate endpoint lists with
separate secrets — this is done fresh, not copied):

1. `https://api.sparx.works/v1/public/webhooks/sparx-pay` — **Events on your account**:
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`,
   `charge.dispute.created`, `charge.dispute.closed`
2. **Same URL** — **Events on connected accounts**: `account.updated`
3. Take the **two** live `whsec_…` (one per endpoint above) → **comma-join** into
   `stripe-webhook-secret-sparx-pay` (§1b).

> An unset/wrong webhook secret makes the route **200-ack without processing** — cards get
> charged, orders stay unpaid, no confirmation email, nothing errors. Don't use Stripe's
> "Send test webhook" to verify until the live secret is in the pod (§7), or it returns a
> 200 that did nothing and reads as success.

---

## 4. Per-tenant sparx Pay re-onboarding (Part B)

Because connected `acct_…` are mode-scoped (§0), **every tenant collecting via sparx Pay
must re-onboard in live mode**:

- The real launch tenant does live Express onboarding in `Selling → Setup → Payment
providers → sparx Pay` (real business identity + bank; Stripe Connect hosted onboarding
  **blocks headless browsers** at identity — use a real visible browser).
- This mints a **live** `acct_…`, written to `tenant.stripeAccountId` (canonical) + the
  payment secret-store copy. `getPaymentConfig` / balance / payouts all resolve from
  `tenant.stripeAccountId`.
- **Launch decision (2026-07-25):** the live store is an **existing real tenant** (not a
  new one) that re-onboards its sparx Pay in **live** mode. `keen-cedar-6433` stays a
  **test** sandbox — it does not carry to live. Before flipping, confirm the launch
  tenant has a real store (products, shipping config, legal pages) and a bank account for
  the live Express onboarding.

---

## 5. Part A — platform module billing (trails Part B; not live yet)

Billing (WizeWorks charging tenants for modules) is **not provisioned in prod at all** —
`STRIPE_PRICE_*` are **not even in the bootstrap KEYS list** yet, and the billing webhook
isn't registered (docs/92 §1). When you turn this on **in live**:

1. Run the provisioner with the **live** key — creates products, prices, meter, portal
   config in live mode and **prints the `STRIPE_PRICE_*` env block**:
   ```bash
   STRIPE_SECRET_KEY=sk_live_… pnpm --filter @wizeworks/billing provision-stripe
   ```
2. Add each printed `STRIPE_PRICE_<MODULE>_MONTHLY` / `_ANNUAL` (+ `MANAGED_HOSTING`) to
   Secret Manager via `gcloud secrets versions add`. The secret **containers, the
   `bootstrap.yml` KEYS entries, and the Terraform declarations are already wired**
   (done 2026-07-25 — 25 `stripe-price-*` names across all 12 billable modules ×
   {monthly,annual} + managed hosting). `priceIdFor()` reads them from env; a
   missing/undefined value → that module silently isn't billable (warned, not failed).
   Run `terraform apply` once to create the empty containers, then add the versions.
3. Register the **live** billing webhook `…/v1/public/webhooks/stripe/billing`
   (subscription + invoice events, docs/92 §6) → `stripe-webhook-secret-billing`.
4. Apply the `20260813000000_platform_billing` migration via the DB Migrate workflow if
   not already applied.

> Trials + suspension already enforce **without** Stripe (the clock is on the tenant row).
> This track only turns on the ability to **charge**. It can go live after Part B.

---

## 6. Terraform / infra state

The secret **containers** (`stripe-webhook-secret-sparx-pay`, `-billing`, `stripe-client-id`)
are declared in [terraform/envs/prod/main.tf](../terraform/envs/prod/main.tf) L459–482 and
should already exist from the last `terraform apply`. Cutover only changes their **values**
(§1b), which is a `gcloud secrets versions add`, **not** a terraform change. Run
`terraform plan` in `terraform/envs/prod` to confirm no drift; only `apply` if it shows the
containers missing. (Adding the §5 `STRIPE_PRICE_*` secrets later is the one change that
touches both terraform + bootstrap.)

---

## 7. The apply sequence (in order)

Once you've flipped Stripe to live and have the live keys ready:

1. **GitHub Variables** → set both live `pk_live_…` publishable keys (§1a). _Must precede
   the tag in step 5._
2. **Secret Manager** → you paste the live `stripe-secret-key` (and, once §3 endpoints
   exist, the live webhook secrets). I never enter keys.
3. **Live Stripe webhook endpoints** (§3) — register the two sparx-pay endpoints; capture
   the two `whsec_…`; you add the comma-joined value to `stripe-webhook-secret-sparx-pay`.
4. **Sync secrets to the cluster** — `gh workflow run bootstrap.yml -f components=app-secrets`
   (rolls api/web pods so the new env lands). _I can run this on your go._
5. **Cut a tag / build images** so the live publishable key ships (auto-tag on the next
   releasable commit, or `gh workflow run build-images.yml` + `deploy-prod.yml`). Verify
   the running images picked up the new build.
6. **Verify webhooks** — now (secret is live in the pod) use Stripe "Send test webhook" →
   expect a processed 200, not a silent ack.
7. **Re-onboard the launch tenant's sparx Pay in live** (§4) — real browser, real bank.
8. **Real-money smoke test** (§8).
9. _(Later)_ Part A billing (§5).

---

## 8. Go-live smoke test (real money, minimal)

On the **real launch tenant**, live mode:

1. Place one real low-value order through the storefront with a **real card** — the
   Payment Element must mount with `pk_live_…` (view source / network), charge succeeds,
   `application_fee_amount` = 0.5% of the total, `on_behalf_of` + `transfer_data.destination`
   = the tenant's **live** `acct_…` (destination charge).
2. Order flips **Paid** (webhook processed, not silent-acked), confirmation email sends.
3. **Refund** it from the workbench order pane → real `re_…`, order → Refunded.
4. Confirm the sparx Pay balance shows the pending amount; a real `po_…` payout appears
   once Stripe's first daily payout runs (Finance → Payouts; until then the derived
   in-transit view shows the deposit — BUG-012 fix).
5. Watch api-rest logs for zero webhook-signature failures.

---

## 9. Rollback

Cutover is reversible until real customer money moves: restore the `sk_test`/`pk_test`
values (Secret Manager + GitHub Variables), re-run `bootstrap.yml -f components=app-secrets`,
rebuild. Once a **real** customer has paid, don't roll back keys — refund through Stripe
instead. The live connected accounts and any live orders persist regardless.

---

## 10. Quick reference — every cutover item

- [ ] Platform account activated in live (business + bank + Connect enabled)
- [ ] GitHub Variable `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_…`
- [ ] GitHub Variable `NEXT_PUBLIC_MARKET_STRIPE_PUBLISHABLE_KEY` → `pk_live_…`
- [ ] Secret `stripe-secret-key` → `sk_live_…`
- [ ] Live webhook: sparx-pay, events on your account (5 events)
- [ ] Live webhook: sparx-pay, events on connected accounts (`account.updated`)
- [ ] Secret `stripe-webhook-secret-sparx-pay` → two live `whsec_…`, comma-joined
- [ ] `gh workflow run bootstrap.yml -f components=app-secrets`
- [ ] New tag / image build so live pk ships; verify running images
- [ ] Stripe "Send test webhook" → processed 200
- [ ] Launch tenant re-onboards sparx Pay in live (new live `acct_…`)
- [ ] Real-money smoke test: charge + destination-charge shape + refund + payout
- [ ] _(later)_ Part A billing: `provision-stripe` live → `STRIPE_PRICE_*` into SM + bootstrap KEYS + live billing webhook
