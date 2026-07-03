---
title: Pricing — module-based
node: business
type: reference
status: active
sources:
  - packages/billing/src/price-catalog.ts
  - docs/17-billing-subscriptions.md
---

> ⚠️ **Mirror of `packages/billing/src/price-catalog.ts` (`MODULE_MONTHLY_CENTS`).** Prices are materialized here because code is referenced last; the catalog is the source of truth — if they disagree, the **code wins** and you re-sync this note ([[CONTRACT]]). (Builder was once wrongly $49 → corrected to $10; treat the code as canonical, not memory.)

**Sparx is module-based pricing: a flat monthly price per *active* module, one invoice, no tiers or plans.** Turn a module off → billing stops ("off means off"). The gating mechanism (flag, not plan) is [[billing-model]]; the module set is [[modules]].

## List prices (monthly, USD)

| module | $/mo | | module | $/mo |
|---|---|---|---|---|
| **builder** | **$10** | | ai | $49 |
| commerce | $49 | | dropship | $29 |
| cms | $49 | | inventory | $29 † |
| crm | $49 | | invoicing | $19 † |
| email | $29 | | chat | $19 |
| b2b | $99 | | scheduling | $29 |

- **`builder` $10 is the only always-cheap base — but NOT required / always-on.** It's a normal toggle; a headless / CMS-only / CRM-only tenant needs no Builder. Starting floor is $10.
- **† Bundled-free:** `invoicing` ($19) and `inventory` ($29) carry a standalone price but ride **free** with Commerce/B2B (the module graph never sets an explicit flag → no Stripe item). A WMS-only tenant (Inventory *without* Commerce/B2B) **is** billed the $29. See `BUNDLED_FREE` in [[module-mechanism]].
- **Dependency:** `b2b` requires `commerce` (`REQUIRES`). A module with no catalog entry isn't separately billed.
- Total = sum of active modules (`activeTotalCents`). The 8-module "core stack" example lands at **$363/mo**.

## Free model + mechanics

- **14-day free trial**, all modules, **no credit card** to start, 30-day data retention after expiry (`TRIAL_PERIOD_DAYS = 14`; docs/17 §6). It is **not** pay-at-publish (that idea was proposed then reversed).
- **No tiers, no bundles, no per-seat / per-record metering; flat email; fair-use on infra.** The pricing page is a **switchboard** — toggle modules, live-recompute the total — never static plan cards.
- Billing runs as **one Stripe subscription with an item per active module** ([[stripe]]); `MODULE_MONTHLY_CENTS` is the source of truth for "what a plan costs" independent of Stripe (Price IDs are prod-only env values).
- **Marketing may name competitors** in cost comparisons (Webflow / Shopify / HubSpot / …) with real prices — the savings framing is the point, and an explicit exception to the no-competitor-names rule (which applies to *design docs* — see [[doc-style]]).

Related: [[billing-model]], [[modules]], [[module-mechanism]], [[stripe]], [[what-sparx-is]]
