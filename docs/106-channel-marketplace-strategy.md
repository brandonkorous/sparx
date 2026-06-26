# sparx Platform — Channel & Marketplace Integration Strategy + Build Plan

**Version:** 1.4
**Author:** Brandon Korous
**Last Updated:** 2026-06-25

> **Implementation status (2026-06-25):** **P0 framework + P1 feed channels + P2 first order channel
> (TikTok Shop) are BUILT.** P0/P1: the `@sparx/channels` adapter contract + registry, the
> `channel-sync-worker` (catalog/inventory push), OAuth connect/callback + AES-256-GCM token storage
> (§4.6), Terraform, the Settings → Channels dashboard, and the **Google Shopping / Meta / Pinterest**
> feed adapters.
>
> **P2 (TikTok Shop — the first bidirectional ORDER channel):** the `TikTokShopAdapter` (signed Open-
> Platform calls, full contract), a global `channel_shop_links` shop_id→tenant directory (cross-tenant
> read / tenant-scoped write) so the app-level webhook can route, the public webhook
> `POST /v1/public/webhooks/channels/:slug` (verify → resolve tenant → `ingestOrder`), the
> `ingestChannelOrder` service (order + inventory decrement in ONE idempotent transaction, in api-rest),
> the worker's `order.fulfilled` → tracking push-back, and the dashboard Orders channel badge + filter.
> Inbound ingest runs in api-rest; outbound push stays in the worker.
>
> **Channel-revenue analytics consolidation is now BUILT (2026-06-25).** `reportingService`
> `channelComparison`/`channelRevenue`/`channelTopProducts` consolidate every channel by a _derived
> key_ (marketplace orders split by `source` slug, native orders by `channel` bucket — primitive +
> canonical labels in `@sparx/crm-schemas`), surfacing gross/fees/net-after-fees/AOV/share via
> `GET /v1/commerce/reports/channel-revenue` + `/channel-top-products`, the `get_channel_revenue`/
> `get_channel_comparison`/`get_channel_top_products` MCP tools, the Settings → Channels performance
> surface (per-connection 30-day GMV/Orders/AOV + a Revenue-by-channel card + a top-products drill), and
> the commerce overview's channel section (now source-split). Applies to every channel, not just TikTok.
>
> **P3 order-channel breadth (Etsy, Walmart, eBay, Faire) is now BUILT (2026-06-25).** Four order-shape
> adapters on the proven framework — fetch-only, no DB, registered in `registerBuiltinChannels()`.
> Crucially, only **Faire** has reliable order webhooks; **Etsy / Walmart / eBay are poll-based**, so P3
> added the **polling ingest path**: a `fetchOrders(auth, {since})` contract method, a
> `POST /internal/channels/poll` internal endpoint (cron-token auth, per-tenant loop) that pulls orders
> since a per-connection cursor (stored on `channel_connections.metadata.lastOrderPolledAt`, no
> migration) and ingests each through the SAME idempotent `ingestChannelOrder` as the webhook, and a
> `channel-order-poll` k8s CronJob (every 5 min). Outbound push (catalog/inventory/fulfillment) needed
> NO new infra — the existing worker pushes to any registered adapter. Connect specifics: Etsy uses
> OAuth2 with PKCE (a stateless verifier derived from the signed state), eBay OAuth2 with a RuName, Faire
> OAuth2 plus a webhook HMAC, and Walmart client-credentials (per-seller / Solution-Provider keys, not
> redirect OAuth).
>
> Every channel is gated `coming_soon` at runtime until its platform OAuth app is approved and its
> credentials are set in env (Google reuses the Search-Console client; the rest need their own) — it then
> flips `available` with no code change. Live end-to-end OAuth + push is unverifiable until those partner
> apps are approved; the code is complete and typecheck-green. **Next: file the P3 partner apps (Etsy
> commercial app, Walmart Marketplace / Solution Provider, eBay developer, Faire partner); P4 = Amazon
> (its own track).**

---

## 0. What this is

The unifying strategy **and** build plan for every external selling surface sparx connects to —
Etsy, Amazon, TikTok Shop, Meta (Instagram/Facebook), Google Shopping, Walmart, eBay, Pinterest,
Faire — **and** sparx's own first-party marketplace, sparx.market.

