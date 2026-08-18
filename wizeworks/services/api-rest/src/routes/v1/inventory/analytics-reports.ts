// Inventory analytics reports (docs/100 P6b, docs/09 §8) — turnover / DIO, aging
// + dead-stock, and reorder analysis, over the master model + ledger. Thin
// wrappers over @wizeworks/inventory's analytics service (shared with the MCP supply
// tools). Each supports `?format=csv` for a spreadsheet export (the detail rows);
// default is the JSON envelope. Inventory-module-gated + viewer-read, RLS-scoped.
//
//   GET /v1/inventory/reports/valuation
//   GET /v1/inventory/reports/turnover?from=&to=
//   GET /v1/inventory/reports/aging?warehouse_id=&dead_stock_days=
//   GET /v1/inventory/reports/reorder-analysis?warehouse_id=&velocity_days=

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@wizeworks/inventory';
import type {
  AgingReport,
  ReorderAnalysisReport,
  ShrinkageReport,
  TurnoverReport,
} from '@wizeworks/inventory';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const TurnoverQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(['json', 'csv']).optional(),
});
const AgingQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  dead_stock_days: z.coerce.number().int().min(1).max(3650).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  format: z.enum(['json', 'csv']).optional(),
});
const ReorderQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  velocity_days: z.coerce.number().int().min(1).max(365).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  format: z.enum(['json', 'csv']).optional(),
});
const ShrinkageQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  warehouse_id: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryAnalyticsReportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/reports/valuation', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    return ok(await inventoryService.inventoryValuation(toInventoryContext(request)));
  });

  app.get('/v1/inventory/reports/turnover', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = TurnoverQuery.parse(request.query);
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * DAY_MS);
    const report = await inventoryService.turnoverReport(toInventoryContext(request), { from, to });
    if (q.format === 'csv') return sendCsv(reply, 'turnover', turnoverCsv(report));
    return ok(report);
  });

  app.get('/v1/inventory/reports/aging', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = AgingQuery.parse(request.query);
    const report = await inventoryService.agingReport(toInventoryContext(request), {
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
      ...(q.dead_stock_days !== undefined ? { deadStockDays: q.dead_stock_days } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
    });
    if (q.format === 'csv') return sendCsv(reply, 'dead-stock', agingCsv(report));
    return ok(report);
  });

  app.get('/v1/inventory/reports/reorder-analysis', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ReorderQuery.parse(request.query);
    const report = await inventoryService.reorderAnalysis(toInventoryContext(request), {
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
      ...(q.velocity_days !== undefined ? { velocityDays: q.velocity_days } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
    });
    if (q.format === 'csv') return sendCsv(reply, 'reorder-analysis', reorderCsv(report));
    return ok(report);
  });

  // Shrinkage (docs/146 Phase 1). 80% of operators report losing 1–5% of
  // inventory value a year and almost none can say where it went, because the
  // write-offs are scattered across adjustments, damaged receipts and count
  // variances. The ledger already holds every one of them; this is the read.
  app.get('/v1/inventory/reports/shrinkage', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ShrinkageQuery.parse(request.query);
    const report = await inventoryService.shrinkageReport(toInventoryContext(request), {
      ...(q.from ? { from: q.from } : {}),
      ...(q.to ? { to: q.to } : {}),
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
    });
    if (q.format === 'csv') return sendCsv(reply, 'shrinkage', shrinkageCsv(report));
    return ok(report);
  });
};

// ─── CSV serialization ────────────────────────────────────────────────

function sendCsv(reply: FastifyReply, name: string, body: string): FastifyReply {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="inventory-${name}.csv"`)
    .send(body);
}

type CsvValue = string | number | null;

function csvCell(v: CsvValue): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

function turnoverCsv(r: TurnoverReport): string {
  return toCsv(
    [
      'from',
      'to',
      'period_days',
      'cogs_cents',
      'units_sold',
      'avg_inventory_value_cents',
      'turnover',
      'turnover_annualized',
      'days_inventory_outstanding',
    ],
    [
      [
        r.range.from,
        r.range.to,
        r.periodDays,
        r.cogsCents,
        r.unitsSold,
        r.avgInventoryValueCents,
        r.turnover,
        r.turnoverAnnualized,
        r.daysInventoryOutstanding,
      ],
    ]
  );
}

function agingCsv(r: AgingReport): string {
  return toCsv(
    ['sku', 'title', 'warehouse', 'on_hand', 'cost_cents', 'last_sale_at', 'days_since_last_sale'],
    r.deadStock.map((d) => [
      d.sku,
      d.title,
      d.warehouseCode,
      d.onHand,
      d.costCents,
      d.lastSaleAt,
      d.daysSinceLastSale,
    ])
  );
}

function reorderCsv(r: ReorderAnalysisReport): string {
  return toCsv(
    [
      'sku',
      'title',
      'warehouse',
      'on_hand',
      'available',
      'reorder_point',
      'velocity_per_day',
      'days_of_cover',
      'projected_stockout_at',
      'suggested_quantity',
      'supplier',
      'unit_cost_cents',
    ],
    r.rows.map((row) => [
      row.sku,
      row.title,
      row.warehouseCode,
      row.onHand,
      row.available,
      row.reorderPoint,
      row.velocityPerDay,
      row.daysOfCover,
      row.projectedStockoutAt,
      row.suggestedQuantity,
      row.supplierName,
      row.unitCostCents,
    ])
  );
}

// The shrinkage export is the per-variant detail, not the summary tiles: the
// reason someone exports a shrinkage report is to go and look at the items, and
// a CSV of four totals is a screenshot with extra steps.
function shrinkageCsv(r: ShrinkageReport): string {
  return toCsv(
    ['sku', 'product', 'units_lost', 'value_cents', 'movements', 'from', 'to'],
    r.topVariants.map((v) => [
      v.variantSku,
      v.productTitle,
      v.units,
      v.valueCents,
      v.movements,
      r.from,
      r.to,
    ])
  );
}

export default inventoryAnalyticsReportRoutes;
