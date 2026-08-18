# 58 — Per-site dashboard context

Version: 0.2.0
Author: Brandon Korous
Last Updated: 2026-06-05

> Design doc. Extends multi-site (docs/49). Locks how the **active site shifts the
> entire dashboard context** — and how orders, customers, and inventory split
> across the per-site / tenant-wide line. **Status: P0 built; P1–P2 awaiting review
> before build.** (v0.2.0: customers are now per-property _memberships_ under a
> tenant-wide _identity_ — replaces the v0.1 "derive from orders" model.)

---

## 1. The decision

When a user switches the active web **property/site** in the dashboard (the
bookmarks-bar switcher), the **entire** authoring context should shift to that
site — not just the Builder. Catalog, content, theme, navigation, orders, and the
customer view all narrow to "this site." Switching to Driftwood should make the
dashboard feel like Driftwood's back office; nothing authored on Tesla should bleed
in (the bug that motivated this — a Tesla `Model 3` showing on a Driftwood rail —
see [multi-site-context-shift-handoff.md](multi-site-context-shift-handoff.md)).

The hard part is separating three things that "everything filters by site" lumps
together:

- **A customer is a _person_, not a site visit.** Two of the tenant's sites
  (cars.sparx.works, dogs.sparx.works) can be different brands with different
  audiences — a cars buyer is not a dogs buyer. We **default customers separated per
  site** (a per-property _membership_, owning its own consent + history) while still
  recognizing the same human at login (a tenant-wide _identity_). See §3 D2/D6 + §5 P2.
- **An order is a _transaction_ on a specific site.** It is tagged with the site it
  was placed on (its origin), but it outlives that site and feeds tenant-wide finance
  ([24-crm-orders.prisma](../packages/db/prisma/schema/24-crm-orders.prisma)) — so it
  is site-_tagged_, not site-_owned_.
- **Inventory is one shared pool.** A shared product has one stock level, deducted by
  any site's checkout. Two sites are sites over the **same warehouse**.

So "everything filters by site" means: **default-separate customers per site (under a
tenant-wide login identity), tag orders with their origin site, and keep the genuinely
shared pools shared.** This doc locks that.

## 2. Shared vs. scoped map

The axis every record falls on. "Scoped" = the active-site switch filters it;
"Shared" = tenant-wide, unaffected by the switch.

| Record                          | Per-site?  | Mechanism                                                           |
| ------------------------------- | ---------- | ------------------------------------------------------------------- |
| Builder pages / layouts / home  | **Scoped** | `property_id` column (docs/49 P1B) — built                          |
| Products (catalog)              | **Scoped** | Model B junction `commerce_product_properties`, empty = all — built |
| Content entries / pages         | **Scoped** | Model B junction `content_entry_properties`, empty = all — built    |
| Brand identity (name/colors)    | **Scoped** | `properties.brand_override` (presentation-only) — built             |
| Full theme tokens / fonts       | **Scoped** | per-property theme snapshot — **handoff #2/#3, separate track**     |
| Navigation                      | **Scoped** | Builder NavMenu node, per-layout — **docs/57, parked**              |
| **Orders**                      | **Scoped** | `orders.property_id` = **origin site** (tagged, not owned) — **P1** |
| **Customer membership**         | **Scoped** | per-property `customers` row + its consent / LTV / orders — **P2**  |
| **Customer identity** (login)   | Shared     | tenant-wide credential; recognizes the person across sites — **P2** |
| Inventory / stock levels        | Shared     | one pool; deducted by any site                                      |
| Pricing rules / discounts       | Shared     | tenant-wide (per-site pricing visibility = docs/49 deferred)        |
| B2B accounts / deals / pipeline | Shared     | tenant-wide (a wholesale account may buy across sites)              |
| Settings / billing / modules    | Shared     | tenant-level (per-site billing metering = docs/49 deferred)         |

## 3. Locked decisions

- **D1 — Orders gain an origin site, not ownership.** A new nullable
  `orders.property_id` records **which site the order was placed on**. The order
  still belongs to the tenant (the spine is unchanged); `property_id` is the same
  app-tier scoping axis as everywhere else (NOT an RLS boundary — `tenant_id`
  stays the only one, docs/49 §2). Nullable because legacy/admin/import/MCP orders
  may have no site of origin; null = "no specific site" (shows under All sites).

- **D2 — Customers are per-property _memberships_ under a tenant-wide _identity_.**
  Two layers: a tenant-wide **identity** (one login per `(tenant, email)` — the
  credential and sessions) and a per-property **membership** (the `customers` row,
  unique `(tenant, property, email)`, owning consent, marketing prefs, LTV, and
  orders). cars-John and dogs-John are **separate memberships** that may share one
  identity. The "one customers table" commitment holds — it stays one table, it just
  gains `property_id` plus a link to the identity (the placeholder `authUserId`
  becomes that link). Default = separated; the identity exists to recognize the same
  human across sister sites (D6), never to merge their consent.

