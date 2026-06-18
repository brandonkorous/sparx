# sparx Platform — Inventory Product Build Plan

**Version:** 1.20
**Author:** Brandon Korous
**Last Updated:** 2026-06-17

---

## 0. What this is

The build plan for **Inventory as a first-class, standalone sparx product** — the scope decided in
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
| P5    | External sync: Tier C/B/A adapters (Fishbowl)                            | ✅                | ERP/WMS-backed tenants live                       |
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

### Phase 2 — Sell path (wire the reservation engine) ✅ DONE

**Goal:** stock becomes real-time accurate; oversell is structurally prevented; `inventory_policy` is
enforced. Fixes docs/99 defect D2. This is the commerce **integration** layer.

**Work (exact seam points from the audit):**

1. **Cart soft-hold** — `packages/commerce/src/services/cart-service.ts`:
   - `addItem()` (after `cartItem.create`): reserves the line atomically inside the cart tx and stores the
     `reservationId` on the line. A `deny`-policy shortfall throws and rolls the add back (can't add past
     available). ✅ **DONE** — via the tx-aware `inventoryService.reserveOnTx(tx, ctx, {…})`.
   - `updateItem()`: release + re-reserve on qty change; release on remove. ✅ **DONE** — plus `clear()`
     and `merge()` release the source holds so a cleared/merged cart never leaks `allocated`.
   - **Schema add:** `CartItem.inventoryReservationId` (migration `20260903000000_cart_item_reservation`,
     nullable, NOT a FK — soft cross-module pointer). ✅ **DONE.**
