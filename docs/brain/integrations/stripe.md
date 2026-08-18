---
title: Stripe (payments + billing)
node: integrations
type: reference
status: active
sources:
  - wizeworks/packages/payments/
  - wizeworks/packages/billing/
---

A real, deep integration (not the dev-tooling `stripe:*` MCP). Two homes, both no-op until keys are set:

- **`wizeworks/packages/payments/`** — vendor-agnostic gateway. `gateways/stripe-direct.ts` (merchant's own Stripe, no platform fee) + `gateways/sparx-pay.ts` (**Stripe Connect** destination charges, flat **0.5% `application_fee`**). Sits alongside non-Stripe gateways (square, authorize-net, first-pay, custom-redirect). Consumed by `wizeworks/packages/commerce/` checkout / subscription / return / market-payout.
- **`wizeworks/packages/billing/`** — **platform** billing: WizeWorks charges each tenant via one Stripe subscription, one item per active module (`price-catalog.ts`, `scripts/provision-stripe.ts`). Ties to [[billing-model]].
- **Webhooks:** Pub/Sub topic `stripe.webhook` → billing consumer. Secrets `stripe-secret-key`, `stripe-webhook-secret`. Docs 92 / 94 / 111.

Related: [[billing-model]], [[modules-are-flags]], [[rejected]]