It is the **hub**. The per-integration detail docs stay where they are; this doc owns the parts that
cut across all of them:

1. The **selling-surface taxonomy** (§2) — the three shapes a "channel" can take, why they install and
   sync differently, and which subsystem owns each.
2. The **full platform set** (§3) — every surface we integrate, prioritized into a build sequence.
3. The **shared framework** (§4) — `@sparx/channels` + one generic `channel-sync-worker`, modeled on the
   already-built dropship adapter pattern, plus the exact data-model deltas and the inventory seam.
4. The **phased build sequence** (§6) and the **partner applications to file immediately** (§7).

It does **not** replace these — it sequences and unifies them:

- TikTok Shop deep spec → [docs/27](27-tiktok-shop-integration.md).
- Social/feed channels (Meta, Google Shopping, Pinterest) → [docs/71](71-social-commerce-channels.md).
- sparx.market first-party marketplace → [docs/archive/72](archive/72-sparx-market-architecture.md)
  (reframed here as a **first-party channel on this framework**, §4.7).
- Integration taxonomy + the `shape` discriminator → [docs/88](88-integrations-catalog.md).
- Inventory ledger (the hard prerequisite — **now satisfied**) → [docs/100](100-inventory-build-plan.md).

### Decisions locked (this doc)

| #   | Decision              | Choice                                                                                    | Rationale                                                                                                                  |
| --- | --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| C1  | sparx.market priority | **Parked behind external channels; ships as the framework's first-party channel**         | The spine has to exist either way; sparx.market becomes the **dogfood** that proves the adapter/worker/settlement path.    |
| C2  | Platform set          | **Build all of them** (the five named + Google Shopping, Walmart, eBay, Pinterest, Faire) | Full surface, not a token slice — channel breadth is the value. Sequenced by effort/lead-time, not scoped down.            |
| C3  | Channel runtime owner | **One generic `channel-sync-worker` + an adapter registry** (not one worker per channel)  | Scales — a new channel is a new adapter class, not a new deployment. Mirrors the built dropship/provider registry pattern. |

---

## 1. The two products people conflate

"Marketplace integration" blurs two genuinely different products. Keeping them separate is the whole
point — they install differently, sync differently, and only one of them is something sparx _owns_.

- **External channel integration** — connect a tenant's **existing** Etsy / Amazon / TikTok / Meta
  seller account so catalog, orders, and inventory sync. **sparx becomes the back-office
  system-of-record; the marketplace stays the storefront.** This is "automatically integrate individual
  stores." It is the foundation.
- **sparx.market** — a **destination sparx builds and owns**, where tenants opt products into a shared
  public catalog, sparx is _merchant-of-record_ (charges through sparx's own Stripe, settles to the
  tenant via ACH), and shoppers buy across tenants in one place. A demand-generation channel sparx
  controls + an SEO play.

**They share one spine.** Every order carries a `source`/`channel`; inventory lives in **one**
authoritative ledger and is pushed out to every connected surface; sparx.market is — architecturally —
just _one more channel_ whose orders happen to be born inside sparx instead of ingested from outside.
That is exactly why **C1** is correct: build the channel framework first, and sparx.market plugs into it
as a first-party channel that dogfoods the whole path.

> **One precision on "automatic":** order channels require per-tenant OAuth (the merchant authorizes
> their own account) — so it is **one-click connect**, not zero-touch. The only genuinely _automatic_
> (auto-enroll on store launch) surface is the **feed** side — Google Shopping especially
> ([docs/71 §9](71-social-commerce-channels.md)).

---

## 2. The three selling-surface shapes

A "channel" is one of three shapes. Lumping them together is what causes the confusion. All three map
onto [docs/88](88-integrations-catalog.md) shape #2 (**sales channel**); the feed shape is a
catalog-out-only sub-variant.

