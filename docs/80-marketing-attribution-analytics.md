# 80 — Marketing Attribution & Traffic Analytics

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-09

---

> Attribution answers one question at two altitudes: **"where did this come from?"** For
> WizeWorks it means _which channel produced a paying tenant_ — the number that decides where the
> next launch dollar and hour go. For a tenant it means _which channel produced an order_ — a
> first-class product feature, surfaced through the dashboard and the MCP server the same way
> [auth](16-auth-security.md), [billing](17-billing-subscriptions.md), [consent](42-legal-and-consent.md),
> and [SEO/AIO](50-seo-aio-discoverability.md) each became platform capabilities rather than
> per-app chores. This doc records the model, the data contracts, the privacy posture, and the
> phased build. It is the home for the `docs/80` references threaded through the code.
>
> **First principle: attribution is not retroactive.** A visit captured without its source is
> unattributable forever. Capture is cheap to add and impossible to backfill — so the capture
> layer ships before the first paid channel runs, even though the _reporting_ on top of it lands
> later.

---

## 1. Why this exists

Sparx is about to drive traffic from many channels (Product Hunt, Hacker News, the MCP registries,
Reddit, paid search/social, the per-module marketing domains). Today the only instrumentation is
PostHog on `apps/web` ([posthog-provider.tsx](../apps/web/components/posthog-provider.tsx)), configured
`person_profiles: 'identified_only'`. That captures `utm_*` as **event** properties on `$pageview`
— enough to see _traffic_ by channel — but it records no durable **first-touch** for the anonymous
majority, and the conversion happens on a **different registrable surface** (`app.sparx.works`),
where the channel context is already gone. The result: we can see who visited, not which channel
produced a customer. That gap is the entire reason to spend a launch.

The same gap exists one level down. A Sparx tenant replacing Shopify + HubSpot expects to answer
"which campaign drove the most revenue last quarter" — and to ask it in plain language of their AI.
No commerce platform exposes that natively; Sparx's MCP server can.

## 2. The two-level model

Attribution in Sparx is **two systems that share one engine**, mirroring the two-surface pattern in
[doc 50 §1](50-seo-aio-discoverability.md):

| Level                             | Subject              | Surface(s)                                                                                       | Conversion event                                  | Stored on                                          | Audience                     |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| **L-PLAT — Platform acquisition** | A WizeWorks prospect | `apps/web` (`sparx.works`) + per-module marketing domains → `apps/dashboard` (`app.sparx.works`) | Tenant signup → module activation → paid (Stripe) | `tenants` + platform attribution tables            | WizeWorks (internal)         |
| **L-TEN — Tenant commerce**       | A tenant's shopper   | `apps/site` (`{tenant}.sparx.zone` + custom domains)                                             | Customer signup / order / RFQ                     | `customers` + `orders` + tenant attribution tables | The tenant (product feature) |

Both levels use the **same capture library, the same attribution snapshot shape (§5.2), the same
identity-stitch pattern (§6), and the same model math (§9).** They differ only in where the cookie
lives, which identity system resolves the anonymous visitor (Better Auth vs `@sparx/customer-auth`),
and who reads the report. Build the engine once; instantiate it twice.

> **Decision — one engine, two instantiations.** We do **not** build a separate "internal launch
> tracker." Platform acquisition is L-TEN run against the WizeWorks tenant-of-record plus a thin
> `tenants.acquisition_*` denormalization. Anything we'd want for our own launch, a tenant gets for
> their store, and vice versa. This keeps the product feature honest (we dogfood it) and halves the
> surface area.

## 3. Concept model & vocabulary

- **Touch** — a single inbound visit with its resolved channel context (source/medium/campaign +
  referrer + landing path + click ids). Touches are append-only.
- **Session** — a series of pageviews under one visit (PostHog's `$session_id`; 30-min inactivity
  window). A session has at most one entry touch.
- **Visitor** — an anonymous person, keyed by a first-party UUID. On storefronts this UUID is
  **already minted**: the `sparx_consent` cookie's `visitorId` (doc 42 §4.2). We reuse it rather than
  create a parallel id (§6.1).
