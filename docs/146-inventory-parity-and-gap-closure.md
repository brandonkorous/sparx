# sparx Platform — Inventory: Market Parity & Gap Closure Plan

**Version:** 1.17
**Author:** Brandon Korous
**Last Updated:** 2026-08-13

---

## 0. What this is

Three questions, answered in order, then a build plan:

1. **What do the best and most-used inventory systems actually do?** (§1)
2. **What do their users complain about most?** (§2)
3. **What do we already have, and where are the gaps?** (§3–§4)

§5 is the position this plan takes. §6 is the **checkable feature list** — the definition of done.
§7–§10 are the data model, API/MCP, surface, and reporting specifications the phases build against.

This is the successor to [docs/100](100-inventory-build-plan.md) (the six-phase build that made
Inventory a first-class module) and [docs/99](99-inventory-implementation-audit.md) (the audit that
drove it). Both are **complete**. This doc is the next horizon: from "a correct, coherent inventory
module" to "the inventory system a business would choose over the incumbents."

**Binding principles carried forward from docs/100 §0 (do not re-litigate):**

- Inventory is its **own module**, amber `#F59E0B`, owning the **supply** side. Commerce / B2B /
  Dropship are consumers, never owners of stock.
- **Standalone-usable is a hard requirement.** Every feature below must work for a WMS-lite tenant
  with no commerce, no storefront, and no orders.
- **One source of truth + an append-only movement ledger.** `onHand == Σ(movements.delta)`, always.
  Nothing in this plan may introduce a second writer to `on_hand` outside `applyMovement()`.

---

## 1. The market — what the leaders actually ship

The category splits into five bands. Nobody wins all five, which is the opening.

| Band                          | Who plays there                                | What it means in practice                                                                                                      |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Enterprise ERP-inventory**  | NetSuite, Microsoft Dynamics, SAP              | Demand planning with seasonality, full WMS, multi-entity, multi-currency, deep GL posting. Priced and implemented accordingly. |
| **Multichannel operations**   | Cin7 (Core + Omni), Linnworks, Brightpearl     | Channel stock sync, POS, B2B portal, warehouse app, 3PL/EDI. The centre of gravity for growing ecommerce brands.               |
| **Manufacturing-first**       | Fishbowl, Katana, MRPeasy                      | BOMs, work orders, raw-material tracking, job costing, production scheduling.                                                  |
| **SMB / accounting-attached** | QuickBooks (Enterprise + Online), Zoho, Square | Cheap, familiar, shallow. Wins on "it's already where my books are."                                                           |
| **Light asset tracking**      | Sortly, inFlow                                 | Photo-first, barcode-first, mobile-first. Wins on time-to-first-value.                                                         |

**The capability set the category has converged on** — this is the parity bar:

- Real-time stock by SKU × location, with a movement/audit history behind every number
- Multi-warehouse, plus **bin/sub-locations** inside a warehouse (zone → aisle → rack → bin)
- **Barcode/QR on everything**, and a **mobile scan-first app** for receive, put-away, pick, count,
  transfer, and lookup — with guided walk paths and scan-to-verify
- Purchase orders → **receiving with landed cost** (freight/duty apportioned into unit cost)
- **Pick / pack / ship**: pick lists, batch and wave picking, pack verification, labels
- **Kitting, bundles, BOM, and assembly/build orders**
- **Units of measure** — buy by the case, stock by the each, sell by the pair
- **Lot/batch + expiry (FEFO) and serial tracking**, recall-ready
- **Cycle counting** on a schedule, driven by **ABC classification**; full counts; blind counts
- **Demand forecasting** and **dynamic reorder points** with safety stock and a service level
- **Costing choices**: moving average, FIFO, standard cost — and a valuation report that ties to the GL
- **Supplier management** with lead times, MOQ, price breaks, and performance history
- **Channel + marketplace sync** (Amazon, eBay, Walmart, Etsy, Shopify) and **3PL/EDI** connections
- **Accounting sync** — inventory asset and COGS journal entries into QuickBooks/Xero
- **Reporting**: valuation, turnover, aging, dead stock, shrinkage, sell-through, GMROI, fill rate
- Role-based access, full audit trail, open API

