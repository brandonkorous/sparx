// Inventory module — Reorder engine (docs/100 P3d). Items at/below their reorder
// point become reorder suggestions grouped by (supplier, warehouse); the buyer
// drafts one PO per group to the preferred supplier. The same drafting logic is
// driven automatically by the `inventory.low` automation action. All
// `requireInventoryModule` + `toInventoryContext` (standalone-usable, no commerce).
//
//   GET  /v1/inventory/reorder/suggestions   ?warehouse_id&take          (grouped, the board)
//   GET  /v1/inventory/reorder/worklist       ?warehouse_id&supplier_id&q&sort&take&skip&velocity_days
//   GET  /v1/inventory/reorder/summary        (does ANY level even have a reorder rule?)
//   POST /v1/inventory/reorder/draft          → draft PO(s) from selected lines
//
// The worklist row also carries a sales-velocity read (units sold per day over a
// trailing window → days of cover → projected stock-out date). That is NOT
// recomputed here: it comes straight from `@sparx/inventory`'s `reorderAnalysis`,
// the one implementation shared with the reports route and the MCP supply tools,
// merged onto each low row by (variant × warehouse). So "how long until this runs
// out" and "how little is left" are two honest reads of the SAME low set.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const SuggestionsQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
});

const WorklistQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  // Least on the shelf first (urgency), furthest below its reorder point
  // (shortfall), or soonest to run out at its current sales rate (cover).
  sort: z.enum(['urgency', 'shortfall', 'cover']).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  // Trailing window the sales velocity is measured over (days). Passed straight
  // to the shared analysis; the service defaults it to 30 when absent.
  velocity_days: z.coerce.number().int().min(1).max(365).optional(),
});

/**
 * One flat reorder row — a (variant × warehouse) at/below its reorder point.
 *
 * The grouped `/suggestions` shape is what the buyer's board wants (one PO per
 * supplier); the worklist wants the opposite — a single scannable list where the
 * numbers line up down a column. So the groups are flattened back to one row per
 * low level, each carrying the preferred supplier the engine resolved (or null,
 * when nothing supplies it yet and it can't be drafted until a link is added).
 */
interface ReorderWorklistRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  productId: string;
  warehouseName: string;
  warehouseCode: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  suggestedQuantity: number;
  onOrder: number;
  supplierId: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  leadTimeDays: number | null;
  currency: string | null;
  unitCostCents: number | null;
  estimatedCostCents: number | null;
  // ── Sales-velocity read, merged from `reorderAnalysis` (not recomputed) ──
  // `null` means "we could not measure it for this row" (it fell outside the
  // bounded analysis window), which is a different thing from a measured zero.
  /** Average units sold per day over the trailing velocity window. 0 = measured
   *  but nothing sold; null = not measured for this row. */
  velocityPerDay: number | null;
  /** How many days the available stock lasts at that rate. Null when nothing is
   *  selling (no honest cover to give) or velocity was not measured. */
  daysOfCover: number | null;
  /** When it is projected to hit zero, at that rate. Null alongside daysOfCover. */
  projectedStockoutAt: string | null;
}

/**
 * The value a row sorts by under "runs out soonest": days of cover, but with two
 * honest overrides. An already-out row (nothing available) is the most urgent
 * whatever its sales rate, so it leads; a row with no cover figure — nothing
 * selling, or velocity not measured — has no deadline to sort against, so it
 * sinks to the bottom rather than pretending to be either urgent or safe.
 */