| Shape                        | Sync                                         | Checkout happens on     | Inventory dependency          | Examples                                        |
| ---------------------------- | -------------------------------------------- | ----------------------- | ----------------------------- | ----------------------------------------------- |
| **Order channel**            | Catalog **↔** Orders **↔** Inventory (2-way) | the marketplace         | **Hard** — must not oversell  | TikTok Shop, Etsy, Amazon, Walmart, eBay, Faire |
| **Feed / discovery channel** | Catalog **→** out only (+ ads)               | the tenant's sparx site | None — read-only catalog feed | Google Shopping, Meta (IG/FB), Pinterest        |
| **First-party destination**  | Orders **born in sparx**                     | sparx.market            | Hard — same ledger            | sparx.market                                    |

**Why the split matters for the build:** feed channels only _read_ the catalog, so they have **no
inventory dependency** and can ship first as fast wins. Order channels ingest orders that decrement
stock, so they are gated on the inventory ledger (§4.3) — which is already done.

> **Meta accuracy note.** Meta has wound down on-platform checkout for US merchants. For most tenants,
> Meta Shop = a **catalog feed + Instagram/Facebook ads that click through to the tenant's own sparx
> site** — a feed/discovery channel, **not** an order channel. Scope it like Google Shopping, not like
> TikTok. (The older framing in [docs/71](71-social-commerce-channels.md) treating Meta as a full order
> channel is corrected here.)

---

## 3. The platform set (C2 — all of them)

Build sequence is by **effort + partner-application lead time**, not scope. Tiers are a deploy order.

| Platform            | Shape       | API / Auth                                                 | Order vs Feed | Best-fit vertical                                    | Partner gate / lead time                                               | Tier |
| ------------------- | ----------- | ---------------------------------------------------------- | ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- | ---- |
| **Google Shopping** | Feed        | Merchant API (Content API for Shopping)                    | Feed          | Everyone (auto-enroll, free listings)                | GMC account; low                                                       | 1    |
| **Meta (IG/FB)**    | Feed        | Commerce/Catalog API, FB Login for Business                | Feed (+ ads)  | Every SMB                                            | Meta app review; **weeks**                                             | 1    |
| **Pinterest**       | Feed        | Catalogs API                                               | Feed          | Fashion, home, food                                  | App access; low                                                        | 1    |
| **TikTok Shop**     | Order       | Open Platform API, OAuth2 ISV app, webhooks                | Order         | Modern SMB / social impulse                          | **ISV partner app — weeks** ([docs/27](27-tiktok-shop-integration.md)) | 2    |
| **Etsy**            | Order       | Open API v3, OAuth2 PKCE                                   | Order         | Handmade, vintage, craft, supplies                   | Commercial app review; **weeks**                                       | 3    |
| **Walmart**         | Order       | Walmart Marketplace API                                    | Order         | General merch, home, electronics                     | Seller + API approval; **weeks**                                       | 3    |
| **eBay**            | Order       | Sell API (Inventory/Fulfillment/Account), OAuth2           | Order         | **Auto parts, industrial, refurb (Gillett)**         | Developer app; medium                                                  | 3    |
| **Faire**           | Order (B2B) | Faire sell-side API                                        | Order         | Wholesale brands → retailers (pairs with B2B module) | Partner approval; medium                                               | 3    |
| **Amazon**          | Order       | SP-API, LWA OAuth, restricted-PII audit, SQS notifications | Order         | Highest volume; brands, dropship                     | **SP-API dev registration + security audit — weeks→months**            | 4    |
| **sparx.market**    | First-party | (we own it)                                                | First-party   | Cross-tenant demand + SEO                            | none — sparx-owned                                                     | 5    |

---

## 4. Architecture

The pattern is **already built twice** — the dropship `SupplierAdapter`
([packages/dropship](../packages/dropship), e.g.
[printify.ts](../packages/dropship/src/adapters/printify.ts)) and the provider `ProviderBundle`
([packages/integration-framework](../packages/integration-framework)). Channels reuse the same shape:
an adapter interface, a registry, OAuth + `SecretReader` for tokens, a webhook router, and a worker.
Nothing here is invented from scratch.

### 4.1 `@sparx/channels` — the adapter contract

A new contract package (zero module deps → acyclic), modeled on `SupplierAdapter`. Each platform is one
adapter class implementing:

