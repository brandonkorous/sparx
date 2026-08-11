# sparx Platform — Inventory: Market Parity & Gap Closure Plan

**Version:** 1.3
**Author:** Brandon Korous
**Last Updated:** 2026-08-10

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

### Phase 4 — Pick, pack, ship ⬜

- [ ] **4.1** `PickList` + `PickListLine` — generated from orders (single, batch, or wave), assigned to a picker, bin-sequenced **[P3] DB**
- [ ] **4.2** Allocation strategy per warehouse: FIFO / FEFO / nearest-bin / single-bin-preferred **[P3][P18]**
- [ ] **4.3** Guided pick surface — next bin, item, quantity; scan-to-verify; short-pick with a reason that routes to a count **[P3] UI**
- [ ] **4.4** Pack verification — scan every item into a package; mismatch blocks; capture package dimensions/weight **[P3] UI**
- [ ] **4.5** Packing slip document, matching the PO document's build path **[P3]**
- [ ] **4.6** Pack → `OrderFulfillment` + label purchase handoff (existing shipping providers), so picking flows into the shipping we already have **[P3]**
- [ ] **4.7** Pick/pack throughput report — units per hour, accuracy rate, short-pick rate by picker and by bin **[P3][P21]**

### Phase 5 — True cost ⬜

- [ ] **5.1** `PurchaseOrderCharge` / `GoodsReceiptCharge` — freight, duty, insurance, broker, other; per-PO and per-receipt **[P4] DB**
- [ ] **5.2** Landed-cost allocation across receipt lines by value / quantity / weight / manual, feeding the cost basis on post **[P4]**
- [ ] **5.3** Landed-cost breakdown on the receipt surface: invoice cost → allocated charges → landed unit cost **[P4] UI**
- [ ] **5.4** `InventoryCostLayer` — FIFO layers written on inbound, consumed on outbound, with the consumed layers recorded on the movement **[P5] DB**
- [ ] **5.5** Per-tenant (and per-variant override) costing method: `moving_average` | `fifo` | `standard` **[P5] DB**
- [ ] **5.6** Standard cost + purchase price variance report (standard vs actual landed) **[P5][P21]**
- [ ] **5.7** FX capture at receipt — PO currency, rate used, base-currency landed cost stored alongside **[P15] DB**
- [ ] **5.8** As-of-date valuation — value the ledger at any past timestamp, not just now **[P21]**
- [ ] **5.9** COGS movement attribution: every `sale` movement carries the cost consumed, so margin is exact rather than estimated **[P5]**

### Phase 6 — Units of measure, kits, and assembly ⬜