**Sources:** [Fortune Business Insights — market](https://www.fortunebusinessinsights.com/inventory-management-software-market-108589),
[ERP Software Blog — top 10 for 2026](https://erpsoftwareblog.com/2025/12/top-inventory-management-software/),
[The Retail Exec — requirements checklist](https://theretailexec.com/logistics/inventory-management-requirements/),
[Cin7 Core WMS documentation](https://help.core.cin7.com/hc/en-us/articles/9034461577487-Introduction-to-Warehouse-Management-System-WMS),
[Capterra — inventory management category](https://www.capterra.com/inventory-management-software/).

---

## 2. What people complain about — the evidence

The single best primary source is inFlow's **State of Inventory Management 2026**, a survey of 400
operators. It is devastating, and it is the whole argument for this plan.

### 2.1 The headline numbers

| Finding                                                        | Figure    |
| -------------------------------------------------------------- | --------- |
| Still run inventory primarily on **spreadsheets**              | **85%**   |
| …including companies with 500+ employees                       | 53%       |
| Use dedicated inventory software                               | 22%       |
| Still keep **paper** records                                   | 27%       |
| Name **inaccurate inventory data** as a top challenge          | **44.8%** |
| Name **supplier reliability** as a top challenge               | **52%**   |
| Report **overstock**                                           | 37.5%     |
| Report **stockouts**                                           | 33.5%     |
| Experience a stockout **at least monthly**                     | **44%**   |
| Report annual shrinkage of 1–5%                                | 80%       |
| Holding costs above 10% of inventory value                     | 54%       |
| Cite **technology integration** as their top 12-month priority | **60%**   |
| **Want** AI in their inventory workflow                        | **81%**   |
| **Have** any AI in it today                                    | **11%**   |

Source: [inFlow — State of Inventory Management 2026](https://www.inflowinventory.com/blog/state-of-inventory-management-2026/).

### 2.2 The recurring complaint clusters

Drawn from G2/Capterra review analysis, app-marketplace reviews, and vendor comparison write-ups.

| #       | Complaint                                                                                                                                                              | Who it lands on                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **C1**  | **The numbers are wrong.** Sync failures cause overselling and phantom stock; SKU/part-number mismatch across thousands of products produces refunds and wrong orders. | Every multichannel tool              |
| **C2**  | **Sync is opaque and unreliable.** "Synchronization doesn't work." Nobody can see what a sync actually did, or how stale a number is.                                  | Sync apps, marketplace connectors    |
| **C3**  | **Reporting is too shallow — everyone exports to Excel** to build views the product can't produce.                                                                     | Fishbowl, QuickBooks, most SMB tools |
| **C4**  | **Onboarding is brutal.** Months of implementation, spreadsheet gymnastics, consultants, and it still comes out inaccurate.                                            | NetSuite, Cin7, Fishbowl             |
| **C5**  | **Customization needs a developer.** Simple changes require scripts and paid consultants.                                                                              | NetSuite                             |
| **C6**  | **Pricing punishes growth.** Per-user seats inflate as the team grows; EDI/3PL/advanced modules are expensive add-ons; renewal increases exceeding 100%.               | NetSuite, Cin7, most mid-market      |
| **C7**  | **Support is slow and generic** — days to reply, boilerplate answers, worse after acquisitions/rebrands.                                                               | Broad                                |
| **C8**  | **Double entry between systems.** Ordering in one place, invoicing in another, inventory in a third. Stock leaves the building unrecorded.                             | Broad — the spreadsheet's real rival |
| **C9**  | **Missing depth where it counts** — no native lot/serial, no landed cost, thin forecasting.                                                                            | SMB/accounting-attached tools        |
| **C10** | **The consequences are real:** delayed shipments hurt marketplace account health; stockouts and refunds hit revenue directly.                                          | Everyone                             |

**Sources:** [G2 — Cin7 Omni vs Fishbowl](https://www.g2.com/compare/cin7-omni-vs-fishbowl-inventory),
[SelectHub — NetSuite Inventory Management reviews](https://www.selecthub.com/p/inventory-management-software/netsuite-inventory-management/),
[GSI — NetSuite pros and cons 2026](https://www.getgsi.com/blog/netsuite-pros-and-cons),
[Gestisoft — Fishbowl alternatives](https://www.gestisoft.com/en/blog/fishbowl-inventory-alternatives),
[Shopify app reviews — inventory sync](https://apps.shopify.com/reviews/1621700),
[TechRepublic — best inventory management software 2026](https://www.techrepublic.com/article/best-inventory-management-software/).

### 2.3 What the evidence actually says

Read together, the survey and the reviews say something narrower than "add more features":

> **The category's core promise — "your stock number is right" — is not being kept**, and the tools
> that keep it are too expensive, too slow to implement, and too opaque for the businesses that need
> it most. So 85% of operators stay on spreadsheets, which are at least legible.

That is the gap. Not BOM depth. **Trust, legibility, and time-to-value.**

---

## 3. What sparx has today

Verified against the code on 2026-08-10, not against the docs.

### 3.1 Shipped and solid

| Capability                                                                                                                                                           | Where                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Append-only movement ledger** — `onHand == Σ(delta)`, `balanceAfter` running balance, one writer (`applyMovement`)                                                 | [packages/inventory/src/services/ledger.ts](../packages/inventory/src/services/ledger.ts), `inventory_movements`                                                                           |
| **Full attribution + idempotency** on every movement (`actorType` user/ai/system/integration, `source`, `idempotencyKey`)                                            | [34-commerce-inventory.prisma](../packages/db/prisma/schema/34-commerce-inventory.prisma)                                                                                                  |
| Multi-warehouse, typed `owned / 3pl / dropship / virtual`, per-channel defaults, system in-transit location                                                          | `inventory_warehouses`                                                                                                                                                                     |
| Levels with `onHand` / `allocated` / **`safetyBuffer`** / reorder point / reorder qty / lead time                                                                    | `inventory_levels`                                                                                                                                                                         |
| **Reservation engine, fully wired** — cart soft-hold (TTL), order hard-hold, subscription renewal hold, reaper                                                       | [reservations.ts](../packages/inventory/src/services/reservations.ts), [sell-path.ts](../packages/inventory/src/services/sell-path.ts)                                                     |
| Moving-average cost basis recomputed on every costed inbound                                                                                                         | `inventory_levels.avgCostCents`                                                                                                                                                            |
| Suppliers + per-variant purchasing detail (supplier SKU, cost, MOQ, lead time, preferred)                                                                            | [36-inventory-supply.prisma](../packages/db/prisma/schema/36-inventory-supply.prisma)                                                                                                      |
| Purchase orders with lifecycle, terms, currency, printable document                                                                                                  | [37-inventory-purchasing.prisma](../packages/db/prisma/schema/37-inventory-purchasing.prisma), [purchase-order-document.ts](../packages/inventory/src/services/purchase-order-document.ts) |
| Goods receipts — atomic post, per-line cost override, damaged-on-arrival booked as a `receive`+`damage` pair                                                         | [goods-receipts.ts](../packages/inventory/src/services/goods-receipts.ts)                                                                                                                  |
| **Counts** — cycle + full, expected-vs-counted, variance-value approval gate, absolute `setOnHand` post that survives a mid-count sale                               | [39-inventory-counts.prisma](../packages/db/prisma/schema/39-inventory-counts.prisma), [inventory-count-lifecycle.ts](../packages/inventory/src/services/inventory-count-lifecycle.ts)     |
| Transfers with in-transit custody, ship/receive lifecycle                                                                                                            | [40-inventory-transfers.prisma](../packages/db/prisma/schema/40-inventory-transfers.prisma)                                                                                                |
| **Lot/batch + expiry + hazmat + CoA + recall workflow**, and **serial units** pinned to order items                                                                  | [35-commerce-lot-serial.prisma](../packages/db/prisma/schema/35-commerce-lot-serial.prisma)                                                                                                |
| B2B fleet holds + per-account availability                                                                                                                           | [b2b-holds.ts](../packages/inventory/src/services/b2b-holds.ts)                                                                                                                            |
| Reorder suggestions + auto-draft POs grouped by supplier, net of open-PO quantity                                                                                    | [reorder.ts](../packages/inventory/src/services/reorder.ts)                                                                                                                                |
| Reports: **valuation, turnover, aging, reorder analysis**                                                                                                            | [analytics.ts](../packages/inventory/src/services/analytics.ts)                                                                                                                            |
| **External sync, three tiers** — CSV pull, API pull, on-prem agent push (paired via tenant API key, heartbeat + online/offline)                                      | [66-inventory.prisma](../packages/db/prisma/schema/66-inventory.prisma), [services/inventory-worker](../services/inventory-worker/)                                                        |
| Sync hygiene: unmapped-SKU queue, **stale-link detection**, last-writer-wins by source timestamp, per-run bookkeeping                                                | `inventory_source_links`, `inventory_sync_runs`, `inventory_unmapped_skus`                                                                                                                 |
| Feed **UoM conversion** on external links (`unitsPerExternal`)                                                                                                       | `inventory_source_links`                                                                                                                                                                   |
| Outbound stock push to 11 channel adapters (Amazon, eBay, Walmart, Etsy, Faire, TikTok Shop, Google, Meta, Pinterest, sparx market)                                  | [packages/channels/src/adapters/](../packages/channels/src/adapters/)                                                                                                                      |
| Events + automation: `inventory.low` / `.depleted` / `.adjusted` / `.count.completed` / `.transfer.*` / `.source.*`, with seeded automations (auto-draft PO, notify) | [packages/events/src/types.ts](../packages/events/src/types.ts), [packages/automation-actions/src/seeds/inventory.ts](../packages/automation-actions/src/seeds/inventory.ts)               |
| **~48 MCP tools** covering read + write across the whole module                                                                                                      | [packages/inventory/src/mcp/](../packages/inventory/src/mcp/)                                                                                                                              |
| **18 REST route modules** under the module namespace                                                                                                                 | [services/api-rest/src/routes/v1/inventory/](../services/api-rest/src/routes/v1/inventory/)                                                                                                |
| **21 workbench surfaces** — stock, locations, transfers, counts, movements, lots, suppliers, POs, receiving, reorder, reports, sources                               | [apps/workbench/surfaces/inventory/](../apps/workbench/surfaces/inventory/)                                                                                                                |
| RLS tenant isolation on every table; audit log on service writes                                                                                                     | [packages/db/CLAUDE.md](../packages/db/CLAUDE.md), [audit.ts](../packages/inventory/src/audit.ts)                                                                                          |

**This is already a serious system.** The ledger design in particular is better than most of the
market — very few competitors can tell you _why_ a number is what it is. We under-sell it.

### 3.2 Confirmed absent

Grepped for, not found anywhere in `packages/inventory`, `packages/commerce`, the schema, `api-rest`,
or the workbench surfaces:

`bin` / `bin_location` · `unitOfMeasure` / `packSize` / `casePack` (internal) · `BOM` /
`billOfMaterials` / `workOrder` / `assembly` · `abcClass` / ABC analysis · `fifo` / `lifo` /
cost layers · `consignment` · `EDI` · `ASN` · `countSchedule` / cycle-count scheduling · landed-cost
allocation (the word appears in comments; the **apportionment of freight/duty across receipt lines
does not exist** — `GoodsReceiptLine.unitCostCents` is just the invoice cost) · demand forecasting
(`get_forecast` is the **CRM deal** forecast, unrelated) · accounting connectors (QuickBooks/Xero) ·
scan-driven workflows · pick/pack (only `OrderFulfillment`, which is a shipping record, not a warehouse
process) · inventory-adjustment CSV import (still open per [docs/68 §11](68-wizards-import-export-bulk.md)).

---

## 4. The gap matrix

Two kinds of gap. **P** = parity (they have it, we don't). **D** = differentiator (fixes a top
complaint; mostly nobody does it well).

### 4.1 Parity gaps

| ID  | Gap                                                                                                     | Why it matters                                                                     | Effort |
| --- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| P1  | **Bin / sub-locations** inside a warehouse                                                              | Table stakes above ~500 SKUs. Without it there is no put-away or directed pick.    | L      |
| P2  | **Barcode labels + scan-first operations**                                                              | The #1 accuracy lever in the field. `ProductVariant.barcode` exists and is unused. | L      |
| P3  | **Pick / pack / ship** as a warehouse process                                                           | 49.8% report order-accuracy problems. We ship a label; we don't guide a picker.    | L      |
| P4  | **Landed cost allocation** (freight/duty/broker across lines)                                           | Margin is wrong without it. Named as missing depth in SMB tools.                   | M      |
| P5  | **Costing methods** — FIFO cost layers, standard cost                                                   | Moving average only. Accountants ask for FIFO by name.                             | M      |
| P6  | **Internal units of measure** (buy case → stock each → sell pair)                                       | Exists only for external feed links. Distribution can't operate without it.        | M      |
| P7  | **BOM + assembly/build orders**                                                                         | Bundles decrement components at sale; nothing _builds_ stock from components.      | M      |
| P8  | **Demand forecasting + dynamic reorder points**                                                         | Reorder points are static integers a human typed. 81% want AI here.                | M      |
| P9  | **ABC / XYZ classification**                                                                            | Drives count cadence and reorder policy everywhere else in the market.             | S      |
| P10 | **Cycle-count scheduling** (recurring, ABC-driven, blind)                                               | Counts exist but must be created by hand, every time.                              | S      |
| P11 | **Supplier performance scorecards**                                                                     | **52% name supplier reliability their #1 problem.** Nobody serves it well.         | M      |
| P12 | **PO approval workflow + spend thresholds**                                                             | Any team over ~5 people asks for it.                                               | S      |
| P13 | **Backorder queue + allocate-on-receipt**                                                               | Backorder is a policy flag today; there is no queue and no auto-allocation.        | M      |
| P14 | **Consignment / VMI / 3PL-owned stock**                                                                 | "On my shelf, not my asset." Valuation is wrong without an ownership axis.         | M      |
| P15 | **Multi-currency purchasing with FX at receipt**                                                        | PO carries a currency; nothing converts it into base-currency valuation.           | S      |
| P16 | **Accounting sync** (QuickBooks / Xero): inventory asset + COGS                                         | The single most-requested integration in the SMB band.                             | L      |
| P17 | **ASN / inbound EDI-lite**                                                                              | Receiving against a supplier's advance ship notice, not a paper slip.              | M      |
| P18 | **FEFO / FIFO pick rules + expiring-stock report**                                                      | Lots carry `expiresAt`; nothing picks by it.                                       | S      |
| P19 | **Returns → disposition** (restock / quarantine / scrap)                                                | Returns restock today with no inspection gate or quarantine location.              | S      |
| P20 | **Inventory CSV import + full export round-trip**                                                       | Explicitly open. Blocks migration off a spreadsheet — the #1 incumbent.            | S      |
| P21 | **Report depth**: dead stock, shrinkage, sell-through, GMROI, fill rate, days-of-cover, as-of valuation | C3: "we export to Excel." Four reports today.                                      | M      |

### 4.2 Differentiator gaps — the complaints, answered

| ID  | Complaint answered        | What we build                                                                                                                                                                                                                                                  |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | C1, 44.8% inaccuracy      | **Provenance UI.** Every quantity anywhere in the product is clickable → the ledger rows that produced it, with actor, source, reference, and running balance. Nobody else can do this; we already have the data.                                              |
| D2  | C1                        | **Continuous reconciliation.** A job that re-derives `Σ(delta)` per level and raises `inventory.reconciliation.drift` on any mismatch. Ledger integrity becomes a monitored SLO, not an assumption.                                                            |
| D3  | C1, C2                    | **Oversell defence, made visible.** Per-channel safety buffers, an **oversell incident log** (every deny + every negative on-hand), and auto-pause of channel selling on a stale source.                                                                       |
| D4  | C2                        | **Sync freshness SLO.** Every stock number carries an age. Sources declare an expected interval; breaching it flags the source, banners the surface, and fires an event. "How stale is this?" is answerable on screen.                                         |
| D5  | C3                        | **Report builder + scheduled delivery.** Saved views, column chooser, group/pivot, CSV+API on every report, emailed on a schedule. The point is to make "export to Excel" unnecessary — and when they do export, the export re-imports.                        |
| D6  | C4, 85% spreadsheets      | **The spreadsheet bridge.** Import a messy sheet → column mapping with fuzzy match → dry-run diff → apply. Paste-in bulk edit on the stock grid. Guided setup that ends with an opening-balance count. **Target: file to accurate stock in under 30 minutes.** |
| D7  | C6                        | **Unlimited users, priced per module.** Warehouse/scanner staff cost nothing. A dedicated low-privilege **scanner role**. This is already how sparx bills — we just have to build the role and say it out loud.                                                |
| D8  | C8                        | **One platform, no double entry.** Receipt → supplier bill in invoicing. Sale → COGS. PO → CRM supplier record. Stock → storefront, B2B portal, and marketplace listings. Already largely true; make each seam explicit and visible.                           |
| D9  | 52% supplier pain         | **Supplier scorecards.** On-time %, fill rate, actual-vs-promised lead time (feeding the reorder math), price variance vs PO, damage rate on receipt. Late-PO alerts. Genuinely underserved by the whole category.                                             |
| D10 | 81% want AI / 11% have it | **MCP-native inventory.** All ~48 tools plus everything added here, so a tenant's own AI client can answer "what should I reorder", "why did this drop", "which supplier is slipping". **BYOK/MCP only** — sparx never runs an LLM on a platform credential.   |
| D11 | C5                        | **No-developer customization.** Custom fields on inventory objects, saved views, automation triggers on every inventory event, and webhooks — all through the UI.                                                                                              |
| D12 | C10                       | **Stockout / oversell economics on screen.** Days-of-cover, projected stockout date, revenue at risk, and holding-cost estimate — surfaced on the reorder surface, not buried in a report.                                                                     |

---

## 5. The position

Everything below serves one claim, and the claim has to survive contact with a skeptical operator:

> **"Your stock number is right, you can see exactly why, and you were running in an afternoon —
> without buying a seat for every person in the warehouse."**

The three supporting pillars, in priority order:

1. **Trust** (D1, D2, D3, D4) — we already have the ledger nobody else has. Surface it.
2. **Time-to-value** (D6, P20, D7) — the incumbent is a spreadsheet. Beat the spreadsheet's
   onboarding, not NetSuite's feature list.
3. **Depth** (P1–P21) — so that a business that outgrows the spreadsheet never has to leave.

Where those conflict, **trust wins, then time-to-value, then depth.**

---

## 6. The plan — the feature list to mark off

Twelve phases. Each is independently shippable and independently valuable. Ordering is deliberate:
trust first (it's our advantage and the #1 complaint), physical warehouse second (it unblocks the
most parity gaps), intelligence later (it needs the data the earlier phases produce).

Legend: **[P#]/[D#]** = the gap from §4 · **DB** = needs a migration · **API** = new/changed endpoints ·
**MCP** = new tools · **UI** = new/changed workbench surface

---

### Phase 1 — Trust: make the numbers provably right ✅

_The differentiator, built on what we already have. Nothing here needs a competitor to exist._

**Shipped 2026-08-10.** Migration `20270219000000_inventory_integrity` (four tables + the source
freshness columns) is authored and awaiting the pipeline; everything else is in the working tree.

- [x] **1.1** `Explain this number` provenance drawer — one call decomposes a quantity, re-derives it from the ledger, names who holds the allocated units, and reports feed freshness. Reachable from the stock list, the stock item's per-location card, the movements ledger, and commerce's product-stock pane. **[D1] UI** — `surfaces/inventory/provenance.tsx`, `services/provenance.ts`
- [x] **1.2** Movement ledger export (CSV + API) with full filter parity to the movements surface — `GET /v1/inventory/movements/export`; truncation reported in a response header, not just implied by the row count **[D1] API**
- [x] **1.3** Reconciliation job — re-derives `Σ(delta)` per `(variant, warehouse)`, compares to `on_hand`, records a run row; `full` / `sample` / `variant` scopes **[D2] DB** — `services/integrity.ts`
- [x] **1.4** `inventory.reconciliation.drift` event (one per RUN, not per drift) + the Integrity surface's verdict card: last run, levels checked, drift found, value in question, clean-run streak **[D2]**
- [x] **1.5** Oversell incident log — three kinds kept apart (`blocked` / `allowed` / `negative_on_hand`), each snapshotting what the system believed at the decision. The blocked write is DETACHED, because the transaction that discovers it is about to roll back **[D3] DB**
- [x] **1.6** Oversell surface: incidents by kind, item, channel and stock age, with the row opening the item **[D3] UI**
- [x] **1.7** Per-channel safety buffer — override → channel default → level cushion, with two partial unique indexes so a nullable-column UNIQUE cannot accept duplicate channel defaults **[D3] DB**
- [x] **1.8** Sync freshness SLO — `expectedIntervalSec` on `InventorySource`; a breach flags the source, stamps `staleSince`, and fires `inventory.source.stale` (and `.recovered`). Events fire on TRANSITIONS only **[D4] DB**
- [x] **1.9** Stock age indicator — `asOf` + server-computed `ageSeconds` on every level row; the badge renders only when the number has actually gone stale, so the colour keeps meaning something **[D4] UI**
- [x] **1.10** Staleness policy per source: `warn` | `buffer_up` | `pause_channel`, resolved worst-of across every late source feeding a level and additive on top of the configured channel buffer **[D3][D4]**
- [x] **1.11** Shrinkage report — `loss` / `damage` / negative `recount` by period, location, reason and value, priced at the movement's own cost; positive recounts reported ALONGSIDE rather than netted off; % of valuation against the 1–5% band businesses actually live in **[P21] UI**
- [x] **1.12** Scanner-safe role — `scanner` is a lateral staff role admitted to receive / count-entry / transfer / lookup by an explicit allow-list, with cost fields redacted at the transport and receipt-line cost overrides stripped. Posting a count and creating a transfer stay `editor` **[D7]**

**Also landed with it** (not on the original list, needed to make the above true):

- `inventory-integrity-sweep` k8s CronJob at 04:30 UTC — reconcile + freshness in one nightly pass, deliberately BEFORE the 05:30 valuation snapshot so a drifting level is on the record before its value is frozen into a historical series.
- Five MCP tools: `explain_stock_level`, `get_inventory_health`, `get_oversell_incidents`, `get_shrinkage_report`, `run_inventory_reconciliation` **[D10]**
- `pnpm test`: 19 unit assertions on the two rules that decide how much stock a customer may see (buffer precedence, staleness combination), plus a DB-backed suite covering reconciliation, the detached blocked-incident write, the partial unique indexes, the sweep's transitions, and shrinkage arithmetic.

**Outstanding for a follow-up, stated rather than hidden:** the B2B availability pane has no
provenance affordance yet (it renders account-scoped availability, not a `(variant, warehouse)`
level, so it needs the fleet-hold arithmetic surfaced too — a small piece of Phase 9's work).

### Phase 2 — The physical warehouse: bins and put-away ✅

**Shipped 2026-08-10.** Migration `20270221000000_inventory_bins` (three tables, the
warehouse/variant/receipt/count columns, and the DEFAULT-bin backfill) is authored and awaiting the
pipeline; everything else is in the working tree.

**The architectural decision that shaped all of it:** the warehouse ledger is left ALONE. Bins sit
strictly below it —

```
inventory_levels          (variant, warehouse)   ← availability reads this
  └── inventory_bin_levels     (variant, bin)    ← Σ == the level above
        └── inventory_bin_movements              ← Σ(delta) == the bin level
```

— so `on_hand == Σ(inventory_movements.delta)` is untouched, Phase 1's reconciliation keeps working
with no change to its query, and it merely gains the second cross-check. Putting bins into the
warehouse ledger was the obvious alternative and it is wrong: a bin-to-bin move changes no warehouse
quantity, so it would have had to be a −N/+N pair whose `balanceAfter` dips through a value the shelf
never held.

- [x] **2.1** `InventoryBin` — warehouse × code, free-text zone/aisle/rack/shelf, six types, `isSellable`, pick sequence, capacity hint, and the `isSystem`/`isDefault` pair **[P1] DB**
- [x] **2.2** `InventoryBinLevel` — `(variant, bin)` on-hand, summing to the warehouse level which stays authoritative for availability. **No `allocated`**: a reservation holds stock at the LOCATION, and allocating against a shelf would force the picking decision at add-to-basket time **[P1] DB**
- [x] **2.3** `InventoryBinMovement` — the bin ledger, same discipline as the warehouse one (row-locked, idempotent, attributed). `applyMovement` gains an optional `binId` and mirrors into it in the SAME transaction; an unnamed outbound draws down richest-first across the shelves that hold stock, because a sale does not know which shelf a picker used **[P1] DB**
- [x] **2.4** Shelves list + shelf detail surfaces, sorted by the pick WALK rather than the alphabet **[P1] UI**
- [x] **2.5** Put-away on receiving — the receipt LINE records the shelf (a mirror that decided silently leaves no trace), with the suggester resolving it when the receiver is booking from a desk **[P1]**
- [x] **2.6** DEFAULT / QUARANTINE / DAMAGED provisioned per location, looked up by TYPE not by code so a tenant can rename them; damaged-on-arrival routes both halves to DAMAGED rather than the pick face **[P19]**
- [x] **2.7** Bin- and zone-scoped counting, plus blind counts. A shelf line posts a RELATIVE delta against the locked shelf, never `setOnHand` — setting the location to a shelf's count would silently delete every other shelf, and would look like a successful count **[P1][P10]**
- [x] **2.8** Shelf labels — three sizes, QR encoding the shelf code itself (not a URL, so it still scans when the wifi does not reach the back of the building), rendered in the browser and printed by it so the preview IS the output **[P2]**
- [x] **2.9** Backfill seats every existing level in its location's DEFAULT bin, and `enableBinsForWarehouse` does the same on opt-in — so `Σ(bins) == level` holds from the first instant rather than the first put-away. **No movements are written for the seating**: nothing happened, and a fabricated `put_away` for every level would put a lie in an append-only log on day one **[P1] DB**

**Also landed with it:**

- **Bins are OPT-IN per location** (`Warehouse.usesBins`, default false). With them off, not one bin
  row is written and nothing behaves differently — a shop with one stockroom gains nothing from
  naming a shelf before it can book a delivery.
- The reconciliation pass gained the **Σ(bins) == level** cross-check, deduplicated against the
  ledger finding so one underlying problem is reported once.
- 12 REST endpoints, 5 MCP tools (`find_stock_location`, `list_bins`, `get_bin_contents`,
  `suggest_put_away`, `move_between_bins`), and the scan-capable gate on the physical operations.
- A put-away suggester that returns SEVERAL shelves with the reason in words for each — advice a
  person can disagree with, since a warehouse always has reasons the system does not know.

**Outstanding, stated rather than hidden:**

- **A returned unit that inspection marks NOT restockable still records nowhere.** Routing it to the
  quarantine shelf needs bin-sellability to gate availability first — today availability reads the
  location total, so seating it in quarantine would make it sellable, which is worse than the gap.
  That gating belongs with the ownership axis in **Phase 9 (9.5–9.7)** and is listed there.
- The bin picker is on receiving, counting and the shelf surfaces. **Transfers and manual adjust
  still pick a location only**, and fall through to the suggester — correct behaviour, but the
  operator cannot override it there yet.

### Phase 3 — Scan-first operations ✅

**Shipped 2026-08-10.** Migrations `20270222000000_inventory_barcodes` and
`20270223000000_inventory_scan_events` are applied to docker and awaiting the pipeline; everything
else is in the working tree.

**The architectural decision that shaped all of it: the session lives in the DATABASE, not in the
tab.** Every trigger pull is written to `inventory_scan_events` immediately and a receiving tally is
DERIVED from those rows. That costs a round trip per scan and buys four things a client-side tally
cannot have — the session survives a reload, survives the battery dying, can be worked by two people
on two guns at once, and can be replayed from an offline queue hours later without anyone reasoning
about merge order.

**And the constraint the whole phase rests on: `UNIQUE (tenant_id, value)`.** A scan must resolve to
exactly ONE item or every workflow here ends at a disambiguation prompt and there was no point
scanning. Two variants sharing a manufacturer GTIN is a real situation and the registry refuses it —
on purpose, because the alternative is finding out on the dock at 6am rather than when somebody
typed the second one in. The refusal names the conflicting item, and the ones the backfill could not
seat are listed on their own surface rather than silently dropped.

- [x] **3.1** `VariantBarcode` — many codes per item, each with a symbology (UPC-A/UPC-E/EAN-13/EAN-8/GTIN-14/ITF-14/Code 128/Code 39/QR), a **pack size**, an optional supplier, and scan telemetry. `ProductVariant.barcode` stays as a DERIVED mirror of the primary, and only when that primary is a GTIN — the feeds mean a GTIN by "barcode", and an internal Code 128 means nothing to Google **[P2] DB**
- [x] **3.2** Internal barcodes minted as real **number-system-2 UPC-A** — the GS1 range reserved for restricted circulation, so any gun reads them with no configuration and they can never collide with a manufacturer's code. From a stored counter, not `MAX + 1`: a deleted code must never be re-issued while its labels are still on shelves **[P2]**
- [x] **3.3** Label printing — product labels (three sizes × three content presets × copies), the shelf labels from Phase 2, and a **document label** for a purchase order, receipt, transfer or count, without which "scan the count sheet" is an instruction with nothing to scan. Rendered in the browser and printed by it, so the preview IS the output and it works on a warehouse tablet with no connection **[P2]**
- [x] **3.4** `ScanInput` — a keyboard-wedge field that re-takes focus after every scan, plus a `BarcodeDetector` camera path where the browser has one, plus audio feedback (a rising chirp, a falling buzz) because the person is looking at the box rather than the screen. Behind it, `resolveScan` returns matches across variant / bin / PO / receipt / transfer / count / lot / serial and **does not guess** when a value honestly matches two things **[P2] UI**
- [x] **3.5** Scan-to-receive — a server-held session, pack-size expansion, damaged-per-box, per-scan undo, and **over-receipt refused outright** with the numbers in the message. Posting goes through `createGoodsReceipt`, so a scanned delivery and a typed one write byte-identical ledger entries **[P2][P3] UI**
- [x] **3.6** Scan-to-count — each pull ADDS one (counting a shelf is one pull per item), an item not on the sheet is ADDED to it rather than refused, and **blind counts withhold the expected quantity at the serializer** rather than trusting the screen to hide it **[P2][P10] UI**
- [x] **3.7** Scan-to-transfer (draft only — an in-transit transfer describes a box already on a truck) and scan-to-lookup, which answers "what is this, where is it, how many" from one field **[P2] UI**
- [x] **3.8** Warehouse mode — a single-column surface with four jobs, 44px minimum targets, and a persistent location picker. Its own surface rather than a responsive collapse of six: making the desk surfaces fold down produces six bad phone screens, and making the phone its own produces one right one at no cost to the desk **[P2] UI**
- [x] **3.9** Offline-tolerant scan queue — `localStorage`, replayed on reconnect and on mount, in trigger order. Correct by construction rather than by care: every scan carries a client-minted key and `UNIQUE (tenant_id, idempotency_key)` makes the second arrival a no-op **[P2][D1]**

**Also landed with it:**

- **`@sparx/commerce-schemas` gained the symbology engine** — check digits, UPC-E expansion, scan
  equivalence, and the bar patterns for Code 128 / the EAN-UPC family / ITF-14, all pure. One
  implementation, so a label printed in the browser carries the code the server validated. Written
  rather than installed: a symbology is a published table and a checksum, and owning it means label
  output has no runtime dependency and can move server-side for PDFs later.
- **`scanEquivalents`** — a UPC-A read by a gun in EAN-13 mode, an EAN-13 that is a UPC-A, a UPC-E
  expanded to its full form. Which encoding arrives is a property of how the gun is configured, not
  of the item, and without this "we registered the barcode and it still says unknown" is a ticket
  the tenant cannot possibly diagnose.
- **Failed scans are recorded.** A code that resolves to nothing writes `not_found`; an over-receipt
  writes `rejected` with the reason. "I scanned it and nothing happened" is otherwise the least
  diagnosable complaint in warehouse software.
- **`scanned_at` vs `created_at`** — the gap between them IS the outage, recorded rather than
  inferred, so a replayed count is honestly dated to when the shelf was looked at.
- 27 REST endpoints across barcodes and scanning, 12 MCP tools, and a `device_id` on every scan so a
  misbehaving gun can be told from a misbehaving person.
- **Two defects found by the new tests rather than by a warehouse:** `PurchaseOrderLine.quantity`
  does not exist (it is `quantityOrdered`) and Prisma's `GetSelect` let it through typecheck; and
  `UpdateBinInput` fabricated `type`, so renaming a quarantine shelf would have silently turned it
  into a pick shelf. The second is a Phase 2 defect that the generic `patch-semantics` guard caught.

**Outstanding, stated rather than hidden:**

- **Nothing prints a price on a product label yet.** The "Shelf edge" preset reserves the slot and
  the field is not rendered: variant price lives in Commerce and the barcode read does not carry it,
  so filling it means either a second query per label or widening the registry read. Worth doing;
  not worth doing badly on the way past.
- **The camera path needs a Chromium browser.** `BarcodeDetector` is unimplemented in Safari and
  Firefox, so the button is hidden there rather than shown broken. The keyboard-wedge path — which
  is what actual scanners use — works everywhere.

### Phase 4 — Pick, pack, ship ✅

**Shipped 2026-08-10.** Migration `20270224000000_inventory_picking`; everything else is in the
working tree.

**The decision the whole phase turns on: picking changes no stock number.** By the time a pick list
exists, `commitSaleOnTx` has already taken the units off `inventory_levels.on_hand` — the goods are
gone from the ledger and still physically on the shelf. A confirmed pick that decremented again
would sell one unit twice in the books. So a pick writes NO warehouse movement. What it adds is
knowledge of WHICH SHELF, and when the picker took from somewhere other than the instruction, that
difference is written to the bin ledger alone. Same layering as Phase 2, for the same reason.

**Which forced the second decision, and it is the more interesting one: the ALLOCATION is the
checkout draw-down.** A pick list that chose shelves by reading current bin levels would read levels
the sale had already drawn down and conclude the stock was nowhere. So `mirrorMovementToBins` became
strategy-aware — the shelf chosen at checkout is now the shelf the warehouse's strategy would have
chosen — and the pick list READS that decision rather than making a second one. One decision, one
place, nothing to reconcile. It also fixed a latent Phase 2 shortcoming: the draw-down was
hard-coded richest-first, which quietly meant FEFO did not exist and a warehouse with dated stock
was shipping whatever pile happened to be biggest.

**And the third: a short pick moves stock UP.** Units nobody could find were never picked, so the
sale that removed them has not happened. They go back on-hand AND into a reservation for the order
that still wants them, so nobody can buy something we have just admitted we cannot find — then the
shelf goes on a blind count. The alternative (leave the decrement, treat the units as shrinkage) is
wrong twice: it books a loss nobody has confirmed, and it leaves the order owing units the system
believes were shipped.

- [x] **4.1** `PickList` + `PickListLine` + `PickListOrder` — generated from orders (single / batch / wave), assignable, bin-sequenced. A line always points at ONE order item even on a wave: merging by variant would shorten the walk by nothing and would destroy the only thing that makes a short pick actionable, which is knowing whose unit is missing **[P3] DB**
- [x] **4.2** Allocation strategy per warehouse (FIFO / FEFO / nearest-bin / single-bin), applied where it actually decides anything — inside the checkout draw-down, which the walk then reads. Sellable shelves before quarantine and damaged; the pick face before bulk; FEFO excludes recalled batches outright rather than ranking them last **[P3][P18]**
- [x] **4.3** Guided pick surface — shelf, then item, then quantity, in that order of size, because the first question in an aisle is always "am I in the right place". Scan-to-verify (wrong item refused, wrong shelf refused and told where to go), and a short-pick reason from a closed list that raises a blind count on the shelf **[P3] UI**
- [x] **4.4** Pack verification — `ShipmentPackage` + `ShipmentPackageLine`, scan every item in, anything not on the order REFUSED, per-line scanned-vs-typed recorded, weight and dimensions captured for the rate quote. Splitting an order across boxes is assumed rather than treated as an exception **[P3] UI**
- [x] **4.5** Packing slip on the PO document's build path — pure renderer plus tenant-scoped loader. No prices (the box may be a gift, a dropship, or one of four), a scanned-verified tick per line, and an "also in this order, sent separately" block that costs four lines of paper and prevents a support ticket every time **[P3]**
- [x] **4.6** Sealed box → `OrderFulfillment`, one fulfillment PER BOX so a three-parcel order gets three tracking numbers, feeding the existing rate quote and label purchase unchanged. Lives in `@sparx/commerce` — the only package that can see both the warehouse and the order **[P3]**
- [x] **4.7** Throughput — units per hour measured against time actually spent picking, scan-verified rate, short-pick rate, per picker AND per shelf, with the reasons grouped **[P3][P21]**

**Also landed with it:**

- **Time is measured per walk per person, first confirmed line to last.** A walk assigned at 08:00
  and worked at 11:00 took twenty minutes, and any other reading slanders the picker. Attribution is
  per LINE, so a walk handed over halfway credits both people for what each actually did.
- **The metric is called "confirmed by scan", not "accuracy".** We can measure how many lines a
  trigger pull confirmed. We cannot measure what was picked wrong and never noticed, and a metric
  named "accuracy" would claim we can.
- **The shelf table is the one that pays.** A shelf that keeps coming up empty is a put-away
  problem, a signage problem or a theft problem, and it will never appear in a per-person view.
- **Pick scans are deliberately NOT replayed from the offline queue.** Receiving replays because the
  pallet is still on the dock either way; a pick replayed hours later would confirm units off a
  shelf somebody has since counted and corrected. A dropped pick scan costs one trigger pull.
- **`inventory_scan_events` gained a `pack` context**, so a bench scan is recorded on the same terms
  as every other trigger pull — same idempotency, same evidence trail.
- 21 REST endpoints, 16 MCP tools (15 on inventory, plus `fulfill_package` on commerce, which is
  there because it writes an order and inventory must not depend on `@sparx/crm`), five workbench
  surfaces, and two new jobs in warehouse mode.

**Outstanding, stated rather than hidden:**

- **A wave does not consolidate identical lines on screen yet.** The route groups by shelf, which is
  where the walking saving is, but nine orders wanting the same widget still read as nine rows at
  that shelf rather than "take nine, sort into totes 1–9". The data supports it; the display does
  not do it yet.
- **Nothing re-picks a shorted line automatically.** The units are back on hand and held for the
  order, and the count settles whether they exist — but putting them on a NEW walk is a person
  generating one. Automatic re-allocation belongs with backorders (Phase 9), which is where the
  "what do we do when it genuinely is not there" question actually gets answered.

### Phase 5 — True cost ✅

**The gap in one sentence.** A unit's cost basis was whatever the supplier invoiced for the goods —
so the freight, the duty, the broker's fee and the insurance, all of it real money spent to acquire
that stock, reached no margin figure anywhere on the platform. On imported goods that is routinely
15–30%, which is the whole margin on a lot of lines. A business pricing off that number is selling
its thinnest lines at a loss and cannot see it.

- [x] **5.1** `PurchaseOrderCharge` / `GoodsReceiptCharge` — freight, duty, insurance, broker, handling, other; per-PO (the estimate, apportioned across deliveries by value share) and per-receipt (the actual, all of it landing there) **[P4] DB**
- [x] **5.2** Landed-cost allocation across receipt lines by value / quantity / weight / manual, feeding the cost basis on post. Largest-remainder rounding, so the per-line amounts sum to the charge EXACTLY; a basis that cannot divide (weight, against a catalogue with no weights) falls back to units and SAYS it fell back **[P4]**
- [x] **5.3** Landed-cost breakdown on the receipt surface: invoice cost → allocated charges → landed unit cost, per line, with each charge named and the basis it was spread on **[P4] UI**
- [x] **5.4** `InventoryCostLayer` + `InventoryCostConsumption` — layers written on inbound, consumed oldest-first on outbound, with the consumed layers recorded per movement **[P5] DB**
- [x] **5.5** Per-tenant (and per-variant override) costing method: `moving_average` | `fifo` | `standard`, on its own workbench surface that explains each by what it is FOR **[P5] DB**
- [x] **5.6** Standard cost + purchase price variance report — planned against actual LANDED, per variant and supplier, with units that have no standard reported rather than counted as zero variance **[P5][P21]**
- [x] **5.7** FX capture at receipt — the delivery's currency, the rate on the day it landed, and the base-currency landed cost stored alongside **[P15] DB**
- [x] **5.8** As-of-date valuation — the two append-only ledgers walked back to any past instant, so the year-end figure works for a date nobody thought to snapshot **[P21]**
- [x] **5.9** COGS movement attribution: `cost_consumed_cents` on every movement that takes stock out, so margin is a subtraction rather than an estimate **[P5]**

**Also landed with it** (not on the original list, needed to make the above true):

- **The cost ledger is kept whatever method the tenant chose.** Layers are written and consumed
  regardless of `moving_average` / `fifo` / `standard`; the method decides which number gets STAMPED
  on the movement, not whether the history exists. A business switching to FIFO next year needs the
  layers to already be there, and a layer ledger only some tenants keep is one nobody can trust.
- **An OPENING layer per stocked (variant, location), written by the migration** at the moving
  average the platform was already reporting. Not a new number — the one valuation, margin and
  shrinkage have all been using — so `Σ(open layers) == on_hand` is true from day one and FIFO works
  immediately instead of after a year of sell-through.
- **`cost_consumed_cents` is SIGNED.** A reversal credits the cost of goods sold, so summing the
  column over a period gives period COGS with no special cases and a cancelled order nets to zero.
- **A cancelled order gives the units back to the layers it took them from**, at what they cost then
  — recorded as a negative consumption rather than by editing the original row. Putting them on a
  fresh layer at today's average would re-cost the same goods and silently reorder FIFO for
  everything behind them.
- **A charge arriving late is the normal case, and it revalues.** The forwarder bills a fortnight
  after the pallet; adding that charge replays the whole order's allocation from a zeroed base
  (which makes it idempotent), corrects the layers, and nudges the moving average by the value
  change across the units STILL ON HAND. It does not restate what already sold — that cost was
  recorded when the goods left, and editing it is what an accountant means by "the books moved".
- **`cogs_report` by reason.** Goods sold is cost of sales; goods lost is a problem. Adding them
  together hides the second inside the first, so the report splits them and the surface colours
  them differently.
- 15 REST endpoints, 8 MCP tools, two new workbench surfaces (cost vs plan; how stock is valued),
  the landed-cost breakdown and charge entry on the receipt surface, expected charges on the
  purchase order, and cost-of-goods + as-of valuation added to Reports.
- **Changing the costing METHOD is deliberately absent from MCP.** Switching from moving average to
  FIFO changes how every future figure is computed and is a decision a business makes with its
  accountant, not one an agent makes on a hunch. Recording a freight bill IS there — it is a
  bookkeeping entry, and a fully reversible one.

**Deviations from the plan above, stated rather than quietly taken:**

- **The schema file is `56-inventory-costing.prisma`, not `45-`.** §7's table named 45 before the
  inventory files settled into their own run (51-integrity → 55-picking); 56 continues it.
- **`inventory_movements` gained `cost_consumed_cents` but NOT `cost_layer_ids`.** An array column
  cannot carry how many units came off each layer, which is exactly what the breakdown needs, so
  the per-layer detail is a child table (`inventory_cost_consumptions`) instead.
- **A purchase-order charge cannot use the `manual` basis.** It is apportioned across deliveries
  that do not exist yet, so there are no lines to name amounts against. Manual is receipt-only, and
  a CHECK constraint pins it rather than a comment.
- **Standard cost reuses `inventory_levels.unit_cost_cents` / `commerce_product_variants.cost_cents`**
  rather than adding a column. Both already mean "the planned/manually-set cost"; a third field
  meaning the same thing is how two of them start to disagree.

**Outstanding, stated rather than hidden:**

- **Nothing writes an accounting journal yet.** The figures are exact and the reasons are separated,
  but posting them into QuickBooks or Xero is Phase 10 (10.7). Until then a bookkeeper reads these
  reports and types.
- **A revaluation nudges the moving average but writes no movement.** It cannot — a freight invoice
  moves no stock — so the correction is visible in the level and the layers but does not appear in
  the movement feed. When the audit trail for cost-only changes is wanted (it will be, alongside the
  GL work), it wants its own record rather than a fake movement.
- **Per-variant costing overrides are settable via the API but have no UI.** The tenant-level choice
  has a surface; the per-variant escape hatch is a one-field POST, and it belongs on the product's
  own cost panel rather than on a costing screen nobody would think to look at for it.

### Phase 6 — Units of measure, kits, and assembly ✅

**The gap in one sentence, twice.** A distributor buys in cases of twelve, keeps singles on the
shelf and sells pairs — and the platform knew one number per variant and no unit at all, so a buyer
ordering four cases typed 48 and hoped and a counter facing a shelf of sealed cartons had to decide
for themselves what "quantity" meant. And a manufacturer takes components off a shelf and puts a
finished thing on it — an event with no representation anywhere, because a `Bundle` decrements three
stock numbers at checkout without anything ever being _built_.

- [x] **6.1** `UnitOfMeasure` + per-variant conversions: a stocking UoM on the variant (the base), any number of conversions, a purchase default and a sales default, with integer-safe factors **[P6] DB**
- [x] **6.2** UoM applied through PO lines, receipts, counts, transfers and order items; the ledger always stores base units, and the conversion happens at ONE seam (`resolveLineUom`) **[P6]**
- [x] **6.3** UoM display with the base-unit equivalent always alongside — `describeQuantity` is pure, shared, and never drops the singles figure **[P6] UI**
- [x] **6.4** `BillOfMaterials` + `BomComponent` — components, quantity per BATCH, scrap %, labour cost, versioned with exactly one active recipe per output **[P7] DB**
- [x] **6.5** `AssemblyOrder` — planned → released → completed; releasing HOLDS the components, completing consumes them and produces finished stock through the ledger, and the cost rolls up from what actually left plus labour **[P7] DB**
- [x] **6.6** Disassembly — the same two reasons with the arrows reversed, with the finished unit's cost split back across its components in proportion to what each is worth **[P7]**
- [x] **6.7** Buildable quantity — "you can make 14, you run out of hinges", measured against what is FREE rather than raw on-hand **[P7] UI**
- [x] **6.8** Bundle availability derived from component availability, with optional and sell-past-zero components correctly not gating **[P7]**
- [x] **6.9** Surfaces: units, recipes list + editor, runs list + detail **[P7] UI**

**Also landed with it** (not on the original list, needed to make the above true):

- **Factors are integers, and the refusal is the feature.** A fractional factor makes on-hand
  fractional, and an inventory system that can hold 4.999999 of something cannot reconcile. Goods
  that genuinely divide get a smaller BASE unit: stock grams, sell a 500 g bag as a unit of 500.
- **A document line records the unit as TEXT plus the factor, with no foreign key.** An FK means
  `SET NULL`, which erases what "4" meant from a historical purchase order the day somebody tidies
  their unit list. The factor is snapshot for the same reason — a case becoming 24 next year must
  not silently double what last year's orders were for.
- **Component quantities are per BATCH, not per finished unit.** A run of 100 needing three litres
  of glue records 3 against a batch of 100; per-unit would record 0.03 and the ledger stores
  integers. Every label on the recipe editor says "per run" for the same reason.
- **`assembly` is a first-class reservation holder**, alongside cart / order / subscription. A
  scheduled build is as real a claim on stock as a placed order, and releasing a run is what stops
  the last four hinges going out on this morning's order.
- **The cost roll-up is exact because Phase 5 exists.** Each component's `assembly_out` is stamped
  with `cost_consumed_cents` by the cost ledger, so a finished unit costs the sum of what genuinely
  left the shelf plus labour — not a price-list estimate. The recipe's own estimate is shown beside
  it and labelled as an estimate; the difference between the two is worth looking at.
- **A part-completed run scales its parts down and rounds UP**, and cannot grow past what was
  planned — a run that quietly grew is one nobody scheduled the parts for.
- **A tenant is seeded a starter set of fourteen units on first read**, marked `isSystem` so
  "we started you off with this" stays distinguishable from "we set this up". Deleting them all is
  honoured rather than quietly undone on the next load.
- 15 REST endpoints, 11 MCP tools, one new event (`inventory.assembly.completed`, provisioned in
  Terraform), five workbench surfaces, and pack readings on the purchase-order and delivery panes.
- **Editing a RECIPE is deliberately absent from MCP.** A bill of materials is a specification, and
  an agent quietly changing what a product is made of is a different category of mistake from
  mis-recording a count. Planning, releasing and completing a run are all there.

**Deviations from the plan above, stated rather than quietly taken:**

- **The schema files are `57-inventory-uom.prisma` and `58-inventory-assembly.prisma`**, not `46-`
  and `47-` — §7's table predates the inventory files settling into their own 51→58 run.
- **No `stocking_uom_id` / `purchase_uom` / `sales_uom` triple on the variant.** Only the stocking
  unit is a column; purchase and sales defaults are FLAGS on the conversion rows, because they are
  properties of the set ("usually bought by the case" is one fact) and two columns could disagree
  with the conversions they point at. Partial unique indexes enforce one of each.
- **The sell path carries the unit but the storefront cart does not offer one.** `order_items` has
  the snapshot pair and every quantity in it is base units, so fulfilment, picking, packing and the
  ledger all keep counting one thing. Letting a shopper _choose_ "2 pairs" is a storefront cart and
  checkout change, and it belongs with that surface rather than in an inventory phase.

**Outstanding, stated rather than hidden:**

- **Multi-level recipes do not explode.** A recipe whose component is itself made to a recipe
  consumes that component as stock; it does not automatically build it. That is the right default
  (you usually want to see the sub-assembly on a shelf), but "build what you need to build this"
  is a real feature and is not here.
- **Nothing schedules a run against a due date.** `plannedFor` is recorded and shown; capacity,
  sequencing and "what must start today" are planning questions and belong with Phase 7.
- **A bundle's swappable component is counted on its default variant only.** Working out that the
  shopper could pick a different candle would mean resolving the whole swap set and being wrong the
  moment the storefront offers a different one, so the figure is honest about being the default
  configuration's.

### Phase 7 — Planning intelligence ✅

**The gap in one sentence.** A reorder point was an integer somebody typed once: it knew nothing
about how fast the thing sells, nothing about how long the supplier really takes (as opposed to what
they promised), and nothing about how erratic either of those is — so it was wrong in both
directions at once, too high on the steady lines and too low on the spiky ones. That single missing
number is why 37.5% of operators report overstock and 33.5% report stockouts _at the same time_.

**The architectural decision that shaped all of it — the consent rule.** The computed figure is
written to a NEW column, `inventory_levels.dynamic_reorder_point`, BESIDE the existing
`reorder_point` rather than on top of it. The operative trigger — what the reorder engine and
`inventory.low` actually read — is overwritten only where the level is explicitly auto-managed,
which is false by default and false for every level that already has a hand-typed point. A buyer who
typed 40 last spring and finds the system quietly buying at 87 has learned that the platform edits
their settings behind their back, and no feature earns that back. So: show the difference, explain
it, let them adopt it. `autoApplyReorderPoints` flips the default only for levels that have never had
a point at all, where there is nothing to overwrite and the alternative is no warning whatsoever.

**Two places on purpose, same shape as Phase 5.** Four denormalised columns on `inventory_levels`
are the FAST READ (sort a stock list by class or cover without joining anything); the four planning
tables are the EXPLANATION (every input, its window, its sample size). Both are written by the same
nightly pass in one transaction per level, so they cannot disagree — exactly the relationship the
moving average has with its cost layers.

**And the thing that is deliberately NOT materialised.** The rate is measured nightly because it
barely moves; the quantity moves every time somebody sells something. Days of cover is one divided
by the other, so storing it would produce a screen confidently reporting eleven days of cover on a
shelf that emptied at lunchtime — the exact "the numbers are wrong" complaint this plan exists to
answer. Cover, projected stockout and revenue at risk are computed LIVE from the stored rate against
the live quantity, every time.

- [x] **7.1** Demand velocity — trailing 7/30/90-day units-per-day per `(variant, warehouse)`, the standard deviation of DAILY demand (including the days nothing sold, so a line that sold everything in one afternoon cannot read as steady), the coefficient of variation, and how much history any of it stands on. Materialised nightly. **Demand is `sale` AND `assembly_out`** — a component consumed by a production run is demand in every sense that matters, and a WMS-lite manufacturer with no commerce module would otherwise forecast zero for every part they use **[P8] DB** — `services/demand.ts`
- [x] **7.2** Seasonality index — same-period-last-year against that year's average, NULL (never a defaulted 1.0) below a year of history, clamped to ×0.2–×5 so one freak order cannot thirty-times a reorder point **[P8]**
- [x] **7.3** Lead-time actuals — measured order-SENT to first-receipt, at two grains (supplier overall, and supplier × variant), with the spread, the sample count, the promise captured alongside, and the on-time rate. Two partial unique indexes rather than one over a nullable column **[P8][D9]** — `services/lead-times.ts`
- [x] **7.4** Safety stock = `z × √(LT·σ_d² + d²·σ_LT²)`. **Both** variability terms, not just demand — a supplier whose lead time swings 3–21 days puts far more stock at risk than one whose demand wobbles, and σ_LT is the only term that says so, which matters because supplier reliability is the category's #1 complaint **[P8]**
- [x] **7.5** Dynamic reorder point = `d × LT × seasonality + safety stock`, recomputed nightly, with the consent rule above and a one-click "adopt today's figure" that is deliberately NOT the same act as handing the level to the nightly maths **[P8]**
- [x] **7.6** Projected stockout date + days-of-cover on every level, computed live rather than stamped **[D12]**
- [x] **7.7** Reorder worklist v2 — default sort is now **money at risk**, with the measured lead time and its provenance on the row, and a plain-English sentence explaining the whole calculation inline. Clicking a row opens the calculation, not the stock item **[P8][D12] UI**
- [x] **7.8** ABC (cumulative usage-VALUE cut at 80/95) and XYZ (coefficient of variation), recomputed nightly, with a sticky override that survives a re-rank and keeps the measured class beside it, plus a one-sentence instruction for each of the nine pairs **[P9] DB** — `services/classification.ts`
- [x] **7.9** Cycle-count schedules — ABC-driven cadence, generating real counts (blind by default), taking the least-recently-counted slice with never-counted first, refusing to stack a second count on an unfinished one, and advancing `nextRunAt` from the date that WAS due so a paused schedule resumes rather than firing six overdue counts **[P10] DB** — `services/count-schedules.ts`
- [x] **7.10** Slow-mover report in three kinds that need different answers — **dead** (all of it is excess; the question is disposal), **overstock** (it sells, there is just far more cover than the horizon; the answer is to stop buying), **slow** (worth an eye) — each with the capital tied up and what to do **[P21]**
- [x] **7.11** Holding cost per item and in total, at a configurable annual carrying rate defaulting to the category's 25%, broken down by ABC class, with the most expensive things to KEEP listed separately from the most valuable things to own **[D12][P21]**
- [x] **7.12** Phase 1's provenance treatment applied to derived numbers: every input with its source and an honest confidence, both formulas with this item's numbers substituted in, and a verdict that is the WEAKEST input rather than an average — plus what would most improve it **[D1][D10]** — `services/planning-provenance.ts`

**Also landed with it** (not on the original list, needed to make the above true):

- **`inventory-planning-sweep` k8s CronJob at 03:30 UTC** — five stages in a load-bearing order
  (lead times → demand → classify → reorder points → generate due counts), each collecting its own
  failure so one bad stage does not skip the ones after it. Deliberately BEFORE the integrity sweep
  at 04:30 and the valuation snapshot at 05:30: a night's numbers are planned, then checked, then
  priced, in that order.
- **`InventoryPlanningPolicy`** — a fifth table beyond the four §7 named, because 7.11's "configurable
  annual carrying rate" and 7.4's service level had nowhere to live. Same contract as `CostingPolicy`:
  absent means the defaults, so a tenant who never opens the screen still gets a working forecast.
- **Twelve MCP tools** (`get_stockout_risk`, `explain_reorder_point`, `get_demand_forecast`,
  `get_abc_classification`, `get_slow_moving_stock`, `get_holding_cost`, `get_supplier_lead_times`,
  `get_planning_policy`, `list_count_schedules`, `apply_computed_reorder_point`,
  `set_stock_classification`, `recompute_planning`) **[D10]**. Turning ON automatic reorder-point
  management is deliberately absent from the tool set: it hands the nightly maths permission to
  rewrite an operational trigger every night, and the entire value of that decision is that a person
  made it knowingly.
- `inventory.classification.changed` — ONE event per sweep with the tallies, never one per item: a
  re-ranking after a busy quarter moves hundreds, and a few hundred notifications say nothing
  anybody can act on individually.
- Three workbench surfaces — **Planning** (five tabs: at risk · what matters · not selling · cost to
  keep · settings), **Why this number**, and **Counting schedules** + its editor.
- `pnpm test`: 45 pure assertions on the arithmetic every planning figure is made of (service-level
  z, both variability terms, the ABC cut including the item that CROSSES a threshold, XYZ against a
  null CV, cover with no demand, revenue at risk with stock inbound, seasonality below a year of
  history), plus **21 DB-backed** covering the steady-vs-spiky distinction, `assembly_out` as demand,
  `transfer_out` NOT as demand, measured-vs-promised lead time, the consent rule in both directions,
  a sticky override through a re-rank, schedule generation refusing to stack behind an open count,
  a six-weeks-overdue schedule resuming on a sane date, and the weakest-input verdict.

**Two real defects the integration suite caught on first run**, both worth the pattern:

1. **`audit_logs.entity_id` is a UUID column, so a composite `variant:warehouse` key fails at
   INSERT.** Four audit writes in the new services keyed on the pair, and every one of them threw
   `Error creating UUID … found ':' at 37` the moment it ran. The house convention already existed —
   `setReorderPolicy` keys on the variant and carries the warehouse in the diff — and typecheck
   cannot see any of this, because the field is a `string`.
2. **A duplicate route for one surface.** `inventory.packing.bench` had TWO entries in
   `packages/links/src/routes.ts` (bare, and with an `:orderId`), which `check:routes` passes
   happily — it only checks that every surface HAS an address — while the links package's own
   `routes.test.ts` fails on it. Fixed by making the bare station canonical and the order-scoped path
   an alias. Shipped unnoticed in Phase 4: **`check:routes` is not a substitute for `pnpm test`.**

**Deviations from the plan as written:**

- **The schema file is `59-inventory-planning.prisma`, not `48-`.** §7's numbering was aspirational
  and Phases 5 and 6 already landed at 56/57/58; a 48 would sort into the middle of the CRM files
  and mean nothing. The migration is `20270227000000_inventory_planning`.
- **Lead-time measurement lands here rather than in Phase 8.** §7.3 asked for it and §7.9 needs it,
  and the on-time rate falls out of the same pass for free. Phase 8's scorecard reads
  `inventory_supplier_lead_times` rather than measuring it again.
- **No economic order quantity.** EOQ needs a per-order cost figure no small business has to hand,
  and its answer is wildly sensitive to that guess — a precise-looking number built on an invented
  one. The suggested quantity tops up to the point plus a review period instead, which is
  explainable in a sentence.

**Outstanding, stated rather than hidden:**

- **The seasonality index conflates growth with season until two years of history exist.** It
  compares the same period last year against the trailing year's average, so a business that has
  tripled reads every month as "hot". The ×5 clamp bounds the damage and the surface reports the
  index rather than hiding it, but the honest fix needs the year-before-last as the baseline.
- **Seasonality is applied as one forward 30-day window, uniformly.** The multiplier that should
  really apply is the one covering the lead-time window ahead, which differs per level; a fixed
  window is close enough for a first pass and wrong for a 90-day import lead time.
- **A cycle-count schedule's zone filter reads the bin ledger, so it only narrows for tenants using
  bins.** A zone on a location with no bins matches nothing, which is correct but reads as an empty
  schedule rather than as a misconfiguration.
- **Nothing consumes `inventory.classification.changed` yet.** The event fires and the count
  schedules already read the fresh class on their next run; an automation trigger on it (tell me
  when something becomes an A) is a Phase 11 custom-field/automation item.

#### What the browser walk-through found (2026-08-11)

Phase 7 passed typecheck, lint and 209 tests and was still wrong in five places. Every one of them
needed a person to look at a screen; none was findable from a green suite. The common thread in the
first three is one fault — **an unmeasured thing presented as a measurement** — which is precisely
what the phase claimed to have solved and had only solved for seasonality.

1. **XYZ called everything "Erratic".** A coefficient of variation is a finite number for any
   history at all: two sales in thirty days yields ≈4.0, comfortably past the Z threshold. So a young
   catalogue reported eighteen lines of "Erratic", six of which had never sold a unit, each advised
   to be ordered little and often and counted monthly. `classifyXyz` now takes the evidence
   (`MIN_DEMAND_DAYS_FOR_XYZ = 6`, `MIN_HISTORY_DAYS_FOR_XYZ = 28`) and returns **null** below it;
   `inventory_classifications.xyz_class` became nullable (migration
   `20270301000000_planning_xyz_unknown`) and the screen says "Not enough history". Three extra
   advice sentences cover the unknown-steadiness pairs, and the provenance surface no longer prints
   "(very erratic)" beside a spread it cannot justify.
2. **An unknown cost price rendered as `$0.00`.** A hundred notebooks nobody had costed showed as
   worth nothing, and the money totals silently excluded them. Both money reports now carry
   `costKnown` per row and `itemsWithoutCost` per report: the cell reads "No cost set" and the header
   says by how much the total understates.
3. **Empty lists claimed everything was fine before any pass had run.** "Nothing is at risk — this is
   the good version of an empty list" appeared on a tenant nobody had measured. Every planning
   surface now distinguishes measured-and-clear from never-looked-at.
4. **The "set reorder levels automatically" switch was a permanent no-op.** The first sweep creates a
   policy row for every level it plans and — under a two-state `is_auto_managed` — stamped `false`,
   because the switch is off by default. The "decided once, never re-litigated" rule then read that
   default as a decision forever, so turning the switch on later did nothing at all, silently. The
   flag is now **three-state** with an `auto_managed_source` (migration
   `20270302000000_reorder_auto_managed_undecided`): NULL means nobody decided and the switch
   governs; `sweep` means automation adopted it and the switch still governs; `person` is final in
   both directions. Switching off RELEASES a sweep-adopted level and removes the number automation
   wrote — leaving it behind would be indistinguishable from a hand-typed figure and the level could
   never be adopted again.
5. **A panel with no error branch reported a broken server as a finding.** A 500 on the slow-mover
   report fell through to `rows = []`, and "Not selling" announced "Nothing has been checked yet"
   with /usr/bin/bash.00 across the board — while api-rest was simply mid-restart. Same fault as the others,
   caught live. `isError` now precedes the empty state on all three report panels, and its copy talks
   about the connection rather than about the stock.
6. **The switch adopted levels it had never seen move.** Three of the four it took on had
   `history_days = 0` and were handed a reorder point of 0 — not "you need none" but "we have never
   seen this item", and it made them look configured. Adoption now also requires history to compute
   from; a level becomes eligible the first sweep after its first movement.
7. **UI faults that no test can see:** a second tab strip three pixels under the pane strip (Planning
   was one surface with five tabs; it is now five dockable surfaces sharing `planning-shell.tsx`); a
   second toolbar of filters floating above the table; the settings pane hand-rolling cards instead
   of `FormSection` + `Field` + explicit Save, left-hugging with a dead right gutter; the same SKU
   appearing twice with nothing naming its location; the same advice sentence repeated down seven
   consecutive rows; `0.7105 a day` and `3.3118 a day either way` printed to four decimals; and a
   freshly created count schedule announcing "Next run: 7 seconds ago".

**Two defects in earlier phases surfaced on the way past.** `GET /v1/inventory/pick-lists` and
`GET /v1/inventory/packages` both sent `ok({items,total})` where every client reads `paged(items)`,
so `rows.map is not a function` — the Walks surface had never rendered since Phase 4. And React
rejected `toast.add` inside a mutation's `onSuccess` (`flushSync` inside a commit); `lib/defer.ts`
gained `afterCommit` alongside its `afterMenuClose` / `afterPaneChange` siblings.

### Phase 8 — Supplier performance and procurement discipline ✅

- [x] **8.1** Supplier scorecard — on-time delivery %, fill rate, lead-time actual vs promised, price variance vs PO, damage rate on receipt, rolling 12 months **[P11][D9] DB**
- [x] **8.2** Scorecard panel on supplier detail + a supplier league table **[P11] UI**
- [x] **8.3** Late-PO detection and alerting (`inventory.purchase_order.late`) against expected arrival **[D9]**
- [x] **8.4** Supplier price breaks / quantity tiers on `SupplierVariant` **[P11] DB**
- [x] **8.5** PO approval workflow — thresholds by amount, approver roles, an approval queue, and an audit trail **[P12] DB**
- [x] **8.6** ASN / advance ship notice — supplier submits (file or API) what shipped and when; receiving pre-fills from it; discrepancies flagged **[P17] DB**
- [x] **8.7** Supplier returns / RTV — send stock back with a credit expectation, tracked to resolution **[P11] DB**
- [x] **8.8** Three-way match: PO ↔ receipt ↔ supplier bill, with the variance surfaced before the bill is paid **[P16][C8]**
- [x] **8.9** Reorder math consumes measured lead times instead of the supplier's stated one **[D9][P8]** — shipped in Phase 7.3

#### What Phase 8 actually built

Ten tables ([60-inventory-supplier-perf.prisma](../packages/db/prisma/schema/60-inventory-supplier-perf.prisma),
migration `20270304000000_inventory_supplier_performance`), one column
(`20270305000000_purchase_order_late_alert`), one new ledger reason, one new PO
status, one new event, five API route files and eleven workbench surfaces.

The whole phase is about the party at the OTHER end of a purchase order. Every
figure it reports was already in the database — a PO records what was promised, a
receipt records what turned up — and nobody had ever added the two together.

**One rule governs every measured column, and it is Phase 7's lesson applied
before the fact rather than after it:** a figure nobody could measure is NULL,
and its sample count sits beside it. A scorecard is where that matters most,
because its output is a judgement about somebody you have to keep buying from.
"0% on time" that actually means "they never quoted a date" is a defensible-
looking number that ends a relationship, and no test can catch it because the
arithmetic is fine. So `onTimeRate`, `fillRate`, `priceVariancePct` and
`damageRate` are each nullable on their own terms, and `score` is NULL below two
measurable components with `scoredComponents` travelling beside it.

**Decisions worth recording:**

- **The scorecard READS `inventory_supplier_lead_times` rather than measuring
  lead time again.** Two independent measurements of one thing is how a scorecard
  starts disagreeing with the screen it links to.
- **Fill rate counts lines on FINISHED orders only.** A line on an open order is
  in transit, not short; counting it would score every supplier zero the day their
  order was raised.
- **Price variance compares same-currency deliveries only**, weighted by value. A
  variance computed across two currencies at a rate nobody recorded is a
  fabricated number, and a 40% overcharge on one washer must not outweigh a 1%
  drift across the year's engines.
- **Damage is read from the ledger's `damage` movements against a receipt**, so
  the phase adds no second record of a fact receiving already writes.
- **A price break is a FLOOR, not a range**, and the resolver never substitutes a
  cheaper rung the order has not reached — a supplier is free to publish a more
  expensive pallet price, and quoting the tier below it would promise a price they
  will not honour. The arithmetic is pure (`resolvePurchasePrice`) so the price a
  buyer is SHOWN and the price the order RECORDS cannot diverge.
- **`pending_approval` had to be its own PO status.** Left a draft, a held order
  vanishes from the buyer's "sent" list and gets raised twice; called submitted,
  stock can be received against it, which defeats the control entirely. Nothing is
  stamped as ordered until somebody signs — approving is what places the order.
- **Approval precedence is STATED, not inherited from query order.** Unlike the
  B2B rule (docs/10 §12), these rules carry an approver, so two matching rules can
  disagree about who signs: highest cleared threshold, then sort order, then age.
- **A rejection returns the order to DRAFT, not cancelled** — "change this and ask
  again" — and mints a new approval row on resubmission so the trail reads as the
  sequence of decisions it was.
- **The late-order alert fires ONCE** (`late_alerted_at`), and rescheduling the
  expected arrival clears it. A nightly re-fire for an order six weeks overdue is
  how alerting gets muted. Rescheduling also had to be built: `updatePurchaseOrder`
  is draft-only, so until now there was no way at all to record "they rang to say
  it will be a fortnight".
- **An order with no due date is UNDATED, not on time.** The count is reported at
  the top of the overdue list rather than omitted, so an empty list is not read as
  a punctual supply chain.
- **An ASN moves no stock and stores no discrepancy.** The gap is the difference
  between the notice and the receipt, both already recorded; a third copy goes
  stale the first time a receipt is corrected. `discrepancyUnits` is NULL until a
  delivery is actually booked — printing 0 before that would read as "matched",
  which is a claim about an unopened pallet. Receiving pre-fill is a READ that
  returns a suggestion, never a write, and it does NOT clamp the supplier's claim
  to what is outstanding, because that is precisely the case the notice exists to
  expose.
- **A return moves stock on SEND, not on create**, and `creditReceivedCents` stays
  NULL until somebody records a credit note — zero would mean "they refused",
  which is a different conversation from "we are still waiting". A line the
  service cannot cost is REFUSED rather than recorded at £0, because a return
  worth nothing moves the stock and silently writes the money off. Stock going
  back gets its own ledger reason (`return_to_supplier`) so shrinkage reports do
  not libel the warehouse.
- **The three-way match compares billed against RECEIVED, not against ordered.** A
  supplier who ships eight of ten and invoices for ten has made no ordering error;
  they have billed for goods that are not on your shelf, and only the receipt
  knows. Approving a bill is REFUSED while a variance is unexplained — that
  refusal is the feature, and the way past it is accepting the difference with a
  written reason recorded against a person.
- **`match.ok` is `boolean | null`.** A carriage-only bill tied to no order has not
  PASSED the check; the check never ran. A rogue line on a bill that IS tied to an
  order still gets checked and flagged.
- **This is not bookkeeping and never becomes one** (docs/148 §1). The bill exists
  so the match can exist. And docs/148's locked decision #2 holds: a supplier bill
  for stock never becomes an expense-ledger row — the value went into inventory on
  receipt and becomes cost when the goods sell.

**Where it runs.** The scorecard sweep and the late-order sweep are the last two
stages of the existing nightly planning pass rather than a CronJob of their own:
both are nightly, per-tenant, inventory-wide passes over the same tables, and a
second scheduler would be another thing to keep alive for no gain. They are last
so a failure in either cannot cost a business its stock numbers.

**Outstanding, stated rather than hidden:**

- **An approval rule routes to a ROLE, not to a named person, in the UI.** The
  schema and the service both carry `requiredApproverUserId` and enforce it, but
  the form has no user picker until the team screens land — so today a rule says
  "any administrator" rather than "Sam".
- **ASN ingestion is manual only.** The `source` column distinguishes
  `manual | file | api` and the API accepts all three, but nothing parses an
  EDI 856 or exposes a supplier-facing endpoint yet. A buyer types the notice in
  from an email, which is still the difference between a visible discrepancy and
  an invisible one.
- **A bill's lines cannot be edited after entry** — a mis-keyed invoice is
  cancelled and re-entered. That is deliberate for now (a bill is somebody else's
  document) but it will annoy anyone who fat-fingers a quantity.
- **`priceVarianceCents` is summed across a supplier's own currency only**, and the
  scorecard reports one figure. A tenant buying from one supplier in two
  currencies gets a variance covering the same-currency half, with the sample
  count saying so.

### Phase 9 — Demand-side commitments ✅

- [x] **9.1** `Backorder` — a queued customer commitment for stock that does not exist yet, with position and promised date **[P13] DB**
- [x] **9.2** Allocate-on-receipt — a receipt fills open backorders in queue order, atomically, and notifies **[P13]**
- [x] **9.3** Backorder surface + the customer-facing promised-date on the storefront and B2B portal **[P13] UI**
- [x] **9.4** Preorder windows (sell before stock exists, with a stated availability date) **[P13]**
- [x] **9.5** Stock ownership axis — `owned` | `consignment` | `customer_owned` | `3pl_owned`, excluded from valuation but present in availability **[P14] DB**
- [x] **9.6** Consignment settlement — report and bill what sold from consigned stock **[P14]**
- [x] **9.7** Returns disposition workflow: inspect → restock / quarantine / repair / scrap, each a distinct ledger reason routing to the right bin **[P19]**
- [x] **9.8** FEFO enforcement + expiring-stock report (30/60/90-day horizons) with a markdown/write-off action **[P18]**

#### What Phase 9 actually built

One new schema file (`61-inventory-demand.prisma`), two migrations
(`20270307000000_inventory_demand_commitments`, `20270308000000_lot_expiry_alert`),
seven services, two API route modules, six workbench surfaces, a panel on the
return pane, and a change to what a shopper is told on a product page.

**The organising rule, and it is the phase's whole personality.** Phase 7 shipped
a classification defaulted to "erratic"; Phase 8 answered with "a metric nobody
could measure is NULL, with its sample count beside it". Phase 9's version is
about DATES, and it is the sharpest yet because its outputs are read by
CUSTOMERS: **a promised date is null until something actually promised it, and
the row records which.** `resolvePromisedDate` consults exactly three things — a
real purchase order's expected arrival, a MEASURED supplier lead time, and a
person typing one. It deliberately does NOT consult the platform's 14-day
`DEFAULT_LEAD_TIME_DAYS` or a supplier's stated catalogue figure: both are fine
for deciding when to reorder, and neither is a commitment anybody made about this
order. A `CHECK` pins `promised_at` and `promise_source` together so the pair
cannot come apart.

**A backorder is a record, never a second hold.** The hold that matters already
exists — `reserveOnTx` has pushed `allocated` past `on_hand` — so this module
writes no movement and touches no level. It is written at exactly one place, the
sell path's commit, measured from the sale movement's own resulting balance, and
skipped when that movement deduplicates (which is the retry guard, free). The
honest consequence is stated in the service header rather than papered over:
allocation is not a physical earmark, and a walk-in can still take the units.
What the queue guarantees is that the decision about who is covered is made by
arrival order and written down, instead of made at the receiving desk and
forgotten.

**Queue position is derived, never stored.** `ROW_NUMBER() OVER (ORDER BY
priority DESC, created_at ASC)` at read time — always contiguous, never
developing a hole when somebody cancels. `priority` IS stored, because bumping a
customer up the queue is a real decision about a relationship.

**Filling is strict queue order, not pro-rata.** Fifteen units across three
customers who each want ten produces one shipped customer and one partial, not
three who cannot be shipped. It runs inside the arrival's own transaction with
the queue locked, so two deliveries landing at once cannot promise the same units
twice — and it is wired into goods receipts AND transfer receipts, because a
branch moving stock in from the main warehouse is how a backorder usually clears
for a business with more than one location.

**Preorders became an offer.** `inventoryPolicy = 'preorder'` had been a pure
synonym for `continue` since the first commerce migration: sell it, let on-hand
go negative, say nothing. A window is now deliberate (dates), bounded (a cap,
enforced at reserve where the customer can still be told no, counted at commit
under a row lock) and dated — with `available_at` NULLABLE, which was the hardest
call in the phase. A maker who has not committed to a date is ordinary; a
merchant forced to fill the field types something, and that something reaches the
product page as a commitment. A partial unique index allows one live window per
variant, because two live windows means two dates promised for one product and
the way that happens is two people in two tabs.

**The ownership axis changes exactly one thing.** `owned | consignment |
customer_owned | 3pl_owned` on the level; valuation counts only `owned`, and
availability counts everything. That asymmetry IS the feature — consigned stock
is somebody else's asset and entirely sellable, which is the whole reason to hold
it — and the screen says so out loud, because the first instinct is to expect it
to vanish from the storefront. Ownership is STAMPED on every movement rather than
joined at read time: buying a consignment out must not retroactively rewrite what
was owed last quarter.

**Settlement is a closed period, not a running total.** Half-open
`[start, end)`, one named counterparty, immutable once closed — a late correction
is the next period's line. Lines are grouped by (variant, location, agreed cost)
and never blended into a weighted average, because a supplier checks a settlement
against their own paperwork and a blended cost matches nothing they hold. Sales
with no recorded cost are counted separately and BLOCK closing: valuing them at
zero would pay the owner short while saying "they gave it to us".

**Returns disposition replaced a boolean that could not carry the job.**
`restockable` was the whole decision, and its `false` branch covered four
different piles with four different futures — a pump needing a seal, a jacket
needing cleaning, a batch awaiting a supplier's verdict, and genuine scrap. Now:
restock, quarantine, repair, scrap — NULL until somebody decides, because there
is no safe default in either direction (restock puts damaged goods back on the
shelf; scrap throws away stock that was fine). `scrap` writes NO movement at all,
deliberately: the cost was relieved as COGS when the item sold, so adding it back
to write it off would post two cancelling entries, churn the moving average, and
file a customer return under shrinkage. The legacy boolean is kept and kept in
step, and the two paths that can restock share ONE idempotency key so they cannot
both move the same units.

**Unsellable shelves became real, and this was the load-bearing fix behind 9.7.**
Before it, routing a return to quarantine moved it on a screen and left it on
sale: `on_hand` counts the whole location and availability subtracted only
`allocated`. `inventory_levels.unsellable_on_hand` is now maintained by
`applyBinMovement` — the single writer of bin levels — and netted out by the ONE
definition of sellable in `low-stock.ts`, plus every inline copy that had drifted
from it: the storefront, sparx.market, external sales channels, bundles,
assemblies, recipes, B2B fleet holds and the provenance drawer. A `repair` shelf
joins the provisioned system bins, distinct from `damaged` because the two piles
have opposite futures and a refurbisher whose repair queue reads as shrinkage is
being told its best margin is a loss.

**FEFO was shipping the worst possible lot.** `resolveFefoLot` ordered by
`expires_at ASC` and excluded recalled batches — but not EXPIRED ones. Sorting by
nearest expiry puts the MOST expired batch first, so a location holding one
out-of-date box shipped it to every customer until it ran out. That is the
precise failure FEFO exists to prevent, and it took until this phase to notice.
The expiring-stock report cuts at 30/60/90 because those map onto what a person
can actually do (markdown, promotion, purchasing decision), keeps `undated` as
its own bucket rather than folding it into the safe end, and shows no money at
all for a lot nothing has costed rather than a zero that would sort a real
exposure to the bottom of a list ordered by value.

**Two guard bugs the phase exposed, both in the ledger.** `applyMovement` and
`applyBinMovement` refused any movement whose RESULT was negative rather than one
that CAUSED it — so a level driven to −12 by a permitted oversell could not then
be received into, because +8 still leaves −4. That is exactly the sequence
backorders exist to serve, and it failed the delivery. Both now also test
`delta < 0`; an inbound movement can never make the position worse.

**Where it runs.** Three more stages on the end of the nightly planning pass —
`backorder_promises`, `preorder_windows`, `expiring_lots` — for the same reason
Phase 8's two are there: one pass over the catalogue, and one place to look when
it did not run. Promises run first, because a purchase order raised today is
exactly what turns "no date" into a date, and a buyer opening the queue in the
morning should find last night's answer rather than yesterday's.

**Outstanding, stated rather than hidden:**

- **The B2B portal shows the promise through the storefront, because
  `apps/b2b-portal` is still an empty placeholder.** A signed-in B2B customer
  reads the same PDP payload (`preorder`, `expectedBackAt`) with their own
  contract price beside it, so the commitment is visible to them today — but
  there is no separate portal surface for it, and 9.3's wording implies one.
- **Backorder notification is manual.** `markBackorderNotified` records that a
  customer was told, and `shouldRenotify` detects a slip worth a second email,
  but nothing SENDS it — no `email.send` template is wired, so somebody presses
  the button after picking up the phone.
- **Consignment settlement cannot separate two owners at one location**, because
  the ownership axis is per (variant, warehouse) by design. A tenant consigning
  the same SKU from two suppliers into one warehouse needs a second location; the
  model refuses to guess rather than producing a plausible split.
- **A markdown applies to the VARIANT, not the batch.** Per-batch pricing would
  have to reach the product page and the till, which is a far larger feature than
  the one warranted here. The lot is what identified the problem; the markdown is
  an ordinary price change with a note saying why.
- **`chargeUpFront` drives wording, not payment capture.** The column records the
  merchant's intent and the storefront reads it; actually deferring the charge to
  fulfilment is a payments change, not an inventory one.

### Phase 10 — Reporting, data portability, accounting ✅

- [x] **10.1** Report set completion: dead stock, shrinkage, sell-through, GMROI, fill rate, days-of-cover, stock-out frequency, movement summary by reason, valuation as-of **[P21]**
- [x] **10.2** Saved views + column chooser on the inventory lists **[D5][D11] UI**
- [x] **10.3** Every report exportable to CSV and addressable by API with identical filters **[D5] API**
- [x] **10.4** Scheduled report delivery by email (daily/weekly/monthly), reusing the `email.send` pipeline **[D5]**
- [x] **10.5** Inventory adjustment CSV import (SKU + location + qty + reason), closing the open item in [docs/68 §11](68-wizards-import-export-bulk.md) **[P20]**
- [x] **10.6** Full round-trip: every export re-imports without editing **[P20][D5]**
- [x] **10.7** QuickBooks Online connector — inventory asset + COGS journal entries, bill-from-receipt, item mapping **[P16]**
- [x] **10.8** Xero connector, same contract **[P16]**
- [x] **10.9** Accounting reconciliation report: sparx valuation vs the GL inventory account, with the difference itemized **[P16][D2]**
- [x] **10.10** Receipt → supplier bill inside sparx invoicing for tenants with no external accounting **[C8][D8]**

#### What Phase 10 actually built

**The rule this phase turns on.** Phases 8 and 9 both landed on "never present absence as
measurement". Phase 10 is that rule applied to RATIOS, where it bites hardest, because a
ratio hides its own inputs:

> **A RATIO WHOSE DENOMINATOR NOBODY MEASURED IS NULL, NOT ZERO — AND THE RESULT CARRIES
> HOW MANY ROWS IT HAD TO LEAVE OUT.**

"Fill rate: 100%" reads identically whether four thousand order lines shipped complete or
nothing was ever recorded, and the second is far more common in a young tenant. So every
percentage in this phase is `number | null`, every report carries the count of what it
could NOT measure (`unmeasuredLines`, `uncostedUnits`, `unattributedUnits`,
`unmeasuredMovements`, `inactiveLines`), and every surface renders those counts as a
sentence rather than dropping them. `formatPercent(null)` returns "Not measured", never
"0%".

**The five new reports (10.1).** Pure arithmetic in
[`commerce-schemas/src/reporting.ts`](../packages/commerce-schemas/src/reporting.ts) (57
unit tests), SQL in
[`performance-reports.ts`](../packages/inventory/src/services/performance-reports.ts):

- **Sell-through** — sold ÷ (sold + on hand at the period's close). The denominator is
  deliberately not "what you bought": a business that received nothing this month and sold
  half its shelf has a real sell-through, and dividing by zero receipts would say otherwise.
- **GMROI** — margin per pound of stock held. Revenue is traced to the goods that LEFT
  (each sale movement matched to its order line, pro-rated by units) rather than to orders
  placed. A sale with no order line is COUNTED and credited NO revenue: dropping it
  understates cost of sales, calling its revenue zero reports a loss on stock that sold
  perfectly well, and only counted-but-uncredited is honest.
- **Fill rate**, by line and by unit. A line is short if Phase 9 recorded a backorder
  against it, else if the sale movement's running balance went below zero. Where neither
  exists the line is `measured: false` and leaves the calculation entirely — the second
  path exists because backorders only began in Phase 9, and a fill rate that silently
  started there would show a flawless history for every month before it.
- **Stock-out frequency** — a run at zero is ONE episode however many movements it spans,
  because a SKU out for a fortnight has one problem and not fourteen. Each (variant,
  location) is seeded with its balance immediately BEFORE the window, so a line already out
  when the period opened counts from day one rather than from whenever it next moved.
  Without the seed the worst cases — lines so out of stock that nothing happened to them
  — are the ones the report misses.
- **Movement summary by reason** — the reconciling report, whose parts must add up to the
  ledger exactly. An unknown reason is grouped rather than dropped; a reason nothing costed
  reports a blank, never $0.00.

**One addressable endpoint, not eighteen (10.3).** `GET /v1/inventory/reports/:key`
resolves through a REGISTRY in
[`report-registry.ts`](../packages/inventory/src/services/report-registry.ts) — 19
reports, each knowing how to RUN, how to write itself as CSV, and how to say itself in a
sentence. The API iterates it, the scheduler resolves through it, the workbench picker is
served from it. Without the registry that is three lists of report names kept in step by
memory, and the failure is silent: a report added to the API and forgotten in the schedule
picker simply cannot be scheduled. An integration test runs every report the catalogue
advertises, so "listed but unrunnable" cannot ship.

**One CSV writer and one CSV reader (10.6).** [`inventory/src/csv.ts`](../packages/inventory/src/csv.ts)
holds both directions. 10.6 holds structurally rather than by testing: the round trip works
only if the writer and the reader share a definition of what a CSV is, and two good
implementations will disagree about a quoted comma, a BOM or a trailing blank line within a
month. The details that actually break it are handled once — BOM written and stripped,
CRLF written and either accepted, quoted newlines honoured, blank trailing rows not parsed
as records, headers compared case-insensitively, formula-looking free text neutralised.
`adjustmentTemplate` emits the same columns the parser reads.

**Plan, then apply (10.5).** A bad adjustment import is indistinguishable from theft in the
ledger afterwards: four hundred `manual` movements, all stamped the same second, all
attributed to whoever pressed the button. So `inventory_import_batches` records the
uploaded file, the full per-row plan (errors and all, so a file can be fixed after closing
the tab), and what was actually posted. Every movement carries
`referenceType: 'InventoryImportBatch'`, which is what makes the import listable,
explainable and REVERSIBLE as a unit — the undo writes compensating movements rather than
deleting anything, because the ledger is append-only and an import that can be erased is
one nobody can audit. Apply is idempotent per row (`import:<batch>:<line>`), so a retry
after a network failure resumes rather than doubling. Rows whose stock moved between the
preview and the apply are counted as `driftedRows` and reported.

**Reports that arrive (10.4).** The reports are good and nobody opens them, because opening
them means remembering to log in on a Monday. `inventory_report_schedules` +
`inventory_report_deliveries`, an hourly `inventory-report-delivery` CronJob, and a new
`inventory-report` platform email template. Three decisions worth knowing: `nextRunAt` is
stored but computed by the pure `nextRunAt()`, so the date the screen promises and the date
the sweep fires on cannot disagree; a report with nothing in it is `skipped` rather than
sent, because a weekly "nothing has expired" is how people learn to filter the sender; and
four consecutive failures PAUSE the schedule visibly, with the count on the row, rather
than retrying into a dead mailbox for a year.

This phase also added **attachments to the platform email path**
(`SendableEmail.attachments`, multipart on Mailgun, filenames logged by the console
provider) — a scheduled CSV whose spreadsheet does not arrive is not a delivered report.
Capped at 400 KB before base64, because the payload crosses JetStream and its default
message limit is 1 MB; a larger report says so in the body and links to the screen rather
than producing an event the broker silently refuses.

**Saved views (10.2).** The `saved_views` table and its service have existed since docs/24;
what was missing was a ROUTE, because the shared `ListToolbar` that would have called it
belonged to `apps/dashboard` and went with it. `/v1/saved-views` is now a platform surface
(CRM keeps its own, over its own table, for its object-key vocabulary), and
[`components/saved-views.tsx`](../apps/workbench/components/saved-views.tsx) is the views
menu + column chooser any list can drop into its toolbar. A view stores the QUESTION
(filters, sort, columns) and never the rows, which is what makes "Running low at the
warehouse" mean the same thing in March as it did in January.

**The accounting handoff (10.7–10.10).** Four pieces, and the boundary in
[docs/148 §1](148-finance-spend-and-profitability.md) — no ledger, no double entry, no
chart of accounts — is intact throughout. Nothing here STORES a journal; it TRANSLATES
movements into the shape their ledger expects at the moment of handing them over.

- **The journal**, pure, in
  [`commerce-schemas/src/accounting.ts`](../packages/commerce-schemas/src/accounting.ts).
  Perpetual inventory in four entries: a receipt debits the asset against accrued
  purchases, a sale debits cost of goods, shrinkage debits shrinkage, a correction hits
  adjustments. A transfer between the business's own locations posts NOTHING — the asset
  has not changed and the account has not changed. Netted per counterpart so an accountant
  gets one entry a month with five lines, which also makes it balance by construction
  (every counterpart's other side is Inventory); `imbalanceCents` verifies that rather than
  assuming it.
- **Two live adapters** —
  [`quickbooks.ts`](../packages/finance/src/accounting/providers/quickbooks.ts) and
  [`xero.ts`](../packages/finance/src/accounting/providers/xero.ts): OAuth 2,
  chart-of-accounts import, account balance, and an idempotent journal post. Genuinely
  different underneath, which is why they are two adapters and not one configuration:
  QuickBooks identifies the company file by a realm id that arrives ONLY as a callback
  query parameter and addresses accounts by opaque id; Xero identifies it by a header
  discovered from `/connections` after the exchange, addresses accounts by CODE, posts a
  `ManualJournal` in DRAFT, and rotates its refresh token on every use.
  [`credentials.ts`](../packages/finance/src/accounting/credentials.ts) stores the grant
  AES-256-GCM through the existing provider-secret box and writes back a rotated refresh
  token before returning — failing to do that breaks the NEXT call, hours later, which is
  what makes it hard to diagnose.
- **The send gate.** Nothing posts unless the entry balances, every role it uses is mapped
  to a real account, and the period is outside the tenant's closed months. All three are
  checked before the request leaves — the alternative is discovering an unmapped account
  halfway through writing somebody's books.
- **The reconciliation (10.9).** sparx keeps no ledger, so the inventory account's balance
  is something it must be TOLD — typed off a trial balance or pulled through a connection,
  both landing in `inventory_gl_snapshots` (immutable per account per date). Until it is
  told, `unexplainedCents` is NULL and the screen asks for the figure; a zero difference
  reported against nothing would be the single most dangerous number in the module. The
  itemised lines are the five ordinary timing differences: goods received not invoiced,
  invoiced not received, non-owned stock in the building, units nobody costed (amount NULL
  — the units exist and their value is genuinely unknown), and stock in transit between
  the business's own places.
- **Receipt → bill (10.10).** `draftBillFromReceipt` is a READ. The draft fills in OUR side
  and asks the operator to correct it to THEIRS, because a bill created straight from the
  receipt would match it perfectly by construction — and a three-way match that cannot
  fail is not a check.

**Availability is a deployment fact, not a code fact.** Both adapters are complete; whether
a tenant can press "connect" depends on whether this installation has an OAuth app
registered with the vendor (`SPARX_QBO_CLIENT_ID` / `SPARX_XERO_CLIENT_ID`).
`accountingProviderAvailability()` reports that honestly, so the panel says "not switched
on here, and here is the export that works today" rather than offering a button that dies
at the redirect. **No live OAuth round trip has been exercised** — there is no sandbox app
for this installation yet, and that is the one part of this phase a browser cannot verify.

**Follow-up, 2026-08-13: the round trip had no CLIENT.** The three routes shipped here
(`:id/connect` → `callback` → `:id/disconnect`) were never called by anything — no button,
no landing route, nowhere in `apps`, `services` or `packages`. The flow existed and could
not be started, which is a subtler failure than a missing feature: every artifact said
"built", the availability reporting was honest about the SECRETS, and the gap was the one
thing nobody had written down. It is finished now (docs/148 §6, "The connect flow") — the
popup, the callback landing route that forwards `realmId`, and sign-in state read from a
stored grant rather than from `status`. Fixing it also turned up a **credential leak**:
`GET /v1/finance/accounting` returned the raw row, so both encrypted tokens were served to
every `viewer`. **A type on the client is a claim about the wire, not a filter on it** —
the workbench interface listed nine safe fields while the server sent twenty.

**`IntegrationCategory` deliberately did NOT gain `accounting`.** docs/148 §6 says to add
it with the first adapter; the rule behind that instruction is that a category is added the
day something DISPATCHES through it. These adapters are called directly by the finance and
inventory services rather than through the `@sparx/integrations` registry, so adding the
category would produce exactly the empty panel heading that file warns about.

**Two things this phase deliberately did not do.** Group/pivot on lists (the third clause of
10.2) is not built: a pivot is a report, and nineteen of those are now one endpoint away, so
a second pivoting engine inside a list toolbar would be a worse version of something the
module already has. And the saved-views bar is on the two lists people live in — stock and
movements — rather than all twenty-five: every other inventory list holds its filters in
bespoke component state, and the remaining wiring is mechanical rather than designed.

**One pre-existing bug this phase found.** `patch-semantics.test.ts` — the generic guard
that walks every exported `Update*Input` — caught `UpdateReportScheduleInput` the moment it
was written as `CreateReportScheduleInput.partial()`. `.partial()` makes a field optional
but does NOT strip its `.default()`, so renaming a schedule would have silently reset its
hour, timezone, format, filters and active flag. Written out explicitly instead.

### Phase 11 — Onboarding: beat the spreadsheet ✅

- [x] **11.1** Guided inventory setup wizard: locations → import → mapping → opening balance → alerts. **Instrumented against a 30-minute target.** **[D6] UI**
- [x] **11.2** Spreadsheet import with fuzzy column mapping, unit/format detection, and a saved mapping profile for re-imports **[D6]**
- [x] **11.3** Dry-run diff before apply — "412 matched, 18 new SKUs, 6 conflicts" — with per-row resolution **[D6][D1]**
- [x] **11.4** Opening-balance count as the setup's final step, so day one starts from a posted, auditable count rather than an assumption **[D6][D1]**
- [x] **11.5** Spreadsheet-grade stock grid: inline edit, paste a column, multi-select bulk actions, keyboard navigation **[D6][C3] UI**
- [x] **11.6** Inventory sample data for the existing sample-data surface, so an empty tenant can be explored before committing **[D6]**
- [x] **11.7** Migration recipes for the common incumbents (spreadsheet, accounting-attached inventory, marketplace exports) as import presets **[D6]**
- [x] **11.8** Custom fields on variant/level/supplier/PO, definable in the UI and present in imports, exports, API, and MCP **[D11]**

#### What Phase 11 actually built

**The rule this phase turns on.** Phase 10's was about ratios. This one is about guesses:

> A GUESS MUST NEVER BE INDISTINGUISHABLE FROM A FACT.

Every column match carries a confidence and how it was reached, and a match below
`COLUMN_MATCH_THRESHOLD` (0.62) arrives as `null` rather than as something plausible — because a
mapping screen that comes pre-filled with the wrong column is worse than one that comes blank. The
blank one gets read; the pre-filled one gets clicked through, and four hundred quantities land in
the cost column. The same rule governs the clock: `handsOnMs` and `withinTarget` are `null` until
there is something to measure, so an unmeasured setup never reports as a failed one.

**The thirty minutes is measured, and measured twice.** `summarizeSetup()` (pure, tested) reports
hands-on time — the sum of gaps between step stamps, excluding any gap longer than a sitting — AND
how many sittings it took. One number would have to either count somebody's lunch break against the
target or silently discard it; both are dishonest, so both are shown. Stamps are written by the
server as each step finishes, not by a timer in the browser, because a timer measures how long a tab
was open and the tab people leave open is the one they were not using.

**The wizard reads the world as well as its own record.** A checklist that only knows what it was
told is a checklist that lies. Each step reports what the RECORD says and what is TRUE right now
(four locations, 812 items, an opening count posted), and where they disagree the screen shows both
— "you marked this done, and there are no locations" is the sentence that helps. `noteSetupStep()`
ticks a step from the thing that satisfied it (an applied import, a posted opening count), and
deliberately refuses to CREATE a setup record: a tenant who never opened the wizard has not begun a
guided setup, and inventing one would report a duration for something that never happened.

**Recipes are code, not rows** (11.7). `MIGRATION_RECIPES` ships in the source: five kinds of file
described by what they ARE rather than by whose product made them — a hand-kept spreadsheet, an item
list from accounts software, a marketplace listing report, a till export, and sparx's own stock-take
sheet. A recipe only WIDENS the alias vocabulary; it never forks the import path, so there is one
importer to keep correct rather than five. A unit test pins that widening never removes a standard
alias.

**A resolution acts on the stored plan, not on the file** (11.3). A person can fix six rows over an
afternoon without re-uploading, and the decisions become part of the batch's permanent record.
`create` makes a real catalogue item — as a DRAFT with no price, because a stock file says nothing
about what to sell something for and a zero price on a published item is a giveaway. `skipped` is
its own outcome, kept distinct from `no_change`: "we left it out" and "it was already right" look
identical in a total and mean opposite things.

**An opening count is its own kind of count** (11.4). `InventoryCountType` gained `opening`, seeded
from the CATALOGUE rather than from the levels — on day one there may be no levels at all, which is
exactly the state the count exists to end. Its movements post under a new `opening` reason rather
than `recount`, so a business's first day does not appear in the shrinkage report as its worst day
of losses. That reason also earned a sixth journal role, `opening_balance`: an opening balance is
not a purchase (which would invent a supplier liability) and not a correction (which would make the
business look like it found a warehouse it had lost). Blind by default, and the approval threshold
is set to the column's maximum — an opening count is EXPECTED to differ from what the system holds,
and gating the last step of setup behind an approval from the one person setting it up is absurd.

**The grid sends a target, never a difference** (11.5). What a cell was showing may be a minute old;
the server computes the change against what is live, inside the row lock, exactly as a count does.
So a sale that landed while the grid was open is reconciled rather than quietly undone by a stale
subtraction. Each row saves in its own transaction — forty edits are forty independent facts, and
one bad row taking the other thirty-nine with it is the experience the spreadsheet does not have.
A partial save clears only the rows that saved and leaves the failures on screen with what was
typed.

**Custom fields: definitions in a table, values in a JSON column** (11.8). A value table would make
the stock grid — three hundred rows with their custom columns — a four-way join for a benefit sparx
would never use. Removing a field turns it OFF and leaves the values in place, so a field deleted by
mistake is recoverable by re-creating it under the same key. Nothing writes a value except
`applyCustomFields`, which is what keeps a field's TYPE a promise: the API, the importer, the grid
and the MCP tool all arrive there, so a number field cannot end up holding "n/a" because one of the
four forgot to check. Fields ride the CSV as `cf_<key>` columns the importer reads back, which is
10.6's round trip extended to the tenant's own data.

**Sample data authors FACTS, never MEASUREMENTS** (11.6). `inventory-depth.ts` adds shelves,
barcodes and a recipe — things a business DECIDED, which a demo tenant genuinely has. It
deliberately does NOT fabricate a supplier scorecard, an ABC class, a demand forecast or a reorder
point: those are things sparx CALCULATED from evidence, and inventing one would put a number on
screen that nothing measured — showing a prospective customer exactly the behaviour the platform
promises not to have. Those surfaces stay empty until the nightly sweep runs over the sample POs and
movements, which is what a real tenant sees in week one and is the honest demo. Custom-field
DEFINITIONS are also deliberately absent: they are tenant configuration that would survive a Clear
and appear on every form.

**Four bugs the tests caught, all real.**

1. `parseCsv` lower-cased its headers, so the mapping screen would have shown a person "qty on hand"
   where their file said "Qty On Hand" — sparx appearing to have mangled their file, as the first
   thing they see. `rawHeaders` now travels alongside.
2. A row that failed to match an item recorded no quantity, so resolving it — creating the item —
   applied a change of zero and landed as "already correct". The quantity is now read BEFORE
   anything can fail, so an error row still carries what the file asked for.
3. `audit_logs.entity_id` is a UUID column and a stock position's key is `<variant>:<warehouse>`.
   Writing a custom-field value and saving a grid row both failed on the insert. A level is now
   audited under its variant with the location in the diff.
4. `formatDuration(30_000)` rounded to "1 minute". Under a minute is under a minute; rounding first
   claims a precision the measurement does not have.

**Two things named rather than quietly skipped.** An opening count refuses a catalogue over 10,000
items — a count of twenty thousand lines is not a count, it is a week, and offering it as one step
of a thirty-minute setup would be a promise the product cannot keep; the refusal says to import the
quantities and count the fast movers first. And the grid's keyboard navigation is what the browser
gives a table of inputs (tab, shift-tab, typing over a selection) plus column paste — not a
spreadsheet's arrow-key cell cursor, which needs a focus manager the app does not have and would be
its own piece of work.

**What driving it in a browser found (2026-08-13).** Everything above was green on 700-odd tests and
a clean typecheck, and the first two minutes on the actual screens still turned up four defects the
suite could not see, which is the whole argument for the walk:

1. **The stock grid's item column collapsed to `6a…`, `BE…`, `CO…`.** The cell was `max-w-0` without
   the `w-full` that makes the idiom work, so five inputs claimed their intrinsic width and the one
   column you cannot edit a grid without reading was squeezed to nothing. Fixing that then clipped
   `312` to `3` — a width is a suggestion a crowded table drops — so the figure columns now carry a
   `min-w` floor. **A number that is wrong is worse than a number that is small.**
2. **`GridCell` fused two classes.** `${'text-right tabular-nums'}${'font-medium'}` produced
   `tabular-numsfont-medium`, so a changed cell silently lost both its alignment and its weight.
3. **"It appears on every items straight away."** The workbench keeps its own PLURAL entity labels
   for section headings while the schemas package has singulars, and the plural was being dropped
   into singular sentences. Sentences now have their own nouns — derived from neither, because no
   amount of trimming an "s" turns "Stock at a location" into a usable one.
4. **"Show it as a column in lists" was a silent no-op on three of the four records.** Only `level`
   definitions are read by anything — the grid, the import, the template — so a field added to Items,
   Suppliers or Purchase orders offered a switch, took the click, and produced no column anywhere,
   while the toast promised a `cf_` export column that also did not exist for them. The toggle is now
   offered only where a list honours it, and each record says plainly where its fields DO turn up
   (on the record, over the API, to a connected assistant). **A switch that changes nothing is worse
   than an absent one: the person turns it on, sees nothing, and stops believing the screen.**

Verified end to end afterwards on real tenant data (1,414 items, 2 locations): the wizard's readiness
counts, a grid quantity edit posting a movement behind its confirm, and a custom field defined →
appearing in the grid → edited → persisted through a server reload.

**Two defects found in the walk that are NOT ours to fix here, both reported rather than patched:**

- **`warning` is unreadable in every `soft` variant, platform-wide.** Silica's soft treatment paints
  the ink from the raw registered color (`--alert-accent`, `--badge-accent`, …), which is right for
  `info` `#147ea3` and `success` `#16865a` and wrong for `warning` `#f2b84b` — a fill color, not an
  ink one. Measured: `rgb(242,184,75)` at 0.9 opacity on its own 12% tint, about **1.7:1**, across
  ~181 `color="warning" variant="soft"` call sites. There is no local fix worth having: the fill and
  the soft ink read the same token, and any amber dark enough to be ink (L ≤ 0.175) is a brown that
  lands on `--color-module-staff` `#92400e`, a hue chosen deliberately for being the palette's only
  unused family. So this is silicaui's rule (3) — the soft variant should derive a legible ink the
  way `-content` is already auto-derived by measured contrast; silica even ships `contrastWarnings`
  for exactly this. Not a call-site patch, and not a token change that collides with a module identity.
- **A console error on every toast — PATCHED 2026-08-13.**
  `@base-ui-components/react@1.0.0-rc.0` called `ReactDOM.flushSync` from inside a layout effect in
  `ToastRoot.recalculateHeight`, so React logged "flushSync was called from inside a lifecycle
  method" once per toast per render. `rc.0` is still the newest published version, so this is a
  `pnpm patch` (`patches/@base-ui-components__react@1.0.0-rc.0.patch`): the two layout-effect call
  sites mark themselves and the flush is skipped on them, because a `setState` in a layout effect
  is already re-rendered synchronously before paint. The ResizeObserver and MutationObserver paths
  KEEP the flush — they run after paint, and dropping it there would let the toast stack visibly
  jump. Guarded by `packages/ui/src/components/overlay/toast.test.tsx`, which was proved red against
  the unpatched module before it was accepted green. Delete both when the fix lands upstream.

### Phase 12 — Prove it ✅

- [x] **12.1** MCP tool coverage for everything added in phases 1–11 (bins, pick lists, assemblies, forecasts, scorecards, backorders, reports) **[D10]**
- [x] **12.2** MCP read tools that answer the operator's real questions: `explain_stock_level`, `get_stockout_risk`, `get_supplier_performance`, `get_inventory_health` **[D10]**
- [x] **12.3** Webhooks on every inventory event, tenant-configurable **[D11]**
- [x] **12.4** Inventory API documented in [docs/06](06-api-specification.md) to the same standard as commerce **[P-all]**
- [x] **12.5** Marketing: the inventory module page rebuilt around the §5 claim, following the six-beat story rule **[D-all]**
- [x] **12.6** Comparison content grounded in §1/§2 with dated, accurate figures **[D-all]**
- [x] **12.7** Feature catalog ([docs/89 §9](89-feature-catalog.md)) reconciled — every line in §6 marked live only when it is actually live **[P-all]**

**12.1–12.3 shipped 2026-08-13.** The audit came first, and it mattered: 125 inventory MCP tools
already existed, so the honest question was not "build tools" but "which capability shipped a
service, a REST route and a screen, and still has no way in from an assistant". Thirteen did — every
one of them from phases 8, 9 and 10, which is the tail nobody circles back to.

Twenty tools were added in three files: supplier scorecards, quantity price ladders, the approval
queue, despatch notices and supplier returns (Phase 8); backorders, per-item commitments,
consignment settlements, stock you do not own and expiring batches (Phase 9); the report catalog,
running any report, the schedules and the GL reconciliation (Phase 10). `get_supplier_performance`
was the one tool 12.2 names by hand that did not exist; the other three did.

**All twenty are READ, and that is the finding rather than a shortcut.** Every write left in these
areas points money at somebody else or breaks a promise to them — approving a purchase order,
sending a return, recording a credit, agreeing a price, cancelling a backorder, re-flagging who owns
stock, writing off a batch on the strength of a date, or committing a recurring email to somebody's
inbox. An assistant should be able to say _your worst supplier is late on a third of its orders_
without being able to place the next order with them. The exclusions are asserted in the test, so
adding one later means deleting a line that says why it was absent.

**The registry guard found two real problems on its first run**
([packages/inventory/test/mcp-registry.test.ts](../packages/inventory/test/mcp-registry.test.ts)):

1. **Thirteen write tools had descriptions under sixty characters**, several of them ambiguous in a
   way that costs data: "Cancel a purchase order" against "Delete a draft purchase order" gives a
   model nothing to choose between, and one of the two is irreversible. All thirteen were rewritten
   to say what state is required, what happens to stock and money, and whether it can be undone.
2. **Five write tools did not prompt.** These turned out to be right — the scanner tools stage into
   a session that `post_scanned_receipt` commits, and that one does prompt — but the decision lived
   nowhere. It is now stated in `scan-tools.ts` and asserted as a named exemption, so a future
   `scan_to_write_off` cannot inherit it from its prefix.

**12.3 was not missing plumbing — it was a closed door.** `publish()` in api-core already fans every
event to matching subscriptions, and `WebhookSubscription` is already tenant-configurable with an
HMAC secret and a retry queue. The block was an allow-list of ten content/media/redirect keys in the
subscriptions route: all 26 inventory events were deliverable and none was subscribable. Twenty-five
are now, grouped in the picker as Stock, Warehouse, Supply and Stock feeds, each described in the
words a business owner would use.

**The twenty-sixth is `inventory.levels.updated`, and it is deliberately absent.** It is declared in
`@sparx/events` and published by nothing. It is also the single most tempting key on the list — the
one an ERP integrator reaches for first — and subscribing to it would leave an endpoint silent
forever while the box sat ticked, which reads to whoever set it up as their own server being broken.
That is the same rule as everywhere else in this plan: **absence must never be presented as a
measurement**, and a subscription that can never fire is exactly that.

Because the three lists that decide this (the API allow-list, the picker's catalogue, the event
registry) sit in three packages and cannot import one another,
[scripts/check-webhook-events.mjs](../scripts/check-webhook-events.mjs) fails the build on any
disagreement — wired into `pnpm check:webhooks`, the pre-push guard and CI, matching the three
structural checks already there.

**Verified end to end in the browser.** All four new groups render with their plain-language
labels, and a subscription saved against three inventory events — stock running low, numbers
stopped adding up, shelf came up short — lists as Active with those labels rather than raw keys.
That last step is the one that matters: it proves the API's allow-list actually accepts the new
keys, which is the exact thing that was closed before.

**12.4 and 12.7 shipped 2026-08-13.**

**12.4 — the number was the finding.** docs/06 documented **18** inventory endpoints; the module
registers **337** across 38 route files. Everything documented was Phase 1; phases 2–11 added roughly
240 endpoints and not one of them was written down. Transcribing that by hand produces a document
that is wrong inside a week, so the reference is **generated** —
[scripts/gen-inventory-api-reference.mjs](../scripts/gen-inventory-api-reference.mjs) reads the
routes and emits [docs/150](150-inventory-api-reference.md), with the group headings and prose held
in the generator (a new route file with no description is a hard error, because what a capability is
FOR cannot be derived from code). `check-inventory-api-docs.mjs` fails the build on any drift, in
either direction: an undocumented endpoint is an invisible feature, and a documented one that no
longer exists sends somebody to build against a 404 and blame their own code.

It lives beside docs/06 rather than inside it because 337 endpoints would have made inventory
roughly half the platform API spec and buried every other module. docs/06 §7 keeps the
contract-stable core, the integrity surface and a table describing all twenty groups, and points at
the full listing.

**12.7 — the catalog was stale in both directions.** docs/89 §9 still said "the full six-phase build
is shipped" and listed nothing from phases 2–11; its MCP line named six tools when there are 145.
Twelve capability lines were added, the module-map headline rewritten, and the MCP line corrected —
including which writes are deliberately absent, since "we chose not to expose approving spend" is a
different claim from "we have not built it".

The worse half was downstream. docs/89 says the marketing site's `apps/web/lib/capabilities.ts` is
derived from it, and inventory there was eight Phase-0 bullets carrying
**`planned('Sync with your warehouse system')`** — a capability live since the first build,
advertised to every prospect as unbuilt. Now 29 lines, all accurate. **A wrong "live" is a broken
promise and a wrong "planned" is a lost sale**, and only one of those two failure modes gets noticed
on its own.

**12.5 and 12.6 shipped 2026-08-13.**

**12.5 — the page did not exist.** The brief said "rebuilt", which assumed there was something to
rebuild; there wasn't. Inventory was one of three billable modules with no marketing page at all
(`ModulePageSlug` in [apps/web/lib/modules.ts](../apps/web/lib/modules.ts) named twelve slugs and
excluded it), so the deepest module on the platform — twelve phases, 337 endpoints, 145 MCP tools —
was represented to the public by a one-line tile in the pricing switchboard with no link on it.

[/inventory](../apps/web/components/marketing/inventory-page.tsx) is now the site's thirteenth
module page, built on the six-beat story rule with the §5 claim as its spine:

| Beat           | The page                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Promise      | One item's quantity taken apart into the five things that produced it. `120 + 240 − 312 + 9 − 6 = 51`, less 10 held, is 41 free to sell                                 |
| 2 Recognition  | You don't distrust the number — you just walk to the shelf before promising. Then the survey: that is 85% of the market, not carelessness                               |
| 3 False fix    | You buy a stock system. It syncs every four minutes, it is right most of the time, and on the morning the shelf says 33 it cannot say which of the two numbers is lying |
| 4 **The turn** | On hand is not a number we keep, it is a sum we can always do again — the one section painted in the module's own hue                                                   |
| 5 Consequences | Shows its working → checks itself overnight → walks the floor with you → tells you what to buy → answers questions                                                      |
| 6 Resolution   | Off the spreadsheet by the end of the afternoon, and everyone can use it — closing beat 2 rather than beat 3                                                            |

Three things are worth recording because they were decisions rather than defaults.

**The escalation in beat 5 is load-bearing, and it is why the page is not a feature grid.** Each
section is only possible because of the one before it: you cannot direct a picker to a shelf unless
the system knows what is on that shelf, you cannot advise a purchase unless the demand history is
trustworthy, and nothing should be reading any of it through an assistant until both are true. A
menu of the same five capabilities says none of that — and Inventory, at twenty-five surfaces, is
the module where the menu was the obvious thing to write.

**One worked example runs through every device**: a coffee roastery, one item, and figures that
reconcile across the hero, the movement ledger, the false-fix dashboard and the reorder table. A
page whose argument is "you can add this up yourself" and whose own columns do not add up is arguing
against itself.

**The short pick is on the page on purpose.** The ledger excerpt shows a movement that goes UP
because a picker could not find a bag — the Phase 4 rule that a unit nobody could find was never
picked, so the sale that removed it has not happened. It costs two lines, and it is the best
available proof that this is a real warehouse ledger rather than a mock-up.

**12.6 — the honest group is the deliverable.** The comparison is two sections on the same page.
The first is the §2.1 survey: six figures, each chosen because it maps onto a section the page then
argues, carrying a citation, the sample size and the date it was checked — a page insisting you
should be able to verify a number cannot then assert six of its own. The second is §1's converged
capability bar, answered row by row.

**Seventeen rows say yes and four say no, and the four are the point.** No general ledger (and never
one); the QuickBooks/Xero connection is written but not switched on for this installation; advance
ship notices are entered or uploaded rather than received over EDI; and there is no production
scheduler behind the recipes and build runs. A page where every row is a yes has told a buyer
nothing, and the fastest test of whether a product is honest about what it does is whether it will
say what it doesn't.

**No competitor is named anywhere in the shipped artifact** — the category's convergence is
described in our own language. The single external reference is to the published survey, which is a
citation rather than a competitive callout.

**And 12.6 found a wrong "live" that 12.7 had introduced the day before.**
`apps/web/lib/capabilities.ts` carried `live('Books that reconcile — QuickBooks & Xero')`. Both
adapters are complete, but a direct connection needs an OAuth app registered with each vendor, and
`SPARX_QBO_CLIENT_ID` / `SPARX_XERO_CLIENT_ID` are unset in every deploy target — so
`accountingProviderAvailability()` returns `coming_soon` and the product deliberately offers the
export instead. The marketing site was promising a button the app declines to show. It is now
`live('Journals & a reconciliation that explains itself')` +
`building('Direct sync — QuickBooks & Xero')`, and [docs/89 §9](89-feature-catalog.md) records the
deployment condition rather than the code fact. Writing the "four things this isn't" group is what
found it, which is the argument for having one.

**Verified in the browser**: the page renders end to end, the module menu and footer both link it
(both derive from `modules-catalog.ts`, so the single `href` wires all of them), the story OG card
renders with the `inventory` clause in the owner's voice, and `/features` picks up the corrected
counts. `MODULE_ORDER` carries the sitemap, `llms.txt` and `llms-full.txt` for free.

---

## 7. Data model additions

New tables, grouped by the schema file they belong in. All tenant-scoped, all RLS-protected, all
prefixed `inventory_*`. Migration names must sort **after** the newest existing migration
([packages/db/CLAUDE.md](../packages/db/CLAUDE.md)).

| Schema file (new)                   | Models                                                                                                                            | Phase |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `42-inventory-bins.prisma`          | `InventoryBin`, `InventoryBinLevel`                                                                                               | 2     |
| `43-inventory-barcodes.prisma`      | `VariantBarcode`                                                                                                                  | 3     |
| `44-inventory-picking.prisma`       | `PickList`, `PickListLine`, `PackVerification`                                                                                    | 4     |
| `56-inventory-costing.prisma` ✅    | `InventoryCostLayer`, `InventoryCostConsumption`, `PurchaseOrderCharge`, `GoodsReceiptCharge`, `CostingPolicy`                    | 5     |
| `46-inventory-uom.prisma`           | `UnitOfMeasure`, `VariantUomConversion`                                                                                           | 6     |
| `47-inventory-assembly.prisma`      | `BillOfMaterials`, `BomComponent`, `AssemblyOrder`, `AssemblyOrderLine`                                                           | 6     |
| `59-inventory-planning.prisma` ✅   | `DemandVelocity`, `InventoryClassification`, `ReorderPolicy`, `SupplierLeadTime`, `CycleCountSchedule`, `InventoryPlanningPolicy` | 7     |
| `49-inventory-supplier-perf.prisma` | `SupplierScorecard`, `SupplierPriceBreak`, `PurchaseOrderApproval`, `AdvanceShipNotice`, `SupplierReturn`                         | 8     |
| `50-inventory-demand.prisma`        | `Backorder`, `BackorderAllocation`                                                                                                | 9     |
| `51-inventory-integrity.prisma`     | `ReconciliationRun`, `OversellIncident`                                                                                           | 1     |

Column additions to existing tables:

| Table                                                                                                                                 | Columns                                                                                                            | Phase   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------- |
| `inventory_movements`                                                                                                                 | `bin_id`, `from_bin_id`, `to_bin_id`, `cost_consumed_cents`                                                        | 2, 5    |
| `inventory_levels`                                                                                                                    | `abc_class`, `xyz_class`, `forecast_daily_demand`, `dynamic_reorder_point`, `planning_computed_at`, `ownership`    | 7, 9    |
| `inventory_counts`                                                                                                                    | `schedule_id` (SET NULL — deleting the standing instruction must never delete the evidence that counting happened) | 7       |
| `inventory_warehouses`                                                                                                                | `allocation_strategy`, `uses_bins`                                                                                 | 2, 4    |
| `inventory_sources`                                                                                                                   | `expected_interval_sec`, `staleness_policy`                                                                        | 1       |
| `inventory_suppliers`                                                                                                                 | `on_time_rate`, `fill_rate`, `measured_lead_time_days`, `scorecard_updated_at`                                     | 8       |
| `inventory_purchase_orders`                                                                                                           | `approval_status`, `approved_by`, `approved_at`, `fx_rate`, `base_currency_total_cents`                            | 5, 8    |
| `inventory_goods_receipt_lines`                                                                                                       | `allocated_charge_cents`, `base_unit_cost_cents`, `landed_unit_cost_cents`, `bin_id`                               | 2, 5    |
| `inventory_goods_receipts`                                                                                                            | `currency`, `base_currency`, `fx_rate`                                                                             | 5       |
| `commerce_product_variants`                                                                                                           | `default_bin_id`, `stocking_uom_id`, `costing_method`                                                              | 2, 5, 6 |
| `inventory_purchase_order_lines`, `inventory_goods_receipt_lines`, `inventory_count_lines`, `inventory_transfer_lines`, `order_items` | `uom_code`, `units_per_uom`                                                                                        | 6       |

**Non-negotiable:** none of these introduce a second writer to `on_hand`. Bin levels, cost layers,
and backorder allocations are all written inside the same transaction as their `applyMovement()` call.

---

## 8. API and MCP surface

**REST** — new route modules under `services/api-rest/src/routes/v1/inventory/`:

`bins.ts` · `barcodes.ts` · `labels.ts` · `picking.ts` · `assemblies.ts` · `boms.ts` ·
`planning.ts` · `classifications.ts` · `schedules.ts` · `supplier-performance.ts` · `approvals.ts` ·
`asn.ts` · `backorders.ts` · `costing.ts` · `uom.ts` · `integrity.ts` · `demand.ts` ·
`reporting.ts` · `accounting.ts`

Phase 10 added ONE report endpoint rather than one per report: `GET /v1/inventory/reports/:key`
resolves through the registry in `@sparx/inventory`, so the API's coverage IS the registry's
coverage permanently. The four named report URLs that shipped before it (`/reports/valuation`,
`/reports/turnover`, `/reports/aging`, `/reports/reorder-analysis`, `/reports/shrinkage`) keep
their own handlers — breaking a published URL to tidy a file is not a trade worth making.

`/v1/saved-views` is PLATFORM-level rather than an inventory route: `target` is just a list
identity, so nothing about it is inventory-specific and a second copy the first time another
module asked would be the whole problem.

Every one module-gated on `inventory`, scope-enforced, and standalone-safe (no commerce dependency).

**MCP** — the module's registry grows from ~48 to ~110 tools. The read tools that matter most for
D10 are the explanatory ones: `explain_stock_level`, `get_stockout_risk`, `get_supplier_performance`,
`get_inventory_health`, `get_buildable_quantity`, `get_landed_cost_breakdown`.

**Events** — additions to the `EventType` union (topic name == event type):

`inventory.reconciliation.drift` · `inventory.oversell.blocked` · `inventory.source.stale` ·
`inventory.bin.moved` · `inventory.pick.completed` · `inventory.pack.verified` ·
`inventory.assembly.completed` · `inventory.backorder.created` · `inventory.backorder.allocated` ·
`inventory.purchase_order.late` · `inventory.purchase_order.approval_requested` ·
`inventory.classification.changed` · `inventory.lot.expiring`

---

## 9. Workbench surfaces

Existing: 21. New: 25 — **21 shipped** (provenance, integrity, shelves list + detail, shelf labels,
warehouse mode, product labels, walks list + detail, guided pick, pack bench, throughput, cost vs
plan, how stock is valued, units, recipes list + editor, runs list + detail, planning, why this
number, counting schedules list + editor). The existing reorder worklist was rebuilt in place
rather than replaced — same surface, ordered by money and carrying its own reasoning.

| Surface                  | Phase | Notes                                                                                          |
| ------------------------ | ----- | ---------------------------------------------------------------------------------------------- |
| Provenance drawer        | 1     | ✅ shipped as a PANE, opened beside the number it explains                                     |
| Integrity                | 1     | ✅ shipped — verdict, drifts, oversell log, feed freshness                                     |
| Bins list / detail       | 2     | ✅ shipped — plus a printable label sheet (three sizes, QR)                                    |
| Warehouse mode           | 3     | ✅ shipped — six jobs, phone-first                                                             |
| Labels                   | 3     | ✅ shipped — product labels + the document sticker                                             |
| Pick lists list / detail | 4     | ✅ shipped as "Walks" — two surfaces plus the guided pick                                      |
| Pack station             | 4     | ✅ shipped — scan-to-verify, one fulfillment per box                                           |
| Cost vs plan             | 5     | ✅ shipped — planned against actual landed, per item and supplier                              |
| How stock is valued      | 5     | ✅ shipped — the costing method, base currency, default charge spread                          |
| Recipes list / editor    | 6     | ✅ shipped as "Recipes" — the editor carries buildable quantity                                |
| Runs list / detail       | 6     | ✅ shipped as "Runs" — plan, hold the parts, mark it made                                      |
| Units                    | 6     | ✅ shipped — the vocabulary; what a case CONTAINS is per item                                  |
| Planning                 | 7     | ✅ shipped — five tabs: at risk · what matters · not selling · cost to keep · settings         |
| Why this number          | 7     | ✅ shipped as a pane — every input, its confidence, and the formulas with your numbers in them |
| Count schedules          | 7     | ✅ shipped — list + editor; "count now" on a row                                               |
| Supplier scorecards      | 8     | ✅ shipped — league table; the per-supplier panel lives on supplier detail                     |
| PO approvals             | 8     | ✅ shipped — approval queue, rules, and the late-order list                                    |
| Backorders               | 9     | ✅ shipped as "Waiting list" — plus preorders, whose stock, consignment and expiring stock     |
| Performance reports      | 10    | ✅ shipped as "How it is performing" — sell-through, GMROI, fill rate, stock-outs, movements   |
| Scheduled reports        | 10    | ✅ shipped as "Sent to your inbox" — list + the create/edit pane with its delivery history     |
| Stock import             | 10    | ✅ shipped — download what you have, count, upload; plan then apply, and undo as a unit        |
| Stock versus your books  | 10    | ✅ shipped — the itemised reconciliation, and where the ledger balance is entered              |
| Receipt → supplier bill  | 10    | ✅ shipped as a panel on the delivery, below the landed cost                                   |
| Import wizard            | 11    | Mapping + fuzzy column detection, on top of the Phase 10 importer                              |

**Design constraints** (binding — [DESIGN.md](../DESIGN.md), [apps/workbench/CLAUDE.md](../apps/workbench/CLAUDE.md)):
inventory is amber `--color-module-inventory`; cross-module panels wear the other module's hue via a
nested `<ModuleProvider>` (a supplier panel is CRM cyan, a COGS panel is finance's hue); status is
`<Badge color={statusTone(s)}>`; warehouse mode must satisfy the responsive top-2 rule on a phone;
silicaui components only, no inline `style`, no eyebrows, no gradients or shadows.

---

## 10. Report inventory (the full set when done)

| Report                      | Status today | Phase |
| --------------------------- | ------------ | ----- |
| Valuation (current)         | ✅ live      | —     |
| Valuation (as of a date)    | ✅ shipped   | 5     |
| Turnover                    | ✅ live      | —     |
| Aging                       | ✅ live      | —     |
| Reorder analysis            | ✅ live      | —     |
| Low stock                   | ✅ live      | —     |
| Shrinkage                   | ✅ shipped   | 1     |
| Reconciliation / drift      | ✅ shipped   | 1     |
| Oversell incidents          | ✅ shipped   | 1     |
| Pick/pack throughput        | ✅ shipped   | 4     |
| Purchase price variance     | ✅ shipped   | 5     |
| Landed cost breakdown       | ✅ shipped   | 5     |
| Stockout risk (money)       | ✅ shipped   | 7     |
| Measured supplier lead time | ✅ shipped   | 7     |
| Dead stock / slow movers    | ✅ shipped   | 7     |
| Days of cover               | ✅ shipped   | 7     |
| Holding cost                | ✅ shipped   | 7     |
| ABC / XYZ distribution      | ✅ shipped   | 7     |
| Supplier scorecard          | ✅ shipped   | 8     |
| Expiring stock              | ✅ shipped   | 9     |
| Sell-through                | ✅ shipped   | 10    |
| GMROI                       | ✅ shipped   | 10    |
| Fill rate                   | ✅ shipped   | 10    |
| Stockout frequency          | ✅ shipped   | 10    |
| Movement summary by reason  | ✅ shipped   | 10    |
| GL reconciliation           | ✅ shipped   | 10    |

---

## 11. Non-goals

Stated so they don't creep in:

- **Full MRP / production scheduling.** Phase 6 delivers BOM + assembly orders. Capacity planning,
  routings, work centres, and shop-floor scheduling are a different product.
- **Full outbound EDI (850/810/856 as a trading network).** Phase 8 delivers ASN-lite (file/API).
  A certified EDI VAN is a partner integration, not core.
- **RFID.** No evidence of demand in our segment; the requirements research lists it among the
  features that underdeliver.
- **A native mobile app.** Warehouse mode is a responsive web surface. Revisit only if scanner
  hardware integration demands it.
- **Platform-run AI.** Forecasting is deterministic statistics we compute; anything LLM-shaped is
  MCP (tenant's own client) or BYOK. Non-negotiable.
- **Any second writer to `on_hand`.** Ever.

---

## 12. Ship gate

A phase is done when **all** of the following hold — not when the headline feature works:

1. Every checkbox in the phase is ticked, including the unglamorous ones.
2. It works **standalone** — verified on a tenant with `inventory` on and `commerce` off.
3. It works **with commerce, B2B, and dropship on**, and degrades cleanly when inventory is off.
4. Ledger invariant intact: `onHand == Σ(movements.delta)` verified by the Phase 1 reconciliation job.
5. REST endpoint + MCP tool + workbench surface all exist for the capability (API-first: the endpoint
   comes first, the UI is one consumer).
6. Tests: unit for the math, integration for the DB path, and a real click-through of the surface as
   a business owner would use it — not a `fetch()` against the endpoint.
7. Docs updated: this file's checkboxes, [docs/89](89-feature-catalog.md), and
   [docs/06](06-api-specification.md) where the API changed.
8. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` green.

---

## 13. Sources

- [inFlow — State of Inventory Management 2026 (400 operators surveyed)](https://www.inflowinventory.com/blog/state-of-inventory-management-2026/)
- [The Retail Exec — Inventory Management Software Requirements Checklist](https://theretailexec.com/logistics/inventory-management-requirements/)
- [Fortune Business Insights — Inventory Management Software Market](https://www.fortunebusinessinsights.com/inventory-management-software-market-108589)
- [ERP Software Blog — 10 Top Inventory Management Software in 2026](https://erpsoftwareblog.com/2025/12/top-inventory-management-software/)
- [Cin7 Core — WMS documentation](https://help.core.cin7.com/hc/en-us/articles/9034461577487-Introduction-to-Warehouse-Management-System-WMS)
- [G2 — Cin7 Omni vs Fishbowl Inventory](https://www.g2.com/compare/cin7-omni-vs-fishbowl-inventory)
- [SelectHub — NetSuite Inventory Management reviews 2026](https://www.selecthub.com/p/inventory-management-software/netsuite-inventory-management/)
- [GSI — NetSuite pros and cons, a practitioner's assessment 2026](https://www.getgsi.com/blog/netsuite-pros-and-cons)
- [Gestisoft — Fishbowl Inventory alternatives 2026](https://www.gestisoft.com/en/blog/fishbowl-inventory-alternatives)
- [TechRepublic — Best Inventory Management Software 2026](https://www.techrepublic.com/article/best-inventory-management-software/)
- [Capterra — Inventory Management Software category](https://www.capterra.com/inventory-management-software/)
- [Shopify App Store — inventory sync app reviews](https://apps.shopify.com/reviews/1621700)

**Related internal docs:** [docs/99](99-inventory-implementation-audit.md) (the audit that drove the
current build) · [docs/100](100-inventory-build-plan.md) (the six-phase build, complete) ·
[docs/28](28-inventory-sync-integration.md) (external sync tiers) ·
[docs/68](68-wizards-import-export-bulk.md) (import/export, §11 open items) ·
[docs/89](89-feature-catalog.md) (feature catalog) · [docs/106](106-channel-marketplace-strategy.md)
(channel stock push).
