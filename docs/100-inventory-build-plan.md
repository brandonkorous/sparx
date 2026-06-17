# Sparx Platform — Inventory Product Build Plan

**Version:** 1.3
**Author:** Brandon Korous
**Last Updated:** 2026-06-16

---

## 0. What this is

The build plan for **Inventory as a first-class, standalone Sparx product** — the scope decided in
[docs/99 §4](99-inventory-implementation-audit.md). docs/99 is the audit + target architecture; this
doc is the _how_: package topology, data model, the six phases, and the exact integration points.

**Binding principles** (from docs/99 §4.0, do not re-litigate):

- Inventory is its **own module/product** (`inventory`, amber `#F59E0B`), owning the **supply** side.
  Commerce/B2B/Dropship are **consumers**, never owners of stock.
- **Standalone-usable is a hard requirement** — a tenant can run Inventory alone (WMS-lite) with no
  commerce, no storefront, no orders. Commerce/B2B are integrations layered on top.
- **One source of truth + an append-only movement ledger.** Every quantity change is a movement row;
  `onHand` is a reconcilable rollup. This kills the two-model split and the dead reservation engine.

---

## 1. Current state we build on (not greenfield)

The module is **half-scaffolded** already — completing it, not inventing it:

| Already exists                     | Location                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `inventory` module slug + type     | `packages/modules/src/index.ts` (`ModuleSlug`, `ALL_MODULES`)                                            |
| Activation validation slug         | `services/api-rest/src/routes/v1/tenant.ts` `MODULE_SLUGS`; `settings/modules/actions.ts` `VALID_SLUGS`  |
| Module color (amber `#F59E0B`)     | `packages/ui/src/providers/module-provider.tsx` `MODULE_COLORS`; `variants.ts` `MODULE_COLOR_KEYS`       |
| Marketing catalog entry            | `apps/web/lib/capabilities.ts`; `apps/dashboard/components/module-catalog.ts`                            |
| Dashboard nav manifest             | `apps/dashboard/app/(dashboard)/_shell/registry.ts` imports `inventoryManifest`                          |
| Operational stock engine           | `packages/commerce/src/services/inventory-service.ts` (21 fns) — **to extract**                          |
| Operational tables                 | `schema/34-commerce-inventory.prisma`, `35-commerce-lot-serial.prisma` — **survivors**                   |
| Sync module (parallel, to fold in) | `schema/66-inventory.prisma`, `services/api-rest/src/routes/v1/inventory/`, `services/inventory-worker/` |
| Valuation cron + lib               | `services/api-rest/src/lib/inventory-valuation.ts`, `routes/internal/inventory-cron.ts`                  |

**Missing module wiring** (the footgun lists — add `'inventory'`):

1. `services/api-rest/src/routes/v1/dashboard.ts` — `MODULE_SLUGS` (home-card metrics)
2. `services/api-rest/src/routes/v1/properties.ts` — `MODULE_SLUGS` (per-site scope)
3. `apps/dashboard/lib/modules.ts` — `SWITCHBOARD_MODULES` (pricing switchboard)
4. `packages/billing/src/price-catalog.ts` — `MODULE_MONTHLY_CENTS.inventory = 2900` ($29/mo)
5. `packages/blueprints/src/manifest.ts` — `BlueprintModuleSlug` enum (if inventory is blueprintable)
6. `packages/modules/src/index.ts` + `apps/dashboard/lib/modules.ts` — `BUNDLED_FREE`: bundle `inventory`
   free when `commerce` **or** `b2b` is active (mirrors invoicing↔b2b). Standalone activation bills $29.

**Packaging (§7):** Inventory is **bundled-free with Commerce or B2B**, and **$29/mo standalone** for
inventory/WMS-only tenants. Either way commerce/b2b must **degrade gracefully without inventory** — when
it's off, variants are untracked (always available) and the seam calls are no-ops; stock tracking switches
on with the module.

---

## 2. Target architecture

### 2.1 Package topology