- **D3 — Origin site is captured at the cart, copied at placement.** The site
  already knows its property (`resolveSiteRoute` → `?property=`). Carry it on the
  `Cart` (`commerce_carts.property_id`, nullable) when the cart is created on a
  site, and copy `cart.property_id → order.property_id` when checkout produces
  the order. Admin/import/MCP orders pass `property_id` explicitly or leave it null.
  This is the single capture point; no checkout UI change.

- **D4 — Shared pools stay shared, and we say so out loud.** Inventory, pricing, and
  B2B accounts do NOT fork per site; the active-site switch never changes a stock
  number or a wholesale account. But a customer **membership** is per-site, so its
  detail shows _that site's_ orders + consent — the tenant-wide person behind it is
  reachable via the identity (e.g. an "also a customer on dogs" affordance), not by
  merging the rows. The switch filters lists and scopes per-site records; it never
  rewrites a genuinely shared pool.

- **D5 — The switch drives list defaults; lists keep an "All sites" escape.** Every
  site-scoped list defaults its filter to the active site (so the global switcher
  shifts it) and offers an explicit **All sites** option. This is the **P0 pattern,
  already built** for products + content (§4); orders + customers adopt the same
  `defaultValue` + `?site=all` convention in P2.

- **D6 — Cross-site recognition, never cross-site consent.** When an email signs in
  on a second site, look the identity up by `(tenant, email)`; if found but this site
  has no membership yet, **notify** ("you already have an account on a sister site")
  and, on the person's confirmation, create the new membership **capturing its consent
  fresh**. Signing up on cars never opts the person into dogs email, marketing, or
  treatment as a customer. Email / marketing / purchases always key off the
  **membership** (site + its consent), never the identity.

## 4. P0 — built (this session)

The switcher already drives the catalog and content lists:

- **Products** — `/v1/commerce/products?property=` filters by Model-B visibility;
  the dashboard catalog Site filter **defaults to the active site** with an "All
  sites" escape ([commerce/products/page.tsx](<../apps/dashboard/app/(dashboard)/commerce/products/page.tsx>)).
  New products already default to the active site (docs/49 §3, prior session).
- **Content** — `/v1/content/entries?property=` now applies
  `contentSiteVisibilityWhere`; the `/cms/content` list defaults to the active site;
  new entries default-scope to the active site (mirrors products)
  ([content/entries.ts](../services/api-rest/src/routes/v1/content/entries.ts),
  [cms/content/page.tsx](<../apps/dashboard/app/(dashboard)/cms/content/page.tsx>)).
- **Toolbar** — the URL-sync `ListToolbar` gained a per-filter `defaultValue` so the
  Site chip reflects the active site with no `?site=` param
  ([list-toolbar.tsx](<../apps/dashboard/app/(dashboard)/_components/list-toolbar.tsx>)).

`defaultValue` resolution, used by every site-scoped list:

```
siteParam absent      → active site (cookie → primary fallback)   // follows the switcher
siteParam === 'all'   → no filter (whole tenant)                  // explicit escape
siteParam === <uuid>  → that site                                 // per-list override
single-site tenant    → no filter, no Site control                // zero behavior change
```

## 5. P1 / P2 — to build (awaiting review)

### P1 — Orders origin site

1. **Schema** — add a nullable `property_id @db.Uuid` to `orders` (in
   [24-crm-orders.prisma](../packages/db/prisma/schema/24-crm-orders.prisma)) and
   `commerce_carts` (in
   [39-commerce-cart.prisma](../packages/db/prisma/schema/39-commerce-cart.prisma)),
   each with a `Property?` relation (`onDelete: SetNull` — deleting a site must not
   delete its orders). Add `@@index([tenantId, propertyId, placedAt(sort: Desc)])` to
   `orders` for the per-site list. **No backfill of historical orders** — they stay
   null (= All sites), matching the products "leave existing shared" decision
   (docs/49 §3). The migration is hand-edited for the index and relation; `property_id`
   is non-RLS scoping, so no policy change. (If a backfill is ever wanted, it MUST loop
   tenants and call `set_config('app.tenant_id')` — `orders` is FORCE-RLS and
   `sparx_owner` is non-superuser in prod, `feedback_sparx_db_rls_pattern`.)

2. **Capture** (`@wizeworks/commerce` checkout→order path): set `cart.property_id` from
   the site's active property when a site cart is created; copy it onto
   the order at placement. The order-event consumer keeps maintaining
   `customers.totalSpent`/`orderCount` — now naturally **per-membership** (per-site),
   since the order's customer row _is_ that site's membership.

3. **Filter** (`/v1/commerce/orders` + `/v1/search/orders`): accept `?property=` →
   `where.propertyId = property` (orders are a single table, not a junction, so it's
   a direct column match, simpler than Model B). The dashboard Orders list adopts the
   P0 Site-filter pattern (default active site + All sites).

