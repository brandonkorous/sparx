# sparx Platform — Finance Hub

**Version:** 1.2
**Author:** Brandon Korous
**Last Updated:** 2026-06-29

> **Status: PLANNED.** This is the feature definition + binding decisions; the phased _how_ lives in
> its companion [110-finance-hub-build-plan.md](110-finance-hub-build-plan.md). It **consolidates**
> financial surfaces that already exist and ship — it does not invent the payment rails. Read
> [94-ADR-payment-gateway.md](94-ADR-payment-gateway.md) (the gateway model),
> [67-billing-build-plan.md](67-billing-build-plan.md) and
> [17-billing-subscriptions.md](17-billing-subscriptions.md) (the sparx subscription), and
> [106-channel-marketplace-strategy.md](106-channel-marketplace-strategy.md) §P5 (marketplace
> settlement) first — this hub is a new **lens** over those, not a reimplementation.

---

## 0. What this is

The feature definition for a **Finance hub** — a single top-level dashboard area (`/finance`) where a
tenant sees and manages **every financial integration in one place**: how they accept money, where their
payouts land, what their customers owe them, what they sell across channels, and what they pay sparx.

Today these are scattered across **three unrelated homes** — Settings, the Commerce module, and the
Invoicing/B2B modules — with one outright **duplicate door** to payment configuration. A tenant who
wants to "manage my finances" has to already know that "accept cards" is in Settings → Payments (but
_also_ Commerce → Providers), "what sparx charges me" is in Settings → Billing, "where my payouts land"
is in Settings → sparx.market, and "my channel revenue" is in Settings → Channels. That is the problem
this fixes.

