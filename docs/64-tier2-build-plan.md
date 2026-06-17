# sparx Platform — Tier 2 Module Build Plan

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-09

---

## Overview

This doc is the sequenced build plan for the four Tier 2 modules: Domain Purchase, B2B/Wholesale, Dropship, and Inventory Sync. All four are specced (see linked PRDs); this doc translates them into actionable, phased implementation slices ordered by dependency and client priority.

**Context:** The platform is pre-live. Tier 1 work (Checkout/Payment, Onboarding completion, MCP/AI) is running in parallel by other agents. Tier 2 work can proceed in parallel on its own branch(es). Billing/Stripe is explicitly deferred — where a phase touches payment (Domain Purchase), stub the Stripe charge with a placeholder that can be wired later.

**Build constraints (from CLAUDE.md):**

- Production-complete — no stubs, no happy-path-only flows
- Module-gated via feature flags, not plan tiers
- Event-driven side effects via Pub/Sub (no inline handlers)
- RLS by hand-edited SQL on every new tenant-scoped table
- New workspace packages need COPY lines in consumer Dockerfiles
- Commits: conventional-commit format, no Co-Authored-By trailers

---

## Module 1 — Domain Purchase (docs/24)

**Spec:** [docs/24-domain-purchase-management.md](archive/24-domain-purchase-management.md)
**Existing foundation:** `services/api-rest/src/routes/v1/domains.ts` handles connect/verify. The `domains` table is live (non-RLS dispatch table). GoDaddy OTE environment available at `api.ote-godaddy.com`.
**Stripe dependency:** Domain purchase requires a Stripe PaymentIntent. For now, implement the full flow but skip the charge — return a mock `payment_intent_id` so the rest of the flow (GoDaddy purchase → DNS config → DB record) can be tested end-to-end. Wire Stripe when billing lands.

### Phase 1 — GoDaddy client + DB schema (no UI)

- Add `GODADDY_API_KEY_OTE`, `GODADDY_API_SECRET_OTE`, `GODADDY_API_KEY_PROD`, `GODADDY_API_SECRET_PROD` to Secret Manager and `.env.example`
- Create `packages/godaddy/` (or `services/api-rest/src/lib/godaddy.ts`) with:
  - `checkAvailability(domain)` → `{ available, price, currency, tld }`
  - `getDomainSuggestions(query, tlds?)` → `DomainSuggestion[]`
  - `purchaseDomain(domain, years, registrantContact, consent)` → `{ orderId }`
  - `configureDNS(domain, records[])` → void
  - `generateDkimKeypair()` → `{ publicKey, privateKey }`
  - Reads OTE vs prod credentials based on `NODE_ENV`
- DB migration — add to `domains` table: `registrar`, `registrar_order_id`, `type` (subdomain/custom/purchased), `registered_at`, `expires_at`, `auto_renew`, `whois_privacy`, `renewal_price_cents`
- New table `domain_purchases`: id, tenant_id, domain, registrar, registrar_order_id, stripe_payment_intent_id, amount_cents, years, type (registration/renewal/transfer), status, created_at — with RLS ENABLE + FORCE
- Pub/Sub topic: `domain.purchased` event schema

### Phase 2 — API endpoints

Extend `services/api-rest/src/routes/v1/domains.ts`:

| Method  | Path                           | Body                                     | Returns                          |
| ------- | ------------------------------ | ---------------------------------------- | -------------------------------- |
| `POST`  | `/v1/domains/search`           | `{ query }`                              | `DomainSuggestion[]`             |
| `POST`  | `/v1/domains/check`            | `{ domain }`                             | `DomainAvailability`             |
| `POST`  | `/v1/domains/purchase`         | `{ domain, years, privacy, propertyId }` | `{ domain, orderId, expiresAt }` |
| `POST`  | `/v1/domains/:id/renew`        | `{ years }`                              | `{ domain, expiresAt }`          |
| `POST`  | `/v1/domains/:id/transfer-out` | —                                        | `{ authCode }`                   |
| `PATCH` | `/v1/domains/:id/privacy`      | `{ enabled }`                            | updated domain                   |
| `PATCH` | `/v1/domains/:id/auto-renew`   | `{ enabled }`                            | updated domain                   |