### P2 — Customer membership + identity

The two-layer split (D2/D6):

| Layer          | Scope       | Owns                                         | Keyed by                    |
| -------------- | ----------- | -------------------------------------------- | --------------------------- |
| **Identity**   | tenant-wide | credential, sessions, "which sites I joined" | `(tenant, email)`           |
| **Membership** | per-site    | consent, marketing prefs, LTV, orders        | `(tenant, property, email)` |

1. **Schema** (in
   [20-crm-customers.prisma](../packages/db/prisma/schema/20-crm-customers.prisma) and
   [48-customer-auth.prisma](../packages/db/prisma/schema/48-customer-auth.prisma)):
   - New tenant-wide **`customer_identities`** table — `(tenant, email)` unique; owns
     the credential, session, and password-reset relations (moved up from `customers`).
     This is the login.
   - `customers` becomes the **membership**: add `property_id @db.Uuid` and
     `identity_id @db.Uuid` (FK → `customer_identities`); change the unique from
     `(tenant, email)` → `(tenant, property, email)`. Consent (`gdprConsent`,
     `ConsentRecord`), LTV, marketing prefs, and all order / CRM relations stay on the
     membership. The existing `authUserId` placeholder becomes `identity_id`.
   - B2B accounts stay tenant-wide — a wholesale account links to the identity, not a
     single membership (§8 Q2).
2. **Migration** (hand-edited, FORCE-RLS backfill loop — `feedback_sparx_db_rls_pattern`):
   per tenant, calling `set_config('app.tenant_id')`, create one identity per existing
   `(tenant, email)` (today's unique guarantees 1:1), point each customer's
   `identity_id` at it, set `property_id` = the tenant's **primary** property, re-home
   the credential / session / reset rows onto the identity, then swap the unique index.
   (Cloud SQL is private-IP → lands via the DB Migrate pipeline only.)
3. **Recognition flow** (`@wizeworks/customer-auth`, docs/27 — D6): on sign-in / sign-up at
   a property, resolve the identity by `(tenant, email)`. If it exists but this property
   has no membership, return a "recognized — link?" state; on confirm, create the
   membership with **fresh consent** and issue the session. One login, per-site consent.
4. **Filter** (`/v1/crm/customers` + `/v1/search/customers`): accept `?property=` →
   `where.propertyId = property` (a direct column now, like orders). The dashboard
   Customers list adopts the P0 Site-filter pattern (default active site + All sites).

## 6. Considered & rejected / deferred

- **Derive the customer site-view from orders (no membership row).** Rejected: a
  registered-but-never-ordered shopper would have no site, and there'd be nowhere
  per-site to hang consent — the thing we most need to keep separate.
- **One property-less customer row + per-property maps** (the "remove property*id"
  idea). Rejected: collapsing to one row forces consent / LTV / orders into
  `{cars,dogs}` sub-maps, abandons the `(tenant, property, email)` model, and \_merges*
  consent — exactly what D6 forbids.
- **An array of properties on one customer row.** That information is real, but it
  belongs as the **set of memberships under an identity** (each carrying its own
  consent), not a bare array — otherwise per-site consent has no home.
- **Per-site inventory / pricing visibility.** Out of scope; docs/49 roadmap.
- **Per-site billing metering.** Out of scope; docs/49 roadmap.

## 7. Acceptance

On one tenant with two sites (primary "Tesla", secondary "Driftwood"):

- Switching the dashboard switcher to Driftwood narrows **products, content, orders,
  and the customers list** to Driftwood; each list offers "All sites".
- An order placed on the Driftwood site carries `property_id = Driftwood` and
  appears only under Driftwood (and All sites), never under Tesla.
- A shopper who signs up on Tesla then signs in on Driftwood is **recognized** (one
  identity), **prompted** to link, and gets a **separate Driftwood membership with its
  own consent** — Tesla never emails them on Driftwood's behalf, or vice versa.
- Each site's customer list shows only that site's memberships; Tesla's marketing
  cannot reach a Driftwood-only member.
- Inventory, pricing, B2B accounts, and billing read identically regardless of the
  active site.

## 8. Open questions for review

1. **Channel vs. property.** Orders already have `channel`
   (`site | b2b_portal | admin | import | mcp`). `property_id` is orthogonal
   (which _site_, not which _surface_) — confirm we want both, not a merge.
2. **B2B orders' origin site.** B2B _accounts_ stay tenant-wide (D2/§7). A B2B order
   placed through a site's portal still gets that site's `property_id` by the same cart
   capture — confirm that's wanted (vs. B2B orders always "All sites").
3. **Default Orders list view.** Default to the active site like products/content
   (consistent), or default to All sites for orders since finance/ops often want the
   whole tenant? Recommendation: **active site, with All sites one click away** (D5),
   for consistency — but flagging because orders have a stronger "whole tenant" pull.