```typescript
interface ChannelAdapter {
  id: ChannelSlug; // 'tiktok_shop' | 'etsy' | 'amazon' | 'walmart' | 'ebay' | 'faire'
  name: string; // display
  shape: 'order' | 'feed'; // gates which methods are required (§2)

  // install / auth (reuses integration-framework OAuth + SecretReader)
  connectUrl(ctx: ChannelCtx): string; // returns OAuth URL
  exchangeCode(ctx, code): Promise<ChannelTokens>;
  refresh(ctx, conn): Promise<ChannelTokens>;

  // catalog out (both shapes)
  pushProduct(ctx, conn, product): Promise<ChannelProductRef>;
  removeProduct(ctx, conn, ref): Promise<void>;

  // order shape only — bidirectional
  ingestOrder?(ctx, conn, payload): Promise<NormalizedChannelOrder>;
  pushFulfillment?(ctx, conn, order, tracking): Promise<void>;
  pushInventory?(ctx, conn, variantRef, qty): Promise<void>;

  // optional analytics pull
  getAnalytics?(ctx, conn, period): Promise<ChannelAnalytics>;

  verifyWebhook?(req): boolean; // signature check for inbound webhooks
}
```

`channelRegistry.register(new TikTokShopAdapter())` at boot, exactly like dropship/providers. **Adding a
channel is one adapter class + one registry line — no change to core commerce.**

### 4.2 One generic `channel-sync-worker` (C3)

`services/channel-sync-worker` — a single Pub/Sub-driven service that dispatches on `source.channel`,
mirroring `dropship-worker`. It owns every async channel job:

- **Catalog push (out):** subscribes `product.created` / `product.updated` / `product.archived` →
  for each tenant connection where the product is opted-in, calls the adapter's `pushProduct`.
- **Inventory push (out):** subscribes `inventory.changed` → calls `pushInventory` on every connected
  channel for that variant. The **safety-buffer net** already built in `computeAvailability`
  ([docs/100 P5b](100-inventory-build-plan.md)) is what gets pushed, so the source→channel lag can't
  oversell.
- **Order ingest (in):** the worker exposes nothing inbound itself — webhooks land on api-rest
  (`/v1/channels/:channel/webhooks/*`, signature-verified via `verifyWebhook`), which normalizes via
  `ingestOrder` and writes the order through the existing order spine.
- **Fulfillment push (out):** subscribes `order.fulfilled` → `pushFulfillment` for channel-sourced
  orders.
- **Token refresh:** a scheduled tick refreshes tokens nearing expiry.

Failed pushes go to a **dead-letter queue with retry**; a channel push **never** mutates the sparx
ledger on failure (the ledger is authoritative — §4.3).

### 4.3 The inventory seam — single ledger writer (prerequisite satisfied)

This is the payoff of [docs/100](100-inventory-build-plan.md) being complete. The inventory ledger is a
**single-writer funnel** (`applyMovement()`) that is already concurrency-safe (row lock), idempotent
(`idempotencyKey`), and actor-attributed (`actorType ∈ {user, ai, system, integration}`). Channels are
just another `integration` writer:

- **Channel order in → decrement:** ingestion commits the sale through the same path checkout uses
  (`commitSaleOnTx`-equivalent), idempotency-keyed on `<channel>:<external_order_id>:<line>`, so a
  redelivered webhook decrements **once**. `source = '<channel>'`, `external_id` set.
- **Stock out → all channels:** any movement fires `inventory.changed`; the worker pushes the new
  sellable quantity to every connected channel. **sparx is the single source of truth across all
  channels** — overselling is structurally prevented because every channel reads one ledger.
- **Cancel / return:** the existing `order.cancelled` consumer + return restock already reverse via
  compensating movements — channel orders inherit this for free.

> Without the unified ledger this would oversell across every channel at once. Because inventory P1–P6
> shipped, the hardest correctness problem in multi-channel commerce is **already solved** — channels
> reuse it rather than re-implement it.

### 4.4 Data-model deltas

The order spine is **already half-primed** — [24-crm-orders.prisma](../packages/db/prisma/schema/24-crm-orders.prisma)
carries `channel` and `source`. The deltas:

- **`orders`** — add `externalId`, `externalStatus`, `channelFeeCents` (the marketplace's commission, so
  net revenue reconciles). Extend the `channel`/`source` vocabularies with the channel slugs
  (`tiktok_shop`, `etsy`, `amazon`, `walmart`, `ebay`, `faire`, `meta`, `sparx_market`).