Purchase flow sequence (per docs/24 §4):

1. [Stub] Stripe charge → mock `payment_intent_id`
2. GoDaddy: `purchaseDomain` → `orderId`
3. GoDaddy: `configureDNS` with sparx DNS records (CNAME @/www → customers.sparx.zone, SPF TXT, DKIM TXT with generated keypair, DMARC, MX)
4. DB: insert `domain_purchases` + upsert `domains` row (`type: purchased`, `status: pending_ssl`)
5. Pub/Sub: publish `domain.purchased`
6. Return success — Caddy on-demand TLS handles SSL from first request

### Phase 3 — Domain worker

New Cloud Run worker (`services/domain-worker/`) subscribed to `domain.purchased`:

- Polls DNS propagation for the new domain
- Marks domain `status: active` once resolved
- Triggers renewal notification emails (30/14/7 day schedule via existing email-worker)
- Nightly cron checks `expires_at < now() + 30d` → publish renewal reminders

### Phase 4 — Dashboard UI

**Settings → Domains panel** (`apps/app/src/app/(dashboard)/settings/domains/`):

- List all domains with status badges (Active / Pending DNS / SSL provisioning / Expiring soon in orange <30d / red <7d)
- Per-domain actions: Set primary, Renew, Enable WHOIS privacy, Transfer out, Remove
- "Find a new domain" search flow (debounced 300ms, suggestions grid with pricing, "Purchase & Connect" button → payment confirmation modal → progress steps → success)

**Onboarding Step 4** — update existing domain step to show domain search first, "Already have a domain?" as secondary path.

### Phase 5 — MCP tools

Add to MCP server (`services/mcp-server/`):

- `get_domains()` — lists all tenant domains with status
- `check_domain_availability(domain)` — availability + pricing
- `suggest_domains(query)` — available suggestions for a business name
- `purchase_domain(domain, years)` — **requires explicit confirmation gate before executing**

---

## Module 2 — B2B/Wholesale (docs/10)

**Spec:** [docs/10-b2b-wholesale-prd.md](10-b2b-wholesale-prd.md)
**Existing foundation:** `apps/app/src/app/(dashboard)/commerce/b2b/` layout + manifest exists. `b2b_accounts` table exists (CRM spine per docs/11 — the CRM owns the customer spine). The Commerce module is gated by the `commerce` module flag; B2B is gated by the `b2b` module flag.
**Module flag:** `b2b`

### Phase 1 — Data model + pricing tiers

New migration — tables (all with RLS ENABLE + FORCE):

- `b2b_pricing_tiers`: id, tenant_id, name, discount_type (percentage/fixed), discount_value, product_scope (all/collections/products), min_order_cents, created_at
- `b2b_tier_product_overrides`: id, tenant_id, tier_id, product_id (nullable), collection_id (nullable), price_cents (nullable), discount_percentage (nullable)
- `b2b_account_product_overrides`: same shape but account_id instead of tier_id
- Extend `b2b_accounts`: add `pricing_tier_id` FK, `credit_limit_cents`, `credit_used_cents`, `payment_terms` (prepay/net30/net60/net90), `discount_percentage`, `status` (active/suspended/credit_hold), `fleet_profiles` JSONB, `internal_notes`

Price resolution function `resolve_b2b_price(variant_id, b2b_account_id)` → returns effective price + tier used. Implement in Postgres as a SQL function so it's consistent across API calls.

Dashboard UI (`apps/app/src/app/(dashboard)/commerce/b2b/`):

- Account list (name, tier, credit status, outstanding balance)
- Account detail: info, contacts, credit summary, pricing override table, fleet profile editor, order history
- Pricing Tiers list + create/edit form

API routes (`services/api-rest/src/routes/v1/b2b/`):

