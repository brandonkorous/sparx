# Sparx Platform — Dropship Integration PRD

**Version:** 2.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-14

---

## 1. Overview

Dropshipping is a first-class commerce capability, not a plugin. A tenant connects one or
more supplier catalogs, imports products with one click, sets pricing rules, and has orders
routed to the right supplier automatically — without leaving the platform. Dropship is gated
by the **`dropship` module flag**; a tenant pays for it only if they use it.

The integration is **selectable**: a tenant picks a supplier from a catalog of vendors, each
with its own credential form, then connects it. A tenant can connect several suppliers, switch
between them, and disconnect any of them. With multi-site (docs/49), a connection can be
**enabled per site** — see §6.

---

## 2. Architecture & build status

The dropship stack is **built and live** (docs/64 Ph1–Ph5). The pieces:

| Layer     | Where                                                                 | What                                                                                                      |
| --------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Adapters  | [`@sparx/dropship`](../packages/dropship)                             | `SupplierAdapter` interface + `createAdapter()` registry + `applyPricingRule()` + the `VENDOR_CATALOG`    |
| Data      | [65-dropship.prisma](../packages/db/prisma/schema/65-dropship.prisma) | `DropshipSupplier`, `DropshipProduct`, `DropshipProductLink`, `DropshipOrder`, `DropshipSupplierProperty` |
| API       | [v1/dropship](../services/api-rest/src/routes/v1/dropship)            | `suppliers` (connect/configure/sync/catalog/import) + `orders` + `analytics` + `vendors`                  |
| Dashboard | [(dashboard)/dropship](<../apps/dashboard/app/(dashboard)/dropship/>) | Suppliers, products, analytics; the vendor picker + per-vendor connect form                               |

> **One dropship abstraction, not two.** `@sparx/integration-framework` also declares a
> `DropshipProvider` interface (so `ProviderBundle.dropship` type-checks). It is **dead** — the
> built path is `@sparx/dropship`, which has its own table and routes rather than riding the
> provider/marketplace install flow. The framework interface is annotated deprecated; new
> dropship work extends `@sparx/dropship`. (Supersedes the docs/88 §5 "framework speced" note.)

---

## 3. Supported suppliers — and the vendor-API reality

Only suppliers with a **real, self-serve, documented integration** are offered. This is a hard
constraint discovered during research (2026-06-13): most dropship/POD suppliers do **not** expose
an API a custom platform can connect to — they expect to be the app that plugs into _your_
storefront, not the reverse. Offering a vendor we can't actually fulfill would be a dead
"Connect" button, so unsupported vendors are **omitted from the picker**, not stubbed.

### Offered (in `VENDOR_CATALOG`)

| Vendor       | Method   | Type            | Notes                                                                            |
| ------------ | -------- | --------------- | -------------------------------------------------------------------------------- |
| **Printify** | API      | Print-on-demand | Bearer token, broadest catalog (apparel + drinkware + home goods), 90+ providers |
| **Printful** | API (v1) | Print-on-demand | Bearer token + optional store id; stable v1 (v2 is beta). Apparel-led, premium   |
| **DSers**    | API      | General         | AliExpress-sourced; token + store id                                             |
| **Spocket**  | API      | General (US/EU) | API key; premium faster-shipping suppliers                                       |
| **CSV feed** | Manual   | Any             | Import a product feed; orders fulfilled manually (the honest no-API fallback)    |

### Evaluated and NOT offered (no usable public API)

| Vendor                         | Verdict                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tapstitch**                  | No public REST API. Store-platform connector only; a direct API is Enterprise-gated + undocumented                                                                                                                                                                                                                                                                                                               |
| **PODPartner**                 | No public REST API at all. Same posture as Tapstitch                                                                                                                                                                                                                                                                                                                                                             |
| **Zendrop**                    | MCP-only (no REST); paid plan; tool schemas must be introspected from a live account                                                                                                                                                                                                                                                                                                                             |
| **AutoDS**                     | Real REST API exists but gated behind approval + a large activation fee; schemas locked until then                                                                                                                                                                                                                                                                                                               |
| **Faire**                      | API is **brand/seller-side only** (no retailer/buyer sourcing endpoint), and Faire is wholesale, not dropship-to-consumer                                                                                                                                                                                                                                                                                        |
| **Ninja Transfers / NinjaPOD** | Core business is DTF transfers + blank apparel you press yourself (not dropship). Their white-label POD arm, **NinjaPOD**, IS a real dropship fit (they print/pack/white-label ship) — but it's a **Shopify-app integration only**, with no public developer API to drive catalog/orders. Revisit if NinjaPOD ships an API. (evaluated 2026-06-14)                                                               |
| **MyDesigns**                  | "Public API" page says **"API & Documentation coming soon"** and is **partner-gated** (contact form, not self-serve). Separately, MyDesigns is a design-generation + listing-automation + DAM layer that _routes orders to other fulfillment partners_ — it sits at the **same layer Sparx does**, not below us as a clean supplier, so it's a poor "vendor" fit even once an API exists. (evaluated 2026-06-14) |
| **Vistaprint / Cimpress**      | Two layers, neither self-serve. **Vistaprint direct** has _no_ dropship API — its reseller arm **ProAdvantage** (on `cimpress.io`) is a manual web ordering portal with blind shipping, no programmatic order placement/webhooks, and subscriptions were **temporarily closed for a platform rebuild** at eval time. The real API is **Cimpress Open** (the MCP that grew out of Vistaprint), but access is **invitation + contract gated**: OAuth2 client-credentials provisioned only after a designated technical contact is invited and a Fulfillment Services Agreement is signed — same partnership-gated posture as AutoDS, not a paste-a-token flow. `open.cimpress.io` was also serving an **expired TLS cert** at eval. Fails the self-serve bar on both layers. Revisit if Cimpress Open opens a self-serve merchant tier (published commission terms, instant credentials) or ProAdvantage ships an API after its relaunch. (evaluated 2026-06-14) |