- **`channel_connections`** (new, FORCE RLS) — `tenant_id`, `channel`, `status`
  (`active|paused|error|disconnected`), `external_id`/`shop_id`, **encrypted tokens**
  (`access_token_enc` / `refresh_token_enc` — AES-256-GCM ciphertext, never plaintext — §4.6),
  `token_expires_at`, `shop_name`, `last_synced_at`, `sync_errors` jsonb, `metadata` jsonb.
- **`channel_product_mappings`** (new, FORCE RLS) — `tenant_id`, `channel`, `sparx_product_id`,
  `sparx_variant_id`, `external_product_id`, `external_variant_id`, `external_sku`, `sync_enabled`,
  `last_synced_at`, `sync_error`. The **per-variant external-SKU map lives here** (variant grain, N
  channels) — no columns on `ProductVariant`.

All new tables follow the standard ENABLE+FORCE RLS + `tenant_isolation` pattern, hand-edited SQL via
the DB Migrate pipeline ([packages/db/CLAUDE.md](../packages/db/CLAUDE.md)).

### 4.5 Marketplace integration — the `shape` discriminator

Channels surface in the existing add-on marketplace ([docs/60](60-marketplace.md), live) under the
`integrations` category with `purpose = 'sales_channel'`. This requires the **`shape` discriminator**
that [docs/88 §8 P0](88-integrations-catalog.md) already flags as missing: a channel listing's acquire
action is **"Add channel"** (OAuth connect), not the provider-adapter **"Connect"**. Adding `shape` to
`MarketplaceIntegration` routes the install correctly. Build this in Phase 0.

### 4.6 OAuth + secrets

Two distinct secret tiers, stored differently:

- **Platform app credentials** (sparx's own registered OAuth app per channel — `GOOGLE_OAUTH_CLIENT_ID`
  /`_SECRET`, `META_APP_ID`/`_SECRET`, `PINTEREST_APP_ID`/`_SECRET`) are **platform env / Secret Manager**,
  low-cardinality and rarely rotated. Google Shopping reuses the existing Search Console Google web client
  (same client, Content API scope added). An adapter's `isConfigured()` reads these; a channel stays
  `coming_soon` until its pair is set, lighting up with **no code change**.