- `GET /v1/b2b/accounts` — list with filters (status, tier, overdue)
- `GET/POST/PATCH /v1/b2b/accounts/:id`
- `GET/POST/PATCH /v1/b2b/pricing-tiers`
- `GET/PATCH /v1/b2b/pricing-tiers/:id/overrides`
- `GET/PATCH /v1/b2b/accounts/:id/overrides`

### Phase 2 — Quote / RFQ workflow

New tables: `b2b_quotes` (id, tenant_id, account_id, customer_id, status, expiry_at, notes, merchant_notes, created_at), `b2b_quote_items` (quote_id, product_id, variant_id, qty_requested, price_quoted, notes).

Quote lifecycle: `draft → submitted → under_review → quoted → accepted/declined/expired`

API routes:

- `GET/POST /v1/b2b/quotes`
- `GET/PATCH /v1/b2b/quotes/:id`
- `POST /v1/b2b/quotes/:id/submit`
- `POST /v1/b2b/quotes/:id/respond` (merchant sets line prices + sends)
- `POST /v1/b2b/quotes/:id/accept` (customer — creates order at quoted price)
- `POST /v1/b2b/quotes/:id/decline`
- `GET /v1/b2b/quotes/:id/pdf` → stream PDF

Dashboard UI:

- Quotes list (pending response, active, expired)
- Quote detail / response editor (set per-line prices, add notes, set expiry, send)

Email notifications: `quote.submitted` → merchant, `quote.responded` → customer (via Pub/Sub → email-worker)

### Phase 3 — Net terms + credit management

Invoice generation at order creation for net-terms accounts:

- `b2b_invoices` table: id, tenant_id, account_id, order_id, invoice_number, due_at, status (unpaid/paid/overdue), paid_at
- `POST /v1/b2b/invoices/:id/mark-paid` (manual payment recording)
- Credit utilization: `credit_used_cents` = sum of unpaid invoices; enforced at order placement
- Overdue worker (Cloud Run cron): daily check → reminder emails at 7/14/30d overdue thresholds → auto status transitions (credit_hold at 14d, suspended at 30d)

### Phase 4 — Fleet & fitment

Extend product variants with fitment data (JSONB `fitment` array). Product import/edit UI gets a Fitment tab (year_min, year_max, make, model, engine). Fleet profile editor on B2B account. Price resolution passes fleet context to `resolve_b2b_price`. Site catalog filtering by fleet profile (via `ext.b2b.fleet` binding in Builder).

### Phase 5 — B2B Portal (site-side)

Extend `@sparx/customer-auth` (not Better Auth — see docs/27) with B2B account context. B2B portal routes under the tenant site: `/account/b2b/` — credit summary, invoice downloads, quote submission, reorder, saved carts. Access control: `account_admin` / `buyer` / `viewer` roles on `b2b_account_contacts`.

### Phase 6 — Purchase approval workflows

`purchase_approval_rules` table per tenant/account. Order placement check: if approval required, set `status: pending_approval`, notify approver. Dashboard approval queue. Approve/reject with reason.

### Phase 7 — Service scheduling

`service_types` and `service_appointments` tables. Booking UI on B2B portal. Appointment linked to B2B account + fleet vehicle. Parts-to-appointment linking. Automated confirmation + reminder emails.

---

## Module 3 — Dropship (docs/14)

**Spec:** [docs/14-dropship-integration-prd.md](14-dropship-integration-prd.md)
**Existing foundation:** `apps/app/src/app/(dashboard)/commerce/dropship/` layout + manifest. No backend implementation.
**Module flag:** `dropship`

### Phase 1 — Connector framework + data model

New tables (all RLS ENABLE + FORCE):

- `dropship_suppliers`: id, tenant_id, name, type (dsers/spocket/faire/autods/custom/csv), credentials JSONB (encrypted), status (connecting/active/error/disconnected), last_sync_at
- `dropship_products`: id, tenant_id, supplier_id, supplier_product_id, title, description, images JSONB, variants JSONB, cost_price_cents, msrp_cents, raw JSONB, imported_at
- `dropship_product_links`: id, tenant_id, product_id (→ products), dropship_product_id, supplier_sku, status (active/discontinued)
- `dropship_orders`: id, tenant_id, order_id (→ orders), supplier_id, supplier_order_id, status (pending/submitted/shipped/delivered/failed), tracking_number, tracking_url, submitted_at, shipped_at