2. **Hard-hold / decrement at checkout** — `checkout-service.ts` `complete()` (inside the completion tx,
   before the session is marked complete): `inventoryService.commitSaleOnTx(tx, ctx, {orderId, lines})`
   decrements `onHand` (+ releases the soft hold's `allocated`) and writes a `sale` movement with
   `referenceId=order.id`. Idempotency-keyed per line (`order-commit:<orderId>:<lineKey>`) so a retried
   completion never double-decrements; skipped for B2B approval-gated orders (placement defers). CRM
   `order-service` stays inventory-agnostic by design (checkout owns the seam). ✅ **DONE.** The B2B
   **approval route** (`/v1/b2b/approval-queue/:orderId/approve`) commits the decrement when it places a
   held order — the other placement path. ✅ **DONE.**
3. **Release on cancel / payment-fail** — new commerce **event consumer** (`@sparx/commerce/consumers`,
   installed at api-rest/api-mcp boot on the in-process platform bus, gated per-tenant on the inventory
   module): on `order.cancelled`, `inventoryService.reverseOrderSale({orderId})` reverses each `sale`
   movement with a compensating `cancel` movement (idempotency-keyed off the source movement) and releases
   any lingering holds. Kept in commerce, NOT CRM, so the order service stays inventory-agnostic. (Payment
   failure that does NOT cancel the order intentionally does not restock — the order stays open for retry;
   restock follows cancellation.) ✅ **DONE.**
4. **Returns restock** — `return-service.ts` `issueRefund()`: for each inspection `restockable=true`,
   `inventoryService.adjust({delta:+qty, reason:'return', referenceType:'Return', referenceId:returnId,
warehouseId, idempotencyKey})`; quantity is the line's approved (accepted-back) count, warehouse the
   inspection's or the channel default. Runs post-commit (the refund is authority; restock is a follow-on).
   ✅ **DONE.**
5. **Allocator** — `reserve()`'s picker is now **stock-aware**: resolve the channel default, prefer a
   warehouse that can fulfill (richest first), else any that can, else the channel default (backorder under
   `continue`/`preorder`), else first active. ✅ **DONE** (single-source). Multi-warehouse **split** +
   proximity/cost routing layers on top once the location geo/cost model lands — **deferred to P5** (no
   geo/cost data wired yet), noted in `pickWarehouseFor`.
6. **inStock sync** — `inventory.depleted`/`low`/`adjusted` events + `Product.inStock` flip via
   `syncProductInStock` (called inside every `applyMovement`, fired post-commit by the sell path). ✅
   **Confirmed wired.**

**Deploy gate:** place an order in the seeded store → `onHand` decrements, movement row written, PDP
hides at zero under `deny`, backorders allowed under `continue`; cancel/refund restock verified. The
inventory-side guarantees (oversell block under `deny`, commit drops onHand + releases allocated keeping
`onHand == Σ(movements)`, idempotent re-commit, cancel restock + idempotent redelivery, backorder under
`continue`) are pinned by `packages/inventory/test/integration/sell-path.test.ts` (DB-backed); the full
storefront e2e is the review/Playwright pass.

> **✅ Phase 2 (Sell path) is COMPLETE.** The reservation engine is wired end-to-end: cart soft-holds with
> oversell protection, checkout (and B2B approval) commit as the single decrement authority, an idempotent
> `order.cancelled` consumer restocks, returns restock on refund, and the allocator is stock-aware. Fixes
> docs/99 D2 (orders now move inventory). Next: **P3 — supply path (suppliers, POs, receiving, reorder).**

**Risks:** transactional correctness (commit composes into the checkout completion tx; idempotency keys per
line make a retried completion safe); double-decrement if both a commit and an `order.created` consumer
fire — resolved by a single authority (checkout/approval commit), no order.created decrement consumer;
concurrency (two carts, last unit) — the reserve availability check now takes a `FOR UPDATE` row lock, so
the last unit can't be double-held under `deny`.

---

### Phase 3 — Supply path (suppliers, POs, receiving, reorder)

**Goal:** the inbound half of a real inventory product — fully standalone.

**Data model (new):** `Supplier` (contact, terms, lead time, per-variant supplier SKU/cost),
`PurchaseOrder` + `PurchaseOrderLine` (status `draft→submitted→partial→received→closed/cancelled`,
expected arrival, line cost), `GoodsReceipt` + `GoodsReceiptLine` (receive against a PO, partials).

**Work:**

1. `Supplier` CRUD + per-variant supplier links (cost feeds valuation/margin). ✅ **DONE (P3a).**
   `inventory_suppliers` + `inventory_supplier_variants` tables (migration `20260904000000_inventory_suppliers`,
   FORCE RLS); `@sparx/inventory` services (`suppliers.ts` CRUD + soft archive; `supplier-variants.ts` upsert/
   remove/list + **one-preferred-supplier-per-variant** invariant + `suppliersForVariant` reverse lookup +
   SKU→variant resolver); API `/v1/inventory/suppliers` (+ `/:id/variants` + `variant-lookup`),
   `requireInventoryModule` (standalone-usable); dashboard `/inventory/suppliers` (list/create/detail with
   inline edit, archive, and the per-variant **purchasing catalog** — add by SKU / set cost·MOQ·preferred /
   remove); `Suppliers` manifest section. DB-backed tests in `test/integration/suppliers.test.ts`.
2. `PurchaseOrder` lifecycle + lines; PO document/print (reuse the billing-document/canvas pattern).
   ✅ **DONE (P3b).** `inventory_purchase_orders` + `inventory_purchase_order_lines` tables (migration
   `20260905000000_inventory_purchase_orders`, FORCE RLS + a `status` CHECK pinning the six-state
   vocabulary); `@sparx/inventory` services split by concern (`purchase-order-shared.ts` serializers +
   helpers, `purchase-orders.ts` CRUD with per-tenant `PO-000001` numbering + retry-on-collision,
   `purchase-order-lines.ts` draft-only line add/update/remove, `purchase-order-lifecycle.ts`
   submit/cancel/close, `purchase-order-document.ts` a pure self-contained print-HTML renderer + loader).
   Lifecycle: `draft` (editable) → `submitted` (orderedAt + expected arrival from supplier lead time) →
   `partial/received` (driven by receiving, P3c) → `closed/cancelled` (terminal). Line cost defaults from
   the supplier link → variant cost → 0; totals (subtotal + shipping) recompute on every line/shipping
   mutation. API `/v1/inventory/purchase-orders` (CRUD + `/submit` `/cancel` `/close` + `/lines` +
   `/:id/document` branded print HTML), `requireInventoryModule` (standalone-usable). Dashboard
   `/inventory/purchase-orders` (status-filtered list / create with in-memory line builder / detail with
   draft header edit + lifecycle bar + add/edit/remove lines + received progress + Print→PDF via a server
   route proxy); `Purchase orders` manifest section. Supplier archive now blocked while an open
   (draft/submitted/partial) PO references it. Seed: 2 suppliers + 6 purchasing links + a draft & a
   submitted demo PO. DB-backed tests in `test/integration/purchase-orders.test.ts` (3 cases; inventory
   suite 22/22).
3. **Receiving** writes `receive` movements into the master, optionally minting `LotBatch` rows;
   partial receipts; over/under-receipt handling.
   ✅ **DONE (P3c).** `inventory_goods_receipts` + `inventory_goods_receipt_lines` tables (migration
   `20260906000000_inventory_goods_receipts`, FORCE RLS); a receipt is **posted atomically** (no editable
   draft — corrections are a later adjustment/count). `@sparx/inventory` `goods-receipts.ts`
   `createGoodsReceipt` routes every line through `applyMovement` (`receive`, +qty, `referenceType:
'GoodsReceipt'`, `idempotencyKey: goods-receipt:<lineId>`), so the moving-average `avgCostCents` updates
   (the onHand=0 case seeds the average from the receipt cost — the div-by-zero guard already lives in the
   ledger), bumps `PurchaseOrderLine.quantityReceived`, optionally mints/extends a `LotBatch`, then advances
   the PO to `partial` (any line received) or `received` (all lines, + `receivedAt`); over-receipt is allowed.
   API `/v1/inventory/receipts` (POST + list/`:id`, `requireInventoryModule`, immutable so no PATCH/DELETE).
   Dashboard `/inventory/receiving` (awaiting-receipt POs + recent-receipts feed), a receive form at
   `/inventory/purchase-orders/[id]/receive` (qty defaults to outstanding, cost override, lot), a read-only
   receipt detail, a **Receive** button on the PO actions bar (submitted/partial) + a receipts panel on the
   PO detail; `Receiving` manifest section. Seed: a partial demo receipt (PO-000002 → `partial`, Σ-invariant
   verified 0 mismatches). DB-backed tests in `test/integration/goods-receipts.test.ts` (3 cases; inventory
   suite 25/25).
4. **Reorder engine** — items at/below `reorderPoint` produce reorder suggestions grouped by (supplier,
   warehouse) with a suggested quantity (the configured reorder qty, else top-up to the point, floored at
   the supplier minimum) + an `onOrder` figure so nothing already inbound is re-ordered; one click drafts a
   PO per group to the preferred supplier (`suppliersForVariant`), lead-time → expected arrival. Manual via
   `/inventory/reorder` (`POST /v1/inventory/reorder/draft`); **auto** via the `inventory.draft_reorder_po`
   automation action on the `inventory.low` event — find-or-appends into one open draft per (supplier,
   warehouse) so repeated lows converge, never spam. The auto seed `INVENTORY_AUTO_REORDER` ships **paused**
   (opt-in). Items with no supplier link surface separately (link a supplier first).
5. Dashboard: `/inventory/suppliers`, `/inventory/purchase-orders` (+ detail), `/inventory/receiving`.
   The mockup's "Incoming POs" + "Receive stock" become real.
6. API: `/v1/inventory/suppliers`, `/purchase-orders`, `/receipts` (CRUD + lifecycle actions).

**Deploy gate:** create supplier → draft PO → receive (partial then full) → `onHand` rises via `receive`
movements; reorder suggestion drafts a PO. All with commerce off.

> **Phase 3 COMPLETE ✅.** P3a (suppliers + per-variant purchasing links), **P3b (PurchaseOrder lifecycle +
> lines + document)**, **P3c (Receiving — goods receipts → `receive` movements → moving-average, partials,
> lot-on-receipt, PO advancing to partial/received)**, and **P3d (Reorder engine — low → grouped
> suggestions → draft PO to the preferred supplier, manual + the opt-in `inventory.low` auto-draft action)**
> are all ✅ DONE. A standalone tenant can now run the whole inbound + replenishment workflow: record
> vendors, see what's low, draft/submit/print purchase orders, receive goods into stock, and let auto-reorder
> draft replenishment POs — all with commerce off. Next: **P4** (counts/transfers/audit UI), independent of
> P3.

**Risks:** PO↔receipt partial-quantity accounting; receipts update the moving-average `avgCostCents`
(§2.3) — guard divide-by-zero when `onHand` is 0 (seed the average from the receipt cost).

---

### Phase 4 — Counts, transfers, audit UI

**Goal:** auditable corrections and cross-location movement — standalone.

**Work:**

1. **Counts** — `InventoryCount` + `InventoryCountLine` (cycle subset or full physical); capture
   expected vs counted, compute variance, **approval over a threshold**, post `recount` movements.
   Dashboard `/inventory/counts`. ✅ **DONE (P4a).** New `39-inventory-counts.prisma`
   (`inventory_counts` + `inventory_count_lines`, migration `20260907000000_inventory_counts`, canonical
   FORCE RLS + `type`/`status` CHECKs); a count is scoped to one warehouse and snapshots `expectedQuantity`
   = on-hand at line creation. Lifecycle `counting → review → [approved] → posted` (+ `cancelled`): the
   editable phase (`@sparx/inventory` `inventory-counts.ts`) creates the session (a `full` count snapshots
   every level in the warehouse, a `cycle` count the chosen variants), adds/removes lines, and records
   counted quantities; the lifecycle (`inventory-count-lifecycle.ts`) submits for review (freezing
   `varianceValueCents` = Σ |Δ|·cost and `requiresApproval` when it clears the per-count
   `approvalThresholdCents`, default $50), approves (admin sign-off, over-threshold only), posts, or
   cancels. **Post applies one `recount` movement per line through the ledger as an absolute `setOnHand`** —
   the corrective delta is computed against LIVE on-hand inside the row lock, so a sale that landed
   mid-count is reconciled, not lost (the line records both the count-time `variance` and the actual
   `appliedDelta`); idempotency-keyed `count:<lineId>`. API `/v1/inventory/counts` (CRUD + `/lines` +
   `/entries` + `/submit` + `/approve` [admin] + `/post` + `/cancel`), `requireInventoryModule`
   (standalone-usable). Dashboard `/inventory/counts` (status-filtered list / create [cycle by SKU or full]
   / detail with lifecycle bar + live-variance line entry + Match-expected + add/remove + Post-recounts
   armed-confirm); `Counts` manifest section + action. Emits `inventory.count.completed` on post. DB-backed
   tests in `test/integration/counts.test.ts` (4 cases; inventory suite 32/32).
2. **Transfers UI** — surface stock movement between warehouses with `/inventory/transfers`; model an
   **in-transit** location so a transfer is `transfer_out` at source now + `transfer_in` on arrival.
   ✅ **DONE (P4b).** New `40-inventory-transfers.prisma` (`inventory_transfers` + `inventory_transfer_lines`,
   migration `20260908000000_inventory_transfers`, canonical FORCE RLS + a `status` CHECK) plus an
   `is_system` flag on `inventory_warehouses` marking the per-tenant **in-transit holding warehouse**
   (provisioned lazily on first ship; `listWarehouses` excludes system warehouses so it never appears in
   the pickers/list). A transfer is a document: lifecycle `draft → in_transit → received` (+ `cancelled`).
   The editable phase (`@sparx/inventory` `inventory-transfers.ts`) composes the lines (variant + qty); the
   lifecycle (`inventory-transfer-lifecycle.ts`) **ships** (each line writes `transfer_out` from source +
   `transfer_in` to the in-transit warehouse — so total stock is conserved while units are in motion),
   **receives** (in-transit → destination; a per-line receipt short of the shipped quantity writes the
   shortfall off the in-transit level as a `loss`, so nothing is stranded), or **cancels** (a draft is
   voided; an in-transit transfer's goods return to source). Every leg funnels through the ledger
   (`applyMovement`, idempotency-keyed per leg+line), so `onHand == Σ(movements)` holds across source,
   in-transit, and destination. API `/v1/inventory/transfers` (CRUD + `/lines` + `/ship` + `/receive` +
   `/cancel`), `requireInventoryModule` (standalone-usable). Dashboard `/inventory/transfers` (status-filtered
   list / create [route + items by SKU] / detail with the lifecycle bar [ship; cancel & return / delete draft
   armed-confirm] + a lifecycle-aware lines panel [draft = editable; in_transit = receive form with per-line
   received quantities; terminal = read-only with a "short" badge]); `Transfers` manifest section + action.
   Emits `inventory.transfer.shipped` / `inventory.transfer.received`. Seed ships a draft MAIN → WEST-3PL the
   user can ship + receive (the deploy-gate exercise). DB-backed tests in `test/integration/transfers.test.ts`
   (4 cases; inventory suite 36/36).
3. **Movement / audit-log viewer** — `/inventory/movements`: the `inventory_movements` ledger, filter by
   variant/warehouse/reason/actor/date. This is the compliance surface docs/99 D5 flagged missing.
   ✅ **DONE (P4c).** No new tables — a read-only, filterable, paginated view over the append-only ledger
   every mutation already writes. New `@sparx/inventory` `movement-log.ts` `listMovements(ctx, filter)`
   (Prisma `findMany` enriched with the variant SKU/product title + warehouse name; filters
   variant/warehouse/reason/actor-type/actor-id/reference/created-at-range; **explicitly scopes `tenant_id`**
   — not just RLS — because the local `sparx_owner` superuser bypasses RLS and a tenant-wide scan would
   otherwise leak rows, matching the reorder-engine precedent). API `GET /v1/inventory/movements`
   (`requireInventoryModule`, viewer). Dashboard `/inventory/movements`: a filter bar (item-by-SKU →
   resolves to a variant id, warehouse, reason, actor, from/to date) + a newest-first ledger table
   (when / item / location / reason badge / signed colored change / running balance / actor / reference),
   deep-linkable by `?variant_id` with a removable "filtered to item" chip; `Movements` manifest section.
   DB-backed tests in `test/integration/movements.test.ts` (4 cases: full feed newest-first + total; filter
   by reason/variant/warehouse + AND-combined; actor-type + pagination; date range — inventory suite 40/40).
4. **Lots/serials UI** — per-variant lot creation tab + serial list/status (models exist; no UI today).
   ✅ **DONE (P4d).** No new tables — a management surface on the existing `LotBatch`/`SerialUnit` models. New
   `@sparx/inventory` `lot-management.ts` adds the reads + status mutations on top of the create primitives
   in `lots.ts`: `listLots` (filterable by item/warehouse/recall-state/expiry/lot-number, enriched with the
   item + serial count, **explicit `tenant_id` scope** per the RLS-bypass precedent), `getLotBatch` (detail +
   a serial-status breakdown), `listSerials`, `updateSerialStatus` (traceability metadata — it does NOT move
   on-hand; the ledger does), and `clearRecall`. New `UpdateSerialStatusInput` schema. API extends
   `/v1/inventory/lots` (GET list + `:id` + `:id/serials` + `:id/clear-recall`) and `/v1/inventory/serials`
   (GET list + `PATCH :id`), keeping the existing create/recall/expiring endpoints. Dashboard rebuilds
   `/inventory/lots` from a thin read-only summary into a full management surface: a filterable lot list, a
   create form (item-by-SKU + warehouse + lot number + qty + mfg/expiry + hazmat class + supplier ref), and a
   lot detail with the recall actions bar (recall with a reason + notify flag / clear recall, confirm-gated)
   and a serial roster panel (list, add a serial, change status inline). `New lot` manifest action. DB-backed
   tests in `test/integration/lots.test.ts` (4 cases: create + enriched/filtered list; add serials + status
   change + roster breakdown; recall + recall-filter + clear; expiry-horizon filter — inventory suite 44/44).

**Deploy gate:** run a cycle count with a variance → approval → `recount` movement; transfer between two
warehouses through in-transit; movement viewer shows the full history; create a lot + serials in UI.
**✅ All four met — Phase 4 is COMPLETE.**

> **P4a (Counts) ✅ DONE** — a standalone tenant can run a cycle or full count, enter quantities, review the
> variance, and post (with an admin approval over the value threshold), correcting stock via auditable
> `recount` movements that reconcile any mid-count drift. The count-vs-live race is handled by the ledger's
> absolute `setOnHand`.
>
> **P4b (Transfers) ✅ DONE** — a standalone tenant can move stock between two warehouses through an
> in-transit holding location: build a draft, ship (source → in-transit), and receive (in-transit →
> destination), with total inventory conserved the whole way; a short receipt is written off in transit and
> cancelling an in-transit transfer returns the goods to source. The in-transit warehouse is a per-tenant
> system location (`is_system`), provisioned on first ship and hidden from the ordinary pickers/list.
>
> **P4c (Movement / audit-log viewer) ✅ DONE** — a standalone tenant can answer "who moved this stock, when,
> why, and by how much" across the entire append-only ledger, filtered by item (SKU), warehouse, reason,
> actor, and date range — the docs/99 D5 compliance surface. Read-only, no new tables.
>
> **P4d (Lots/serials UI) ✅ DONE — PHASE 4 COMPLETE.** A standalone tenant can record a lot (expiry, hazmat,
> supplier ref, quantity), track per-unit serials and change their status, and run a recall (with reason +
> notify) then clear it — a full management surface over the existing models, no new tables. With this the
> whole of Phase 4 (counts · transfers · movement viewer · lots/serials) is delivered; **next is P5**
> (external sync — Fishbowl for Gillett first) then **P6** (documented API + reporting + MCP supply tools +
> B2B visibility).

**Risks:** count-vs-live race (snapshot expected at count start, reconcile deltas at post) — **resolved**
by the absolute `setOnHand` recount (delta computed against live on-hand under the row lock); approval
gating ties into the roles model (`editor`/`admin`) — the `/approve` route requires `admin`.

---

### Phase 5 — External sync (docs/28, for real)

**Goal:** ERP/WMS-backed stock, Gillett's **Fishbowl** first — standalone.

**Work:**

1. **Adapters on the generic framework**, all writing the master ledger via `sync_reconcile`/`receive`:
   - **Tier C (CSV)** — harden the existing `services/inventory-worker/src/csv.ts`. ✅ **DONE (P5a)** —
     see the P5a callout below.
   - **Tier B (SaaS API)** — first cloud adapter (e.g. NetSuite/Cin7) to prove the abstraction.
     ✅ **DONE (P5c)** — a generic config-driven HTTP-API pull, see the P5c callout below.
   - **Tier A (on-prem agent)** — outbound-HTTPS bridge for Fishbowl (Gillett); enrollment mints a
     tenant-scoped API key; `POST /v1/inventory/sources/:id/push` already exists as the ingress.
     ✅ **DONE (P5d)** — the `@sparx/inventory-bridge` agent + pairing/heartbeat, see the P5d callout
     below. The Fishbowl-NATIVE reader stays gated on a real instance (docs/28 §8); the agent ships with
     the universal file (CSV/JSON export) reader.
2. **Conflict resolution** (docs/28 §6): external authoritative on `on_hand` ✅ (P5a reconcile);
   unmapped-SKU review queue ✅ (P5a); **one-source-per-variant ✅ (P5b); stale-link alerting ✅ (P5b)**;
   **last-writer by `source_synced_at` ✅ (P5c)** (Tier B rows carry per-row timestamps; an out-of-order
   older row is dropped, not applied).
3. **Overselling guards:** **per-location safety buffer ✅ (P5b)**; `inventory_policy=deny` for
   externally-linked variants ✅ (the variant default is already `deny`); **UoM conversion (case↔each)
   ✅ (P5b)**.
4. Dashboard: connection detail (pair source, SKU map + unmapped queue, safety buffer) ✅ (P5a/b/c),
   **sync-health** panel (deltas / unmapped / stale / out-of-order, and **source online-offline** for
   Tier A agents ✅ P5d).

**Deploy gate:** CSV / API / agent sources import → master updates via ledger ✅; sync-health shows
deltas + agent online/offline ✅; deliberate conflicts resolve per rules ✅ (one-source, last-writer,
buffer). Gillett Fishbowl validated against a real instance remains the per-tenant §8 pre-build gate
before the Fishbowl-native reader ships (the file-export path works against any on-prem ERP today).

**Risks:** Tier A connectivity is customer-environment-specific (validate Fishbowl edition first);
reconciliation overwrites must still preserve in-flight `committed`.

> **P5a (Tier C — CSV sync, hardened) ✅ DONE.** The existing CSV path worked but was lossy + opaque —
> unmatched SKUs vanished into a log line and "sync health" was just a `lastSyncAt` timestamp. P5a turns
> CSV into a trustworthy, usable connection: (1) **one ingest funnel** — `inventoryService.ingestFeed`
> (packages/inventory `feed-ingest.ts`) is the single path BOTH the CSV worker and the
> `/sources/:id/push` endpoint call (no more duplicated link-resolution logic); it matches rows to links,
> reconciles matches through the ledger (corrective `sync` movement, Σ-invariant preserved), queues
> unmatched SKUs, and records the run. (2) **Two new tables** (`inventory_sync_runs`,
> `inventory_unmapped_skus`, FORCE-RLS) — every sync records full bookkeeping (matched / changed /
> unchanged / unmatched / skipped), and every unmappable external SKU lands in a **review queue** (we
> never auto-create products). (3) **Read + resolve service** (`sync-runs.ts`): `listSyncRuns`,
> `getSyncHealth`, `listUnmappedSkus` (with a suggested variant when an external SKU matches one of ours),
> `mapUnmappedSku` (mints a link + clears the row), `ignoreUnmappedSku`. (4) **API** (`sync.ts`):
> `/sources/:id/{runs,health,unmapped}` + `/unmapped/:id/{map,ignore}`. (5) **Connection detail UI**
> (`/inventory/sources/[id]`): a sync-health panel (last run breakdown + recent-runs table), the
> unmapped-SKU review queue (map-to-suggested / map-by-SKU / ignore), and a SKU-mappings panel
> (add/remove links) — the docs/28 §7 surface. 4 DB tests; suite 48/48. Seed ships a demo CSV connection
> (2 mappings, 3 pending unmapped, 1 run). **Still P5: Tier B (SaaS API), Tier A (Fishbowl bridge),
> conflict resolution (one-source-per-variant, source_synced_at last-writer), oversell guards (safety
> buffer, deny-policy, UoM).**

> **P5b (conflict resolution + oversell guards) ✅ DONE.** The correctness layer that makes
> externally-fed stock safe to sell against. **Conflict resolution (docs/28 §6):** one-source-per-variant
> is enforced server-side — a variant already claimed by another source is rejected at link creation /
> map (the new `createSourceLink` funnel both the links route and `mapUnmappedSku` route through);
> **stale-link tracking** — every matched link is stamped `lastSeenAt` + un-stale'd on sync, and a
> FULL-snapshot run (CSV; the worker passes `fullSnapshot: true`, a partial push doesn't) flags a
> previously-seen-but-now-absent link `isStale`, surfaced as a "stale mappings" count in the sync-health
> panel + a `stale` badge on the mapping row. **Oversell guards:** **UoM conversion** — a link carries
> `externalUom`/`unitsPerExternal`, and `ingestFeed` multiplies the feed quantity before it reconciles
> (a feed "5 cases" with ×12 → 60 each); **safety buffer** — `inventory_levels.safety_buffer` withholds
> the last N units from the SELLABLE `available`, netted into `computeAvailability` (storefront buy-box),
> the reserve **deny** check, and the allocator, so the source→sync lag can't oversell; `deny` is already
> the variant policy default. New schema: link gains `external_uom`/`units_per_external`/`last_seen_at`/
> `is_stale`, level gains `safety_buffer` (additive ALTER, migration `20260910000000_inventory_sync_controls`).
> The mapping + unmapped-map forms gained UoM + buffer fields (shared `MappingControlsFields`). 4 new DB
> tests (one-source reject, UoM ×, stale flag/clear, buffer nets availability + reserve); suite 52/52. Seed
> ships a demo link by-the-case (×6) with a 3-unit buffer. **Still P5: Tier B (SaaS API), Tier A (Fishbowl
> bridge); `source_synced_at` last-writer ordering lands with Tier B (it carries per-row timestamps).**

> **P5c (Tier B — generic SaaS HTTP-API pull + last-writer ordering) ✅ DONE.** The first cloud adapter,
> built generic so ONE config-driven path serves any JSON inventory API (NetSuite, Cin7, a 3PL portal)
> with no per-vendor code — proving the framework abstraction. **The adapter** (`inventory-worker`
> `src/adapters/http-api.ts`): a `type: 'api'` source's `config` declares the endpoint, auth (bearer token
> or a custom header), the dot-path to the rows array (`itemsPath`), a dot-path per field
> (`{sku,location,quantity,cost,syncedAt}Field`), cost unit (cents/dollars), and pagination (page-number
> or cursor, capped at `maxPages`). It fetches, maps, paginates, and returns the SAME normalized
> `FeedRow[]` that flow into `inventoryService.ingestFeed` — so matching, reconciliation, the unmapped
> queue, stale tracking, and run bookkeeping are all shared with CSV/push (the worker dispatches on
> `source.type`). **Last-writer ordering** (the deferred docs/28 §6 piece): an API row carries the
> source's own observation time (`source_synced_at`); `ingestFeed` records the newest one applied per link
> (`inventory_source_links.last_source_synced_at`) and DROPS any later row whose timestamp is older
> (out-of-order delivery / a replayed snapshot) — newest-wins even within a single batch. Dropped rows
> count as `rows_stale` on the run, surfaced as an "Out-of-order" metric in the sync-health breakdown.
> **Config validation + secret handling:** the route validates an `api` config against `ApiSourceConfig`
> (a bad mapping is a 400, not a silent sync failure), redacts the stored `apiKey` from every read (a
> `hasApiKey` flag tells the form a key is set), and preserves the stored secret when an edit leaves the
> key blank. **Connection form** gains a full API-config section (endpoint, auth, field mapping,
> pagination). New schema: link `last_source_synced_at`, run `rows_stale` (additive ALTER, migration
> `20260911000000_inventory_tier_b_sync`). 1 new DB test (out-of-order drop + newest-wins-in-batch) +
> 8 adapter unit tests (mapping, auth, cost/timestamp coercion, page + cursor pagination, maxPages cap);
> suite 53/53. Seed ships a demo `ERP API (NetSuite)` connection. **Still P5: Tier A (Fishbowl on-prem
> bridge) — the `/sources/:id/push` ingress + ingest funnel already exist; the agent + key enrollment is
> the remaining transport.**

> **P5d (Tier A — on-prem bridge agent) ✅ DONE. PHASE 5 COMPLETE.** The hardest connectivity tier: a
> LAN-only ERP (Fishbowl is the archetype) whose API never faces the internet. The integration is
> **outbound from the tenant's side** — a small agent they install on their network. **Server side** (the
> ingress was already built in P5a — `/sources/:id/push` + the ingest funnel): a new `agent` source type
> (Tier A, push-only — the worker never pulls it); **pairing** mints a tenant-scoped API key via
> `@sparx/auth` (`POST /sources/:id/enroll`, returned ONCE, re-enroll rotates + revokes the old key),
> recorded on the source (id + visible prefix); **`POST …/revoke-agent`** unpairs; **`POST …/heartbeat`**
> (authenticated by the agent's own key) bumps liveness. The push endpoint now accepts a per-row
> `synced_at` (→ last-writer ordering, P5c) and a `mode: snapshot|delta` (a snapshot is the agent's full
> reconcile → flags stale mappings), and bumps agent liveness. `getSyncHealth` derives **online/offline**
> from `agent_last_seen_at` within a 5-min grace — surfaced loudly in the connection's **Bridge agent
> panel** (pair / rotate / unpair, the show-once key + install snippet, online/offline + last-seen +
> version). The minted secret is never returned again (only the prefix). **The agent** — a new standalone
> package `@sparx/inventory-bridge` (`services/inventory-bridge`, zero `@sparx` deps, shipped to the
> tenant): config (zod env), a retrying push client (snapshot + heartbeat, exp-backoff, fatal on 4xx), a
> reconcile loop (snapshot on `SYNC_INTERVAL`, heartbeat on `HEARTBEAT_INTERVAL`), and a **pluggable
> reader** — a working **file reader** (CSV/JSON export, mtime = `synced_at`) as the universal production
> path, with the **Fishbowl-native reader gated on a real instance** (docs/28 §8). New schema: source
> `api_key_id`/`api_key_prefix`/`enrolled_at`/`agent_last_seen_at`/`agent_version` (additive ALTER,
> migration `20260912000000_inventory_agent_enrollment`). 1 new inventory DB test (enroll → heartbeat
> online → stale offline → rotate → unpair) + 7 bridge unit tests (push shaping/auth/retry, file CSV/JSON
> parse); inventory suite 54/54, bridge 7/7. Seed ships a paired+online demo `Fishbowl bridge` agent.
> **Phase 5 (External sync) is COMPLETE** — Tier C / B / A all write the one ledger through the one ingest
> funnel; only the Fishbowl-native reader awaits a real Gillett instance (§8). Next: **Phase 6** (documented
> API + reporting + MCP supply tools + B2B).

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

> **P6a DONE — Documented public API (docs/06 §7).** ✅ The four canonical endpoints external
> integrators code against, distinct from the dashboard-shaped routes: `GET /v1/inventory` (cross-warehouse
> enriched + paginated + `q` search), `PATCH /v1/inventory/:variant_id` (set an absolute on-hand OR a signed
> delta), `POST /v1/inventory/adjustments` (bulk JSON **or** `text/csv`, ≤1000 rows, each row isolated in
> its own tx so one failure can't roll back the batch), `GET /v1/inventory/alerts` (low-stock). New service
> `@sparx/inventory` `public-api.ts` (`listInventory` / `updateLevelCount` / `bulkAdjust`) — every write
> through the `applyMovement` ledger funnel; SKU resolution + broad-scan reads explicitly tenant-scoped
> (superuser-bypasses-RLS precedent). **Per-API-key scope enforcement** landed in `@sparx/api-core`:
> `AuthContext.scopes` (lifted from the verified key) + a `requireScope(request, scope)` helper — an `api`
> actor must carry `read:inventory` / `write:inventory` (`403 FORBIDDEN` otherwise); JWT/dashboard actors
> bypass (gated by role). docs/06 §7 reconciled to the implemented shape (spec ↔ routes agree). Tests: 3
> new inventory service tests (list/paginate/search, set-vs-delta, bulk SKU-resolve + isolation) → suite
> **57/57**; 6 new api-rest HTTP **contract** tests (scope reject/allow, PATCH set, bulk JSON, JWT bypass,
> MODULE_DISABLED). typecheck clean (api-core / commerce-schemas / inventory / api-rest); lint 0 errors.

> **P6b DONE — Reporting (docs/09 §8).** ✅ The analytical lens over the master model + ledger, in a new
> `@sparx/inventory` `analytics.ts` (shared by REST **and** the P6c MCP tools): `inventoryValuation`
> (units + cost/retail), `turnoverReport` (COGS over a window / average inventory value → inventory turns +
> **DIO**; average inventory from the daily valuation snapshots, falling back to current valuation),
> `agingReport` (on-hand value bucketed by days-since-last-sale 0-30/31-60/61-90/90+/never + the
> highest-value **dead-stock** list), and `reorderAnalysis` (per low-stock item: sales **velocity** over a
> window → **days-of-cover** → **projected stockout**, suggested qty, preferred supplier — via LEFT JOIN
> LATERAL). All raw SQL, explicitly `tenant_id`-scoped (superuser-bypasses-RLS precedent). **REST**: new
> `analytics-reports.ts` route (`/v1/inventory/reports/{valuation,turnover,aging,reorder-analysis}`) — each
> supports **`?format=csv`** export (text/csv attachment) alongside the JSON envelope; viewer-gated. **CSV/
> JSON export** is the deploy-gate item. **Dashboard**: new `/inventory/reports` page (Reports nav section)
> — turnover/DIO KPI tiles, aging buckets + dead-stock table, reorder-analysis table, each with a
> client-side **Export CSV** (server action → `api.getRaw` → Blob download, token stays server-side). Tests:
> 4 inventory service tests (valuation, turnover/DIO over a window with **backdated** sale movements, aging
> buckets + dead-stock, reorder velocity/cover/supplier) → suite **61/61**; 2 api-rest contract tests
> (turnover JSON, reorder-analysis CSV header). typecheck clean (inventory / api-rest / dashboard); lint 0
> errors (warn-only max-lines on the cohesive analytics SQL bodies).

> **P6c DONE — MCP supply tools (docs/07).** ✅ Inventory gets its OWN first-class MCP surface (per §4.0): a
> new `@sparx/inventory/mcp` registry (mirrors commerce/crm) with `read:inventory` / `write:inventory`
> scopes. Six tools — the supply loop the AI runs end-to-end: **read** `get_low_inventory`,
> `get_inventory_valuation`, `suggest_reorders`; **write** (confirmation) `update_inventory` (forces
> `actorType:'ai'` → ledger attributes it to the agent), `create_purchase_order`, `receive_stock`. MCP tool
> names are GLOBAL across modules, so the three pre-existing inventory tools were **moved OUT of commerce's
> registry** into inventory's (their scope flips commerce→inventory — pre-launch, architecturally correct;
> `get_inventory_valuation` now reads the inventory package's valuation). **api-mcp wiring**: the two scopes
> added to the McpScope union + `DEFAULT_SCOPES_BY_ROLE` (owner/admin/editor write, viewer read) +
> `WRITE_SCOPES`; `inventoryMcpTools` registered in `ALL_MCP_TOOLS`; **`MODULE_BY_SCOPE`** gates both on the
> `inventory` module (refuses when off — standalone-safe). New deps: `@sparx/inventory` (api-mcp) + `zod`
> (inventory package). **Latent bug fixed**: `listLowStock` relied on RLS only — under the superuser-local
> role it leaked other tenants' rows; added explicit `l.tenant_id = ctx.tenantId` (reorder/movement-log/
> analytics precedent). Tests: 5 api-mcp tests (`inventory-tools.test.ts`: globally-unique names [SDK-
> > collision guard], inventory scopes, not-under-commerce-scope, dispatch with module+scope, module-off
> refusal); inventory **61/61**, commerce **7/7** (tool removal clean). docs/07 → v1.3. typecheck clean
> (inventory / commerce / api-mcp); lint 0 errors. (Pre-existing, unrelated: api-mcp `smoke.test.ts`
> `get_customers` fails locally — CRM `customerService.list` has the same superuser-RLS-leak vs the seeded
> demo DB; out of inventory scope, flagged not fixed.)

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
