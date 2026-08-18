# sparx Platform — Finance Hub Build Plan

**Version:** 1.2
**Author:** Brandon Korous
**Last Updated:** 2026-06-29

> **Build status (v1.1):** Slices 0–5 are landed — the hub shell, the real-data
> Overview, Payouts, Subscription, Channels, Receivables, and the payment-kind fold are
> all in the working tree. GAP A (the Connect balance read) shipped; GAP B turned out to
> be **already closed** — `GET /v1/invoicing/aging` with no scope already spans Invoicing
> documents and B2B invoices (one `BillingDocument` substrate since Phase 8), so no new
> AR endpoint was needed. Only **Slice 6 — Stripe go-live** remains as the trailing strand.
>
> **Build status (v1.2, 2026-06-29):** the Overview grew from a consolidation _lens_ into the platform's
> full **money dashboard** — a headline KPI strip, a cash-in trend chart, payout balance + recent
> payouts, AR aging + collections health, channel mix, payment status, and the sparx plan + per-module
> breakdown — all real reads (the new ones in [§4](#4-data-reads-to-add)). Finance also gained its own
> **hue** (money green `#16A34A`, [109 D7](109-finance-hub.md#3-binding-decisions-do-not-re-litigate))
> and doubles as an **upsell surface** ([109 D8](109-finance-hub.md#3-binding-decisions-do-not-re-litigate)) —
> a "Grow how you get paid" subsection for OFF money-in modules. Slice 6 still trails.

---

## 0. What this is

The build plan for the **Finance hub** — the scope decided in [109-finance-hub.md](109-finance-hub.md).
doc 109 is the feature + binding decisions (D1–D6); this doc is the _how_: route/package topology, the
exact integration points against the **as-built** backends, the slice order, the two data reads to add,
and the footguns.

**Binding decisions** (from [109 §3](109-finance-hub.md#3-binding-decisions-do-not-re-litigate), do not
re-litigate): top-level `/finance` hub (D1); one door to payment acceptance, fold the registry payment
kind, absorb PayPal (D2); include the sparx subscription, visually separated (D3); rollup-in-Finance /
manage-in-place (D4); Overview is real-data-or-it-doesn't-ship (D5); IA first, go-live second (D6).

**Slices are build _order_, not scope tiers** — the whole surface is committed. Each slice is a
deployable commit (deploy-early), left in the working tree for the user to commit.

---

## 1. Current state we build on (not greenfield)

Everything in [109 §1](109-finance-hub.md#1-current-state-not-greenfield) is built and consumed. The
consolidation is mostly **moving + composing** existing surfaces, plus two new reads and one Overview
page. Concretely, the surfaces being consolidated:

| Surface (today)                     | Path                                                                       | Destination                             |
| ----------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| Settings → Payments                 | `apps/dashboard/app/(dashboard)/settings/payments/*`                       | → `/finance/payments` (move)            |
| Settings → Billing                  | `apps/dashboard/app/(dashboard)/settings/billing/*`                        | → `/finance/subscription` (move)        |
| Settings → Channels (revenue)       | `…/settings/channels/_components/channel-revenue-panel.tsx`                | → `/finance/channels` (revenue view)    |
| Settings → sparx.market (payouts)   | `…/settings/market/_components/{settlement-panel,payout-account-form}.tsx` | → `/finance/payouts` (move payout bits) |
| Commerce → Providers (payment kind) | `…/commerce/providers/_components/providers-lists.tsx`                     | folded (D2)                             |

---

## 2. Route & shell topology

- **New route group:** `apps/dashboard/app/(dashboard)/finance/` with `page.tsx` (Overview) and one
  folder per section (`payments/`, `payouts/`, `channels/`, `receivables/`, `subscription/`).
- **Shell registration:** Finance is platform-level, like Settings — it is **not** a `ModuleManifest`
  (those are billable modules in `_shell/registry.ts`). Mirror the Settings nav pattern
  (`settings/nav.ts` → a single `FINANCE_NAV` source feeding both the contextual side panel and the hub
  landing grid). Confirm whether the shell renders a non-module top-level entry for Settings and follow
  the same seam for Finance; if the sidebar's top-level list is hard-coded, add Finance beside Settings
  there.
- **Gating nuance (footgun F1):** the hub itself is **ungated** (every tenant has a sparx bill), but
  individual sections gate on their module: Payments/Payouts/Channels/Receivables gate on `commerce`
  (use `requireModuleOrUpsell('commerce')` exactly as Settings → Payments does today); the subscription
  section is ungated. Do **not** gate the whole hub on commerce.

---

## 3. Slices

### Slice 0 — Audit & docs ✅ (this doc + 109)

Audit confirmed the gateway vs provider-registry split, the billing service shape, and the Overview data
sources. Output: docs 109 + 110. **Done when** both docs land.

### Slice 1 — Hub shell + Payments move ✅

- Create `/finance` route group + `FINANCE_NAV` + the landing grid + side-panel wiring.
- **Move** Settings → Payments to `/finance/payments` (the `PaymentsManager` + `actions.ts` move
  verbatim; only import paths change). Leave a **redirect** at `/settings/payments` → `/finance/payments`.
- Update `settings/nav.ts`: the Payments entry becomes a pointer to `/finance/payments` (or is removed
  from the settings grid in favor of a "Finance" entry — decide with the shell seam).
- **Ships immediately** — a working hub with one real section.

### Slice 2 — Overview (the whole ballgame, D5) ✅

- New `/finance` Overview composing live reads ([§4](#4-data-reads-to-add)): gateway status, settlement
  summary, channel-revenue totals, `getBillingState`, **+ GAP A** (Connect balance) **+ GAP B** (AR
  summary).
- Cards grouped by the money-flow split ([109 §4.1](109-finance-hub.md#41-the-money-flow-split-the-visual-contract)):
  "You get paid" vs "You pay sparx." Each card deep-links to its section.
- Empty/zero states are first-class (no gateway yet → "set up" CTA; no AR → calm empty, not a broken card).

### Slice 3 — Payouts consolidation ✅

- New `/finance/payouts` merging: the Connect payout status + **GAP A** balance/next-payout + "Manage
  payouts" hosted-dashboard link (from `openSparxPayDashboard`), the **sparx.market settlement** panel +
  runs, and the **ACH payout account** form.
- Move the payout bits **out** of Settings → sparx.market; leave participation/profile/listings there
  (D4 / [109 §5](109-finance-hub.md#5-what-stays-where)). The settlement email's link target updates to
  `/finance/payouts`.

### Slice 4 — Subscription + Channels + Receivables ✅

- **Subscription:** move Settings → Billing to `/finance/subscription`; redirect `/settings/billing`.
  Apply the "You pay sparx" separated treatment (D3).
- **Channels:** `/finance/channels` renders the channel-revenue view (`ChannelRevenuePanel` +
  top-products drill); rows deep-link to Settings → Channels for connect/sync (D4).
- **Receivables:** `/finance/receivables` renders the AR rollup from **GAP B**; deep-links into
  `/invoicing/documents` + `/b2b/invoices` to author.

### Slice 5 — Fold the payment kind (D2) ✅

- **As built:** removed `payment` from `KIND_ORDER` in `commerce/providers/page.tsx` (the Providers
  list is data-driven by kind — there is no payment-specific branch in `providers-lists.tsx` to
  remove). Per **F2**, `registerPaypalProviders` is **kept registered** — checkout and the
  provider-install flow still resolve PayPal — only the duplicate management _surface_ is folded.
- Surface **PayPal as a gateway option** in `/finance/payments` (a fourth card under the three
  selectable gateways). PayPal isn't a selectable `PaymentGatewayId` yet — wiring the actual gateway
  stays on-demand per ADR 94 §12 — so the card **connects through the existing provider-install
  flow** (`/commerce/providers/install?slug=paypal&kind=payment`). The **door** is unified now: this
  is the only place a merchant reaches PayPal.
- Updated copy in `commerce/providers` description (dropped "payment" from the kind list, points to
  Finance → Payments). Docs updated.

### Slice 6+ — Stripe go-live (follows, per [92-billing-stripe-go-live.md](92-billing-stripe-go-live.md))

- Provision live keys via Secret Manager + Terraform (mirror any imperative change into TF same session).
- Exercise end-to-end: checkout → webhook → ledger → payout; a marketplace settlement run; a subscription
  create/cancel via `syncModuleItems` + portal.
- Light up the Connect balance read (GAP A) against live data; verify AR summary (GAP B) against real
  invoices.

---

## 4. Data reads to add

- **GAP A — Connect payout balance ✅ (shipped).** `GET /v1/commerce/payments/sparx-pay/balance` calls
  Stripe `balance.retrieve({}, { stripeAccount })` for the tenant's connected account and returns
  available + pending (in the account's default currency) + the payout cadence. Guarded like the rest
  of `@wizeworks/payments` — no platform key or no connected account → `null`, so dev/test is a clean
  no-op. Lib: `getSparxPayBalance` in `wizeworks/services/api-rest/src/lib/payments-onboarding.ts`. Surfaces on
  Overview + Payouts.
- **GAP B — Unified AR summary ✅ (already closed, no new endpoint).** The intended read already exists:
  `GET /v1/invoicing/aging` with **no `scope`** aggregates open balances + aging buckets across BOTH
  Invoicing documents AND B2B invoices, because both are the one `BillingDocument` substrate since
  Phase 8. The Overview card and the Receivables section both consume it directly — no generalization
  of the B2B `ar-aging-summary` was needed.
- **Overview money-dashboard reads (v1.2) — all pre-existing, no new endpoints.** The expanded Overview
  (see the v1.2 build-status note at the top) composes reads that already shipped for the per-module overviews:
  `GET /v1/commerce/reports/revenue-summary` + `…/revenue-timeseries` (KPI + cash-in trend; `netCents`
  per bucket), `GET /v1/invoicing/reports/collected-timeseries` (store-less cash-in fallback —
  `collectedCents`/`billedCents`), `GET /v1/invoicing/reports/collections` (`avgDaysToPay`, deposits),
  `GET /v1/invoicing/reports/customer-breakdown?limit=3` (top debtor), and
  `GET /v1/market/settlement/runs?take=4` (recent payouts). All guarded (disabled module / unreachable →
  null → calm empty or badged-sample state). The data layer normalizes commerce-vs-invoicing into one
  `cashIn` series in `finance/_data/overview.ts` so the hero chart is source-agnostic.

---

## 5. Footguns

- **F1 — Don't gate the whole hub on commerce.** The subscription section must work for a content-only
  tenant. Gate per-section, not per-hub ([§2](#2-route--shell-topology)).
- **F2 — The fold is not a migration, but PayPal must survive it.** sparx Pay was never a provider
  install, so removing the payment kind touches no `tenant_payment_configs` rows — but PayPal _is_ the
  only real payment-kind provider today. "Fold" means **re-home PayPal into the Payments door**, not
  delete it. Verify no server route still expects a payment-kind provider installation before removing
  the registration.
- **F3 — Redirects, not copies.** Settings → Payments/Billing/channels become redirects so they can't
  drift from the Finance source. Don't leave two live editors for the same config.
- **F4 — Finance owns a hue (money green `#16A34A`), superseding "neutral chrome."** As of v1.2
  ([109 D7](109-finance-hub.md#3-binding-decisions-do-not-re-litigate)) Finance has its own module color
  in `@wizeworks/ui` — the rail icon, contextual panel, and every `/finance/*` page wear finance green, NOT
  a per-section borrow of commerce/invoicing hues. On the Overview tint exactly ONE finance card (the
  cash-in hero); the rest stay plain (one-primary-card-per-hue, root CLAUDE.md). A finance signal
  embedded in another module wears finance green via a nested `<ModuleProvider module="finance">`.
  **Upsell cards are the exception** — each wears its TARGET module's hue (one card per hue) so it reads
  as an opportunity, not a finance signal. The subscription ("you pay sparx") section is finance-green
  like the rest and must never read as a commerce hue.
- **F5 — Settlement email + onboarding deep links.** Updating where payouts live changes the weekly
  settlement email's link target and any onboarding "set up payments" step — update those when the moves
  land (Slices 3 + 1).
- **F6 — User owns dev + commits.** Verify via typecheck/lint/DB+API, not by restarting their dev server;
  stage only finance/docs files by path, leave the tree for the user to commit.

---

## 6. Definition of done

Mirrors [109 §8](109-finance-hub.md#8-definition-of-done-feature-level): six sections live under
`/finance`; Overview fully real-data + deep-linked + money-flow-split; one payment door (no payment kind
in Providers, PayPal re-homed); Settings redirects in place; marketplace payouts under Finance while
participation stays in Settings; both data gaps closed; the Stripe go-live tracked as the trailing strand.