- **Identity edge** — the link from an anonymous visitor to a known principal: a Better Auth user /
  tenant (L-PLAT) or a CRM `customers` row (L-TEN). `consent_records` already carries a
  `visitorId → customerId` edge we can exploit.
- **Channel** — the normalized bucket a touch rolls up to (Direct, Organic Search, Paid Search,
  Organic Social, Paid Social, Referral, Email, Affiliate, MCP/AI-referral, Internal). Derived from
  `(source, medium, click ids, referrer)` by a deterministic classifier (§5.4).
- **First-touch / Last-touch / Multi-touch** — attribution _models_ (§9). We **store** first and last
  touch on the converting record and **retain the full path** so any model can be computed later.
- **Conversion** — a value-bearing outcome: signup, module activation, paid subscription (L-PLAT);
  account creation, order, RFQ, accepted quote (L-TEN).

## 4. The UTM taxonomy (the standard)

The cheapest, highest-leverage artifact, and the one piece usable **today** with zero code. A
controlled vocabulary prevents the same channel fragmenting into `producthunt` / `PH` / `product_hunt`
across reports. It governs **both** WizeWorks links and the in-product link builder we give tenants
(§11.3).

### 4.1 Parameter rules

- All values **lowercase, hyphen-delimited, ASCII** (`utm_campaign=ph-launch-2026-06`).
- `utm_source` — the **specific property**, from a controlled list (§4.2). Never a channel ("social").
- `utm_medium` — the **channel class**, from a fixed enum (§4.3). This is what the classifier trusts.
- `utm_campaign` — `{initiative}-{yyyy-mm}` (`founding-100-2026-06`), optionally `-{variant}`.
- `utm_content` — creative/placement discriminator for A/B (`hero-cta`, `comment-link`).
- `utm_term` — paid keyword only.
- Reserved: `utm_id` mirrors the campaign id when a paid platform needs a stable key.

### 4.2 `utm_source` controlled vocabulary (extensible registry)

`product-hunt · hacker-news · reddit · indie-hackers · mcp-registry · x · linkedin · youtube ·
google · bing · meta · tiktok · newsletter · partner-{name} · sparxcms · sparxcrm · sparxemail ·
sparxb2b`. New sources are added to `packages/attribution/src/taxonomy.ts` (the single source of
truth) — not invented ad hoc in a link.

### 4.3 `utm_medium` fixed enum (drives channel classification)

`organic-social · paid-social · paid-search · cpc · display · referral · email · affiliate ·
community · qr · mcp`. The classifier (§5.4) maps medium → channel; an unknown medium falls to
`Referral` and raises a taxonomy-lint warning.

### 4.4 Link builder