- [ ] **6.1** `UnitOfMeasure` + per-variant conversions: stocking UoM (base), purchase UoM, sales UoM, with integer-safe factors **[P6] DB**
- [ ] **6.2** UoM applied through PO lines, receipts, counts, transfers, and the sell path; the ledger always stores base units **[P6]**
- [ ] **6.3** UoM display everywhere with the base-unit equivalent shown alongside ("4 cases (48 ea)") **[P6] UI**
- [ ] **6.4** `BillOfMaterials` + `BomComponent` — components, quantity per, scrap %, optional operations/labour cost **[P7] DB**
- [ ] **6.5** `AssemblyOrder` — planned → released → completed; consumes components and produces finished stock, all through the ledger; cost rolls up from components + labour **[P7] DB**
- [ ] **6.6** Disassembly (produce components from a finished unit) **[P7]**
- [ ] **6.7** Buildable-quantity calculation — "you can make 14 of these from what's on hand," with the limiting component named **[P7] UI**
- [ ] **6.8** Bundle availability derived from component availability (today's `decrement_components` bundles have no availability math) **[P7]**
- [ ] **6.9** Assembly surfaces: BOM editor, assembly orders list + detail **[P7] UI**

### Phase 7 — Planning intelligence ⬜

- [ ] **7.1** Demand velocity — trailing 7/30/90-day units-per-day per `(variant, warehouse)`, computed from the ledger's `sale` movements, materialized nightly **[P8] DB**
- [ ] **7.2** Seasonality index — same-period-last-year multiplier where ≥12 months of history exists, ignored otherwise (and said so on screen) **[P8]**
- [ ] **7.3** Lead-time actuals — measured PO-submit-to-receipt per supplier and per variant, with variance **[P8][D9]**
- [ ] **7.4** Safety stock from a chosen service level (90/95/99%) using demand and lead-time variability **[P8]**
- [ ] **7.5** Dynamic reorder point = (forecast demand × lead time) + safety stock, recalculated nightly, with a manual override that sticks **[P8]**
- [ ] **7.6** Projected stockout date + days-of-cover on every level **[D12]**
- [ ] **7.7** Reorder surface v2 — sorted by revenue at risk, with the reasoning shown inline (velocity, lead time, cover, what's already on order) **[P8][D12] UI**
- [ ] **7.8** ABC classification (by value) and XYZ (by demand variability), recomputed nightly, overridable **[P9] DB**
- [ ] **7.9** Cycle-count schedules — recurring, ABC-driven cadence (A monthly, B quarterly, C annually), auto-generating counts and assigning them **[P10] DB**
- [ ] **7.10** Overstock / dead-stock / slow-mover report with capital tied up and a suggested action **[P21]**
- [ ] **7.11** Holding-cost estimate per variant and in total (configurable annual carrying rate) **[D12][P21]**
- [ ] **7.12** Every planning number is explainable — the same provenance treatment as Phase 1, applied to derived numbers **[D1][D10]**

### Phase 8 — Supplier performance and procurement discipline ⬜

- [ ] **8.1** Supplier scorecard — on-time delivery %, fill rate, lead-time actual vs promised, price variance vs PO, damage rate on receipt, rolling 12 months **[P11][D9] DB**
- [ ] **8.2** Scorecard panel on supplier detail + a supplier league table **[P11] UI**
- [ ] **8.3** Late-PO detection and alerting (`inventory.purchase_order.late`) against expected arrival **[D9]**
- [ ] **8.4** Supplier price breaks / quantity tiers on `SupplierVariant` **[P11] DB**
- [ ] **8.5** PO approval workflow — thresholds by amount, approver roles, an approval queue, and an audit trail **[P12] DB**
- [ ] **8.6** ASN / advance ship notice — supplier submits (file or API) what shipped and when; receiving pre-fills from it; discrepancies flagged **[P17] DB**
- [ ] **8.7** Supplier returns / RTV — send stock back with a credit expectation, tracked to resolution **[P11] DB**
- [ ] **8.8** Three-way match: PO ↔ receipt ↔ supplier bill, with the variance surfaced before the bill is paid **[P16][C8]**
- [ ] **8.9** Reorder math consumes measured lead times instead of the supplier's stated one **[D9][P8]**

### Phase 9 — Demand-side commitments ⬜

- [ ] **9.1** `Backorder` — a queued customer commitment for stock that does not exist yet, with position and promised date **[P13] DB**
- [ ] **9.2** Allocate-on-receipt — a receipt fills open backorders in queue order, atomically, and notifies **[P13]**
- [ ] **9.3** Backorder surface + the customer-facing promised-date on the storefront and B2B portal **[P13] UI**
- [ ] **9.4** Preorder windows (sell before stock exists, with a stated availability date) **[P13]**
- [ ] **9.5** Stock ownership axis — `owned` | `consignment` | `customer_owned` | `3pl_owned`, excluded from valuation but present in availability **[P14] DB**
- [ ] **9.6** Consignment settlement — report and bill what sold from consigned stock **[P14]**
- [ ] **9.7** Returns disposition workflow: inspect → restock / quarantine / repair / scrap, each a distinct ledger reason routing to the right bin **[P19]**
- [ ] **9.8** FEFO enforcement + expiring-stock report (30/60/90-day horizons) with a markdown/write-off action **[P18]**

### Phase 10 — Reporting, data portability, accounting ⬜

- [ ] **10.1** Report set completion: dead stock, shrinkage, sell-through, GMROI, fill rate, days-of-cover, stock-out frequency, movement summary by reason, valuation as-of **[P21]**
- [ ] **10.2** Saved views + column chooser + group/pivot on every inventory list **[D5][D11] UI**
- [ ] **10.3** Every report exportable to CSV and addressable by API with identical filters **[D5] API**
- [ ] **10.4** Scheduled report delivery by email (daily/weekly/monthly), reusing the `email.send` pipeline **[D5]**
- [ ] **10.5** Inventory adjustment CSV import (SKU + location + qty + reason), closing the open item in [docs/68 §11](68-wizards-import-export-bulk.md) **[P20]**
- [ ] **10.6** Full round-trip: every export re-imports without editing **[P20][D5]**
- [ ] **10.7** QuickBooks Online connector — inventory asset + COGS journal entries, bill-from-receipt, item mapping **[P16]**
- [ ] **10.8** Xero connector, same contract **[P16]**
- [ ] **10.9** Accounting reconciliation report: sparx valuation vs the GL inventory account, with the difference itemized **[P16][D2]**
- [ ] **10.10** Receipt → supplier bill inside sparx invoicing for tenants with no external accounting **[C8][D8]**

### Phase 11 — Onboarding: beat the spreadsheet ⬜

- [ ] **11.1** Guided inventory setup wizard: locations → import → mapping → opening balance → alerts. **Instrumented against a 30-minute target.** **[D6] UI**
- [ ] **11.2** Spreadsheet import with fuzzy column mapping, unit/format detection, and a saved mapping profile for re-imports **[D6]**
- [ ] **11.3** Dry-run diff before apply — "412 matched, 18 new SKUs, 6 conflicts" — with per-row resolution **[D6][D1]**
- [ ] **11.4** Opening-balance count as the setup's final step, so day one starts from a posted, auditable count rather than an assumption **[D6][D1]**
- [ ] **11.5** Spreadsheet-grade stock grid: inline edit, paste a column, multi-select bulk actions, keyboard navigation **[D6][C3] UI**
- [ ] **11.6** Inventory sample data for the existing sample-data surface, so an empty tenant can be explored before committing **[D6]**
- [ ] **11.7** Migration recipes for the common incumbents (spreadsheet, accounting-attached inventory, marketplace exports) as import presets **[D6]**
- [ ] **11.8** Custom fields on variant/level/supplier/PO, definable in the UI and present in imports, exports, API, and MCP **[D11]**

### Phase 12 — Prove it ⬜

- [ ] **12.1** MCP tool coverage for everything added in phases 1–11 (bins, pick lists, assemblies, forecasts, scorecards, backorders, reports) **[D10]**
- [ ] **12.2** MCP read tools that answer the operator's real questions: `explain_stock_level`, `get_stockout_risk`, `get_supplier_performance`, `get_inventory_health` **[D10]**
- [ ] **12.3** Webhooks on every inventory event, tenant-configurable **[D11]**
- [ ] **12.4** Inventory API documented in [docs/06](06-api-specification.md) to the same standard as commerce **[P-all]**
- [ ] **12.5** Marketing: the inventory module page rebuilt around the §5 claim, following the six-beat story rule **[D-all]**
- [ ] **12.6** Comparison content grounded in §1/§2 with dated, accurate figures **[D-all]**
- [ ] **12.7** Feature catalog ([docs/89 §9](89-feature-catalog.md)) reconciled — every line in §6 marked live only when it is actually live **[P-all]**

---

## 7. Data model additions

New tables, grouped by the schema file they belong in. All tenant-scoped, all RLS-protected, all
prefixed `inventory_*`. Migration names must sort **after** the newest existing migration
([packages/db/CLAUDE.md](../packages/db/CLAUDE.md)).

| Schema file (new)                   | Models                                                                                                    | Phase |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| `42-inventory-bins.prisma`          | `InventoryBin`, `InventoryBinLevel`                                                                       | 2     |
| `43-inventory-barcodes.prisma`      | `VariantBarcode`                                                                                          | 3     |
| `44-inventory-picking.prisma`       | `PickList`, `PickListLine`, `PackVerification`                                                            | 4     |
| `45-inventory-costing.prisma`       | `InventoryCostLayer`, `PurchaseOrderCharge`, `GoodsReceiptCharge`, `CostingPolicy`                        | 5     |
| `46-inventory-uom.prisma`           | `UnitOfMeasure`, `VariantUomConversion`                                                                   | 6     |
| `47-inventory-assembly.prisma`      | `BillOfMaterials`, `BomComponent`, `AssemblyOrder`, `AssemblyOrderLine`                                   | 6     |
| `48-inventory-planning.prisma`      | `DemandVelocity`, `InventoryClassification`, `CycleCountSchedule`, `ReorderPolicy`                        | 7     |
| `49-inventory-supplier-perf.prisma` | `SupplierScorecard`, `SupplierPriceBreak`, `PurchaseOrderApproval`, `AdvanceShipNotice`, `SupplierReturn` | 8     |
| `50-inventory-demand.prisma`        | `Backorder`, `BackorderAllocation`                                                                        | 9     |
| `51-inventory-integrity.prisma`     | `ReconciliationRun`, `OversellIncident`                                                                   | 1     |

Column additions to existing tables:

| Table                           | Columns                                                                                 | Phase   |
| ------------------------------- | --------------------------------------------------------------------------------------- | ------- |
| `inventory_movements`           | `bin_id`, `from_bin_id`, `to_bin_id`, `cost_consumed_cents`, `cost_layer_ids`           | 2, 5    |
| `inventory_levels`              | `abc_class`, `xyz_class`, `forecast_daily_demand`, `dynamic_reorder_point`, `ownership` | 7, 9    |
| `inventory_warehouses`          | `allocation_strategy`, `uses_bins`                                                      | 2, 4    |
| `inventory_sources`             | `expected_interval_sec`, `staleness_policy`                                             | 1       |
| `inventory_suppliers`           | `on_time_rate`, `fill_rate`, `measured_lead_time_days`, `scorecard_updated_at`          | 8       |
| `inventory_purchase_orders`     | `approval_status`, `approved_by`, `approved_at`, `fx_rate`, `base_currency_total_cents` | 5, 8    |
| `inventory_goods_receipt_lines` | `allocated_charge_cents`, `landed_unit_cost_cents`, `bin_id`                            | 2, 5    |
| `commerce_product_variants`     | `default_bin_id`, `stocking_uom_id`, `costing_method`                                   | 2, 5, 6 |

**Non-negotiable:** none of these introduce a second writer to `on_hand`. Bin levels, cost layers,
and backorder allocations are all written inside the same transaction as their `applyMovement()` call.

---

## 8. API and MCP surface

**REST** — new route modules under `services/api-rest/src/routes/v1/inventory/`:

`bins.ts` · `barcodes.ts` · `labels.ts` · `picking.ts` · `assemblies.ts` · `boms.ts` ·
`planning.ts` · `classifications.ts` · `schedules.ts` · `supplier-performance.ts` · `approvals.ts` ·
`asn.ts` · `backorders.ts` · `costing.ts` · `uom.ts` · `integrity.ts` · `imports.ts`

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

Existing: 21. New: 17 — **5 shipped** (provenance, integrity, shelves list + detail, shelf labels).

| Surface                  | Phase | Notes                                                                     |
| ------------------------ | ----- | ------------------------------------------------------------------------- |
| Provenance drawer        | 1     | ✅ shipped as a PANE, opened beside the number it explains                |
| Integrity                | 1     | ✅ shipped — verdict, drifts, oversell log, feed freshness                |
| Bins list / detail       | 2     | ✅ shipped — plus a printable label sheet (three sizes, QR)               |
| Warehouse mode           | 3     | Full-screen scan shell hosting receive / count / pick / transfer / lookup |
| Labels                   | 3     | Label design + print queue                                                |
| Pick lists list / detail | 4     | Two surfaces                                                              |
| Pack station             | 4     | Scan-to-verify packing                                                    |
| BOM editor               | 6     |                                                                           |
| Assemblies list / detail | 6     | Two surfaces                                                              |
| Planning                 | 7     | Forecast, ABC/XYZ, dynamic reorder points                                 |
| Count schedules          | 7     |                                                                           |
| Supplier scorecards      | 8     | League table; the per-supplier panel lives on supplier detail             |
| PO approvals             | 8     | Approval queue                                                            |
| Backorders               | 9     |                                                                           |
| Import                   | 11    | Mapping + dry-run diff                                                    |

**Design constraints** (binding — [DESIGN.md](../DESIGN.md), [apps/workbench/CLAUDE.md](../apps/workbench/CLAUDE.md)):
inventory is amber `--color-module-inventory`; cross-module panels wear the other module's hue via a
nested `<ModuleProvider>` (a supplier panel is CRM cyan, a COGS panel is finance's hue); status is
`<Badge color={statusTone(s)}>`; warehouse mode must satisfy the responsive top-2 rule on a phone;
silicaui components only, no inline `style`, no eyebrows, no gradients or shadows.

---

## 10. Report inventory (the full set when done)

| Report                     | Status today | Phase |
| -------------------------- | ------------ | ----- |
| Valuation (current)        | ✅ live      | —     |
| Valuation (as of a date)   | ❌           | 5     |
| Turnover                   | ✅ live      | —     |
| Aging                      | ✅ live      | —     |
| Reorder analysis           | ✅ live      | —     |
| Low stock                  | ✅ live      | —     |
| Shrinkage                  | ✅ shipped   | 1     |
| Reconciliation / drift     | ✅ shipped   | 1     |
| Oversell incidents         | ✅ shipped   | 1     |
| Pick/pack throughput       | ❌           | 4     |
| Purchase price variance    | ❌           | 5     |
| Landed cost breakdown      | ❌           | 5     |
| Dead stock / slow movers   | ❌           | 7     |
| Days of cover              | ❌           | 7     |
| Holding cost               | ❌           | 7     |
| ABC / XYZ distribution     | ❌           | 7     |
| Supplier scorecard         | ❌           | 8     |
| Expiring stock             | ❌           | 9     |
| Sell-through               | ❌           | 10    |
| GMROI                      | ❌           | 10    |
| Fill rate                  | ❌           | 10    |
| Stockout frequency         | ❌           | 10    |
| Movement summary by reason | ❌           | 10    |
| GL reconciliation          | ❌           | 10    |

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