> If any of these later open a self-serve API (or a tenant strikes a deal with AutoDS), they slot
> in as a new adapter + `VENDOR_CATALOG` entry with no schema change. **NinjaPOD** is the most
> worth-watching of the no-API set (a genuine DTF-apparel dropship niche). POD vendors with strong
> public APIs worth revisiting if we expand: **Gelato**, **Gooten**.

---

## 4. Supplier adapter contract

Each adapter implements the `SupplierAdapter` interface
([packages/dropship/src/types.ts](../packages/dropship/src/types.ts)):

```typescript
interface SupplierAdapter {
  authenticate(credentials: Credentials): Promise<boolean>;
  syncCatalog(since?: Date): AsyncGenerator<NormalizedProduct>;
  submitOrder(order: Order): Promise<SupplierOrderResult>;
  getTrackingUpdate(supplierOrderId: string): Promise<TrackingInfo>;
  checkInventory(skus: string[]): Promise<InventoryMap>;
}
```

`createAdapter(type, credentials)` constructs the right adapter by `type`. Credentials are an
opaque `Record<string,string>` stored (encrypted) on the supplier row; the adapter casts them to
its own typed shape. POD adapters return `null` from `checkInventory` (made-to-order: no finite
stock).

**Variant references.** `submitOrder` only receives `supplierSku` per line, so each adapter
encodes whatever its order API needs into that SKU during `syncCatalog`: Printful uses the
`sync_variant_id`; Printify uses a composite `"{productId}:{variantId}"`; DSers/Spocket use the
supplier SKU directly.

---

## 5. Selectable integration (the vendor picker)

The connect flow is two steps:

1. **Pick a vendor.** `GET /v1/dropship/vendors` returns `VENDOR_CATALOG` — each entry carries a
   label, tagline, description, `connectionMethod` (`api` | `manual`), a `pod` flag, a
   `capabilities` map, and a **`credentialFields[]` spec** (key, label, type, placeholder, help,
   required). The picker renders one card per vendor, badging POD and automated-vs-manual.
2. **Enter credentials.** The form is **data-driven** from the chosen vendor's `credentialFields`
   — no per-vendor form code. The merchant also sets an optional pricing rule (§8) and, on a
   multi-site tenant, the site scope (§6).

`POST /v1/dropship/suppliers` validates the connection inline (calls `adapter.authenticate`)
before persisting, so a bad credential fails fast with a 400 rather than a silent broken row.

A tenant may connect several suppliers, edit credentials, and disconnect (soft-delete) any of
them. "Switching" is just connecting a new one and disconnecting the old.

---

## 6. Per-site enablement (multi-site)

A supplier connection is **tenant-wide** — one credential set, one imported catalog — and is
either enabled on **every** site (the default) or restricted to specific sites. This is modeled
by the `DropshipSupplierProperty` junction (composite PK, no `tenant_id`, isolation rides the FK
parents — same convention as `commerce_product_properties`):

- **No rows for a supplier = enabled on all of the tenant's sites.** (Zero backfill: every
  existing connection stays global.)
- **Rows present = enabled only on those sites.**

Effects:

- The connect/edit form shows a per-site selector only when the tenant has more than one site;
  default is "all sites."
- `GET /v1/dropship/suppliers?propertyId=…` returns the connections enabled on a given site
  (scoped-to-it **or** all-sites).
- **Imported products inherit the connection's site scope.** Importing from a connection scoped
  to sites A+B writes `commerce_product_properties` rows for A+B, so the product only appears on
  those sites; an all-sites connection writes none, leaving the product global.

This satisfies "each site can have multiple dropship providers, and each site can have its own."

---

## 7. Product import flow