- **Phase 0 (now):** a tracked spreadsheet/CSV checked in at `docs/launch/utm-links.csv`, generated
  by a tiny `packages/attribution` CLI that validates against the vocabulary and emits the encoded
  URLs for every launch channel (ties directly to the [launch plan](#)).
- **Phase 4:** an in-dashboard **Campaign Link Builder** for tenants — same validation, writes to a
  `utm_campaigns` registry (§8.4) so reports can show friendly campaign names and detect typo-drift.

## 5. The capture layer

### 5.1 Where capture runs

- **L-PLAT:** `apps/web` (all marketing routes) + the per-module marketing domains. Cookie scoped to
  the registrable domain **`.sparx.works`** so `app.sparx.works` can read first-touch at signup.
- **L-TEN:** `apps/site` storefronts. Cookie scoped to the storefront's registrable domain. For
  `*.sparx.zone` that's `.sparx.zone`; for a tenant **custom domain** it's that domain (handled in §6.2).

### 5.2 The attribution snapshot (the shared shape)

Every touch and every stored attribution column is a projection of one object:

```ts
// packages/attribution/src/types.ts
export interface AttributionSnapshot {
  source: string | null; // utm_source (normalized) or classifier-derived
  medium: string | null; // utm_medium or derived
  campaign: string | null;
  term: string | null;
  content: string | null;
  channel: Channel; // classifier output (§5.4)
  referrer: string | null; // document.referrer host+path, PII-stripped
  landingPath: string | null; // first path on this surface
  clickIds: {
    // captured only with `marketing` consent
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    fbclid?: string;
    ttclid?: string;
    li_fat_id?: string;
    msclkid?: string;
  };
  capturedAt: string; // ISO; from the edge, never client clock for ordering
}
```

`first_touch_*` and `last_touch_*` are two snapshots stored on the converting record; the full
ordered list lives in `attribution_touches` (§8).

### 5.3 Cookie / storage mechanics

- **`sparx_attr_first`** — set **once** (set-once semantics; never overwritten while present). Holds
  the first-touch snapshot. This is the durable "where they originally came from."
- **`sparx_attr_last`** — overwritten on every touch that carries new channel context (a bare repeat
  visit with no UTM and an internal referrer does **not** overwrite last-touch — that's the
  _last-non-direct_ rule baked into capture).
- **Visitor id** — on storefronts, **reuse `sparx_consent.visitorId`** (doc 42). On marketing,
  mint `sparx_attr_vid` (UUID) at the edge.
- **localStorage mirror** for resilience against cookie eviction; cookie is source of truth.
- **Edge-set, not just client JS.** A Next middleware (`apps/web/middleware.ts`,
  `apps/site/middleware.ts`) stamps the visitor-id cookie and a server-trusted `capturedAt` on first
  response, so capture survives a blocked client bundle (§7.2). Client JS enriches with
  `document.referrer` and UTM parsing.

### 5.4 Channel classification

A pure function `classify(snapshot, referrerHost): Channel` in `packages/attribution`:

1. Explicit `utm_medium` wins (enum → channel map).
2. Else a click id implies paid (`gclid → Paid Search`, `fbclid → Paid Social`, …).
3. Else referrer host against a maintained list (search engines → Organic Search; social hosts →
   Organic Social; known LLM/agent user-agents or `utm_medium=mcp` → **MCP/AI-referral**).
4. Else `Direct`.

> **Decision — MCP/AI-referral is a first-class channel.** Traffic arriving because an AI agent
> surfaced the tenant (or WizeWorks) is the channel we most want to measure given the positioning.
> Capture `utm_medium=mcp` on agent-emitted links and detect known agent UAs; report it separately.

### 5.5 Consent gating (non-negotiable — ties to doc 42)

Attribution is **not** strictly-necessary. It maps onto doc 42's four categories
(`strictly_necessary | preferences | analytics | marketing`):

- **`analytics` consent** gates: first/last-touch snapshots, `attribution_touches`, PostHog person
  profiles, channel/campaign attribution. Use `gateTracker({ category: 'analytics', load })` from
  `@sparx/legal` so capture only initializes when granted, and tears down on withdrawal.
- **`marketing` consent** gates the **click-id capture** (`gclid`/`fbclid`/…) and the §13 ad-platform
  send-back. Without it, `clickIds` is empty and no conversion API fires.
- **Cookieless essential fallback.** Under strictly-necessary only, we may keep an **aggregate,
  identifier-free** server count (channel tallies with no visitor id, no cookie) — defensible as
  essential measurement, never joined to a person. Identified attribution requires `analytics`.
- **GPC / Do-Not-Sell** honored: a Global Privacy Control signal forces `marketing` off and disables
  send-back regardless of banner state.

## 6. Cross-domain & identity stitching

### 6.1 Anonymous → identified

- **L-PLAT:** the `.sparx.works` cookie is readable by `app.sparx.works`. The signup handler
  (Better Auth) reads `sparx_attr_first`/`_last`, attaches them to `tenant.created` (§8.5), writes
  `tenants.acquisition_*`, and calls `posthog.identify(userId, {}, { $set_once: firstTouch })` so the
  PostHog person inherits true first-touch.
- **L-TEN:** at `@sparx/customer-auth` account creation or first authenticated checkout, resolve
  `sparx_consent.visitorId → customerId`. The CRM spine ([doc 11](11-crm-prd.md)) gets first/last-touch
  columns; the order gets an attribution snapshot at creation. The **append-only CRM activity**
  timeline records an `attribution.identified` activity, so the journey shows on the customer card.

### 6.2 True cross-domain (different registrable domains)

A tenant on a **custom domain** whose checkout or account lives on `*.sparx.zone` crosses an eTLD+1
boundary the cookie can't span. Handle with **link decoration**: the storefront appends a short-lived
signed `?_sx=` handoff param (the visitor id + a capture nonce) to cross-origin navigations into the
Sparx-hosted surface; the receiving middleware mints/reconciles the cookie from it. Same mechanism we
use for `sparx.works → app.sparx.works` when a future custom WizeWorks domain is involved. No
third-party cookies, ever.

### 6.3 Merge semantics

On identity resolution, prior anonymous touches for that visitor id are **back-linked** (not copied)
to the principal; first-touch is `$set_once`, last-touch updates. A visitor who later signs in on a
second device is unified at the principal level once both devices identify (deterministic, never
probabilistic fingerprinting — see non-goals §18).

## 7. Server-side pipeline & resilience

### 7.1 Capture endpoint + event bus

A server endpoint `POST /v1/attribution/touch` (`services/api-rest`) accepts the snapshot, validates
it, writes `attribution_touches` (tenant-scoped) or the platform table, and publishes
`attribution.touch.recorded` on the Pub/Sub bus (`@sparx/events`). Conversions **enrich existing
events rather than minting parallel ones**: `tenant.created`, `customer.created` /
`customer.subscribed`, and `order.created` each carry an `attribution` block. Where a CRM consumer
needs it, follow the **two-bus rule** (`publishCrmEvent` _and_ the platform bus — see the CRM
delivery footgun) so the attribution-aware consumer actually receives it.

### 7.2 Ad-blocker / ITP resilience

- **PostHog reverse proxy.** Serve PostHog through a first-party path (`/ingest/*`) via a Caddy
  reverse-proxy route (or Next rewrite), so capture isn't blocked by third-party-host filters. (Note
  the [Caddy stale-config footgun](20-operational-runbook.md) — a proxy route is a Caddyfile change
  that needs a `bootstrap caddy` to take effect.)
- **Server-side conversions.** The value-bearing events (signup, order) are recorded **server-side**
  from the request context, so a blocked client bundle never loses a _conversion_ — only some
  top-of-funnel pageviews. Safari ITP's 7-day cap is mitigated by the edge-set first-party cookie and
  the server record.

### 7.3 Don't double-count

PostHog remains the **product-analytics** system of record for events/funnels; the Sparx tables are
the **attribution system of record** for revenue joins and the tenant-facing feature. The signup/order
conversion is written once server-side and mirrored to PostHog by `identify`/`capture` — the DB row is
canonical for money, PostHog for behavior.

## 8. Data model

All tenant-scoped tables are `ENABLE`+`FORCE` RLS with a `tenant_id` and the standard
`tenant_isolation` policy (hand-edited SQL per [packages/db/CLAUDE.md](../packages/db/CLAUDE.md)).
Platform-acquisition tables are **system-scoped** (no `tenant_id`; read only by WizeWorks internal
tooling), following the non-RLS auth-domain pattern used by `domains` / `billing_subscriptions`.

### 8.1 `attribution_touches` (tenant, append-only)

`id · tenant_id · visitor_id · session_id · snapshot (jsonb) · channel · customer_id (nullable FK) ·
order_id (nullable FK) · occurred_at`. Append-only like `audit_logs` / `consent_records`. Indexed on
`(tenant_id, visitor_id, occurred_at)` and `(tenant_id, channel, occurred_at)`.

### 8.2 `attribution_visitors` (tenant)

1:1 with a storefront visitor id: `tenant_id · visitor_id (PK part) · first_touch (jsonb) ·
last_touch (jsonb) · first_seen_at · last_seen_at · customer_id (nullable)`. `visitor_id` **is**
`sparx_consent.visitorId`. Set-once on `first_touch`.

### 8.3 Attribution columns on existing records

- `customers` (CRM spine): `first_touch_channel`, `first_touch_source`, `first_touch_campaign`,
  `first_touch_at`, `last_touch_*`, `acquisition_channel` (the chosen-model winner).
- `orders`: `attributed_channel`, `attributed_source`, `attributed_campaign`, `attribution_model`
  (the model used at write time), plus the raw `attribution` jsonb snapshot for recomputation.
- `tenants` (platform): `acquisition_channel`, `acquisition_source`, `acquisition_campaign`,
  `acquisition_first_touch (jsonb)`, `acquisition_last_touch (jsonb)`, `acquired_at`.

### 8.4 `utm_campaigns` (tenant + platform registry)

`id · scope (tenant|platform) · tenant_id (nullable) · source · medium · campaign · friendly_name ·
created_by · created_at`. Backs the link builder (§4.4) and gives reports human names + typo-drift
detection.

### 8.5 Event payload additions

```ts
// carried on tenant.created, customer.created, customer.subscribed, order.created
attribution?: {
  firstTouch: AttributionSnapshot;
  lastTouch: AttributionSnapshot;
  model: AttributionModel;        // which model populated the denormalized columns
  visitorId: string;
}
```

## 9. Attribution models & revenue

- **Stored on the record:** first-touch + last-touch (cheap, always available).
- **Computed at report time** from `attribution_touches`: `first` · `last` · **`last-non-direct`**
  (default for revenue) · `linear` · `position-based` (40/20/40) · `time-decay` (7-day half-life).
- **Revenue attribution** flows `order.total → customer → touch path`, fractionally split per the
  selected model. Subscription revenue (L-PLAT) attributes Stripe MRR/LTV to the tenant's acquisition
  touch path — so a channel report shows **LTV by channel**, not just signups.
- **Lookback windows** (configurable): tenant default 30-day click / 1-day view; platform default
  90-day click (B2B sales cycles are long; a PH visitor who converts 6 weeks later still counts).
- Models recompute from the retained path; changing the default never loses history.

## 10. Platform-level use (WizeWorks launch & growth)

- **Acquisition funnel:** visit → signup → activation (live site / first order) → paid (Stripe) →
  retained. Each stage broken down by channel/campaign, sourced from `tenants.acquisition_*` joined to
  billing.
- **Launch-day view:** real-time channel tallies for the PH/HN/Reddit/MCP-registry drop, fed by the
  `utm-links.csv` taxonomy so every link is pre-tagged. This is what tells you, mid-launch, that HN is
  out-converting PH 5:1 and to put your energy there.
- **Channel ROI:** cost (paid spend, imported) vs LTV (Stripe). The one report that reallocates the
  next launch budget.

**Shipped (interim):** the acquisition funnel above is exposed today as a cross-tenant **internal
endpoint** — `GET /internal/acquisition/summary` (JSON, or `?format=csv`; optional `since`/`until`
window) — aggregating `tenants.acquisition_*` by channel / source / campaign with a `with_billing`
conversion proxy (`stripeCustomerId` set). It is **not** a dashboard page: Sparx has no cross-tenant
operator login yet (see [docs/16 §2.4](16-auth-security.md)), so the report runs as a
System/Internal principal behind a shared-secret header (`X-Sparx-Internal-Acquisition-Token`,
[docs/16 §2.5](16-auth-security.md)). A real launch-day operator console lands when the platform-operator
auth tier is built.

## 11. Tenant-level use (product feature)

### 11.1 Reports

Channel report, campaign performance, top landing pages, new-vs-returning, and **revenue by channel**
— in the Commerce/CRM dashboard surface, respecting the dashboard working-area standard
([doc 34](34-platform-glossary.md)).

### 11.2 Customer journey

The full ordered touch path renders on the **CRM customer card** activity timeline (append-only
activities, [doc 11](11-crm-prd.md)) — "Found you via Organic Search → Email campaign → bought." This
is the HubSpot-parity feature that justifies the CRM module.

### 11.3 In-product campaign link builder

The §4.4 builder, tenant-scoped, writing `utm_campaigns`. A tenant tags their own newsletter / IG /
ad links and sees them resolve in reports with friendly names.

## 12. MCP / AI surface (the differentiator)

Attribution tools on the tenant's MCP server ([doc 07](07-mcp-server-spec.md)), scoped + audited like
every tool:

- `get_channel_report({ range, model? })` — revenue & conversions by channel.
- `get_campaign_performance({ campaign?, range })` — per-campaign spend/return.
- `get_customer_journey({ customerId })` — the ordered touch path for one customer.
- `get_attribution_for_order({ orderId })` — what produced a specific sale.

This is the literal payoff of the launch tagline: _ask your AI "which campaign drove the most revenue
last month" and get a real answer_ — because the data is first-party and modeled, not trapped in a
third-party analytics silo.

## 13. Ad-platform conversion loop (paid scaling)

When a tenant (or WizeWorks) runs paid acquisition, close the loop **server-side**, gated on
`marketing` consent + ad-platform consent mode:

- **Google Ads** — Enhanced Conversions + offline conversion import via `gclid`/`gbraid`/`wbraid`.
- **Meta** — Conversions API (`fbclid`/`_fbp` + hashed PII) for signup/purchase.
- **TikTok / LinkedIn / Microsoft** — Events APIs via `ttclid` / `li_fat_id` / `msclkid`.

Credentials live behind the integrations/marketplace surface ([doc 60](60-marketplace.md)); each send
is consent-checked and audit-logged. PII for matching is hashed (SHA-256) before transmission, never
stored in plaintext for this purpose.

## 14. Privacy, consent & compliance

- **Consent-first** (§5.5): no identified capture without `analytics`; no click-ids / send-back
  without `marketing`; GPC forces marketing off.
- **First-party only.** No third-party cookies, no cross-site fingerprinting, no probabilistic
  cross-device. Identity is deterministic (a real login) or it doesn't happen.
- **IP** truncated/anonymized at the edge; geo derived then the raw IP dropped.
- **Retention:** raw `attribution_touches` 25 months (Google Ads parity), then aggregated and the row
  pruned; aggregates kept indefinitely.
- **DSAR/erasure:** attribution rows key on `customer_id`/`visitor_id`, so a deletion request cascades
  via the existing CRM erasure path; the L3 DPA ([doc 42](42-legal-and-consent.md)) is updated to name
  attribution processing and the ad-platform sub-processors.
- **Tenant-configurable.** A tenant can disable attribution capture entirely (a `consent_settings`
  sibling), and choose their lookback/model defaults.

## 15. Reporting & warehouse

- **PostHog** for behavioral funnels/retention (system of record for events).
- **Sparx DB** for revenue-joined attribution (system of record for money) — the tenant-facing reports
  query this directly via `api-rest`, RLS-scoped.
- **Warehouse (Phase 6):** export touches + conversions to **BigQuery** (GCP-native) for SQL and
  large-window multi-touch recompute. Optionally surfaced back into a Builder page through the
  [doc 63](63-external-data-connections.md) `ext.*` DataSource mechanism — a tenant binding their own
  attribution warehouse into a custom dashboard widget.

## 16. Events catalog (additions)

| Event                                      | Bus                          | Payload addition                         |
| ------------------------------------------ | ---------------------------- | ---------------------------------------- |
| `attribution.touch.recorded`               | platform                     | full `AttributionSnapshot` + `visitorId` |
| `tenant.created`                           | platform                     | `attribution` block (§8.5)               |
| `customer.created` / `customer.subscribed` | CRM **+** platform (two-bus) | `attribution` block                      |
| `order.created`                            | platform                     | `attribution` block                      |

## 17. Phased build plan

Sequenced like the Tier/Billing plans. Each phase is production-complete, module-gated where it
touches a module, RLS on every tenant table, event-driven, conventional commits.

- **Phase 0 — Taxonomy (now, zero app code).** `packages/attribution` with `taxonomy.ts` +
  `classify()` + a validating link-builder CLI; `docs/launch/utm-links.csv` for every launch channel.
  Unblocks the launch immediately; nothing else depends on app changes.
- **Phase 1 — Platform acquisition (launch-critical).** Edge + client capture on `apps/web`
  (`.sparx.works` cookie, set-once first-touch, last-non-direct last-touch, consent-gated);
  read-at-signup in `app.sparx.works`; `tenants.acquisition_*` migration; PostHog `identify`
  `$set_once`; an internal channel/funnel dashboard. **This is the slice that must precede the first
  paid/PH/HN push.**
- **Phase 2 — Server pipeline & resilience.** `POST /v1/attribution/touch`,
  `attribution.touch.recorded`, PostHog reverse proxy (Caddy), Stripe paid-conversion → LTV-by-channel.
- **Phase 3 — Tenant commerce capture.** `apps/site` capture reusing `sparx_consent.visitorId`, gated
  via `gateTracker('analytics')`; `attribution_visitors` + `attribution_touches` (RLS); snapshot onto
  `customers` (at customer-auth) and `orders` (at checkout); custom-domain `?_sx=` handoff.
- **Phase 4 — Tenant reporting + MCP.** Dashboard channel/campaign/revenue reports; customer-journey on
  the CRM timeline; the four MCP tools; in-product campaign link builder + `utm_campaigns`.
- **Phase 5 — Ad-platform loop.** Meta CAPI, Google Enhanced/offline, TikTok/LinkedIn/Microsoft;
  `marketing`-gated, consent-mode, hashed PII, audit-logged; credentials via integrations.
- **Phase 6 — Multi-touch & warehouse.** Linear/position/time-decay report-time models; BigQuery
  export; optional `ext.*` binding; anomaly alerts ("Paid Social CPA up 40% w/w").

## 18. Non-goals

- Not a replacement for PostHog/GA as the product-analytics tool — Sparx complements them with
  **revenue-joined, first-party, MCP-readable** attribution.
- Not a full BI suite (no arbitrary pivot builder in v1; reports are curated + MCP-queryable).
- No fingerprinting, no probabilistic cross-device, no third-party-cookie reliance, no buying
  third-party identity graphs.
- Not last-click-only — last-click is a _view_, not the architecture.

## 19. Open questions / decisions to lock

1. **Platform-attribution storage:** dedicated system schema vs the WizeWorks tenant-of-record +
   denormalized `tenants.acquisition_*`. (Leaning: tenant-of-record for the engine, `tenants.*` for
   fast reads.)
2. **Default tenant revenue model:** `last-non-direct` (proposed) vs `position-based`.
3. **Own pixel vs PostHog-only** for top-of-funnel: do we ship a featherweight first-party beacon, or
   lean entirely on the proxied PostHog? (Leaning: PostHog proxied; our tables own conversions.)
4. **Ad-credential home:** integrations/marketplace ([doc 60](60-marketplace.md)) vs a dedicated
   attribution settings area.
5. **Retention window:** 25 months (proposed) vs shorter EU-default with a tenant override.

## 20. Related documents

[05 Data Model](05-data-model.md) · [07 MCP](07-mcp-server-spec.md) · [11 CRM](11-crm-prd.md) ·
[16 Auth & Security](16-auth-security.md) · [17 Billing](17-billing-subscriptions.md) ·
[27 Customer Accounts & Storefront Auth](27-customer-accounts-storefront-auth.md) ·
[42 Legal & Consent](42-legal-and-consent.md) · [50 SEO/AIO](50-seo-aio-discoverability.md) ·
[60 Marketplace](60-marketplace.md) · [63 External Data Connections](63-external-data-connections.md) ·
[67 Billing Build Plan](67-billing-build-plan.md)