`SupplierAdapter` interface in `packages/dropship/`:

```typescript
interface SupplierAdapter {
  authenticate(credentials: Credentials): Promise<boolean>;
  syncCatalog(since?: Date): AsyncGenerator<NormalizedProduct>;
  submitOrder(order: Order): Promise<SupplierOrderResult>;
  getTrackingUpdate(supplierOrderId: string): Promise<TrackingInfo>;
  checkInventory(skus: string[]): Promise<InventoryMap>;
}
```

### Phase 2 — CSV/manual supplier (Tier 3)

First concrete adapter: CSV file upload. Merchant uploads supplier CSV → normalized product schema → `dropship_products`. Order export as CSV for manual submission. This proves the adapter interface before building live API connectors.

Pricing rules engine: cost + percentage margin / multiplier / flat markup / compare-at = MSRP. Applied at import time, configurable per supplier.

Dashboard UI:

- Suppliers list + Add Supplier flow (select type → enter credentials → test → sync)
- Supplier catalog browser (search, filter by category/price/shipping-time, Import button)
- Dropship Products list (imported products, margin %, sync status)

### Phase 3 — Order router

When an order is placed containing dropship products:

1. Order router splits fulfillment groups by supplier
2. For each group: create `dropship_orders` row, publish `dropship.order.route` event
3. Dropship worker consumes event → calls `adapter.submitOrder()` → stores `supplier_order_id`
4. Tracking webhook or polling → `adapter.getTrackingUpdate()` → updates fulfillment record → triggers customer shipping email

Mixed orders (inventory + dropship) handled in a single checkout; each group fulfills independently.

New Cloud Run worker `services/dropship-worker/`:

- Subscribes to `dropship.order.route` (submit to supplier)
- Cron: every 4h catalog sync for Tier 1 suppliers, every 12h for Tier 2
- Cron: tracking poll for submitted/shipped orders

### Phase 4 — Native connectors

**DSers/AliExpress** and **Spocket** adapters (most common use cases). Each is a standalone class implementing `SupplierAdapter` in `packages/dropship/adapters/`. Build one at a time — DSers first (largest catalog). Credentials: API key + secret stored in Secret Manager per tenant.

### Phase 5 — Profitability reporting

Per-product and per-order: cost, revenue, gross margin ($, %), shipping margin. Accessible in dashboard and MCP. MCP tool: `get_dropship_margin_report(period)`.

---

## Module 4 — Inventory Sync (docs/28)

**Spec:** [docs/28-inventory-sync-integration.md](28-inventory-sync-integration.md)
**Status:** Design doc only. The first concrete driver is Gillett Diesel / Fishbowl (on-prem Tier A). Build the generic framework now; hold the Fishbowl adapter until Gillett's connectivity tier is confirmed.
**Module flag:** `commerce` (part of Commerce, no separate fee)

### Phase 1 — Schema migration

New tables (all RLS ENABLE + FORCE):

```sql
stock_locations      -- warehouse / bin / store per tenant
stock_levels         -- per-variant per-location on_hand + committed + available (generated)
inventory_source_links -- ties a sparx variant to its external SKU
inventory_sources    -- one configured connection per tenant per external system
```

`product_variants.inventory_quantity` stays as the denormalized rollup for sparx-native SKUs. For externally-linked variants it becomes a materialized sum of `stock_levels` (updated by the sync worker).

A variant with no `inventory_source_links` row behaves exactly as today — non-breaking.

### Phase 2 — Core sync worker + CSV ingest (Tier C)

Source-agnostic `services/inventory-sync-worker/` (Cloud Run):

- Consumes `inventory.external.updated` events → resolves SKU via `inventory_source_links` → upserts `stock_levels` → recomputes `product_variants.inventory_quantity` → publishes `inventory.changed`
- Conflict rules: external system always wins on `on_hand`; log discrepancies
- Nightly full-snapshot reconciliation path

