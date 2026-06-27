# sparx Platform — Local Shops Build Plan

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-26

---

## 0. What this is

The build plan for **Local Shops** — the scope decided in
[107-local-shops.md](107-local-shops.md). doc 107 is the feature + the binding decisions (D1–D7); this
doc is the _how_: package topology, the data-model deltas (with the hand-SQL PostGIS bits Prisma can't
generate), the five build phases, the exact integration points, and the footguns.

**Binding principles** (from [107 §3](107-local-shops.md#3-binding-decisions-do-not-re-litigate), do not
re-litigate):

- **Geo = PostGIS** (`geography` + `ST_DWithin` + GiST), one query alongside the existing FTS — no new
  infra (D1).
- **Geocode only with store-permitted providers** (US Census / in-DB TIGER / ZCTA centroids / GeoNames);
  never persist Google/HERE/Radar coordinates (D2).
- **Buyer location is a typed ZIP first**, geolocation is an optional primed enhancement, every feature
  works from a typed ZIP, coarse-only persistence (D3).
- **Hard radius** (D4); **list-first, map is a later toggle** (D5).
- **Fulfillment primitives live in `@sparx/commerce`** (reusable by the tenant storefront _and_
  sparx.market); discovery/directory/events live in the market layer (D6).
- **No new billing module** — local is a capability of sparx.market participation + the Commerce module
  (D7).

**Phases are build _order_, not scope tiers** — the whole surface is committed.

---

## 1. Current state we build on (not greenfield)

The P5 sparx.market spine is **built and deployed**; this completes it, it doesn't invent it.

| Already exists                                            | Location                                                                                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Market data model (listings/merchants/profile/settlement) | `packages/db/prisma/schema/80-market.prisma`                                                                                                                                                                         |
| Freeform merchant `location` string                       | `MarketMerchantProfile.location` + projected `MarketMerchant.location` (80-market.prisma)                                                                                                                            |
| **Address + `latitude`/`longitude` + `hoursOfOperation`** | `Warehouse` — `schema/34-commerce-inventory.prisma` (the geo + pickup-hours seam)                                                                                                                                    |
| Generated-column FTS precedent                            | `market_listings.search_tsv` (`GENERATED ALWAYS AS … STORED` + GIN) — the exact pattern `geo` will follow                                                                                                            |
| Faceted browse (`Prisma.sql`+`$queryRaw`+`withSystem`)    | `packages/commerce/src/services/market/browse.ts`                                                                                                                                                                    |
| Projection writer (assembles merchant identity)           | `packages/commerce/src/services/market/projection.ts` (`resolveMerchantIdentity`, `refreshMarketMerchant`)                                                                                                           |
| Merchant-of-record checkout branch                        | `packages/commerce/src/services/checkout-service.ts` (`channel='sparx_market'`)                                                                                                                                      |
| Order fulfillment (ship-only)                             | `schema/27-crm-order-fulfillments.prisma` (`carrier`/`trackingNumber`)                                                                                                                                               |
| Shipping zones/rates (ship-to-address)                    | `schema/44-commerce-shipping.prisma`                                                                                                                                                                                 |
| Market storefront (`mx-*`)                                | `apps/market/` (home/[category]/products/merchants/cart/checkout/orders/search)                                                                                                                                      |
| Public + authed market routes                             | `services/api-rest/src/routes/v1/public/market.ts`, `…/v1/market/index.ts`                                                                                                                                           |
| Tenant customer accounts (Layer-2 shopper auth)           | `packages/customer-auth` (Argon2id) + `apps/site/app/account/*` — **reusable, marketplace-scoped, for the committed sparx.market buyer account** ([107 §11 #5](107-local-shops.md#11-decisions-resolved-2026-06-26)) |
| Global cross-tenant projection RLS pattern                | `channel_shop_links` (ENABLE + `USING(true)` read + tenant-scoped write) — the template for `market_events`                                                                                                          |

**Postgres geo capability today:** only `pgcrypto` + `btree_gist` are enabled (grep of
`packages/db/prisma/migrations`). **No PostGIS** — P0 adds it.

---

## 2. Target architecture

### 2.1 Package topology

```
@sparx/geo                NEW — geocoding provider seam + ZCTA centroid table + distance/units helpers.
   ├─ depends on: nothing heavy (fetch + a bundled ZCTA dataset); server-safe, acyclic.
   └─ consumed by: @sparx/commerce (projection geocode-on-save), api-rest (address validation).
@sparx/commerce           EXTENDED — local-fulfillment primitives (pickup locations, delivery zones,
                          fulfillment-method) in the COMMERCE layer (reusable by storefront + market);
                          market services gain geo browse + events.
@sparx/commerce-schemas   EXTENDED — Zod for location, pickup, delivery-zone, fulfillment-method, events.
@sparx/db                 EXTENDED — schema + the hand-SQL PostGIS/RLS migrations.
apps/market               EXTENDED — location chip, local browse, checkout fork, event surfaces.
apps/site                 EXTENDED (P2) — reuse the commerce pickup/delivery primitives at storefront checkout.
apps/dashboard            EXTENDED — Settings → Market: location, pickup, delivery zones, appearances.
```

`@sparx/geo` is a **new workspace package** → it must be wired into the Dockerfile transitive closure of
**every** consumer (api-rest, commerce-indexer, dashboard, api-mcp, import-worker — anything that pulls
`@sparx/commerce`). See [§5 footgun #4](#5-footguns).

### 2.2 The two layers (D6)

- **Commerce primitives** (`@sparx/commerce` + `schema/27`,`44`-adjacent + Order): `fulfillmentMethod`,
  `MarketPickupLocation`, `MarketDeliveryZone`, zone-matching, slot computation. Channel-agnostic.
- **Marketplace geo** (`market/*` services + `apps/market`): the global `MarketMerchant.geo` projection,
  cross-tenant radius browse, `MarketEvent` directory, "near me"/city surfaces. sparx.market-specific.

---

## 3. Data-model deltas

Prisma migrations authored against docker Postgres, applied to prod via the **DB Migrate pipeline**
([db-migration skill](../.claude/skills/db-migration/SKILL.md)). RLS + PostGIS bits are **hand-SQL** —
Prisma generates neither.

### 3.1 PostGIS + the `geo` generated column (the hand-SQL keystone)

```sql
-- P0 migration, hand-appended:
CREATE EXTENSION IF NOT EXISTS postgis;

-- lat/lng are ordinary Prisma Float columns. `geo` is a GENERATED geography column
-- derived from them — the SAME pattern as market_listings.search_tsv. App code never
-- writes geo; it falls out of lat/lng. GiST index powers ST_DWithin.
ALTER TABLE "market_merchants"
  ADD COLUMN "geo" geography(Point,4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude","latitude"),4326)::geography) STORED;
CREATE INDEX "market_merchants_geo_idx" ON "market_merchants" USING GIST ("geo");
```

In `schema.prisma` the `geo` column is declared `Unsupported("geography(Point, 4326)")` (Prisma can't
model it; reads go through `$queryRaw`, exactly like the existing market browse). Same generated-`geo`
treatment for `market_pickup_locations` and `market_events`.

### 3.2 Tables & columns

| Table                         | Kind                             | Adds                                                                                                                                                                                                                                          | RLS                                                              |
| ----------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `market_merchant_profiles`    | tenant truth (FORCE RLS, exists) | structured address (`address_line1/2`,`city`,`region`,`postal_code`,`country`), `latitude`,`longitude`,`geocode_status`,`geocoded_at`,`location_public`,`offers_pickup`,`offers_local_delivery`,`offers_shipping`,`discovery_location_source` | unchanged `tenant_isolation`                                     |
| `market_merchants`            | global projection (exists)       | `latitude`,`longitude`,**generated `geo`**+GiST,`city`,`region`,`postal_code`,`country`,capability flags                                                                                                                                      | unchanged (ENABLE, cross-tenant `USING(true)` read)              |
| `market_pickup_locations`     | tenant truth — **NEW**           | `name`,address,`latitude`,`longitude`,gen `geo`,`hours`(JSON),`instructions`,`prep_lead_minutes`,`is_primary`,`warehouse_id?`                                                                                                                 | `ENABLE`+`FORCE`+`tenant_isolation`                              |
| `market_delivery_zones`       | tenant truth — **NEW**           | `type`(radius\|postal),`radius_meters?`,`postal_codes[]?`,`fee_cents`,`minimum_cents`,`estimated_minutes`,`tiers`(JSON)                                                                                                                       | `ENABLE`+`FORCE`+`tenant_isolation`                              |
| `orders`                      | tenant truth (exists)            | `fulfillment_method` (`ship`\|`local_pickup`\|`local_delivery`\|`market_pickup`, default `ship`)                                                                                                                                              | unchanged                                                        |
| `order_fulfillments`          | tenant truth (exists)            | `pickup_location_id?`,`pickup_slot_start?`,`pickup_slot_end?`,`picked_up_at?`,`delivery_zone_id?`,`delivery_window_start/end?`,`delivered_at?`,`event_occurrence_id?`                                                                         | unchanged                                                        |
| `market_events`               | global directory — **NEW**       | `name`,`slug`,address,gen `geo`,`description`,`organizer_name`,`url`,`status`                                                                                                                                                                 | ENABLE + cross-tenant `USING(true)` read; **admin/system write** |
| `market_event_occurrences`    | global — **NEW**                 | `event_id`,`date`,`starts_at`,`ends_at`,`status`                                                                                                                                                                                              | ENABLE + `USING(true)` read; admin/system write                  |
| `market_merchant_appearances` | tenant truth — **NEW**           | `occurrence_id`,`booth_label?`,`accepts_preorders`,`notes?` (+ a projected global read row for "who's at this market")                                                                                                                        | `ENABLE`+`FORCE`+`tenant_isolation`                              |

**Default-`ship` is the backward-compatibility guarantee** — every existing order path, storefront and
B2B, keeps its exact behavior; the new methods only fire when explicitly chosen.

---

## 4. Phases

### P0 — Geo foundation

_Goal: coordinates exist, are indexed, and refresh on save. No buyer-visible change yet._

- **S0.1** Migration: `CREATE EXTENSION postgis`; add lat/lng + generated `geo` + GiST to
  `market_merchants`; structured address + lat/lng + flags to `market_merchant_profiles`. Apply to
  docker; verify `prisma migrate status` clean.
- **S0.2** `@sparx/geo`: the geocoder seam (`geocode()` over US Census + a bundled **ZCTA centroid**
  table for instant ZIP→point, provider-abstracted) + distance/units helpers. Unit-test the ZCTA join
  and a Census call (mocked).
- **S0.3** Projection writer ([projection.ts](../packages/commerce/src/services/market/projection.ts)):
  on `refreshMarketMerchant`, **geocode-on-save** — if the address changed since `geocoded_at`, resolve
  lat/lng via `@sparx/geo` and write them (the `geo` column derives automatically). Skip when unchanged
  (don't re-geocode hot). Best-effort: a geocode failure sets `geocode_status='failed'` and still
  projects the row (no coords = not discoverable, not broken).
- **S0.4** Dashboard Settings → Market: structured location form + geocode-status indicator +
  "show exact vs. city-only" toggle + discovery-source selector. Authed route
  `PUT /v1/market/profile` extended.
- **Integration points:** `market/projection.ts`, `market/merchant.ts`, `v1/market/index.ts`,
  `apps/dashboard/.../settings/market`. **Verify:** edit a merchant address → row gets lat/lng + `geo`;
  `SELECT ST_AsText(geo)` returns the point.

### P1 — Local discovery (Axis A)

_Goal: a buyer can browse "shops/products near me"._

- **S1.1** `@sparx/commerce-schemas`: extend `MarketBrowseQuery` with `nearLat`,`nearLng`,`radiusMeters`
  (+ a `near` ZIP that resolves server-side via `@sparx/geo`). Hard-radius semantics.
- **S1.2** `browse.ts`: compose `ST_DWithin(geo, :pt, :radius)` into the existing `$queryRaw` WHERE and
  add a `nearest` sort (`ORDER BY ST_Distance(...)`), returning `meters` for the card. `listMerchants`
  gains the same. Cross-tenant `withSystem` unchanged.
- **S1.3** api-rest `public/market.ts`: thread the geo params through `BrowseQuery` + `MerchantsQuery`.
- **S1.4** `apps/market`: header **location chip** (typed ZIP source of truth + primed "use my
  location" gesture, coarse-only persistence in local storage); radius preset chips (5/10/25/50 mi);
  nearest-first sort; **"X mi away"** on cards; conditional **capability badges** (pickup/delivery near
  you, gated on computed distance) via `<Badge color={statusTone()} variant="soft">`.
- **S1.5** SEO surfaces: `/near-me`, `/[city]`, `/[city]/[category]` generated from live data
  (sitemap + unique per-page seller cards/counts).
- **Verify:** set ZIP → results are within radius, nearest-first, distance shown; a far-away shop is
  excluded (hard cutoff); typed-ZIP path works with geolocation denied.

### P2 — Local fulfillment (Axis B) — the cross-cutting core

_Goal: a nearby order can be picked up or locally delivered, in market AND on the tenant storefront._

- **S2.1** Schema: `Order.fulfillment_method`; `OrderFulfillment` method fields; **NEW**
  `market_pickup_locations` + `market_delivery_zones` (FORCE RLS) with generated `geo` on pickup
  locations. (Naming note: these live in the commerce/market layer but are reusable primitives — see
  D6; keep the table prefix consistent with the migration.)
- **S2.2** `@sparx/commerce` primitives: pickup-location CRUD + slot computation (`hours` +
  `prep_lead_minutes`); delivery-zone CRUD + **`resolveDeliveryZone(address)`** (radius via `ST_DWithin`
  or postal-list match → fee/minimum/tier). Channel-agnostic service functions.
- **S2.3** **Checkout fork** ([checkout-service.ts](../packages/commerce/src/services/checkout-service.ts)):
  the session carries `fulfillmentMethod`; branch the shipping/quote step — `ship` (unchanged),
  `local_pickup` (pick location + slot, zero shipping), `local_delivery` (in-zone address check +
  fee + window). MoR charge + `MarketSettlement` accrual unchanged (only the shipping/fee line differs).
- **S2.4** api-rest `public/market.ts`: checkout endpoints accept `fulfillmentMethod` + the
  method-specific payloads; pickup/zone read endpoints for the storefront.
- **S2.5** `apps/market` checkout: method selector + pickup-slot picker + delivery-address in-zone
  validation + fee display.
- **S2.6** **Reuse in `apps/site`:** wire the same commerce primitives into the tenant storefront
  checkout (the standalone payoff for small shops on their own site).
- **S2.7** Dashboard: pickup-location + delivery-zone management in Settings → Market (and the storefront
  fulfillment settings).
- **Verify:** a local-pickup order completes with no shipping address + a chosen slot; a delivery order
  inside a zone gets the right fee, one outside is refused; an order on the tenant's own storefront can
  be picked up.

### P3 — In-person markets & events (Axis C)

_Goal: discover markets near me, see which shops attend, pre-order for pickup-at-market._

- **S3.1** Schema: **NEW** global `market_events` + `market_event_occurrences` (admin/system write,
  cross-tenant read; generated `geo` on events) + tenant `market_merchant_appearances` (FORCE RLS) +
  its global projected read row.
- **S3.2** `@sparx/commerce` market services: event directory reads (events near me + occurrences),
  appearance CRUD, projection of appearances to the global read row.
- **S3.3** `market_pickup` fulfillment method: at checkout, reserve for pickup at an occurrence (ties
  `OrderFulfillment.event_occurrence_id`); MoR charge/hold.
- **S3.4** api-rest: public event-discovery endpoints + authed appearance management.
- **S3.5** `apps/market`: "markets near me" surface, per-event "who's here", "this shop will be at
  \<market\> on \<date\>" on merchant/product pages, market-pickup checkout, event SEO pages.
- **S3.6** Dashboard: declare appearances (pick from the curated directory, toggle pre-orders).
- **Verify:** a curated market shows nearby; a shop's declared appearance surfaces on its page; a
  market-pickup order ties to the occurrence.

### P4 — Enhancements (committed, lower-urgency)

- **S4.1** Map view: MapLibre GL JS + hosted tile SKU (MapTiler), OSM attribution, clustered pins,
  "search this area", list↔pin highlight — a toggle off the list.
- **S4.2** Courier last-mile seam (a `MarketDeliveryProvider` interface mirroring the payout-provider
  seam; integration deferred until demand).
- **S4.3** GeoNames international geocoding in `@sparx/geo`.
- **S4.4** (decision-gated) verified-address neighborhood scoping; buyer accounts with saved location
  ([107 §11](107-local-shops.md#11-open-questions--decisions-for-brandon)).

### Committed dependency — sparx.market buyer account

Decided in [107 §11 #5](107-local-shops.md#11-decisions-resolved-2026-06-26): sparx.market gets a
**marketplace-scoped buyer account** (saved default location + pickup preferences + cross-seller order
history), built by **reusing `packages/customer-auth` scoped to the marketplace** — not a third auth
system — linking to the per-seller `Customer` records checkout already ensures on purchase. It's a
sparx.market foundation broader than Local Shops, surfaced here because **local discovery is its first
consumer** (the saved location): it lands **alongside P1** so the location chip persists for signed-in
buyers. It may get its own short spec when built, and it is **not** a blocker for guest checkout, which
stays first-class.

---

## 5. Footguns

1. **`CREATE EXTENSION postgis` privilege.** In prod, `sparx_owner` is a **non-superuser**. On Cloud
   SQL, PostGIS is allowlisted but creating it requires the `cloudsqlsuperuser` role. **Confirm the DB
   Migrate runner role can create PostGIS** before P0 ships — if not, the extension is a one-time
   privileged grant out-of-band (like the documented secret-version step), and the migration just
   `CREATE EXTENSION IF NOT EXISTS`. Test the whole P0 migration against a fresh DB.
2. **`geo` is `Unsupported` in Prisma — read via `$queryRaw` only.** Never try to select `geo` through
   Prisma Client. Generated-column derivation (from lat/lng) means app code never writes it; reads use
   the existing `$queryRaw`+`withSystem` browse path. Mirror the `search_tsv` precedent exactly.
3. **Geocoding ToS (D2).** Only persist coordinates from store-permitted providers (US Census / in-DB
   TIGER / ZCTA / GeoNames). **Do not** wire a provider whose terms forbid storage (the major commercial
   geocoders cap caching at ~30 days) — we store coords to index them, so that's disqualifying. The
   `@sparx/geo` seam must make the provider choice explicit, not incidental.
4. **`@sparx/geo` Dockerfile transitive closure.** New workspace package → add its `COPY` to **every**
   consumer Dockerfile, direct and transitive (api-rest, commerce-indexer, dashboard, api-mcp,
   import-worker — anything pulling `@sparx/commerce`). A missing COPY is an ESM boot crash that
   typecheck/lint won't catch ([new-workspace-package skill](../.claude/skills/new-workspace-package/SKILL.md)).
5. **RLS on the new tables.** Tenant-truth tables (`market_pickup_locations`, `market_delivery_zones`,
   `market_merchant_appearances`) get `ENABLE`+`FORCE`+`tenant_isolation` (hand-SQL). Global directory
   tables (`market_events`, `market_event_occurrences`) follow the `channel_shop_links` pattern:
   `ENABLE`, `USING(true)` cross-tenant SELECT, **writes restricted to admin/system** (these are
   platform-curated, not tenant-owned) — do **not** add a tenant-scoped write policy that would let any
   tenant mutate the shared directory.
6. **Geocode-on-save, not on-read.** Geocoding is the slow/external step — do it once in the projection
   writer when the address changes, never in the browse hot path. Guard on `geocoded_at` vs. address
   change. A geocode failure must not block projection (set `geocode_status='failed'`, project without
   coords).
7. **Default-`ship` is sacred.** `Order.fulfillment_method` defaults to `ship`; the checkout fork must
   only diverge for the new methods. Re-run the existing storefront + B2B + market(ship) checkout tests
   to prove zero behavior change on the default path.
8. **Hard radius (D4).** `ST_DWithin` is the filter; never substitute a soft "rank by distance but show
   everything" radius. A test asserts an out-of-radius shop is absent.

---

## 6. Verification (per phase, the platform way)

- Author migrations against docker Postgres; `prisma migrate status` + `validate` clean; PostGIS objects
  created (`SELECT postgis_version()`), generated `geo` populated (`ST_AsText`), GiST index present.
- Service-layer first (the API exists before the UI): geo browse, zone resolution, slot computation,
  event reads as unit/integration tests.
- Then drive the storefront + dashboard in the browser **one surface at a time** (no bulk fan-out) — set
  a ZIP and confirm radius/distance/badges; complete a pickup and a delivery order; declare an appearance
  and place a market-pickup order.
- Gate green (typecheck + lint + prettier) per slice; migrations land via the pipeline (`main` →
  DB Migrate), never a laptop `migrate deploy`.

---

**Cross-references:** [107 Local Shops (feature)](107-local-shops.md),
[106 Channel & Marketplace Strategy](106-channel-marketplace-strategy.md) (§P5 as-built),
[100 Inventory Build Plan](100-inventory-build-plan.md) (`Warehouse` location seam),
[09 E-Commerce Engine PRD](09-ecommerce-engine-prd.md) (orders/checkout/fulfillment),
[db-migration skill](../.claude/skills/db-migration/SKILL.md),
[new-workspace-package skill](../.claude/skills/new-workspace-package/SKILL.md).