function coverSortValue(row: ReorderWorklistRow): number {
  if (row.available <= 0) return -1;
  return row.daysOfCover ?? Number.POSITIVE_INFINITY;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryReorderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/reorder/suggestions', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = SuggestionsQuery.parse(request.query);
    const suggestions = await inventoryService.listReorderSuggestions(toInventoryContext(request), {
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
    });
    return reply.send(ok(suggestions));
  });

  // The buyer's worklist: one flat row per low (variant, warehouse), narrowed and
  // ordered on the SERVER so the client never sorts or filters a page and presents
  // it as the answer. The heavy suggestion SQL is bounded (500 rows — the complete
  // low set for any realistic catalog), so the search/supplier narrowing + sort +
  // paging run over the WHOLE set here, not over a page the client happens to hold.
  app.get('/v1/inventory/reorder/worklist', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = WorklistQuery.parse(request.query);

    const ctx = toInventoryContext(request);
    const suggestions = await inventoryService.listReorderSuggestions(ctx, {
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      take: 500,
    });

    // The sales-velocity read over the SAME low set — one shared implementation,
    // never re-derived here. Keyed by (variant × warehouse) so it lines straight
    // up with the flattened worklist rows below. `take` is the analysis maximum;
    // it orders by the least available first, so the rows most likely to be acted
    // on are always the ones that carry a cover figure.
    const analysis = await inventoryService.reorderAnalysis(ctx, {
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      ...(q.velocity_days !== undefined ? { velocityDays: q.velocity_days } : {}),
      take: 250,
    });
    const velocityByRow = new Map(
      analysis.rows.map((r) => [
        `${r.variantId}:${r.warehouseId}`,
        {
          velocityPerDay: r.velocityPerDay,
          daysOfCover: r.daysOfCover,
          projectedStockoutAt: r.projectedStockoutAt,
        },
      ])
    );
    // A row the analysis window did not reach keeps `null` velocity — an honest
    // "not measured", distinct from a measured zero (nothing selling).
    const velocityFor = (variantId: string, warehouseId: string) =>
      velocityByRow.get(`${variantId}:${warehouseId}`) ?? {
        velocityPerDay: null,
        daysOfCover: null,
        projectedStockoutAt: null,
      };

    const rows: ReorderWorklistRow[] = [];
    for (const group of suggestions.groups) {
      for (const line of group.lines) {
        rows.push({
          variantId: line.variantId,
          warehouseId: line.warehouseId,
          sku: line.sku,
          title: line.title,
          productId: line.productId,
          warehouseName: group.warehouseName,
          warehouseCode: group.warehouseCode,
          onHand: line.onHand,
          available: line.available,
          reorderPoint: line.reorderPoint,
          reorderQuantity: line.reorderQuantity,
          suggestedQuantity: line.suggestedQuantity,
          onOrder: line.onOrder,
          supplierId: group.supplierId,
          supplierName: group.supplierName,
          supplierCode: group.supplierCode,
          leadTimeDays: group.leadTimeDays,
          currency: group.currency,
          unitCostCents: line.unitCostCents,
          estimatedCostCents: line.estimatedCostCents,
          ...velocityFor(line.variantId, line.warehouseId),
        });
      }
    }
    for (const item of suggestions.unsupplied) {
      rows.push({
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        sku: item.sku,
        title: item.title,
        productId: item.productId,
        warehouseName: item.warehouseName ?? item.warehouseCode,
        warehouseCode: item.warehouseCode,
        onHand: item.onHand,
        available: item.available,
        reorderPoint: item.reorderPoint,
        reorderQuantity: item.reorderQuantity,
        suggestedQuantity: item.suggestedQuantity,
        onOrder: item.onOrder,
        supplierId: null,
        supplierName: null,
        supplierCode: null,
        leadTimeDays: null,
        currency: null,
        unitCostCents: null,
        estimatedCostCents: null,
        ...velocityFor(item.variantId, item.warehouseId),
      });
    }

    const needle = q.q?.toLowerCase();
    const filtered = rows.filter((r) => {
      if (q.supplier_id !== undefined && r.supplierId !== q.supplier_id) return false;
      if (needle) {
        const hay = `${r.sku ?? ''} ${r.title ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    const sort = q.sort ?? 'urgency';
    filtered.sort((a, b) => {
      if (sort === 'shortfall') {
        const gapDelta = b.reorderPoint - b.available - (a.reorderPoint - a.available);
        return gapDelta !== 0 ? gapDelta : a.available - b.available;
      }
      if (sort === 'cover') {
        // Soonest to run out first. Already-out rows lead regardless of rate;
        // rows with no cover figure (nothing selling, or not measured) have no
        // deadline, so they fall to the end. Ties break on the least available.
        const ca = coverSortValue(a);
        const cb = coverSortValue(b);
        return ca !== cb ? ca - cb : a.available - b.available;
      }
      // Urgency: the least on the shelf first; ties break on the bigger shortfall
      // so the order is deterministic across pages.
      return a.available !== b.available
        ? a.available - b.available
        : b.reorderPoint - b.available - (a.reorderPoint - a.available);
    });

    const total = filtered.length;
    const skip = q.skip ?? 0;
    const take = q.take ?? 50;
    return reply.send(paged(filtered.slice(skip, skip + take), { total, skip, per_page: take }));
  });

  // Whether ANY level has a reorder rule at all. It's what tells an empty worklist
  // apart: no rule anywhere ("set one up") reads nothing like every rule being
  // comfortably above its trigger ("nothing to buy — good"). Route-local because it
  // is one count and needs no service surface of its own.
  app.get('/v1/inventory/reorder/summary', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const policyCount = await withRequestTenant(request, (tx) =>
      tx.inventoryLevel.count({ where: { reorderPoint: { not: null } } })
    );
    return reply.send(ok({ policyCount }));
  });

  app.post('/v1/inventory/reorder/draft', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const result = await inventoryService.draftReorderPurchaseOrders(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(result));
  });
};

export default inventoryReorderRoutes;
