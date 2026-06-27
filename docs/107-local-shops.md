# sparx Platform — sparx.market Local Shops & Local Commerce

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-26

> **Status: PLANNED.** This is the feature definition; the phased _how_ lives in its companion
> [108-local-shops-build-plan.md](108-local-shops-build-plan.md). It extends the **as-built P5
> sparx.market** surface ([106 §P5](106-channel-marketplace-strategy.md), and the original
> [archive/72-sparx-market-architecture.md](archive/72-sparx-market-architecture.md)) — read those
> first for the merchant-of-record checkout, the global `market_listings`/`market_merchants`
> projection, and the settlement spine this builds on.

---

## 0. What this is

The feature definition for making **sparx.market local-first** — turning it from "a marketplace that
happens to have sellers everywhere" into **the marketplace for small, real shops, where _"sold by a
shop near you"_ is the core promise, not a filter.** It commits the **full local-commerce surface**:
location-based discovery, real local fulfillment (pickup + local delivery), and in-person market/event
selling.

This is deliberately scoped **before go-live**. Local geography is the kind of dimension that is cheap
to design in while there are zero sellers, zero listings, and zero orders — and brutally expensive to
retrofit once a live catalog, a settlement ledger, and shipped orders exist. We bake it in now.

**Phases in this document mean _build order_, not scope tiers.** Nothing here is an "MVP slice" that
later ships "if there's time." The whole surface is committed; the phases sequence the work by
dependency and risk (see [§10](#10-phasing-build-order--full-surface-committed)).

---

## 1. Why — positioning and the wedge

**Local is a genuine wedge because the incumbents under-serve it on purpose.** The research across the
major marketplaces and commerce platforms is consistent:

- They default to a **national/global catalog** and bolt "local" on as a weak attribute filter
  ("ships from", "based in") — locality is metadata, not the experience.
- **Native local pickup / local delivery is rare or absent** on the big marketplaces; sellers hack it
  with free-shipping coupons and direct messages, and those orders fall outside tracking, ratings, and
  protection.
- The richest "local" capability — **a seller showing up in person at a market, fair, or pop-up on a
  given day** — has been largely **abandoned** by the platforms that once tried it. It survives only in
  niche farmers-/maker-market software, disconnected from the seller's online store.

That triple gap is exactly where **small shops** live: the maker who sells online _and_ at the Saturday
craft fair, the boutique that offers in-store pickup, the farm stand that delivers within ten miles, the
service-area seller who only wants nearby customers. **They are our target audience**, and "local" is
not a nice-to-have for them — it is how their business actually works.

**The promise:** sparx.market is the place a buyer goes to find _real shops near them_ — to buy online
for local pickup or same-area delivery, or to discover which shops will be at this weekend's market and
reserve an item for pickup there. For the shop, it's one place to be discovered locally, sell online,
fulfill the way they actually fulfill, and show up in person — all wired to the same catalog,
inventory, and payouts they already run on sparx.

---

## 2. The model — three axes of "local"

"Local" is not one feature. It is three orthogonal capabilities. We commit all three; each is built on
the proven sparx.market spine.

| Axis                               | The question it answers                     | What it adds                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Local Discovery**            | "What shops/products are near _me_?"        | Near-me browse, a **hard** radius filter, nearest-first sort, distance on every card, "ships from"/"based in" filters, conditional "pickup/delivery near you" badges, city/neighborhood + "near me" landing pages, an optional map view |
| **B — Local Fulfillment**          | "How does a nearby order reach me?"         | A first-class **fulfillment method** on the order — _ship_ (existing), _local pickup_ (location + hours + time slot), _local delivery_ (service zone + fee + minimum + windows); a later courier last-mile seam                         |
| **C — In-person Markets & Events** | "Where can I buy from this shop in person?" | A shop declares it will be at a physical **market/event on a date**; buyers discover markets near them + which shops will be there; **pre-order for pickup-at-market**                                                                  |

### 2.1 Two architectural layers (the key structural decision)

These axes do **not** all belong to the marketplace. They split across two layers, and getting this
split right is what makes the feature reusable instead of a marketplace silo:

1. **Commerce-level local-fulfillment primitives (reusable).** _Fulfillment method_, _pickup
   locations_, and _delivery zones_ are **commerce capabilities** — they live in `@sparx/commerce` and
   power **any** sales channel: a tenant's own storefront checkout (`apps/site`) **and** sparx.market.
   A small shop selling on its own sparx site gets local pickup/delivery for free out of this work.
2. **Marketplace-level local discovery + directory + events.** Cross-tenant "shops near me", the
   merchant directory's geo, the "near me" SEO surfaces, and the markets/events model are **specific to
   sparx.market** (they require the global, cross-tenant projection that only the marketplace has). They
   live in the market service + `apps/market`.

This is the same shape as the rest of the platform: shared primitives in the package layer, the
cross-tenant aggregation in the marketplace layer.

---

## 3. Binding decisions (do not re-litigate)

These are locked by the research + the existing architecture. The build plan assumes them.

- **D1 — Geo queries use PostGIS.** `geography(Point,4326)` columns + GiST indexes; radius via
  `ST_DWithin`, distance via `ST_Distance`. Cloud SQL supports it through `CREATE EXTENSION postgis` —
  **no new infrastructure, no search engine; we stay Postgres-first** (consistent with the Phase-1
  infra rule and the FTS-not-Typesense stance). It composes the radius + distance sort into the **same
  single SQL statement** as our existing `tsvector`/GIN full-text and category filters. We do **not**
  use `cube`+`earthdistance` (its two-step `earth_box … AND earth_distance …` pattern silently
  over-returns when the second filter is forgotten) and we do **not** hand-roll haversine (no index,
  full scan, does not scale). See [§8](#8-geo-technical-architecture).
- **D2 — Only store-permitted geocoding.** We persist coordinates to index them, so the geocoder's
  terms must _permit permanent storage_. We use **public-domain / open providers** — the **US Census
  Geocoder** (or the in-database `postgis_tiger_geocoder`) for US street-level, a **Census ZCTA
  centroid** seed table as the instant zero-API fallback, and **GeoNames** when international addresses
  appear. We **never** store coordinates from providers whose terms forbid it (the major commercial
  geocoders cap caching at ~30 days / ban building a stored database). A provider seam (`@sparx/geo`)
  keeps a paid rooftop provider swappable later.
- **D3 — Buyer location is consent-light and coarse.** A typed **ZIP/city field is the source of
  truth**; browser geolocation is an **optional, one-tap, permission-primed enhancement** fired only on
  a user gesture. **Every local feature must work fully from a typed ZIP** so consent is genuinely
  optional. We persist only the **coarse value the buyer set** (in their session/local storage, not a
  DB row); we do not silently store raw buyer lat/lng. Precise (and IP-derived) location is personal
  data — treat it that way.
- **D4 — The radius is a _hard_ cutoff.** A "within 25 miles" filter returns only shops within 25
  miles. Soft/ranking radii that leak far-away results are a known source of user distrust; we do not
  ship one.
- **D5 — List-first; the map is a togglable enhancement.** Default browse is a ranked list (nearest-
  first, distance on cards). A map view is an opt-in toggle so its cost only accrues when a buyer opens
  it. If/when shown: **MapLibre GL JS + a hosted tile SKU** (OSM attribution) — never the raw public
  OSM tile endpoint (its policy forbids commercial/bulk use with no SLA).
- **D6 — Fulfillment primitives live in `@sparx/commerce`; discovery/directory/events in the market
  layer.** (See [§2.1](#21-two-architectural-layers-the-key-structural-decision).)
- **D7 — No new billing module.** "Local" is a **capability of sparx.market participation**, not a
  separately-priced module (the platform has modules, not tiers; participation is
  `MarketMerchantProfile.enabled`). The reusable local-fulfillment primitives ride the existing
  **Commerce** module. The in-person market-_organizer_ tooling (jury/booths/POS — Axis C's far end) is
  explicitly **out of scope** here and flagged as a possible separate future product
  ([§11](#11-open-questions--decisions-for-brandon)).

---

## 4. Data model

The shape, not the migration SQL (that's [108 §3](108-local-shops-build-plan.md)). Everything below is
additive; nothing here changes an existing column's meaning.

### 4.1 Merchant geography

Today `MarketMerchantProfile.location` and the projected `MarketMerchant.location` are **freeform
strings** ([80-market.prisma](../packages/db/prisma/schema/80-market.prisma)). We make location
**structured + geocoded**:

- **`MarketMerchantProfile`** (tenant truth, FORCE-RLS) gains structured address parts (`addressLine1/2`,
  `city`, `region`, `postalCode`, `country`), a derived `latitude`/`longitude`, a `geocodeStatus`
  (`pending`/`ok`/`failed`/`manual`) + `geocodedAt`, a `locationPublic` flag (show exact vs.
  city-only), and service-capability flags (`offersPickup`, `offersLocalDelivery`, `offersShipping`).
  The merchant's discovery coordinates default from this address, or from a designated pickup location
  ([§4.2](#42-pickup-locations)), or — for inventory-module tenants — from a linked `Warehouse` (which
  **already** carries `latitude`/`longitude` + address + `hoursOfOperation`,
  [34-commerce-inventory.prisma](../packages/db/prisma/schema/34-commerce-inventory.prisma)).
- **`MarketMerchant`** (the global, cross-tenant projection) gains the projected `latitude`/`longitude`,
  a **`geo geography(Point,4326)`** column (GiST-indexed — the load-bearing discovery index),
  `city`/`region`/`postalCode`/`country`, and the capability flags so browse can answer "offers pickup
  near me" without a cross-tenant join. Populated by the projection writer
  ([projection.ts](../packages/commerce/src/services/market/projection.ts)) — geocoding happens here,
  once, on save.

### 4.2 Pickup locations

A shop may have one or more physical points where buyers collect orders (storefront, studio, locker).

- **`MarketPickupLocation`** (tenant truth, FORCE-RLS): `name`, structured address, `latitude`/
  `longitude` + `geo`, `hours` (JSON, mirrors `Warehouse.hoursOfOperation`), `instructions`,
  `prepLeadMinutes`, `isPrimary`, optional soft `warehouseId` link for inventory tenants. The primary
  pickup location can seed the merchant's discovery coordinates.

### 4.3 Delivery zones

How far a shop will deliver itself, and what it charges.

- **`MarketDeliveryZone`** (tenant truth, FORCE-RLS): `type` (`radius` | `postal`), `radiusMeters` (for
  radius) **or** `postalCodes[]` (for a ZIP list), `feeCents` (0 = free), `minimumСents` (order minimum),
  `estimatedMinutes`, and optional **distance-tiered fees** (`tiers: {maxMeters, feeCents}[]` —
  distance tiers require a radius zone, mirroring how the pattern works in practice). A shop can define
  multiple zones; the buyer's address resolves to the first matching zone (or none → not deliverable).

### 4.4 Order fulfillment method (the cross-cutting delta)

This is the genuinely cross-cutting change — it reaches into the order/checkout spine.

- **`Order`** gains `fulfillmentMethod` (`ship` | `local_pickup` | `local_delivery` | `market_pickup`),
  defaulting to `ship` so every existing path is unchanged.
- **`OrderFulfillment`**
  ([27-crm-order-fulfillments.prisma](../packages/db/prisma/schema/27-crm-order-fulfillments.prisma))
  gains method-specific fields: `pickupLocationId`, `pickupSlotStart`/`pickupSlotEnd`, `pickedUpAt`
  (pickup); `deliveryZoneId`, `deliveryWindowStart`/`deliveryWindowEnd`, `deliveredAt` (local delivery);
  `eventOccurrenceId` (market pickup, [§4.5](#45-in-person-markets--events)). `carrier`/`trackingNumber`
  stay exactly as-is for `ship`.

### 4.5 In-person markets & events

The differentiator. Modeled as buyer-discovery + seller-appearance + pre-order — **not** the organizer's
booth-management suite (that's a separate product, [§11](#11-open-questions--decisions-for-brandon)).

- **`MarketEvent`** (global directory, cross-tenant read like `MarketMerchant`): a recurring or one-off
  physical market/fair/pop-up — `name`, `slug`, structured address + `geo`, `description`, `organizerName`,
  `url`. Platform/admin-curated initially; merchant-suggestable later.
- **`MarketEventOccurrence`** (global): one dated instance of an event — `eventId`, `date`, `startsAt`/
  `endsAt`, `status`.
- **`MarketMerchantAppearance`** (tenant truth, FORCE-RLS, projected to a global read row): a shop
  declares it will be at an occurrence — `occurrenceId`, optional `boothLabel`, `acceptsPreorders`,
  `notes`. Drives "this shop will be at \<market\> on \<date\>" on the storefront and the
  `market_pickup` fulfillment method.

---

## 5. Buyer experience

### 5.1 Setting location (Axis A entry point)

- A persistent, editable **location chip** in the market header ("Near 78701 ▾"). Source of truth is a
  typed ZIP/city. IP may _pre-seed_ a guess, always with a visible "change" affordance.
- **"Use my location"** is a one-tap control that primes the buyer ("so we can show shops near you")
  and only then fires the browser prompt, on the gesture. Denial silently falls back to the ZIP field —
  never a dead end.
- Privacy: secure-context only, consent-primed, coarse-only persistence ([D3](#3-binding-decisions-do-not-re-litigate)).

### 5.2 Local browse & discovery

- A **local browse mode** that defaults to nearby and sorts **nearest-first**, with **"2.3 mi away"**
  on every card.
- A **radius control** using preset chips (5 / 10 / 25 / 50 mi) — a **hard** cutoff ([D4](#3-binding-decisions-do-not-re-litigate)).
- Existing facets unchanged (category, price, in-stock, search) — the geo predicate composes _into_ the
  same query ([§8](#8-geo-technical-architecture)).
- **Conditional capability badges**: "Pickup near you" / "Local delivery" appear **only when the buyer's
  computed distance actually qualifies** (a badge that shows regardless of location erodes trust).
  "Ships from \<city\>" is a fine always-on transparency signal. Rendered with the platform
  `<Badge color={statusTone(...)} variant="soft">` convention, not decorative color.
- An optional **map toggle** ([D5](#3-binding-decisions-do-not-re-litigate)) — clustered pins, a manual
  "search this area" control (no auto-refetch on pan), list↔pin highlighting, hand-off to the native
  maps app for directions.

### 5.3 Discovery surfaces (SEO)

- **`/near-me`**, **`/[city]`**, and **`/[city]/[category]`** landing pages generated **from live
  listing/merchant data** (so the seller cards + counts are inherently unique per page, satisfying the
  "don't ship a templated national page with the city swapped in" rule). These feed the same in-app
  local browse mode.

### 5.4 Checkout (Axis B)

The market checkout ([public/market.ts](../services/api-rest/src/routes/v1/public/market.ts)) **forks
by fulfillment method** after the cart:

- **Ship** — the existing flow (full address → rate quote → pay), unchanged.
- **Local pickup** — choose a pickup location + an available time slot (computed from `hours` +
  `prepLeadMinutes`); no shipping address, no shipping cost; pay via the platform MoR.
- **Local delivery** — enter a delivery address; the system checks it falls **inside a matching delivery
  zone** (radius/ZIP) and meets the order minimum, applies the zone fee (or distance tier), optionally
  picks a window; pay via the platform MoR.
- **Market pickup** — for a shop appearing at an event: reserve for **pickup at \<market\> on \<date\>**;
  no shipping; pay (or hold) via the platform MoR.

---

## 6. Merchant experience

In **Settings → Market** (the existing P5 surface), a shop configures:

- **Location** — structured address; geocoded on save (status surfaced); a "show exact location vs.
  city only" toggle; choose discovery coordinates source (this address / a pickup location / a linked
  warehouse).
- **Service modes** — toggles for pickup / local delivery / shipping.
- **Pickup locations** — add/edit points with hours, prep lead time, instructions; mark a primary.
- **Delivery zones** — define radius or ZIP-list zones with fee, order minimum, optional distance
  tiers, ETA.
- **Market appearances** — pick from the curated market directory (or suggest one), declare dates,
  toggle pre-orders.

All edits are explicit-save (platform convention), behind the leave-guard, with destructive removals
behind `useConfirm`.

---

## 7. Fulfillment & money

- The **fee/checkout boundary falls on the fulfillment method.** Platform-checkout methods (ship, local
  delivery, market/pickup paid online) run through the existing **merchant-of-record** charge on the
  platform Stripe account and accrue the standard `MarketSettlement` — **commission and settlement are
  unchanged**; only the shipping/fee line differs. (A future "arrange payment in person" pickup variant,
  if ever offered, would be an off-platform, no-commission path — explicitly not in initial scope.)
- **Local pickup** zeroes shipping. **Local delivery** replaces the carrier shipping line with the
  zone's delivery fee (the shop's own money, surfaced as the fulfillment cost). Refunds/settlement
  reversal behave exactly as today.
- Nothing in this feature changes the commission model (flat bps + per-tenant override) or the weekly
  ACH settlement run.

---

## 8. Geo technical architecture

### 8.1 PostGIS, one query

`CREATE EXTENSION postgis` on Cloud SQL. The discovery columns are `geography(Point,4326)` with GiST
indexes. The load-bearing requirement — _"shops within N miles, sorted by distance, combined with the
existing FTS + category filters, in one statement"_ — is satisfied directly:

```sql
-- market_merchants.geo geography(Point,4326) GiST-indexed; search_tsv tsvector GIN-indexed
SELECT m.*, ST_Distance(m.geo, :pt) AS meters
FROM   market_merchants m
WHERE  ST_DWithin(m.geo, :pt, :radius_meters)        -- GiST: the hard radius
  AND  (:q IS NULL OR m.search_tsv @@ websearch_to_tsquery('english', :q))
  AND  (:category IS NULL OR m.primary_category = :category)
ORDER  BY meters
LIMIT  :limit OFFSET :offset;
```

The same `ST_DWithin`/`ST_Distance` predicate composes into the existing `market_listings` browse query
([browse.ts](../packages/commerce/src/services/market/browse.ts)) via the established
`Prisma.sql` + `$queryRaw` + `withSystem()` pattern. PostGIS also leaves a growth path (polygon service
areas, `<->` KNN nearest-neighbor) without a re-platform.

### 8.2 `@sparx/geo` — the geocoding + distance seam

A new pure-ish package owning two responsibilities behind clean seams:

- **Geocoding provider abstraction** — `geocode(address) → {lat, lng, precision, source}` with
  store-permitted providers ([D2](#3-binding-decisions-do-not-re-litigate)): US Census (or in-DB TIGER),
  a bundled **ZCTA centroid table** for instant ZIP→point with zero API calls, GeoNames for
  international. A paid rooftop provider (permanent-storage SKU) registers here later if precision
  demands it. Coordinates are stored permanently (the whole point) — which is why provider terms gate
  the choice.
- **Distance/units helpers** — miles↔meters, radius presets, distance formatting ("2.3 mi away").

### 8.3 Map layer (deferred enhancement)

MapLibre GL JS + a hosted tile SKU (MapTiler free → paid), OSM attribution, list-first. Built only when
the map view ships ([D5](#3-binding-decisions-do-not-re-litigate)); discovery is fully functional as a
ranked list without it.

---

## 9. Privacy, trust & safety

- **Location is personal data.** Consent-primed geolocation, secure context only, coarse-only buyer
  persistence ([D3](#3-binding-decisions-do-not-re-litigate)). Merchant coordinates are business data
  the shop chooses to publish (with a city-only option).
- **In-person handoff.** Pickup and market-pickup end in a physical meeting. We surface clear pickup
  instructions + hours, and (a later trust primitive) can recommend public safe-exchange spots. We do
  not position sparx as a party to the physical handoff.
- **Transparency.** "Ships from \<city\>" and the shop's published location set honest provenance and
  delivery-time expectations even for non-local orders.

---

## 10. Phasing (build order — full surface committed)

Sequenced by dependency and risk. **All phases are committed**; this is order, not scope. Detail +
slices + integration points are in [108-local-shops-build-plan.md](108-local-shops-build-plan.md).

| Phase  | Theme                                   | Lands                                                                                                                                                                                                                                                                   |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | Geo foundation                          | `CREATE EXTENSION postgis`; `@sparx/geo` (geocoder seam + ZCTA centroids + distance helpers); structured + geocoded merchant location; `geo` columns + GiST; geocode-on-save in the projection writer                                                                   |
| **P1** | Local discovery (Axis A)                | Buyer location chip + primed geolocation; browse radius/nearest-first/distance composed into the FTS query; capability badges; `/near-me` + `/[city]` + `/[city]/[category]` SEO surfaces                                                                               |
| **P2** | Local fulfillment (Axis B)              | `fulfillmentMethod` on the order; `MarketPickupLocation` + pickup-at-checkout (location + slot); `MarketDeliveryZone` + in-zone delivery checkout (fee + minimum + tiers); checkout state-machine fork; **reuse the same primitives in the tenant storefront checkout** |
| **P3** | In-person markets & events (Axis C)     | `MarketEvent` + occurrences (curated directory); merchant appearance declaration; event discovery ("markets near me" + who's there); `market_pickup` fulfillment; event SEO pages                                                                                       |
| **P4** | Enhancements (committed, lower-urgency) | Map view (MapLibre); courier last-mile seam; verified-address neighborhood scoping; GeoNames international                                                                                                                                                              |

---

## 11. Decisions (resolved 2026-06-26)

The open questions were resolved with Brandon:

1. **International scope → US-first.** Census/ZCTA geocoding (US-only, free, public-domain) for launch;
   GeoNames international lands in P4 when non-US sellers appear.
2. **Market-organizer suite → deferred (revisit later).** The far end of Axis C — applications/jury,
   booth maps, layered fees, day-of-market POS — is a distinct product for a different customer (the
   market _organizer_, not the shop) and stays **out of this feature**; a separate "Markets" module is a
   later exploration.
3. **Courier last-mile → deferred until demand.** P4 keeps the `MarketDeliveryProvider` seam; the
   third-party-network integration is built only once demand is shown. **Shop-run local delivery is the
   launch capability.**
4. **Verified-address neighborhood scoping → later.** A powerful hyperlocal-trust primitive but a
   privacy escalation; revisited after the core surface lands.
5. **Buyer accounts → COMMITTED (a sparx.market-wide foundation).** _Clarification:_ tenant storefronts
   **already** have full customer accounts — `packages/customer-auth` (Layer-2, tenant-scoped, Argon2id)
   with a complete account area in `apps/site/app/account/*` (orders, addresses, profile, wishlist,
   bookings, B2B), per [archive/27](archive/27-customer-accounts-site-auth.md). What is guest-first today
   is **sparx.market specifically** — and a marketplace buyer is a _different_ identity from a per-seller
   customer (they shop across many sellers). So sparx.market gets its own **marketplace-scoped buyer
   account** — the natural home for a saved default location + pickup preferences + cross-seller order
   history (exactly what local discovery wants). **Approach: reuse `packages/customer-auth` scoped to the
   marketplace** (not a third auth system), linking to the per-seller `Customer` records that checkout
   already ensures on purchase. This is broader than Local Shops (a sparx.market foundation) and may
   warrant its own short spec when built; tracked as a committed dependency, surfaced in
   [108](108-local-shops-build-plan.md).

---

**Cross-references:** [106 Channel & Marketplace Strategy](106-channel-marketplace-strategy.md) (§P5
sparx.market as-built), [archive/72 sparx.market Architecture](archive/72-sparx-market-architecture.md),
[09 E-Commerce Engine PRD](09-ecommerce-engine-prd.md) (orders/checkout/fulfillment),
[100 Inventory Build Plan](100-inventory-build-plan.md) (the `Warehouse` location seam),
[108 Local Shops Build Plan](108-local-shops-build-plan.md) (the how).