CSV ingest adapter: merchant uploads stock-level CSV (SKU, location, on_hand) → normalized to `inventory.external.updated` events → worker processes.

Dashboard UI — Connections → Inventory Source:

- Add source (select type: CSV / cloud-api / bridge-agent)
- SKU mapping view (auto-match by SKU, manual-map unmapped)
- Sync health panel (last delta, last reconcile, mismatches, source status)

### Phase 3 — Cloud API adapter (Tier B)

First cloud-API adapter. Candidate: **Cin7/DEAR** or **Katana** (widely used, good REST APIs). Do not implement until a merchant running one of these is confirmed. Adapter goes in `packages/inventory/adapters/`.

### Phase 4 — On-prem bridge agent (Tier A)

**Blocked on Gillett Diesel confirmation** — need: Fishbowl version/edition, whether IT will allow an outbound HTTPS agent, and which connectivity port is available. Do not scope further until answered.

When unblocked: Windows agent (Node.js + pkg or Tauri) that talks to Fishbowl's LAN API, long-polls a command queue on sparx, and pushes stock snapshots via outbound HTTPS. Pairing/enrollment flow mints a tenant-scoped API key.

---

## Build order summary

| #   | Module          | Phase                                       | Approximate scope         |
| --- | --------------- | ------------------------------------------- | ------------------------- |
| 1   | Domain Purchase | Ph1 GoDaddy client + schema                 | 1–2 days                  |
| 2   | Domain Purchase | Ph2 API endpoints + purchase flow           | 1–2 days                  |
| 3   | Domain Purchase | Ph3 Domain worker                           | 1 day                     |
| 4   | Domain Purchase | Ph4 Dashboard UI                            | 1–2 days                  |
| 5   | Domain Purchase | Ph5 MCP tools                               | 0.5 day                   |
| 6   | B2B/Wholesale   | Ph1 Data model + pricing tiers              | 2–3 days                  |
| 7   | B2B/Wholesale   | Ph2 Quote/RFQ workflow                      | 2 days                    |
| 8   | B2B/Wholesale   | Ph3 Net terms + credit                      | 2 days                    |
| 9   | B2B/Wholesale   | Ph4 Fleet + fitment                         | 1–2 days                  |
| 10  | B2B/Wholesale   | Ph5 B2B portal                              | 2–3 days                  |
| 11  | Dropship        | Ph1 Connector framework + schema            | 1–2 days                  |
| 12  | Dropship        | Ph2 CSV adapter + pricing rules + dashboard | 2 days                    |
| 13  | Dropship        | Ph3 Order router + worker                   | 1–2 days                  |
| 14  | Dropship        | Ph4 DSers/Spocket native connectors         | 2–3 days                  |
| 15  | Inventory Sync  | Ph1 Schema migration                        | 0.5 day                   |
| 16  | Inventory Sync  | Ph2 Core worker + CSV ingest                | 2 days                    |
| 17  | Inventory Sync  | Ph3–4 Cloud/bridge adapters                 | Blocked — confirm Gillett |

---

## Cross-cutting rules for every phase

- All new Pub/Sub events follow the existing `publishEvent()` helper in `@sparx/events`
- All new Cloud Run workers use the `cloud-run-worker` Terraform module pattern (see `services/email-worker/` as reference)
- New `@sparx/` packages need COPY lines in the consumer service Dockerfiles
- Module gating: wrap routes in `requireModule('b2b')` / `requireModule('dropship')` — the same middleware used by other module routes
- Emails: publish `email.send` Pub/Sub event; do NOT call `sendTemplate()` directly except for OTP-level synchronous flows
- Dashboard UI: all list pages use `ListToolbar` + `Container size="full"`, detail pages `Container size="xl"`. Buttons use `color="module"` (Commerce = orange for b2b/dropship routes)
- Every delete/overwrite behind `useConfirm` (name the target + count data at risk)
