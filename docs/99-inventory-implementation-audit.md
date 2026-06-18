# sparx Platform — Inventory Implementation Audit (docs vs. code)

**Version:** 1.3
**Author:** Brandon Korous
**Last Updated:** 2026-06-17

---

## 0. Purpose & verdict

> **STATUS (2026-06-17): FULLY REMEDIATED — every §2 gap is closed.** The six-phase build in
> [docs/100](100-inventory-build-plan.md) is complete (P1 foundation → P2 sell path → P3 supply path → P4
> corrections → P5 external sync → P6 API/reporting/MCP/B2B). Inventory is now a first-class, standalone
> module owning the supply side; the §2 matrix below is the **historical gap record** that drove the build —
> every ❌/🟡 row it lists has since shipped. Open _by design_ (not gaps): the Fishbowl-NATIVE on-prem
> reader (awaits a real Gillett instance, docs/28 §8 — the file-export bridge works against any ERP today)
> and the §5.2 outbound sale-write (`two_way`; v1 is a one-directional mirror).

This is a point-in-time gap analysis of the **inventory** capability: every documented
requirement mapped to the code that does (or does not) satisfy it. It exists because the
`/inventory` dashboard pages were, in practice, near-empty — and the reason turned out to be
architectural, not cosmetic.

**Verdict (at audit time — since remediated): the implementation did _not_ meet the documented
requirements.** The data model and service layer were largely built and well-designed, but three
structural defects made the feature far less than the docs claimed (all three are now fixed — see the
inline RESOLVED notes):

1. **Two parallel, disconnected inventory models exist.** ✅ **RESOLVED (P1c).** The `/inventory`
   overview, valuation, and reports read the **sync-module** table (`stock_levels`), which is empty for
   every tenant that has not wired an external feed — i.e. all of them. The real operational stock lives in
   a **different** table (`commerce_inventory_levels`). Nothing bridges them. → the page renders zeros.
   _Fix:_ the two models were unified onto the master (`inventory_levels`/`inventory_warehouses`); the
   reports + valuation now read it + the movement ledger, sync feeds reconcile into it via `applyMovement`,
   and `stock_levels`/`stock_locations` were dropped (migration `20260902000000_inventory_unify_stock`).
2. **Orders never move inventory.** ✅ **RESOLVED (P2).** `reserve()` / `commit()` / `release()` existed
   but had **zero callers** — carts didn't soft-hold, orders didn't decrement, no worker consumed `order.*`.
   _Fix:_ the cart seam reserves/releases atomically with the cart line, checkout commits the sale through
   the ledger, the B2B approval route commits on placement, returns restock, and an `order.cancelled`
   consumer reverses — the reservation engine is fully wired.
3. **The documented API contract is not implemented.** ✅ **RESOLVED (P6a).** docs/06 §7 specifies
   `GET /v1/inventory`, `PATCH /v1/inventory/:variant_id`, `POST /v1/inventory/adjustments`,
   `GET /v1/inventory/alerts` — none existed as written; the `/v1/inventory/*` namespace was taken by the
   sync module. _Fix:_ all four canonical endpoints ship (scope-enforced, module-gated), docs/06 §7 is
   reconciled to the implemented shape, and the operational surface is the inventory module's own namespace.

The feature catalog ([docs/89 §9](89-feature-catalog.md)) marks Multi-warehouse, Inventory levels,
Adjustments, **Reservations**, Low-stock alerts, and CSV import all as **✅ Live**. Reservations is
not live in any functional sense, and the others are live only on the operational side that the
`/inventory` pages don't read.

---

## 1. The root cause: two inventory systems that don't talk