```
@sparx/inventory          NEW — owns the supply domain (service + events + errors + MCP tools)
   ├─ depends on: @sparx/db, @sparx/commerce-schemas¹, shared low-level publisher
   └─ depends on NO other module package  ← keeps the dependency graph acyclic
@sparx/inventory-schemas  DEFERRED¹ — Zod inputs stay in @sparx/commerce-schemas for now
@sparx/commerce           consumes @sparx/inventory (checkout reserve/commit, return restock)
@sparx/crm                emits order.* events; an inventory consumer reacts (no direct dep)
services/inventory-worker EXISTING — repurposed to write the master ledger, + sync adapters
```

> **¹ Deferral (as built in P1a, 2026-06-16).** The standalone `@sparx/inventory-schemas` split was
> **deferred**. The inventory Zod inputs continue to live in `@sparx/commerce-schemas`, which is a
> dependency-free **shared leaf** — `@sparx/inventory` importing it keeps the graph acyclic, so the split
> buys ownership tidiness, not correctness. The blocker: inventory's Zod inputs share primitives
> (`AddressSnapshot`, `HazmatClass`, money/units helpers) with the commerce schemas, so a clean split
> means first extracting those primitives to a third shared leaf — a knot not worth untying mid-foundation.
> Revisit once the supply-side schema surface (PO/receiving/count inputs) is large enough to justify its
> own home. Tracked here so the topology above reads as intent, not current state.

**Dependency rule:** consumers point _at_ inventory; inventory points at no module. This is why the
extraction must also lift the shared primitives inventory currently borrows from commerce.

### 2.2 The extraction untangle (Phase 1 core)

`inventory-service.ts` today imports from `@sparx/commerce`'s internals:

| Borrowed today                                              | Resolution                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sparx/commerce-schemas` (inputs/types)                    | **DEFERRED** — Zod inputs stay in `@sparx/commerce-schemas` (shared leaf, acyclic); `@sparx/inventory-schemas` split postponed (see §2.1 ¹) |
| `../audit` (`writeAuditLog`)                                | `writeAuditLog` writes the shared `AuditLog` table → lift to a shared util (or `@sparx/db`) both modules import                             |
| `../events` (`publishCommerceEvent`, `indexCommerceEntity`) | publish `inventory.*` via the **shared low-level publisher** (`createPublisher`) directly; inventory owns its own event helper              |
| `../errors` (`CommerceOutOfStockError`, …)                  | define `@sparx/inventory` error classes (or a shared `@sparx/errors`)                                                                       |
| `@sparx/db` (Prisma)                                        | unchanged — single shared client                                                                                                            |

> Prisma is **one shared client over one schema folder** — "extracting a package" is **code
> organization + ownership**, not a separate database. **Tables are renamed `commerce_* → inventory_*`
> now** (pre-launch, no user data to preserve — §7), and the ledger model `InventoryAdjustment` →
> **`InventoryMovement`** (`inventory_movements`) to reflect that it records every kind of stock
> movement, not just manual adjustments. RLS policies are re-applied on the renamed tables via the pipeline.

### 2.3 Data ownership — survivors, new, retired

| Survives (master)                                         | New (this plan)                                | Retired / folded                               |
| --------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `Warehouse` (gains types: bin/3pl/transit/virtual)        | `Supplier`                                     | `StockLocation` → `Warehouse`                  |
| `InventoryLevel` (onHand/allocated/available/cost)        | `PurchaseOrder` + `PurchaseOrderLine`          | `StockLevel` → `InventoryLevel`                |
| `InventoryAdjustment` (the **movement ledger**)           | `GoodsReceipt` + `GoodsReceiptLine`            | (sync writes the master, not a parallel table) |
| `InventoryReservation`                                    | `InventoryCount` + `InventoryCountLine`        |                                                |
| `LotBatch`, `SerialUnit`                                  | `RollupInventoryDailyValuation` already exists |                                                |
| `InventorySource`, `InventorySourceLink` (ingestion only) | (reused as the sync feed)                      |                                                |

**Movement ledger invariant:** the only writer of `InventoryLevel.onHand` is one internal
`applyMovement()` that also appends an `InventoryMovement` row, so `onHand == Σ(movements)` always holds
and is auditable. **Every** mutation source funnels through it — checkout, manual dashboard edits, MCP/AI,
3rd-party/ERP sync, returns, the reaper — see §2.5.

**Moving-average cost (from day one):** each cost-bearing inbound movement (receipt, costed adjustment,
sync) updates a stored `avgCostCents` on the level —
`new_avg = (onHand·old_avg + qtyIn·costIn) / (onHand + qtyIn)`. Valuation and margin read `avgCostCents`
(falling back to `ProductVariant.costCents` before the first receipt). No latest-cost interim.

### 2.4 The seam (commerce ↔ inventory)

- **Checkout** (commerce) calls `inventory.reserve()` on cart add, `inventory.commit()` inside the
  order-creation transaction, `inventory.release()` on cancel/payment-fail.
- **Availability**: storefront PDP + B2B read `inventory.levelsForVariant()` / an availability helper.
- **Events**: inventory publishes `inventory.low`, `inventory.depleted`, `inventory.changed`; commerce
  consumes to flip the denormalized `Product.inStock` and hide/show, and to fire automations.
- **Shipping** references inventory `Warehouse` for origin.
- All seam calls are **inert when commerce is inactive** — inventory never depends on commerce being on.
- **Degrade-without-inventory:** when the `inventory` module is off, commerce/b2b treat variants as
  untracked (always available) and the seam calls are no-ops — no reserve/commit/decrement. Stock
  tracking switches on only when inventory is active (bundled-free with commerce/b2b — §1).

### 2.5 One ledger, many writers (concurrency, idempotency, actors)

Stock is mutated concurrently by **many sources** — checkout sales, internal users (dashboard adjust /
receive / count / transfer), MCP/AI, 3rd-party & ERP integrations (Fishbowl push, CSV), returns, and the
reservation reaper. All of them go through `applyMovement()`; none writes `onHand` directly. That funnel
gives three guarantees the product needs:

- **Concurrency-safe:** `onHand` updates take a row lock (atomic increment / `SELECT … FOR UPDATE`), so a
  simultaneous sale + sync delta + manual adjust cannot lose an update or oversell the last unit.
- **Idempotent:** every movement carries an optional `idempotencyKey` (+ unique index). Integration
  retries, redelivered Pub/Sub events (`order.cancelled`), and double-clicks apply **once**.
- **Attributed:** every movement records `actorType` ∈ {`user`,`ai`,`system`,`integration`} + `actorId`
  (+ `source` for integrations), so the audit log answers who moved stock, when, why, and by how much.

Reconciliation from an authoritative external source writes a **corrective movement** (a delta to match),
never a blind overwrite — the audit trail stays intact.

---

## 3. The six phases

Each phase is independently deployable (docs/03 deploy-early) and the **whole surface is committed** —
phases are a deploy order, not a scope cut. "Standalone?" = does this phase work with inventory active
and commerce off.

| Phase | Theme                                                                    | Standalone?       | Ships                                             |
| ----- | ------------------------------------------------------------------------ | ----------------- | ------------------------------------------------- |
| P1    | Foundation: extract `@sparx/inventory`, unify to one ledger, re-point UI | ✅                | `/inventory` shows real data + non-zero valuation |
| P2    | Sell path: wire reserve/commit/release into commerce                     | n/a (integration) | real-time accurate stock, oversell protection     |
| P3    | Supply path: suppliers, POs, receiving, reorder engine                   | ✅                | inbound + replenishment workflow                  |
| P4    | Counts, transfers, audit UI                                              | ✅                | auditable corrections + cross-location moves      |
| P5    | External sync: Tier C/B/A adapters (Fishbowl)                            | ✅                | ERP/WMS-backed merchants live                     |
| P6    | API contract + reporting + MCP + B2B                                     | ✅                | headless + AI + wholesale complete                |

---

### Phase 1 — Foundation (extract + unify + re-point)

**Goal:** one inventory module backed by one ledger, showing real data, with the engine living in
`@sparx/inventory`. This phase alone fixes docs/99 defect D1 and makes `/inventory` useful.

**Work:**

1. **Create `@sparx/inventory`** (use the `new-workspace-package` skill). _(`@sparx/inventory-schemas`
   split **deferred** — Zod inputs stay in `@sparx/commerce-schemas`; see §2.1 ¹.)_
   Move `inventory-service.ts`; resolve the §2.2 untangle (own events/errors, shared audit). Re-export so
   existing importers (MCP read/write tools, reservation-reaper) switch to `@sparx/inventory`.
   `@sparx/commerce` keeps a thin re-export shim only if needed for an interim. ✅ **DONE (P1a, PR #64).**
2. **Unify the stock model.** Make `InventoryLevel`/`Warehouse` the single master:
   - Migrate any `StockLevel`/`StockLocation` data into `InventoryLevel`/`Warehouse`; map location
     types; add `transit`/`bin`/`virtual` to `Warehouse.type`. ✅ **DONE (P1c)** — the migration lifts
     `stock_locations` → `inventory_warehouses` (preserving ids, synthesized `LOC-…` codes) and
     `stock_levels` → `inventory_levels` + an opening `sync` movement per lifted level (so `Σ(movements)`
     holds), looped per-tenant with `app.tenant_id` set (FORCE-RLS footgun). Sync locations fold onto the
     existing `Warehouse.type` vocabulary (`owned`/`3pl`/`virtual`), so no new enum values were needed.
   - Repoint the **sync worker** (`services/inventory-worker/src/handlers/sync.ts`) and the
     `POST /v1/inventory/sources/:id/push` + `/sync` endpoints to upsert `InventoryLevel` via the
     ledger (`sync` reconcile movement), not `stock_levels`. ✅ **DONE (P1c)** — both call
     `inventoryService.reconcileStockLevel()`, which derives a corrective delta inside the level's row
     lock (`applyMovement` `setOnHand`) → `sync` movement, `actorType: 'integration'`. `InventorySourceLink`
     repointed from `stock_locations` to `inventory_warehouses` (`location_id` → `warehouse_id`).
   - **Rename now:** `commerce_* → inventory_*` tables and `InventoryAdjustment → InventoryMovement`
     (`inventory_movements`); re-apply RLS (§2.2, §7). ✅ **DONE (P1b)** — migration
     `20260901000000_inventory_module_ledger` (data-preserving ALTER RENAME of all six tables + their
     PKs/FKs/indexes/RLS policies).
   - Retire `stock_levels`/`StockLocation` (drop after data move; RLS-aware migration via the pipeline).
     ✅ **DONE (P1c)** — migration `20260902000000_inventory_unify_stock` (per-tenant data lift → FK
     repoint → `DROP TABLE stock_levels, stock_locations`).
3. **Movement ledger as the sole write path** (§2.5). Route every `onHand` mutation through one internal
   `applyMovement()` that appends an `InventoryMovement` with `actorType`/`actorId`/`source` + an optional
   unique `idempotencyKey`, taking a row lock on the level for concurrency safety. Add a reconcile check
   (`onHand == Σ(movements)`) and a stored `avgCostCents` updated on costed inbound movements
   (moving-average, §2.3). ✅ **DONE (P1b)** — `applyMovement` (services/ledger.ts) is the sole onHand
   writer (`SELECT … FOR UPDATE` lock, idempotency dedupe, actor attribution, `balanceAfter` running
   balance, moving-average `avgCostCents`); `adjust`/`transfer`/`commit` all route through it. The 1085-line
   service was split by concern (warehouses · levels · ledger · movements · reservations · lots). The
   `onHand == Σ(movements)` reconcile invariant is guaranteed structurally (single writer + `balanceAfter`);
   a standalone reconcile/audit report is P4. ✅ **Hardened + proven (P1e)** — the deferred DB-backed
   integration test (`packages/inventory/test/integration/ledger.test.ts`, real Postgres) pins the
   Σ-invariant + running `balanceAfter`, idempotency-key dedupe, the absolute `setOnHand` reconcile, AND a
   concurrent-writer test. That last one surfaced a real hole: the "ensure the level row exists" step used a
   Prisma `upsert` (SELECT-then-INSERT), so a concurrent burst of the **first** movement on a brand-new
   (variant, warehouse) collided on the PK instead of serializing. Fixed to an atomic
   `INSERT … ON CONFLICT (variant_id, warehouse_id) DO NOTHING`, so the FOR UPDATE lock's concurrency
   guarantee now holds even for first-touch.
4. **Re-point reads at the master:** ✅ **DONE (P1c)** — verified against the dev DB (155 on-hand units +
   3 ledger movements that the old `stock_levels`-backed reports showed as zeros).
   - `inventory-valuation.ts` `computeValuation()` → `inventory_levels`, costed at the moving-average basis
     (avg → unit → variant cost). Valuation now non-zero. ✅
   - `routes/v1/inventory/reports.ts` (summary/by-warehouse/activity) → master + the ledger. The activity
     feed is the real `inventory_movements` ledger (delta · reason · running balance), not `stock_levels`
     `updatedAt` diffs. ✅
   - `/inventory` overview page → the re-pointed reports; the recent-changes card renders the movement feed,
     and `/inventory/locations` now lists `Warehouse`s (one stock model). ✅
5. **Move the operational pages under `/inventory`:** `/commerce/inventory` → `/inventory/stock`,
   `/commerce/warehouses` → `/inventory/warehouses`, `/commerce/lots` → `/inventory/lots`; the
   `/inventory` route itself stays the master-backed **overview** (the stock grid moved to
   `/inventory/stock` so the landing isn't displaced). Update the `inventoryManifest` sections.
   ✅ **DONE (P1e)** — pages moved (history-preserving `git mv`); the inventory module owns its own API
   namespace `/v1/inventory/*` (`stock.ts` levels/adjust/transfer/reorder/low-stock/enriched + `lots.ts`
   lots/serials/recalls), gated by `requireInventoryModule` so a standalone WMS tenant manages stock with
   no commerce. The orphaned `/v1/commerce/inventory*` + `/v1/commerce/warehouses` routes were removed and
   their commerce-side consumers (product editor Inventory tab, settings, detail-slot, universal-search
   warehouse projector) repointed to `/v1/inventory/*` (inventory rides free with Commerce, so the gate
   passes). The bare `/inventory/locations` page was retired in favour of `/inventory/warehouses`.
6. **Finish module wiring** — add `'inventory'` to the lists in §1 (price `2900`, `BUNDLED_FREE` with
   commerce/b2b) and build the commerce/b2b **degrade-without-inventory** path (untracked = always available).
   ✅ **DONE (P1e)** — `MODULE_MONTHLY_CENTS.inventory = 2900`; `BUNDLED_FREE: inventory → [commerce, b2b]`
   in `@sparx/modules` + the dashboard/web switchboard mirrors; `properties.ts` `MODULE_SLUGS` +
   `BlueprintModuleSlug` extended (dashboard.ts + activation slugs already had it). The degrade path is the
   shared `computeAvailability(levels, policy, { inventoryActive })` in `@sparx/inventory` — the single home
   for "untracked = always available" — wired into the storefront PDP read (`mapFullProduct` passes
   `isModuleEnabled(tenantId, 'inventory')`); module off → unbounded, always in stock, seam no-ops.
7. **Seed** real inventory data (warehouses + levels + movements + lots) so a fresh tenant shows a
   populated module (per the "seed rich local data" rule).
   ✅ **DONE (P1e)** — `seedDemoInventory()` builds a focused diesel-parts catalog (8 products / 10 variants,
   the Gillett vertical) across 2 warehouses, writing opening movements the `applyMovement` way (Σ(delta) ==
   on_hand, running `balance_after`). Verified against docker pg: **0 invariant mismatches**, valuation
   $24,718.50 cost / $50,138.57 retail over 925 units, OUT=1/LOW=3/HEALTHY=11, 36 movements, 1 active recall,
   4 lots — the module renders real numbers. Idempotent (handle `inv-demo-*` drop+recreate); the products
   double as a small commerce catalog for the seeded tenant.

**Deploy gate:** `/inventory` overview + valuation render real numbers for the seeded tenant; manual
adjust/transfer/reorder work; MCP `get_low_inventory`/`update_inventory` still green; existing commerce
flows unaffected (they didn't touch inventory yet anyway).

> **✅ Phase 1 (Foundation) is COMPLETE** as of P1e (P1a package extract → P1b ledger + rename → P1c unify +
> repoint reads → P1e pages + module wiring + degrade seam + seed + DB-backed ledger test). `/inventory`
> renders real numbers, the module is activatable + standalone-usable, and commerce/B2B degrade without it.
> Next: **P2 — wire reserve/commit/release into cart → checkout → order**.

**Risks:** data move `StockLevel`→`InventoryLevel` (idempotent migration + reconcile); RLS on any new/
renamed table (hand-edit, FORCE-RLS backfill footgun per packages/db/CLAUDE.md); the package extraction
touching MCP/scheduler imports (typecheck-driven).

---

### Phase 2 — Sell path (wire the reservation engine)

**Goal:** stock becomes real-time accurate; oversell is structurally prevented; `inventory_policy` is
enforced. Fixes docs/99 defect D2. This is the commerce **integration** layer.

**Work (exact seam points from the audit):**

1. **Cart soft-hold** — `packages/commerce/src/services/cart-service.ts`:
   - `addItem()` (~L206, after `cartItem.create`): `inventory.reserve({variantId, quantity,
holderType:'cart', holderId:cartId, ttlSeconds:1800})`; store `reservationId` on the line.
   - `updateItem()` (~L257–260): release + re-reserve on qty change; release on remove.
   - **Schema add:** `CartItem.inventoryReservationId` (migration).
2. **Hard-hold / decrement at checkout** — `checkout-service.ts` `complete()` (~L537, inside the order
   tx, before session marked complete): `inventory.commit(reservationId)` per line → decrements
   `allocated`+`onHand`, writes `sale` movement with `referenceId=order.id`. CRM `order-service` stays
   inventory-agnostic by design (checkout owns the seam).
3. **Release on cancel / payment-fail** — new **inventory event consumer** (in `inventory-worker` or an
   `order.cancelled` handler): on `order.cancelled` / payment void, find `InventoryReservation` for
   `holderType:'order', holderId:orderId` → `release()`. The reservation-reaper already expires cart TTLs.
4. **Returns restock** — `return-service.ts` `issueRefund()` (~L449): for each inspection
   `restockable=true`, `inventory.adjust({delta:+qty, reason:'return', referenceId:returnId, warehouseId})`.
5. **Allocator** — replace the "first active warehouse" picker in `reserve()` with a channel→default-
   location map then proximity/cost-aware split; partial allocation + backorder remainder when
   `inventory_policy='continue'`.
6. **inStock sync** — confirm `inventory.changed`/`depleted` → commerce flips `Product.inStock`
   (event-driven, already partially present via `syncProductInStock`).

**Deploy gate:** place an order in the seeded store → `onHand` decrements, movement row written, PDP
hides at zero under `deny`, backorders allowed under `continue`; cancel/refund restock verified.

**Risks:** transactional correctness (commit must be atomic with order insert); double-decrement if both
a commit and an `order.created` consumer fire — pick **one** authority (checkout commit), make the
consumer idempotent; concurrency (two carts, last unit) — rely on row locks in the level update.

---

### Phase 3 — Supply path (suppliers, POs, receiving, reorder)

**Goal:** the inbound half of a real inventory product — fully standalone.

**Data model (new):** `Supplier` (contact, terms, lead time, per-variant supplier SKU/cost),
`PurchaseOrder` + `PurchaseOrderLine` (status `draft→submitted→partial→received→closed/cancelled`,
expected arrival, line cost), `GoodsReceipt` + `GoodsReceiptLine` (receive against a PO, partials).

**Work:**

1. `Supplier` CRUD + per-variant supplier links (cost feeds valuation/margin).
2. `PurchaseOrder` lifecycle + lines; PO document/print (reuse the billing-document/canvas pattern).
3. **Receiving** writes `receive` movements into the master, optionally minting `LotBatch` rows;
   partial receipts; over/under-receipt handling.
4. **Reorder engine** — items at/below `reorderPoint` produce reorder suggestions (the "Reorder watch"
   already lists them); one click drafts a PO to the preferred supplier; lead-time → expected arrival.
   Wire to the existing `inventory.low` event + automation so suggestions can auto-draft.
5. Dashboard: `/inventory/suppliers`, `/inventory/purchase-orders` (+ detail), `/inventory/receiving`.
   The mockup's "Incoming POs" + "Receive stock" become real.
6. API: `/v1/inventory/suppliers`, `/purchase-orders`, `/receipts` (CRUD + lifecycle actions).

**Deploy gate:** create supplier → draft PO → receive (partial then full) → `onHand` rises via `receive`
movements; reorder suggestion drafts a PO. All with commerce off.

**Risks:** PO↔receipt partial-quantity accounting; receipts update the moving-average `avgCostCents`
(§2.3) — guard divide-by-zero when `onHand` is 0 (seed the average from the receipt cost).

---

### Phase 4 — Counts, transfers, audit UI

**Goal:** auditable corrections and cross-location movement — standalone.

**Work:**

1. **Counts** — `InventoryCount` + `InventoryCountLine` (cycle subset or full physical); capture
   expected vs counted, compute variance, **approval over a threshold**, post `recount` movements.
   Dashboard `/inventory/counts`.
2. **Transfers UI** — surface the existing `transfer()` API with `/inventory/transfers`; model an
   **in-transit** location so a transfer is `transfer_out` at source now + `transfer_in` on arrival.
3. **Movement / audit-log viewer** — `/inventory/movements`: the `InventoryAdjustment` ledger, filter by
   variant/warehouse/reason/actor/date. This is the compliance surface docs/99 D5 flagged missing.
4. **Lots/serials UI** — per-variant lot creation tab + serial list/status (models exist; no UI today).

**Deploy gate:** run a cycle count with a variance → approval → `recount` movement; transfer between two
warehouses through in-transit; movement viewer shows the full history; create a lot + serials in UI.

**Risks:** count-vs-live race (snapshot expected at count start, reconcile deltas at post); approval
gating ties into the roles model (`editor`/`admin`).

---

### Phase 5 — External sync (docs/28, for real)

**Goal:** ERP/WMS-backed stock, Gillett's **Fishbowl** first — standalone.

**Work:**

1. **Adapters on the generic framework**, all writing the master ledger via `sync_reconcile`/`receive`:
   - **Tier C (CSV)** — harden the existing `services/inventory-worker/src/csv.ts`.
   - **Tier B (SaaS API)** — first cloud adapter (e.g. NetSuite/Cin7) to prove the abstraction.
   - **Tier A (on-prem agent)** — outbound-HTTPS bridge for Fishbowl (Gillett); enrollment mints a
     tenant-scoped API key; `POST /v1/inventory/sources/:id/push` already exists as the ingress.
2. **Conflict resolution** (docs/28 §6): external authoritative on `on_hand`; last-writer by
   `source_synced_at`; unmapped-SKU review queue; stale-link alerting; one-source-per-variant.
3. **Overselling guards:** per-location safety buffer; `inventory_policy=deny` for externally-linked
   variants; UoM conversion (case↔each).
4. Dashboard: `/inventory/connections` (pair source, choose sellable locations, safety buffer),
   `/inventory/connections/mapping` (auto + manual SKU map, unmapped queue), **sync-health** panel
   (last delta / last reconcile / mismatches / source online-offline — critical for Tier A agents).

**Deploy gate:** CSV source imports → master updates via ledger; sync-health shows deltas; a deliberate
conflict resolves per rules. Gillett Fishbowl validated against a real instance (docs/28 §8 pre-build).

**Risks:** Tier A connectivity is customer-environment-specific (validate Fishbowl edition first);
reconciliation overwrites must still preserve in-flight `committed`.

---

### Phase 6 — API contract + reporting + MCP + B2B

**Goal:** headless, AI, and wholesale complete — every docs/99 §2 row reads ✅.

**Work:**

1. **Documented API** (docs/06 §7): implement `GET /v1/inventory`, `PATCH /v1/inventory/:variant_id`,
   `POST /v1/inventory/adjustments` (bulk CSV/JSON), `GET /v1/inventory/alerts`, plus PO/receiving/
   transfer/count endpoints. Reconcile docs/06 to the final shape (spec and routes must agree).
2. **Reporting** (docs/09 §8): turnover, DIO, aging/dead-stock, reorder analysis — off the master +
   ledger; CSV/JSON export. Valuation/value-over-time already live from P1.
3. **MCP**: keep `get_low_inventory`/`update_inventory`; add `receive_stock`, `create_purchase_order`,
   `suggest_reorders`, `get_inventory_valuation` so the agent runs the supply loop (audit-logged, `ai` actor).
4. **B2B** (docs/10): per-account stock visibility/availability, fitment-filtered availability, min/max
   order qty, fleet/work-order holds — as a consumer of the master.

**Deploy gate:** documented endpoints pass contract tests; reports + export verified; MCP supply tools
exercised; a B2B account sees account-scoped availability.

---

## 4. Cross-cutting (every phase)

- **RLS:** every new table tenant-scoped, ENABLE+FORCE, `tenant_isolation` policy; hand-edited SQL via
  the DB Migrate pipeline (private-IP Cloud SQL). Mind the FORCE-RLS backfill footgun.
- **Migrations:** author against docker Postgres → push `main` → DB Migrate workflow. Never laptop-apply.
- **Testing:** unit (Vitest) for ledger invariants + reservation lifecycle + PO/receipt accounting;
  integration for the seam; Playwright for each dashboard surface. docs/19.
- **Events:** `inventory.adjusted|low|depleted|changed|received|reserved|committed|released`,
  `inventory.source.*`, `inventory.count.completed`. Publish via the shared low-level publisher.
- **Standalone check** each phase: verify the surface works with **only** `inventory` active.
- **Boy-scout file size:** split `inventory-service.ts` (already >250 lines) as it moves — by concern
  (levels, reservations, lots, suppliers/PO, sync), not arbitrarily.

## 5. Sequencing

P1 is the hard prerequisite for everything (package + ledger + unified model). P2 depends on P1 (engine
in place). P3/P4/P5 each depend only on P1 and are **mutually independent** — they can be built in any
order or in parallel once P1 lands. P6 depends on whichever surfaces it exposes (API/MCP over P1–P5;
B2B over P1). Recommended order: **P1 → P2 → P3 → P4 → P5 → P6**, but P3/P4 can lead if supply-side
value is wanted before the commerce seam.

## 6. Definition of done

Every requirement row in [docs/99 §2](99-inventory-implementation-audit.md) reads ✅; docs/89 §9 status
flags corrected; docs/28 folded from backlog into shipped; docs/06 §7 matches the routes. Inventory is
activatable and fully usable as a standalone product, and richens Commerce/B2B/Dropship when those are on.

## 7. Resolved decisions (2026-06-16)

1. **Price & packaging** — **$29/mo standalone** (`MODULE_MONTHLY_CENTS.inventory = 2900`), **bundled-free
   when Commerce or B2B is active** (`BUNDLED_FREE`, mirrors invoicing↔b2b). Selling merchants get stock
   tracking at no surcharge; inventory/WMS-only tenants pay $29. Requires commerce/b2b to **work without
   inventory** (untracked = always available; seam no-ops) — built regardless (§1, §2.4).
2. **Table rename — YES, now.** Pre-launch, no user data to preserve, so rename `commerce_* → inventory_*`
   and `InventoryAdjustment → InventoryMovement` in P1 rather than carry the misnomer (§2.2). No deferral —
   "why defer to when we have users?"
3. **Valuation cost basis — moving-average, now.** Stored `avgCostCents` per level, updated on every
   costed inbound movement; no latest-cost interim (§2.3).
4. **Decrement authority — checkout `commit()`** (atomic with the order insert) is the single sale
   authority; an idempotent `order.cancelled` consumer only releases. All other writers (manual / AI /
   integration / return / reaper) funnel through the same `applyMovement()` with concurrency, idempotency,
   and actor attribution (§2.5).