**This is an IA-consolidation, not a rewrite.** The payment gateway abstraction, Connect onboarding,
marketplace settlement, and platform subscription billing are **already built and wired**
([§1](#1-current-state-not-greenfield)). The hub gives them one front door and one overview. The
separate **Stripe go-live** (live keys, end-to-end exercise) is sequenced _after_ the consolidation —
see the build plan.

**The organizing principle is money-flow direction, not page.** The reason the current surfaces feel
disjointed isn't only that they're scattered — it's that three fundamentally different relationships
were never visually distinguished:

- **Money in** — your customers pay _you_ (checkout, invoices, B2B orders).
- **Money settled to you** — the marketplace pays _you_ (sparx.market is merchant-of-record; weekly ACH).
- **Money out** — you pay _sparx_ (your module subscription).

The hub puts them in one place **while keeping them distinct**. Conflating "what I pay sparx" with "how
my customers pay me" would be worse than the status quo, not better.

---

## 1. Current state (not greenfield)

The financial backends are **built and consumed** today. This hub is a front door over them.

| Already exists                                                        | Location                                                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Gateway abstraction (`PaymentGateway`, registry, `PaymentService`)    | `wizeworks/packages/payments/src/{gateway,registry,service}.ts`                                       |
| sparx Pay (Connect destination charges) + Stripe-direct gateways      | `wizeworks/packages/payments/src/gateways/{sparx-pay,stripe-direct}.ts`                               |
| Connect onboarding + hosted dashboard links                           | `wizeworks/services/api-rest/src/lib/payments-onboarding.ts`, `/v1/commerce/payments/*`               |
| Payment ledger + platform-fee record (`payment_intents.platform_fee`) | `PaymentService.createPaymentIntent`                                                                  |
| Consumed by checkout / invoices / B2B / scheduling deposits           | `…/public/checkout.ts`, `…/invoicing/documents.ts`, `…/b2b/invoices.ts`, `lib/scheduling-payments.ts` |
| Marketplace settlement (sparx as MoR, weekly ACH)                     | `wizeworks/packages/payments/src/market.ts`, `getMarketSettlement{Summary,Runs}`                      |
| Platform subscription (one Stripe sub, item per module)               | `wizeworks/packages/billing/src/service.ts` (`getBillingState`, `createPortalSession`)                |
| Provider registry (tax/shipping/dropship/**payment=PayPal**)          | `apps/dashboard/lib/providers-bootstrap.ts`, `/commerce/providers`                                    |
| Channel revenue consolidation report                                  | `/v1/commerce/reports/channel-revenue`, `getChannelRevenue`                                           |

**Key audit finding:** the gateway path and the provider-registry path are **separate backends**. sparx
Pay / stripe-direct / manual live in `tenant_payment_configs` + the tenant root row; the provider
registry's `payment` kind today holds **only PayPal**. sparx Pay was never a provider installation — so
folding the registry's payment kind into the one Payments surface is a UI/registration change, **not a
data migration**.

---

## 2. Why a top-level area (and not a Settings page or a Commerce section)

- **Finance spans modules.** Billing is platform-level; payment acceptance is Commerce; AR is
  Invoicing/B2B; payouts are the marketplace. No single module owns it.
- **A content-only tenant still has a sparx bill.** Scoping the hub to Commerce would orphan platform
  billing for a CMS-only or CRM-only tenant. Per the platform's content-**and/or**-commerce framing,
  finance is not a commerce-only concern.
- **It's too important to bury.** "See all my financial integrations in one screen" is a primary job.
  A sub-page of Settings, one click deeper than a dozen siblings, under-serves it.

So the hub is a **platform-level surface**, a peer of Settings — not a billable module (no manifest fee,
no module hue of its own). It registers in the shell like Settings does.

---

## 3. Binding decisions (do not re-litigate)

- **D1 — Top-level `/finance` hub.** A platform-level area with its own sidebar entry and section nav.
  Not a module; not under Settings; not under Commerce.
- **D2 — One door to payment acceptance.** Finance → Payments owns gateway choice (sparx Pay / your own
  Stripe / manual) + Connect onboarding **+ PayPal**. The Commerce → Providers `payment` kind is
  **folded** — PayPal is surfaced as a gateway option, not a registry install. Providers keeps
  tax / shipping / dropship / subscription_billing kinds.
- **D3 — Include the sparx subscription, visually separated.** "You pay sparx" lives in the hub as its
  own section, with a hard visual split from money-in. One screen, but never blurred money-flows.
- **D4 — Rollup-in-Finance, manage-in-place.** Finance is the **lens on money**; the **management home**
  for an external integration stays with its module, deep-linked. Channel revenue shows in Finance;
  connecting/syncing a TikTok or Etsy account stays in Settings → Channels. AR aging shows in Finance;
  authoring invoices stays in the Invoicing module. No duplicated editors or OAuth flows in the hub.
- **D5 — Overview is real-data-or-it-doesn't-ship.** Every Overview card is backed by a live read and
  deep-links to its source. No placeholder/stubbed cards — that would fail the entire brief.
- **D6 — IA first, go-live second.** Consolidate the surfaces against the existing backends; drive the
  Stripe go-live (live keys, end-to-end) after. Each ships independently (deploy-early).
- **D7 — Finance owns a hue ("money green" `#16A34A`).** Added in v1.2 (2026-06-29). Finance stays
  platform-level (no manifest fee), but it owns a module color in `@wizeworks/ui` (`MODULE_COLORS`) so its
  hub pops and a finance signal reads as finance wherever it appears — the rail icon, the contextual
  panel, every `/finance/*` page, and an embedded finance panel in another module (e.g. the Payouts
  card on the Commerce overview, via a nested `<ModuleProvider module="finance">`). On the Overview the
  one-primary-card-per-hue rule applies: only the cash-in hero carries the green tint; every other
  finance card stays plain. **This supersedes the original "neutral chrome / commerce-orange acceptance
  / invoicing-lime AR / neutral sparx bill" framing** in §4 — finance is no longer hueless. Green-600 is
  deliberately deeper than the emerald success token (`#10B981`) so chrome never reads as a status.
- **D8 — Finance is an upsell surface.** It's the one screen every tenant opens for money, so an OFF
  money-in capability (Commerce / Invoicing / B2B) is surfaced as an opportunity in a **"Grow how you
  get paid"** subsection — _off-not-empty_ (gated by `isModuleEnabled`, which honors the `BUNDLED_FREE`
  graph, so Invoicing is never pitched to a Commerce/B2B tenant). Each upsell card wears its **target
  module's hue** (one card per hue) so it reads as an opportunity, not a finance signal; the CTA
  activates the module (modules-not-plans). For a content-only tenant this subsection IS the "You get
  paid" content.

**Phases in the build plan mean _build order_, not scope tiers.** The whole surface is committed; nothing
here is an "MVP slice" deferred to "if there's time."

---

## 4. Information architecture

A platform-level hub at `/finance` with section nav. **Finance owns "money green" `#16A34A` (D7)** — the
rail icon, contextual panel, and every `/finance/*` page wear it, and an embedded finance signal in
another module wears it via a nested `<ModuleProvider module="finance">`. On the Overview only the one
**cash-in hero** is tinted (one-primary-card-per-hue); every other finance card stays plain. _(v1.1 and
earlier described neutral chrome with per-section commerce/invoicing hues — superseded by D7.)_

| Section                | Route                   | Absorbs / sources                                       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Overview**           | `/finance`              | new; reads existing APIs                                | The platform's **money dashboard**: a headline KPI strip (revenue · available to pay out · outstanding AR · what you pay sparx), a cash-in **trend chart**, payout balance + recent payouts, AR aging + collections health, channel mix, payment status, the sparx plan + per-module breakdown, and a **"Grow how you get paid"** upsell subsection (D8). **Adaptive** by tenant — a commerce shop sees the full dashboard, a service/invoicing tenant sees cash-collected + AR, a content-only publisher sees the upsell menu. Money-flow split + every card deep-links down. |
| **Payments**           | `/finance/payments`     | Settings → Payments **+ PayPal**                        | The single door to "how I accept money": gateway choice + Connect onboarding + PayPal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Payouts**            | `/finance/payouts`      | Connect payouts + sparx.market settlement + ACH account | "Where your money lands" — consolidates the two payout stories into one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Channels**           | `/finance/channels`     | Channel-revenue report                                  | Revenue / fees / net by channel. Rows deep-link to Settings → Channels to connect/sync (D4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Receivables**        | `/finance/receivables`  | Invoicing + B2B AR                                      | AR aging + recent payments rollup; deep-links into the Invoicing module to author (D4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **sparx subscription** | `/finance/subscription` | Settings → Billing (`@wizeworks/billing`)               | "You pay sparx," visually separated from money-in. Plan, status, Stripe portal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### 4.1 The money-flow split (the visual contract)

The Overview and the section nav must legibly group:

- **You get paid** — Payments, Payouts, Channels, Receivables.
- **You pay sparx** — the subscription section, set apart (its own group header / divider, neutral hue,
  never interleaved with money-in cards).

This split is the point of the hub. It is **binding**, not cosmetic.

---

## 5. What stays where

- **Settings keeps thin redirects.** `Settings → Payments`, `Settings → Billing`, and the channel-revenue
  view redirect to their `/finance/*` homes so existing nav, deep links, onboarding steps, and the weekly
  settlement email don't break. Finance is the **single source**; Settings entries become pointers, not
  second copies (no drift).
- **sparx.market splits by concern.** Payouts + settlement → Finance → Payouts. **Participation, seller
  profile, and listed products stay** in Settings → sparx.market — those are marketplace _selling_ config,
  not finance.
- **Commerce → Providers stays** for tax / shipping / dropship / subscription_billing. Only the `payment`
  kind is folded out (D2).
- **The Invoicing and B2B modules keep their full surfaces.** Finance shows the AR _rollup_ only.

---

## 6. Overview data sources (and the two real gaps)

Each Overview card and its live source. Two require a small new backend read — flagged so the build plan
closes them, not hand-waves them.

| Card                                     | Source today                                                        | Gap?                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Payment acceptance status                | `/v1/commerce/payments/config` (`getPaymentConfig`)                 | none                                                                                            |
| sparx.market settlement owed / paid      | `getMarketSettlementSummary`                                        | none                                                                                            |
| Revenue (30-day, by channel)             | `/v1/commerce/reports/channel-revenue`                              | none                                                                                            |
| You pay sparx (plan, status, next bill)  | `getBillingState` (`@wizeworks/billing`)                            | none                                                                                            |
| **Connect payout balance + next payout** | sparx Pay payouts currently only on the Stripe **hosted** dashboard | **GAP A ✅** — added `GET /v1/commerce/payments/sparx-pay/balance` (`balance.retrieve`)         |
| **AR outstanding + aging**               | invoicing + B2B share one `BillingDocument` substrate (Phase 8)     | **GAP B ✅** — already closed: `GET /v1/invoicing/aging` (no scope) spans both; no new endpoint |

Both gaps are closed. GAP A shipped as a small additive read (no schema change); GAP B needed nothing
new — the unscoped aging endpoint already aggregates across Invoicing and B2B. Details in the build
plan ([110 §4](110-finance-hub-build-plan.md#4-data-reads-to-add)).

**Overview expanded to the full money dashboard (v1.2, 2026-06-29)** on the same real-data discipline.
Beyond the cards above it now composes, all live and guarded: `revenue-summary` + `revenue-timeseries`
(the cash-in KPI + trend), `invoicing/reports/collected-timeseries` (the store-less cash-in fallback —
cash collected when there's no storefront), `invoicing/reports/collections` (avg days-to-pay, deposits),
`invoicing/reports/customer-breakdown` (who owes the most), and `market/settlement/runs` (recent
payouts). The **one** concession to D5 is the cash-in trend _chart_: when an active selling tenant has no
orders in the window yet it shows a clearly-badged illustrative series (the platform's
`liveOr`/`SampleBadge` convention) and auto-flips to real on the first sale — the sanctioned pattern
across every module overview, not a stubbed card. KPI/summary figures are always real or "—".

---

## 7. Non-goals

- **Not** a new accounting / bookkeeping product (no GL, no journals, no reconciliation ledger beyond the
  existing `payment_intents`).
- **Not** a new billing _module_ — the hub is platform-level UI; it adds no priced capability and no
  manifest fee.
- **Not** a reimplementation of the gateway, settlement, or subscription backends — it is a lens over
  them.
- **Not** the place to author invoices or connect channels — those stay in their modules (D4).
- The **PayPal gateway implementation itself** is still on-demand per [ADR 94 §12](94-ADR-payment-gateway.md);
  D2 only requires PayPal be _surfaced through the one Payments door_ when it lights up — not built now.

---

## 8. Definition of done (feature-level)

- A top-level **Finance** area exists with the six sections in [§4](#4-information-architecture).
- The **Overview** shows every card in [§6](#6-overview-data-sources-and-the-two-real-gaps) backed by live
  data, each deep-linking to its source (D5).
- The **money-flow split** ([§4.1](#41-the-money-flow-split-the-visual-contract)) is visually unmistakable.
- Finance **owns its hue** (D7) — green rail icon/panel/pages, one tinted Overview card — and doubles as
  an **upsell surface** (D8): off money-in modules surface in "Grow how you get paid."
- Payment acceptance has **one door**; Commerce → Providers no longer shows a `payment` kind (D2).
- Settings → Payments / Billing / channel-revenue **redirect** into Finance; no duplicated live surface.
- sparx.market payouts/settlement appear under Finance → Payouts; participation/profile/listings remain in
  Settings.
- The two data gaps ([§6](#6-overview-data-sources-and-the-two-real-gaps)) are closed with real reads.
- The companion **Stripe go-live** ([110](110-finance-hub-build-plan.md), [92](92-billing-stripe-go-live.md))
  is sequenced and tracked, even though it ships after the consolidation.