1. Tenant browses a connected supplier's synced catalog in the dashboard.
2. Selects a product → **Import**. The platform creates a `commerce_products` row (draft) +
   `product_variants`, applies the supplier's pricing rule (or a per-import override), imports
   images, links the variant cost (`costCents`) and dropship source, and writes a
   `DropshipProductLink`.
3. The product is scoped to the supplier's sites (§6) and indexed (`search.entity.changed`).
4. Tenant reviews price/content and publishes.

---

## 8. Pricing rules

Imported products price automatically via `applyPricingRule(costCents, rule)`:

| Rule type           | Formula                  |
| ------------------- | ------------------------ |
| `percentage_markup` | `cost × (1 + value/100)` |
| `multiplier`        | `cost × value`           |
| `flat_markup`       | `cost + value` (cents)   |
| `fixed_margin`      | `cost / (1 − value/100)` |

Rounding (`cent` | `dollar` | `five_dollar`) and an optional cap at the supplier MSRP
(`compare-at` = supplier MSRP) are applied after.

---

## 9. Catalog sync

`syncCatalog` is an async generator the sync worker drains on a schedule and on demand. API
suppliers sync price/inventory/availability; CSV is a manual re-pull. A product that goes out of
stock or is discontinued is flagged unavailable and the tenant is notified (dashboard + email).
POD suppliers have no finite stock, so inventory sync is a no-op for them.

---

## 10. Order routing & fulfillment

When an order containing dropship products is placed:

1. The router splits lines into fulfillment groups **by supplier** (a `DropshipOrder` per group).
2. Each group is submitted via its adapter's `submitOrder` (idempotent on the Sparx order id).
3. Tracking arrives by poll (`getTrackingUpdate`) or webhook; the order's fulfillment record and
   the customer shipping email update; a CRM activity is logged.

Mixed orders (some inventory-held, some dropship) fulfill each group independently; the customer
gets combined tracking when all groups ship. A submission failure holds the group and alerts the
tenant rather than silently dropping it.

---

## 11. Margin & profitability reporting

Per-product and per-order profitability (cost, revenue, gross margin $/%, shipping margin, fees)
is available in the dashboard and via MCP ("What are my top 10 most profitable dropship products
this month?"). Cost comes from the imported variant cost; for aggregators the cost can drift
between sync and order time, so margin is reported as of last sync.

---

## 12. Print-on-demand authoring — DEFERRED (decision)

**Decision (2026-06-13):** ship **catalog + order routing** for the POD suppliers now; defer POD
**authoring** (design/mockup in Sparx → publish to the supplier) to a later phase. The current
flow imports products the merchant has already designed in the supplier's tools and routes orders
to them by SKU — no artwork moves through Sparx.

To keep authoring from becoming a rewrite later, the seams are already open:

- **`DropshipProductLink.metadata` (JSONB, nullable)** — reserved home for a product↔supplier
  design binding (designRef, print-file URLs, placement map). Null today.
- **`DropshipProduct.variants` / `.raw` (JSONB)** — already carry the full supplier payload, so
  POD product structure (print areas, mockups, blueprint/template ids) lands without a migration.
- **The order line** today carries only `supplierSku`. POD authoring would add `files` /
  `placements` to the submitted line (both Printify and Printful accept these on the order). The
  adapter interface can grow an optional `createProduct(design)` without disturbing the import +
  order-routing path.

Do not block the deferred work: when POD authoring lands, it is additive.

---

## 13. Decisions (locked)

| #   | Decision                       | Choice                                                                                         |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| D1  | Dropship abstraction           | Extend the built `@sparx/dropship` `SupplierAdapter`; the framework `DropshipProvider` is dead |
| D2  | Which vendors                  | Only self-serve documented APIs: Printify, Printful, DSers, Spocket, CSV                       |
| D3  | No-API vendors                 | Hidden from the picker (not stubbed): Tapstitch, PODPartner, Zendrop, AutoDS, Faire            |
| D4  | POD pick (replacing Tapstitch) | Printify + Printful (both real APIs)                                                           |
| D5  | Connection ↔ site              | Tenant-wide connection, enabled per site; empty scope = all sites                              |
| D6  | POD authoring                  | Deferred; catalog + order routing now; seams kept open (§12)                                   |

---

## 14. Open questions

- **Order email.** The `SupplierAdapter` `Order` has no customer email; Printify/Printful accept
  one on the order. Add an optional `email` to `Order` when a supplier requires it for
  notifications.
- **AutoDS by request.** If a tenant wants AutoDS, it needs a business deal + post-approval
  schemas; build the adapter then and add it to `VENDOR_CATALOG` (it would be a `manual`/gated card).
- **CSV column mapping UI.** The CSV adapter needs a column-mapping config the current connect
  form doesn't yet collect; a richer CSV mapping step is a follow-on.