|                  | **Commerce inventory** (operational, real data)                                                                | **Inventory-sync module** (what `/inventory` shows)                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Stock table      | `commerce_inventory_levels` — [`InventoryLevel`](../packages/db/prisma/schema/34-commerce-inventory.prisma)    | `stock_levels` — [`StockLevel`](../packages/db/prisma/schema/66-inventory.prisma)                                                 |
| Location table   | `commerce_warehouses` (`Warehouse`)                                                                            | `stock_locations` (`StockLocation`)                                                                                               |
| Written by       | manual adjust, transfer, reorder-policy (via `inventoryService`)                                               | **only** the [`inventory-worker` sync](../services/inventory-worker/src/handlers/sync.ts) + `POST /v1/inventory/sources/:id/push` |
| Read by          | [`/commerce/inventory`](<../apps/dashboard/app/(dashboard)/commerce/inventory/page.tsx>), product-detail panel | [`/inventory` overview](<../apps/dashboard/app/(dashboard)/inventory/page.tsx>), valuation chart, reports                         |
| Populated today? | Yes (manual/seed/MCP)                                                                                          | **No** — needs a configured `InventorySource` + sync; no adapter is built                                                         |

The valuation/“value over time” feature shipped recently (commit `223b4fec`) computes
`Σ(onHand × cost/retail)` — but off `stock_levels`
([inventory-valuation.ts:36](../services/api-rest/src/lib/inventory-valuation.ts#L36)), so it reads
**$0** until an external feed exists. Same for the summary, by-location, and activity reports
([reports.ts](../services/api-rest/src/routes/v1/inventory/reports.ts)).

**Net effect:** the polished `/inventory` module is a window onto a table that nothing fills, while
the table with real stock has only a basic CRUD grid at `/commerce/inventory`.

---

## 2. Requirement-by-requirement matrix

Legend — **Status:** ✅ Met · 🟡 Partial / not wired · ❌ Missing · 🔵 Built ahead of docs (backlog item).
"Doc says" = the claim in the source doc.

### 2.1 Core stock model

| Requirement                                    | Source                 | Doc says | Actual              | Evidence                                                                                                                                |
| ---------------------------------------------- | ---------------------- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Per-variant on-hand / available                | docs/05 §3, docs/09 §2 | ✅       | ✅                  | `InventoryLevel.onHand/allocated`; derived `available`                                                                                  |
| `inventory_policy` deny / continue (backorder) | docs/05 §3, docs/09 §4 | ✅       | 🟡                  | policy field + branch logic in `inventoryService.reserve` — but `reserve` is never called, so the policy is never evaluated at checkout |
| Reorder point / qty / lead time                | docs/89 §9             | ✅       | ✅                  | `InventoryLevel.reorderPoint/reorderQuantity/leadTimeDays`; editable in UI                                                              |
| Per-variant cost (for valuation/margin)        | docs/05 §3, docs/09 §8 | ✅       | ✅                  | `ProductVariant.costCents`, `InventoryLevel.unitCostCents`                                                                              |
| Multi-warehouse (owned/3PL/dropship/virtual)   | docs/89 §9, docs/28 §4 | ✅       | ✅ (but duplicated) | `Warehouse` **and** `StockLocation` are two separate location models                                                                    |

### 2.2 Reservations & order flow — **the biggest gap**

| Requirement                         | Source                      | Doc says | Actual       | Evidence                                                                                                                                |
| ----------------------------------- | --------------------------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Soft holds (cart, TTL)              | docs/89 §9, docs/28 §5.3    | ✅ Live  | ❌ not wired | `cart-service.ts` makes **no** reservation call                                                                                         |
| Hard holds (order/subscription)     | docs/89 §9                  | ✅ Live  | ❌ not wired | `order-service` has zero inventory references                                                                                           |
| Atomic decrement on order create    | docs/09 §4, docs/65 Phase 6 | ✅       | ❌           | `commit()` has **zero callers**; no `order.created`/`order.paid` consumer adjusts stock                                                 |
| Release on payment failure / cancel | docs/09 §4                  | ✅       | ❌           | `release()` has zero callers                                                                                                            |
| TTL reaper for abandoned carts      | (reservation engine)        | —        | 🟡           | [reservation-reaper](../packages/commerce/src/schedulers/reservation-reaper.ts) cron runs, but there are never any reservations to reap |
| `allocated` quantity surfaced in UI | docs/89 §9                  | ✅       | 🟡           | column renders, but is always `0` because nothing reserves                                                                              |

> The entire `InventoryReservation` table, the `reserve/commit/release` service methods, the
> deny/continue policy branch, and the reaper cron form a complete, **unreferenced** subsystem.
> Functionally, inventory is manual-only: it changes when a human (or MCP) adjusts it, and at no
> other time.

### 2.3 Adjustments & audit

| Requirement                                                               | Source                   | Doc says | Actual | Evidence                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ------------------------ | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adjustment with reason/reference/actor/note                               | docs/89 §9, docs/09 §2   | ✅       | ✅     | `InventoryAdjustment` rows on every `adjust()`                                                                                                                                                     |
| Reason taxonomy (sale/return/recount/loss/damage/transfer/receive/manual) | docs/89 §9               | ✅       | 🟡     | reasons exist; `sale`/`return` reasons are unreachable (no order path writes them)                                                                                                                 |
| **Audit-log viewer** in dashboard                                         | docs/89 §9 (“audit log”) | ✅       | ❌     | rows are written, never surfaced in any UI                                                                                                                                                         |
| Bulk CSV import / adjust (operational)                                    | docs/89 §9, docs/06 §7   | ✅       | ❌     | only CSV path is [`inventory-worker/csv.ts`](../services/inventory-worker/src/csv.ts) for the **sync** module → writes `stock_levels`, not operational stock. No `POST /v1/inventory/adjustments`. |
| Transfers between warehouses                                              | docs/89 §9               | ✅       | 🟡     | `inventoryService.transfer()` + `POST /v1/commerce/inventory/transfer` exist; **no dashboard UI**                                                                                                  |

### 2.4 Valuation, reporting & analytics

| Requirement                                   | Source                 | Doc says | Actual    | Evidence                                                                                                                        |
| --------------------------------------------- | ---------------------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Inventory valuation (Σ on-hand × cost)        | docs/09 §8, docs/89 §9 | ✅       | 🟡 broken | computed off **empty** `stock_levels` → reads $0; [inventory-valuation.ts](../services/api-rest/src/lib/inventory-valuation.ts) |
| Value-over-time (daily snapshots)             | docs/97 §5             | ✅       | 🟡 broken | `rollupInventoryDailyValuation` cron works, but snapshots zero for stock-less tenants                                           |
| Low-stock report / watchlist                  | docs/89 §9, docs/09 §2 | ✅       | ✅        | `listLowStock()` (raw SQL on `commerce_inventory_levels`); watch panel on `/commerce/inventory`                                 |
| `inventory.low` / `inventory.depleted` events | docs/89 §9             | ✅       | ✅        | published from `inventoryService.adjust`                                                                                        |
| Low-stock automation alert                    | docs/89 §11            | ✅       | ✅        | `COMMERCE_LOW_INVENTORY_ALERT` system automation                                                                                |
| Turnover / DIO / reorder analysis reports     | docs/09 §8             | ✅       | ❌        | not implemented                                                                                                                 |

### 2.5 Dashboard UI

| Requirement (mockup `inventory-overview.html` / docs/89) | Doc says | Actual | Evidence                                                                                                           |
| -------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| KPI strip (SKUs / units / value / low-out)               | ✅       | 🟡     | renders on `/inventory`, but off the empty table → zeros                                                           |
| Action queue: Out / Low / Reorder / **Incoming POs**     | ✅       | ❌     | “Incoming POs” tile is sample data; no PO backing                                                                  |
| “Adjust stock” action                                    | ✅       | ✅     | inline editor on `/commerce/inventory` + product panel                                                             |
| “Receive stock” action                                   | ✅       | ❌     | no receiving workflow                                                                                              |
| “Locations” management                                   | ✅       | 🟡     | `/inventory/locations` (sync `StockLocation`) and `/commerce/warehouses` (operational) — two separate location UIs |
| Per-location stock breakdown                             | ✅       | 🟡     | exists on `/inventory` but off empty data                                                                          |
| Recent adjustments timeline                              | ✅       | 🟡     | `/inventory` activity feed reads `stock_levels` changes, not `InventoryAdjustment`                                 |

### 2.6 API contract

| Documented endpoint (docs/06 §7)          | Implemented?  | Actual location                                            |
| ----------------------------------------- | ------------- | ---------------------------------------------------------- |
| `GET /v1/inventory` (list levels)         | ❌ as written | `/v1/inventory/reports/*` is the sync module instead       |
| `PATCH /v1/inventory/:variant_id`         | ❌            | operational adjust is `POST /v1/commerce/inventory/adjust` |
| `POST /v1/inventory/adjustments` (bulk)   | ❌            | no bulk operational endpoint                               |
| `GET /v1/inventory/alerts`                | ❌            | low-stock is `GET /v1/commerce/inventory/low-stock`        |
| `GET /v1/products?inventory_lt=10` filter | ❓ unverified | —                                                          |

> The `/v1/inventory/*` namespace the API spec reserves for operational inventory was claimed by the
> sync module. Either the spec or the routes need to be reconciled.

### 2.7 MCP / AI

| Requirement                                   | Source              | Actual | Evidence                                                                                                                                                           |
| --------------------------------------------- | ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get_low_inventory` read tool                 | docs/07 §3, docs/65 | ✅     | [read-tools.ts](../packages/commerce/src/mcp/read-tools.ts) → `listLowStock`                                                                                       |
| `update_inventory` write tool (with confirm)  | docs/07 §3, docs/65 | ✅     | [write-tools.ts](../packages/commerce/src/mcp/write-tools.ts) → `adjust`; registered via `commerceMcpTools` in [api-mcp](../services/api-mcp/src/tool-registry.ts) |
| `commerce.update_inventory` automation action | docs/89 §11         | ✅     | automation catalog + action schema                                                                                                                                 |
| AI inventory changes hit the audit trail      | docs/07             | ✅     | MCP `adjust` writes `InventoryAdjustment` with actor                                                                                                               |

This is the one area that is genuinely **complete and correct** against the docs.

### 2.8 Lots, serials, recalls

| Requirement                                     | Doc says          | Actual                   | Evidence                                                                                                            |
| ----------------------------------------------- | ----------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Lot batches (expiry, hazmat, supplier ref, CoA) | (beyond docs/89)  | 🔵 ✅ model + partial UI | [`LotBatch`](../packages/db/prisma/schema/35-commerce-lot-serial.prisma); `/commerce/lots` shows expiring + recalls |
| Serial units                                    | —                 | 🟡                       | `SerialUnit` model exists; **no UI**                                                                                |
| Recalls (+ customer notification)               | —                 | 🟡                       | `initiateRecall()` + active-recall view; notification list generated, wiring to email unverified                    |
| Per-product lot creation tab                    | (noted “Phase 2”) | ❌                       | product-detail Inventory tab does not exist yet                                                                     |

### 2.9 B2B (Gillett Diesel)

| Requirement                            | Source          | Actual                             | Evidence                                                 |
| -------------------------------------- | --------------- | ---------------------------------- | -------------------------------------------------------- |
| Fitment-aware catalog                  | docs/10         | ✅ (separate from inventory pages) | `fitment-service.ts`                                     |
| Per-account inventory visibility rules | docs/10         | ❓ out of scope of this audit      | —                                                        |
| Fishbowl (on-prem, Tier A agent) sync  | docs/28 §3, §8  | ❌                                 | no Fishbowl adapter; only generic source framework + CSV |
| PO & receiving workflow                | docs/10, mockup | ❌                                 | no PO/supplier model anywhere                            |

### 2.10 External inventory sync (docs/28 — explicitly backlog)

| Requirement                                                                                               | Status      | Evidence                                                                       |
| --------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| Source-agnostic tables (`stock_locations`, `stock_levels`, `inventory_source_links`, `inventory_sources`) | 🔵 ✅ built | [schema 66](../packages/db/prisma/schema/66-inventory.prisma)                  |
| Sync worker (drain Pub/Sub, upsert mirror)                                                                | 🔵 🟡       | [`inventory-worker`](../services/inventory-worker/src/handlers/sync.ts) exists |
| Push endpoint for external systems                                                                        | 🔵 ✅       | `POST /v1/inventory/sources/:id/push`                                          |
| CSV source adapter                                                                                        | 🔵 🟡       | [`csv.ts`](../services/inventory-worker/src/csv.ts)                            |
| Tier A on-prem agent / Tier B SaaS adapters (Fishbowl, NetSuite…)                                         | ❌          | none built                                                                     |
| SKU-mapping & sync-health UI                                                                              | 🟡          | `/inventory/sources` scaffold                                                  |
| Per-delta movement ledger for synced stock                                                                | ❌          | `stock_levels` holds current qty only; no audit ledger on the sync side        |

> The sync module is **ahead** of where docs/28 says it should be (docs/28 calls it backlog), but it
> was built as a _parallel_ system rather than as a feed _into_ the operational inventory — which is
> precisely what created defect #1.

---

## 3. Defects ranked by severity

| #      | Severity              | Defect                                                              | Why it matters                                                                                                                                                                                                             |
| ------ | --------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~D1~~ | ✅ **RESOLVED (P1c)** | ~~Two disconnected stock models; `/inventory` reads the empty one~~ | Unified onto the master `inventory_levels`/`inventory_warehouses`; reports + valuation read the master + the movement ledger; `stock_levels`/`stock_locations` dropped (migration `20260902000000_inventory_unify_stock`). |
| D2     | **P0**                | Orders never reserve/decrement inventory                            | Stock is fiction during selling; oversell is guaranteed; `inventory_policy` never enforced                                                                                                                                 |
| D3     | **P1**                | API contract (docs/06 §7) unimplemented as written                  | Headless/MCP/API consumers can’t use inventory per spec; “API-first” violated                                                                                                                                              |
| D4     | **P1**                | No PO / receiving / supplier model                                  | “Incoming POs” + “Receive stock” are mockup-only; no inbound stock workflow                                                                                                                                                |
| D5     | **P2**                | No audit-log viewer; no transfer UI; no cycle counts                | Adjustment data captured but not actionable; transfers API-only                                                                                                                                                            |
| D6     | **P2**                | Catalog (docs/89 §9) overstates status (Reservations “✅ Live”)     | Source-of-truth doc is misleading; needs correction regardless of build decision                                                                                                                                           |

---

## 4. The correct, feature-complete path

This is the full scope of a production-grade inventory system for sparx — not a patch to make the
page non-empty. Unification is the **foundation** of it, not a substitute for it. Everything below is
in scope; the phases are a **deploy order** (ship the moment each layer works — docs/03 deploy-early),
**not** a scope cut. Nothing here is deferred to "someday."

### 4.0 Module boundary — Inventory is its own module (DECIDED 2026-06-16)

Inventory is a **first-class, full-featured product in its own right** (`inventory`, already listed in
docs/89 §9) — not an appendage of commerce. It owns the **supply** side; Commerce owns the **demand/sale**
side; they meet at checkout via a thin contract. This mirrors how **Dropship** is its own supply space
that "comes together" in Commerce/B2B, and how the platform treats CMS-only / CRM-only as equally
first-class (sparx is content **and/or** commerce — selling is one capability, never the assumption).

**Standalone-usable is a hard requirement.** A tenant can activate **Inventory alone** — warehouse /
stock / supplier / PO / receiving / count / valuation / ERP-sync management as a standalone WMS-lite
product — with **no** commerce, no storefront, no orders. Every inventory capability must work without a
sale path; commerce and B2B are _integrations layered on top_, not prerequisites. Inventory gets the same
first-class treatment as any other module: its own module color (amber), its own marketing surface, its
own overview dashboard, and its own MCP/AI tool surface.

The current code scattered this — supply logic was built inside `@sparx/commerce` (`/commerce/warehouses`,
`/commerce/lots`) while a half-built parallel sync module squatted on `/inventory`. The fix **promotes
inventory to its own product/module**, it does not fold it into commerce.

|         | **Inventory** (`inventory` — supply)                                                                                                                       | **Commerce** (`commerce` — demand)                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Owns    | warehouses/locations, the stock ledger (levels + movements), reservations engine, suppliers, POs, receiving, lots/serials, counts, transfers, ERP/WMS sync | catalog (products/variants/collections), pricing, carts, checkout, orders, returns, sales channels |
| Package | **new `@sparx/inventory`** (extract today's `inventoryService` out of `@sparx/commerce`)                                                                   | `@sparx/commerce` (depends on `@sparx/inventory`)                                                  |
| Pages   | `/inventory/*` (warehouses, stock, movements, POs, receiving, counts, lots, sync)                                                                          | `/commerce/*` (products, orders, carts…)                                                           |

**The seam (event-driven, thin):** the `ProductVariant` stays owned by commerce; inventory holds stock
_per variant per location_ (`InventoryLevel.variantId` → commerce variant). At checkout **commerce calls
`inventory.reserve()` then `inventory.commit()`**; storefront PDP + B2B query inventory for availability;
inventory publishes `inventory.low` / `inventory.changed` and commerce flips the denormalized `inStock`.
Shipping references inventory's locations for origin. Dropship remains a _parallel_ supply source — a
tenant may activate inventory, dropship, or both. Inventory becomes properly module-gated (wire the
`inventory` slug into the ~8 hardcoded module lists incl. `api-rest` `MODULE_SLUGS`, or activation 400s).
`/commerce/inventory`, `/commerce/warehouses`, `/commerce/lots` **move to `/inventory/*`**.

### 4.1 Target end-state architecture

1. **One inventory source of truth, owned by the inventory module.** `InventoryLevel` keyed by
   `(variant, location)` is the master ledger of `onHand` / `allocated` / `available` / cost — extracted
   into `@sparx/inventory` (tables renamed to the `inventory_*` namespace). `Warehouse` absorbs the
   location _types_ the sync module invented (`bin` / `3pl` / `transit` / `virtual`), so there is exactly
   **one** location model. `stock_levels` / `StockLocation` are retired (or demoted to raw inbound-staging
   used only for reconciliation diffing). The sync module becomes an **ingestion source that writes into
   the master**, never a parallel store. Commerce/B2B/Dropship are **consumers** of this module, not
   owners of stock.
2. **An append-only movement ledger is the spine.** Every quantity change — `sale`, `return`,
   `receive`, `adjust`, `transfer_in/out`, `reserve`/`commit`/`release`, `sync_reconcile` — is an
   immutable `InventoryAdjustment` (movement) row with reason + reference + actor. `onHand` is a
   denormalized rollup that must always equal Σ(movements) and is reconcilable against it. **The only
   way stock ever moves is a movement row.** This is the correctness guarantee everything else relies
   on.
3. **The reservation lifecycle is wired end-to-end** (§4.2). Soft holds on cart, hard holds + decrement
   on order, release on failure/cancel/expiry, with `inventory_policy` (deny/continue) enforced and a
   channel/proximity-aware multi-location allocator (not "first active").
4. **Inbound supply chain is real** (§4.3): Suppliers → Purchase Orders → Receiving, with reorder
   suggestions driven by reorder-point/lead-time, lot capture on receipt.
5. **Counts & corrections** (§4.4): cycle + full physical counts with expected-vs-counted variance,
   approval, and `recount` movements.
6. **External sync is genuinely built** (§4.5): the docs/28 Tier A/B/C adapters (Fishbowl agent for
   Gillett first), conflict rules, safety buffers, UoM conversion, SKU-mapping + sync-health UI — all
   feeding the master ledger.
7. **The documented API contract is honored** (docs/06 §7) and MCP/AI can run the whole loop (§4.6).
8. **Reporting is complete** (docs/09 §8): valuation (now non-zero), value-over-time, turnover, DIO,
   aging/dead-stock, reorder analysis, all exportable — read off the master.
9. **One coherent dashboard module** (§4.7) replaces the two half-modules.

### 4.2 Sell path — make stock real-time accurate

- `reserve()` on cart line-add → soft hold with TTL, increments `allocated`; `inventory_policy=deny`
  blocks over-reservation, `continue` permits backorder.
- `commit()` inside the order-creation transaction → soft→hard, decrement `onHand`, write `sale`
  movement, atomic with the order insert.
- `release()` on payment failure / order cancel / cart abandon; the existing reaper expires stale TTLs.
- **Allocation:** channel→default-location map, then proximity/cost-aware split across locations;
  partial allocation + backorder remainder when policy allows.
- Returns/refunds write `return` movements with optional restock (the return flow already has the
  restock toggle — connect it to the ledger).

### 4.3 Supply path — the biggest missing workflow

New models + lifecycle (currently **absent**): `Supplier`, `PurchaseOrder` + `PurchaseOrderLine`,
`GoodsReceipt` + lines.

- PO lifecycle: `draft → submitted → partially_received → received → closed/cancelled`, with cost
  capture per line (feeds valuation).
- **Receiving** writes `receive` movements into the master and optionally mints `LotBatch` rows;
  partial receipts supported. This is what makes "Incoming POs" and "Receive stock" real.
- **Reorder engine:** items at/below reorder point produce reorder suggestions; one click drafts a PO
  to the preferred supplier (and an automation/MCP path can auto-draft). Lead-time feeds expected
  arrival.

### 4.4 Counts & adjustments

- Cycle count (subset) + full physical count sessions: capture expected vs counted, compute variance,
  require approval over a threshold, post `recount` movements. Replaces ad-hoc single-line adjusts as
  the auditable correction path.
- Transfers: surface the existing `transfer()` API with a UI and an **in-transit** location so a
  transfer is `transfer_out` at source now + `transfer_in` at destination on arrival.

### 4.5 External sync — finish docs/28 properly

- Adapters on the generic framework, all writing the master via `sync_reconcile` / `receive` movements:
  **Tier A on-prem agent (Fishbowl, for Gillett)** first, then **Tier B SaaS API** (NetSuite/Cin7/…),
  **Tier C CSV** (harden the existing parser).
- External system authoritative on `on_hand`; apply docs/28 §6 conflict rules, per-location safety
  buffer, UoM conversion, unmapped-SKU review queue.
- Dashboard: connect/pair source, choose sellable locations, SKU-mapping screen, sync-health panel
  (last delta / last reconcile / mismatches / source online-offline — critical for Tier A agents).

### 4.6 API contract + MCP

- Implement the documented operational surface: `GET /v1/inventory`, `PATCH /v1/inventory/:variant_id`,
  `POST /v1/inventory/adjustments` (bulk CSV/JSON), `GET /v1/inventory/alerts`, plus PO/receiving/
  transfer/count endpoints. Keep the sync endpoints under `/v1/inventory/sources|locations|links`.
  Update docs/06 §7 to the final shape — the spec and the routes must agree (API-first).
- MCP: keep `get_low_inventory` / `update_inventory`; add `receive_stock`, `create_purchase_order`,
  `suggest_reorders`, `get_inventory_valuation` so the agent can run the supply loop. All AI writes hit
  the movement ledger with `actor=ai`.

### 4.7 Dashboard — one product, at `/inventory`

`/inventory` is the home. The operational pages move in from commerce (`/commerce/inventory` →
`/inventory`, `/commerce/warehouses` → `/inventory/warehouses`, `/commerce/lots` → `/inventory/lots`) and
the sync module's `/inventory` overview is rebuilt off the master. One amber module delivering every
surface the mockups + docs call for, **all usable with inventory active alone**: overview (real KPIs /
action-queue / by-location / reorder / recent **movements**), stock grid with adjust, **movement /
audit-log viewer**, **transfers** UI, **purchase orders + receiving**, **suppliers**, **counts**,
**lots/serials**, and the **sync connections + SKU-mapping + health** screens. Commerce/B2B integrations
add on top when active: per-account stock visibility, fitment-filtered availability, min/max order qty,
and fleet/work-order holds (docs/10). A dedicated marketing page + module overview give it the same
front-door as every other sparx product.

### 4.8 Build order (deployable slices, full surface committed)

| Phase                         | Lands                                                                                                                                    | Ships value                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **P1 Foundation**             | One location + one stock table; sync feeds master; movement-ledger is the only write path; re-point overview/valuation/reports at master | `/inventory` shows real numbers + non-zero valuation day one |
| **P2 Sell path**              | reserve/commit/release wired into cart→checkout→order; policy enforcement; allocator; returns→restock                                    | Inventory is real-time accurate; oversell protected          |
| **P3 Supply path**            | Supplier + PO + Receiving models/lifecycle/UI; reorder suggestions; lot capture                                                          | Inbound stock + replenishment workflow                       |
| **P4 Counts/transfers/audit** | Cycle+physical counts w/ variance approval; transfers UI + in-transit; movement viewer                                                   | Auditable corrections + stock moves between locations        |
| **P5 External sync**          | Tier C hardening, Tier B adapter, **Tier A Fishbowl agent (Gillett)**; SKU-mapping + sync-health; conflict rules/buffers/UoM             | ERP-backed tenants live                                      |
| **P6 API/reporting/MCP/B2B**  | Documented `/v1/inventory*` API; turnover/DIO/aging/dead-stock + exports; MCP supply tools; B2B visibility + fleet holds                 | Headless + AI + wholesale complete                           |

Correct [docs/89 §9](89-feature-catalog.md) status flags as each phase lands, and fold the relevant
parts of docs/28 from backlog into shipped. End state: every row in §2 reads ✅.

---

## 5. Appendix — file map

**Data model:** [`34-commerce-inventory.prisma`](../packages/db/prisma/schema/34-commerce-inventory.prisma) ·
[`35-commerce-lot-serial.prisma`](../packages/db/prisma/schema/35-commerce-lot-serial.prisma) ·
[`66-inventory.prisma`](../packages/db/prisma/schema/66-inventory.prisma) (sync) ·
`75-analytics-rollups.prisma` (valuation rollup)

**Service layer:** [`inventory-service.ts`](../packages/commerce/src/services/inventory-service.ts) ·
[`reservation-reaper.ts`](../packages/commerce/src/schedulers/reservation-reaper.ts) ·
[`mcp/read-tools.ts`](../packages/commerce/src/mcp/read-tools.ts) · [`mcp/write-tools.ts`](../packages/commerce/src/mcp/write-tools.ts)

**API:** [`v1/commerce/inventory.ts`](../services/api-rest/src/routes/v1/commerce/inventory.ts) (operational) ·
[`v1/inventory/`](../services/api-rest/src/routes/v1/inventory/) (sync module) ·
[`inventory-valuation.ts`](../services/api-rest/src/lib/inventory-valuation.ts) ·
[`internal/inventory-cron.ts`](../services/api-rest/src/routes/internal/inventory-cron.ts)

**Worker:** [`services/inventory-worker/`](../services/inventory-worker/)

**Dashboard:** [`/commerce/inventory`](<../apps/dashboard/app/(dashboard)/commerce/inventory/>) ·
[`/commerce/lots`](<../apps/dashboard/app/(dashboard)/commerce/lots/>) ·
[`/inventory`](<../apps/dashboard/app/(dashboard)/inventory/>) (sync module overview)

**Docs cited:** [05](05-data-model.md) §3 · [06](06-api-specification.md) §7 ·
[07](07-mcp-server-spec.md) §3 · [09](09-ecommerce-engine-prd.md) §2/§4/§8 · [10](10-b2b-wholesale-prd.md) ·
[28](28-inventory-sync-integration.md) · [65](65-tier1-build-plan.md) · [89](89-feature-catalog.md) §9 ·
[97](97-analytics-reporting-architecture.md) §5