- **Per-tenant OAuth grants** (each tenant's access/refresh tokens) are **AES-256-GCM ciphertext on the
  `channel_connections` row** (`access_token_enc` / `refresh_token_enc`), keyed by `CHANNELS_TOKEN_KEY`, via
  `@sparx/channels/crypto` — **not** Secret Manager refs. These rotate constantly (Google access tokens
  expire hourly); a row cipher box rotates with a plain `UPDATE`, whereas a Secret-Manager ref would churn a
  billed, version-capped secret version per refresh per tenant. This mirrors the Search Console connector
  (the proven in-repo pattern). The CORE "never raw tokens on a row" rule is satisfied — the row holds
  ciphertext, and a DB leak alone yields no usable grant.

The connect flow mirrors Search Console: `GET /v1/channels/:slug/connect-url` signs a short-lived HS256
state (tenant + user + slug + redirect_uri), the dashboard redirects to the channel's consent screen, and
the callback route posts code+state to `POST /v1/channels/callback`, which verifies the state, exchanges
the code via the adapter, encrypts, and upserts the connection. The worker decrypts (and refreshes near
expiry) before each push.

### 4.7 sparx.market as a first-party channel (C1)

sparx.market reuses everything above with two differences: orders are **born in sparx** (not ingested),
and sparx is **merchant-of-record**. Concretely:

- The product opt-in (`public_listing`, `market_category` from [docs/72](archive/72-sparx-market-architecture.md))
  is the channel's "is this product on the channel" toggle — same model as `channel_product_mappings`.
- Checkout runs through **sparx's own Stripe account**; orders write `source = 'sparx_market'` on the
  same order spine and decrement the same ledger.
- A **settlement worker** computes `sales − commission − chargebacks` and ACH-transfers to the tenant
  weekly, emitting a settlement report (Postal/Mailgun) — the one net-new subsystem sparx.market needs.
- `apps/market` (the public shopping destination) is a new Next.js app; the `/market` route on apps/web
  today is the **add-on** marketplace (docs/60), a different surface — do not conflate.

Shipping sparx.market last means the order spine, inventory push, and analytics breakdown are already
battle-tested by the external channels before sparx puts its own name on the merchant-of-record line.

---

## 5. Per-platform integration notes

Brief, build-relevant notes; the deep specs live in 27/71. All write orders/inventory through the §4.3
seam.

- **Google Shopping** (feed) — Merchant API product feed; **auto-enroll on store launch** (opt-out), free
  organic listings in 3–5 days. No order management. Highest ROI/effort.
- **Meta IG/FB** (feed) — Commerce/Catalog API feed + product tags in posts/reels; clicks land on the
  tenant's sparx site (US on-platform checkout sunset). Pairs with Meta ads. FB Login for Business OAuth.
- **Pinterest** (feed) — Catalogs API product feed; high purchase-intent for fashion/home/food.
  Lightweight once the feed path exists.
- **TikTok Shop** (order) — full bidirectional; ISV app, OAuth, webhooks; GMV Max ad allocation
  requirement (1.5–5%) from July 2026. Spec complete: [docs/27](27-tiktok-shop-integration.md).
- **Etsy** (order) — OAuth2 PKCE; Listings + Inventory + Receipts (orders) APIs; quirky taxonomy
  (who-made-it / what-is-it / when-made) at listing time; commercial app review required.
- **Walmart** (order) — Marketplace API listings/orders/fulfillment; strict item-setup spec; GTIN/UPC
  required. Second-largest US marketplace.
- **eBay** (order) — Inventory + Fulfillment + Account APIs, OAuth2; **the natural fit for the Gillett
  parts/industrial/refurb vertical** and the B2B side.
- **Faire** (order, B2B) — sell-side wholesale; rides the existing B2B module (account pricing, net
  terms). Brands → retailers.
- **Amazon** (order) — SP-API + LWA OAuth + AWS-signed calls; **restricted-PII security audit**; SQS/
  EventBridge order notifications (not plain webhooks); per-category required attributes; FBA vs FBM. Its
  own track — a project, not a sprint.

---

## 6. Phased build sequence

Each phase is independently deployable (deploy-early); the whole surface is committed (phases are a
deploy order, not a scope cut).

| Phase     | Theme                                  | Ships                                                                                                                                                                            | Gated on            |
| --------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **P0**    | Framework                              | `@sparx/channels` + registry; `channel-sync-worker`; data-model deltas (§4.4); marketplace `shape` discriminator; OAuth/secrets wiring; channels dashboard (Settings → Channels) | —                   |
| **P1**    | Feed channels                          | Google Shopping (auto-enroll), Meta catalog feed, Pinterest — catalog-out, no order ingest                                                                                       | P0                  |
| **P2**    | First order channel — **TikTok Shop**  | Full bidirectional loop: connect → catalog sync → order ingest → fulfillment push → inventory sync → analytics ([docs/27](27-tiktok-shop-integration.md))                        | P0 (+ inventory ✅) |
| **P3** ✅ | Order-channel breadth                  | Etsy, Walmart, eBay, Faire — each an adapter on the proven framework + the **polling ingest path** (the three webhook-less channels) **— BUILT 2026-06-25**                      | P2                  |
| **P4**    | **Amazon**                             | SP-API + PII audit + category attributes + FBA/FBM — its own track                                                                                                               | P2                  |
| **P5**    | **sparx.market** (first-party channel) | `apps/market` destination + product-graph opt-in + sparx-MoR checkout + weekly ACH settlement worker                                                                             | P2 (proven spine)   |

**Deploy gates:** P0 — connect a sandbox channel, see it in Settings → Channels. P1 — a product appears
in Google Shopping / Meta catalog within the feed SLA. P2 — place a TikTok test order → sparx order
created, stock decremented (once, idempotent), fulfill → tracking pushed back. P3/P4 — same loop per
platform. P5 — buy a cross-tenant product on sparx.market → order + settlement record created, ACH
batch computed.

---

## 7. Partner applications — file immediately

These gate the build and approval takes **weeks**. The clock starts when you apply — this is the
highest-leverage zero-code action.

| Application                         | Where                                   | Gates | Lead time      |
| ----------------------------------- | --------------------------------------- | ----- | -------------- |
| TikTok Shop **ISV partner**         | partner.tiktokshop.com                  | P2    | weeks          |
| Amazon **SP-API developer + audit** | Seller Central → Developer registration | P4    | weeks → months |
| Meta **app review**                 | Meta for Developers                     | P1    | weeks          |
| Etsy **commercial app**             | Etsy Developers (Open API v3)           | P3    | weeks          |
| Walmart **Marketplace + API**       | Walmart Marketplace                     | P3    | weeks          |
| Google **Merchant Center API**      | GMC + Cloud project                     | P1    | days           |
| eBay **developer app**              | eBay Developers Program                 | P3    | days           |
| Pinterest **app access**            | Pinterest Developers                    | P1    | days           |
| Faire **partner**                   | Faire (sell-side)                       | P3    | medium         |

---

## 8. Cross-cutting (every phase)

- **RLS:** `channel_connections` + `channel_product_mappings` are tenant-scoped, ENABLE+FORCE,
  `tenant_isolation`; hand-edited SQL via the DB Migrate pipeline (mind the FORCE-RLS backfill footgun).
- **Secrets:** per-tenant OAuth grants are AES-256-GCM ciphertext on the `channel_connections` row
  (`@sparx/channels/crypto`, keyed `CHANNELS_TOKEN_KEY`), never plaintext; platform app credentials are
  env / Secret Manager (§4.6).
- **Idempotency:** order ingest + inventory commit are idempotency-keyed on the channel's external id, so
  redelivered webhooks apply once — reusing the ledger's `idempotencyKey` (§4.3).
- **Inventory invariant:** decrement in the sparx ledger first, push out second; failed pushes DLQ-retry,
  **never** re-increment the ledger.
- **Events:** `channel.connected`, `channel.disconnected`, `channel.product.synced`,
  `channel.order.ingested`, `channel.inventory.pushed`, `channel.sync.failed` — published via the shared
  low-level publisher; the worker consumes existing `product.*` / `inventory.changed` / `order.fulfilled`.
- **Rate limits:** every adapter call goes through a rate-limit-aware client with backoff (per-shop caps,
  e.g. TikTok 100/min — [docs/27 §12](27-tiktok-shop-integration.md)).
- **Conflict resolution / SKU mapping:** reuse the inventory sync machinery already built
  ([docs/100 P5](100-inventory-build-plan.md)) — unmapped-SKU review queue, one-source rules, last-writer
  ordering — for the catalog import direction.
- **Analytics:** revenue-by-channel breakdown + MCP tools (`get_channel_revenue`,
  `get_channel_comparison`, `get_top_products_by_channel`) surface every channel including sparx.market
  ([docs/71 §8](71-social-commerce-channels.md)).
- **Module gating:** channels are part of the **Commerce** module — no separate fee. A disabled Commerce
  module means no channel sync (404 + no workers), per the platform gating rule.
- **Testing:** per-adapter unit tests (mapping, auth, webhook signature) + a DB-backed seam test (ingest →
  decrement → fulfill → push) + a Playwright connect flow per channel (docs/19).

---

## 9. Open questions

- **Multi-channel listing conflicts** — when the same physical SKU is listed on Amazon + Walmart + the
  tenant's sparx site, the safety-buffer per channel (P5b) prevents oversell, but per-channel buffer
  _policy_ (reserve N for each marketplace) needs a UI. Defer to P3 when multi-order-channel is real.
- **sparx.market multi-merchant cart** — Phase 1 is single-merchant-per-cart; unified cart with split
  transfers is a later sparx.market slice ([docs/72 §5](archive/72-sparx-market-architecture.md)).
- **GMV Max automation** — TikTok's July-2026 ad-spend requirement: surface the required allocation in
  analytics first; automated campaign creation via the Marketing API is a later add ([docs/27 §8](27-tiktok-shop-integration.md)).
- **Amazon FBA** — FBM (merchant-fulfilled) first; FBA (Amazon-fulfilled, inventory held at Amazon)
  changes the inventory model (stock sits off-ledger at Amazon) and is its own P4 sub-phase.
