// The report registry (docs/146 Phase 10.3 + 10.4).
//
// One list of every inventory report, each knowing three things about itself:
// how to RUN it, how to write it as CSV, and how to say it in a sentence.
//
// ── Why a registry and not eighteen endpoints ────────────────────────────────
//
// 10.3 requires that every report be addressable by API with the same filters
// as the screen. 10.4 requires that a schedule name a report and email it. The
// workbench needs a picker. Without a registry that is three lists of report
// names in three files, kept in step by memory — and the failure mode is quiet:
// a report added to the API and forgotten in the schedule picker simply cannot
// be scheduled, and nobody finds out until somebody goes looking for it.
//
// So the registry is the list. The API iterates it, the scheduler resolves
// through it, and the picker is served from it. Adding a report is adding an
// entry here; forgetting to is impossible, because there is nowhere else to add
// one.
//
// ── What a report definition promises ────────────────────────────────────────
//
//   run     takes the SAME filter object every report takes, ignores the parts
//           that mean nothing to it, and returns its own shape.
//   csv     the DETAIL rows, not the summary tiles. Somebody exporting a
//           shrinkage report wants the items; a CSV of four totals is a
//           screenshot with extra steps.
//   summary two to five lines of plain language for the scheduled email and the
//           picker's preview. Written for an owner, not an analyst.
//
// Every `csv` here goes through `@wizeworks/inventory`'s one serializer, so an
// export re-imports (10.6) and a note containing a comma survives the trip.

import type { ReportKey, ReportFilters } from '@wizeworks/commerce-schemas';

import { type CsvTable, csvSafeText } from '../csv';
import type { ServiceContext } from '../errors';

import {
  agingReport,
  inventoryValuation,
  reorderAnalysis,
  turnoverReport,
  type AgingReport,
  type InventoryValuationReport,
  type ReorderAnalysisReport,
  type TurnoverReport,
} from './analytics';
import { cogsReport, valuationAsOf, type AsOfValuationReport } from './cost-reports';
import { listExpiringStock, type ExpiringStockReport } from './expiry';
import { glReconciliationReport, type GlReconciliationReport } from './gl-reconciliation';
import { listLowStock, type LowStockRow } from './levels';
import {
  fillRateReport,
  gmroiReport,
  movementSummaryReport,
  sellThroughReport,
  stockoutFrequencyReport,
  type FillRateReport,
  type GmroiReport,
  type MovementSummaryReport,
  type SellThroughReport,
  type StockoutFrequencyReport,
} from './performance-reports';
import {
  holdingCostReport,
  slowMoverReport,
  stockoutRiskReport,
  type HoldingCostReport,
  type SlowMoverReport,
  type StockoutRiskReport,
} from './planning-reports';
import { shrinkageReport, type ShrinkageReport } from './shrinkage';
import { listSupplierScorecards, type SupplierScorecardReport } from './supplier-scorecard';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A headline the scheduled email and the report picker both read. `value` is
 *  already formatted for a person — a report knows how its own figure should
 *  read, and pushing that decision to the caller is how the same number ends up
 *  formatted three ways. */
export interface SummaryLine {
  label: string;
  value: string;
  /** Set when the line is reporting something that could NOT be measured, so
   *  the email can set it apart rather than listing it as another statistic. */
  isGap?: boolean;
}

export interface ReportDefinition<T = unknown> {
  key: ReportKey;
  /** Business language. This is what appears in the picker and the email
   *  subject, so it is the owner's word for the thing, not the table's. */
  label: string;
  /** One sentence: what question this answers. */
  description: string;
  /** True when the report covers a PERIOD rather than a moment — the schedule
   *  form asks for a window only for these, and the CSV filename dates them. */
  windowed: boolean;
  run(ctx: ServiceContext, filters: ReportFilters): Promise<T>;
  csv(report: T): CsvTable;
  summary(report: T): SummaryLine[];
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

const NUMBER = new Intl.NumberFormat('en-US');

function money(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined) return 'not recorded';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function units(n: number): string {
  return `${NUMBER.format(n)} ${n === 1 ? 'unit' : 'units'}`;
}

/** A percentage, or the plain sentence that no percentage exists. Never "0%" —
 *  that is the exact lie this phase is built to stop. */
function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? 'not measured' : `${value}%`;
}

function windowFrom(filters: ReportFilters, defaultDays: number): { from: Date; to: Date } {
  const to = filters.to ? new Date(filters.to) : new Date();
  const days = filters.days ?? defaultDays;
  const from = filters.from ? new Date(filters.from) : new Date(to.getTime() - days * DAY_MS);
  return { from, to };
}

function warehouseOf(filters: ReportFilters): string | undefined {
  return filters.warehouseId;
}

// ─── The registry ────────────────────────────────────────────────────────────

const valuation: ReportDefinition<InventoryValuationReport> = {
  key: 'valuation',
  label: 'What your stock is worth',
  description: 'Everything on your shelves right now, valued at what it cost you.',
  windowed: false,
  run: (ctx) => inventoryValuation(ctx),
  csv: (r) => ({
    name: 'valuation',
    headers: [
      'total_units',
      'total_allocated',
      'total_available',
      'total_cost_cents',
      'total_retail_cents',
      'non_owned_units',
      'non_owned_value_cents',
      'currency',
    ],
    rows: [
      [
        r.totalUnits,
        r.totalAllocated,
        r.totalAvailable,
        r.totalCostCents,
        r.totalRetailCents,
        r.nonOwnedUnits,
        r.nonOwnedValueCents,
        r.currency,
      ],
    ],
  }),
  summary: (r) => [
    { label: 'Value at cost', value: money(r.totalCostCents, r.currency) },
    { label: 'On hand', value: units(r.totalUnits) },
    { label: 'At your selling prices', value: money(r.totalRetailCents, r.currency) },
    ...(r.nonOwnedUnits > 0
      ? [
          {
            label: "Somebody else's stock on your shelves",
            value: `${units(r.nonOwnedUnits)}, worth ${money(r.nonOwnedValueCents, r.currency)}`,
            isGap: true,
          },
        ]
      : []),
  ],
};

const valuationAsOfDef: ReportDefinition<AsOfValuationReport> = {
  key: 'valuation_as_of',
  label: 'What it was worth on a date',
  description: 'The stock valuation as it stood at any moment in the past.',
  windowed: true,
  run: (ctx, filters) =>
    valuationAsOf(ctx, {
      asOf: filters.to ? new Date(filters.to) : new Date(),
      warehouseId: warehouseOf(filters) ?? null,
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'valuation-as-of',
    headers: ['as_of', 'sku', 'title', 'warehouse', 'units', 'units_costed', 'value_cents'],
    rows: r.rows.map((row) => [
      r.asOf,
      row.sku,
      csvSafeText(row.title),
      row.warehouseCode,
      row.units,
      row.unitsCovered,
      row.valueCents,
    ]),
  }),
  summary: (r) => [
    { label: 'Value held', value: money(r.totalValueCents, r.currency) },
    { label: 'On hand', value: units(r.totalUnits) },
    ...(r.uncostedUnits > 0
      ? [
          {
            label: 'Units with no purchase behind them',
            value: units(r.uncostedUnits),
            isGap: true,
          },
        ]
      : []),
  ],
};

const turnover: ReportDefinition<TurnoverReport> = {
  key: 'turnover',
  label: 'How fast your stock sells',
  description: 'Times over your stock turned in the period, and how many days it sits.',
  windowed: true,
  run: (ctx, filters) => turnoverReport(ctx, windowFrom(filters, 30)),
  csv: (r) => ({
    name: 'turnover',
    headers: [
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
    rows: [
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
    ],
  }),
  summary: (r) => [
    { label: 'Turns in the period', value: String(r.turnover) },
    { label: 'A year at this pace', value: `${r.turnoverAnnualized} turns` },
    {
      label: 'Days a unit sits before selling',
      value:
        r.daysInventoryOutstanding === null ? 'not measured' : String(r.daysInventoryOutstanding),
      ...(r.daysInventoryOutstanding === null ? { isGap: true } : {}),
    },
    { label: 'Units sold', value: units(r.unitsSold) },
  ],
};

const aging: ReportDefinition<AgingReport> = {
  key: 'aging',
  label: 'How long your stock has sat',
  description: 'What you hold, grouped by how long since it last sold.',
  windowed: false,
  run: (ctx, filters) =>
    agingReport(ctx, {
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'aging',
    headers: ['bucket', 'levels', 'units', 'cost_cents'],
    rows: r.buckets.map((b) => [b.bucket, b.levels, b.units, b.costCents]),
  }),
  summary: (r) => {
    const stale = r.buckets.find((b) => b.bucket === '90+');
    return [
      { label: 'Lines held', value: NUMBER.format(r.buckets.reduce((s, b) => s + b.levels, 0)) },
      {
        label: 'Value unsold for over three months',
        value: money(stale?.costCents ?? 0),
      },
    ];
  },
};

const deadStock: ReportDefinition<SlowMoverReport> = {
  key: 'dead_stock',
  label: 'Stock that is not paying its rent',
  description: 'Dead, overstocked and slow lines, with what each is costing you to keep.',
  windowed: false,
  run: (ctx, filters) =>
    slowMoverReport(ctx, {
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'dead-stock',
    headers: [
      'kind',
      'sku',
      'title',
      'warehouse',
      'on_hand',
      'excess_units',
      'cost_known',
      'value_cents',
      'excess_value_cents',
      'annual_holding_cost_cents',
      'days_of_cover',
      'last_sale_at',
      'days_since_last_sale',
      'abc_class',
      'suggested_action',
    ],
    rows: r.rows.map((row) => [
      row.kind,
      row.sku,
      csvSafeText(row.title),
      row.warehouseCode,
      row.onHand,
      row.excessUnits,
      row.costKnown,
      row.valueCents,
      row.excessValueCents,
      row.annualHoldingCostCents,
      row.daysOfCover,
      row.lastSaleAt,
      row.daysSinceLastSale,
      row.abcClass,
      csvSafeText(row.suggestedAction),
    ]),
  }),
  summary: (r) => [
    { label: 'Lines not paying their rent', value: NUMBER.format(r.totals.items) },
    { label: 'Cash trapped in excess', value: money(r.totals.excessValueCents) },
    {
      label: 'Dead lines',
      value: `${NUMBER.format(r.totals.deadItems)} — ${money(r.totals.deadValueCents)}`,
    },
    ...(r.totals.itemsWithoutCost > 0
      ? [
          {
            label: 'Lines with no cost price, so not in the money above',
            value: NUMBER.format(r.totals.itemsWithoutCost),
            isGap: true,
          },
        ]
      : []),
  ],
};

const reorder: ReportDefinition<ReorderAnalysisReport> = {
  key: 'reorder_analysis',
  label: 'What to order next',
  description: 'Lines at or near their reorder point, with a suggested quantity.',
  windowed: false,
  run: (ctx, filters) =>
    reorderAnalysis(ctx, {
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
      ...(filters.days !== undefined ? { velocityDays: filters.days } : {}),
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'reorder-analysis',
    headers: [
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
    rows: r.rows.map((row) => [
      row.sku,
      csvSafeText(row.title),
      row.warehouseCode,
      row.onHand,
      row.available,
      row.reorderPoint,
      row.velocityPerDay,
      row.daysOfCover,
      row.projectedStockoutAt,
      row.suggestedQuantity,
      csvSafeText(row.supplierName),
      row.unitCostCents,
    ]),
  }),
  summary: (r) => [{ label: 'Lines to reorder', value: NUMBER.format(r.rows.length) }],
};

const lowStock: ReportDefinition<LowStockRow[]> = {
  key: 'low_stock',
  label: 'Running low',
  description: 'Everything at or below its reorder point right now.',
  windowed: false,
  run: (ctx, filters) =>
    listLowStock(ctx, {
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (rows) => ({
    name: 'low-stock',
    headers: [
      'sku',
      'title',
      'warehouse',
      'available',
      'reorder_point',
      'reorder_quantity',
      'lead_time_days',
    ],
    rows: rows.map((row) => [
      row.sku,
      csvSafeText(row.title),
      row.warehouseCode,
      row.available,
      row.reorderPoint,
      row.reorderQuantity,
      row.leadTimeDays,
    ]),
  }),
  summary: (rows) => [{ label: 'Lines running low', value: NUMBER.format(rows.length) }],
};

const shrinkage: ReportDefinition<ShrinkageReport> = {
  key: 'shrinkage',
  label: 'What left without being sold',
  description: 'Losses, breakages and count shortfalls, added up and priced.',
  windowed: true,
  run: (ctx, filters) => {
    const range = windowFrom(filters, 365);
    return shrinkageReport(ctx, {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
    });
  },
  csv: (r) => ({
    name: 'shrinkage',
    headers: ['sku', 'product', 'units_lost', 'value_cents', 'movements', 'from', 'to'],
    rows: r.topVariants.map((v) => [
      v.variantSku,
      csvSafeText(v.productTitle),
      v.units,
      v.valueCents,
      v.movements,
      r.from,
      r.to,
    ]),
  }),
  summary: (r) => [
    { label: 'Written off', value: `${units(r.totalUnits)} — ${money(r.totalValueCents)}` },
    { label: 'Share of your stock value', value: percent(r.percentOfValuation) },
    {
      label: 'Found at a count',
      value: `${units(r.recountGainUnits)} — ${money(r.recountGainValueCents)}`,
    },
  ],
};

const sellThroughDef: ReportDefinition<SellThroughReport> = {
  key: 'sell_through',
  label: 'How much of it sold',
  description: 'Of everything you had to sell, the share that actually sold.',
  windowed: true,
  run: (ctx, filters) =>
    sellThroughReport(ctx, {
      ...windowFrom(filters, 90),
      warehouseId: warehouseOf(filters) ?? null,
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'sell-through',
    headers: [
      'sku',
      'title',
      'warehouse',
      'units_sold',
      'units_on_hand_at_end',
      'units_available',
      'sell_through_pct',
    ],
    rows: r.rows.map((row) => [
      row.sku,
      csvSafeText(row.title),
      row.warehouseCode,
      row.unitsSold,
      row.unitsOnHandAtEnd,
      row.unitsAvailable,
      row.sellThroughPct,
    ]),
  }),
  summary: (r) => [
    { label: 'Sell-through', value: percent(r.totals.sellThroughPct) },
    { label: 'Sold', value: units(r.totals.unitsSold) },
    { label: 'Still on the shelf', value: units(r.totals.unitsOnHandAtEnd) },
  ],
};

const gmroiDef: ReportDefinition<GmroiReport> = {
  key: 'gmroi',
  label: 'What your stock earned',
  description: 'Margin earned for every pound tied up in stock, line by line.',
  windowed: true,
  run: (ctx, filters) =>
    gmroiReport(ctx, {
      ...windowFrom(filters, 90),
      warehouseId: warehouseOf(filters) ?? null,
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'gmroi',
    headers: [
      'sku',
      'title',
      'units_sold',
      'revenue_cents',
      'cogs_cents',
      'gross_margin_cents',
      'gross_margin_pct',
      'avg_inventory_cost_cents',
      'gmroi',
      'unattributed_units',
    ],
    rows: r.rows.map((row) => [
      row.sku,
      csvSafeText(row.title),
      row.unitsSold,
      row.revenueCents,
      row.cogsCents,
      row.grossMarginCents,
      row.grossMarginPct,
      row.avgInventoryCostCents,
      row.gmroi,
      row.unattributedUnits,
    ]),
  }),
  summary: (r) => [
    {
      label: 'Earned per pound of stock',
      value: r.totals.gmroi === null ? 'not measured' : String(r.totals.gmroi),
      ...(r.totals.gmroi === null ? { isGap: true } : {}),
    },
    { label: 'Gross margin', value: money(r.totals.grossMarginCents, r.currency) },
    { label: 'Margin on sales', value: percent(r.totals.grossMarginPct) },
    ...(r.uncostedUnits > 0
      ? [
          {
            label: 'Units sold with no cost recorded, so the margin above is flattered',
            value: units(r.uncostedUnits),
            isGap: true,
          },
        ]
      : []),
    ...(r.unattributedUnits > 0
      ? [
          {
            label: 'Units sold with no order line, so their revenue is missing',
            value: units(r.unattributedUnits),
            isGap: true,
          },
        ]
      : []),
  ],
};

const fillRateDef: ReportDefinition<FillRateReport> = {
  key: 'fill_rate',
  label: 'Could you ship it',
  description: 'The share of order lines you could fill from the shelf, first time.',
  windowed: true,
  run: (ctx, filters) =>
    fillRateReport(ctx, {
      ...windowFrom(filters, 30),
      warehouseId: warehouseOf(filters) ?? null,
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'fill-rate',
    headers: [
      'sku',
      'title',
      'lines_measured',
      'lines_short',
      'units_ordered',
      'units_short',
      'line_fill_rate_pct',
    ],
    rows: r.worstVariants.map((row) => [
      row.sku,
      csvSafeText(row.title),
      row.linesMeasured,
      row.linesShort,
      row.unitsOrdered,
      row.unitsShort,
      row.lineFillRatePct,
    ]),
  }),
  summary: (r) => [
    { label: 'Order lines shipped complete', value: percent(r.lineFillRatePct) },
    { label: 'Units shipped from stock', value: percent(r.unitFillRatePct) },
    { label: 'Lines short', value: NUMBER.format(r.linesShort) },
    ...(r.unmeasuredLines > 0
      ? [
          {
            label: 'Lines nothing recorded, left out of the figures above',
            value: NUMBER.format(r.unmeasuredLines),
            isGap: true,
          },
        ]
      : []),
  ],
};

const stockoutFrequency: ReportDefinition<StockoutFrequencyReport> = {
  key: 'stockout_frequency',
  label: 'How often you ran out',
  description: 'Which lines went to zero, how many times, and for how long.',
  windowed: true,
  run: (ctx, filters) =>
    stockoutFrequencyReport(ctx, {
      ...windowFrom(filters, 90),
      warehouseId: warehouseOf(filters) ?? null,
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'stockout-frequency',
    headers: [
      'sku',
      'title',
      'warehouse',
      'times_out',
      'days_out',
      'currently_out',
      'availability_pct',
      'unmeasured_movements',
    ],
    rows: r.rows.map((row) => [
      row.sku,
      csvSafeText(row.title),
      row.warehouseCode,
      row.episodeCount,
      row.daysOut,
      row.currentlyOut,
      row.availabilityPct,
      row.unmeasuredMovements,
    ]),
  }),
  summary: (r) => [
    { label: 'Lines that ran out', value: NUMBER.format(r.linesAffected) },
    { label: 'Times out of stock', value: NUMBER.format(r.totalEpisodes) },
    ...(r.unmeasuredLines > 0
      ? [
          {
            label: 'Lines with no stock history to read',
            value: NUMBER.format(r.unmeasuredLines),
            isGap: true,
          },
        ]
      : []),
  ],
};

const movementSummary: ReportDefinition<MovementSummaryReport> = {
  key: 'movement_summary',
  label: 'Where the stock went',
  description: 'Every movement in the period, grouped by why it happened.',
  windowed: true,
  run: (ctx, filters) =>
    movementSummaryReport(ctx, {
      ...windowFrom(filters, 30),
      warehouseId: warehouseOf(filters) ?? null,
    }),
  csv: (r) => ({
    name: 'movement-summary',
    headers: ['reason', 'group', 'movements', 'units_in', 'units_out', 'net_units', 'cost_cents'],
    rows: r.rows.map((row) => [
      row.reason,
      row.group,
      row.movements,
      row.unitsIn,
      row.unitsOut,
      row.netUnits,
      row.costCents,
    ]),
  }),
  summary: (r) => [
    { label: 'Movements', value: NUMBER.format(r.totalMovements) },
    { label: 'In', value: units(r.totalUnitsIn) },
    { label: 'Out', value: units(r.totalUnitsOut) },
    { label: 'Net change', value: units(r.netUnits) },
  ],
};

const expiring: ReportDefinition<ExpiringStockReport> = {
  key: 'expiring_stock',
  label: 'Stock about to go off',
  description: 'Batches past or near their date, bucketed and priced.',
  windowed: false,
  run: (ctx, filters) =>
    listExpiringStock(ctx, {
      ...(filters.days !== undefined ? { withinDays: filters.days } : {}),
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
    }),
  csv: (r) => ({
    name: 'expiring-stock',
    headers: [
      'lot_number',
      'sku',
      'item',
      'warehouse',
      'quantity',
      'expires_at',
      'days_remaining',
      'bucket',
      'value_cents',
      'recall_status',
    ],
    rows: r.items.map((row) => [
      csvSafeText(row.lotNumber),
      row.variantSku,
      csvSafeText(row.variantName),
      csvSafeText(row.warehouseName),
      row.quantity,
      row.expiresAt,
      row.daysRemaining,
      row.bucket,
      row.valueCents,
      row.recallStatus,
    ]),
  }),
  summary: (r) => {
    const expired = r.buckets.find((b) => b.bucket === 'expired');
    const soon = r.buckets.find((b) => b.bucket === 'd30');
    return [
      { label: 'Already past date', value: `${NUMBER.format(expired?.lots ?? 0)} batches` },
      { label: 'Going off within a month', value: `${NUMBER.format(soon?.lots ?? 0)} batches` },
      ...(r.undatedLots > 0
        ? [
            {
              label: 'Batches with no date recorded',
              value: NUMBER.format(r.undatedLots),
              isGap: true,
            },
          ]
        : []),
    ];
  },
};

const scorecard: ReportDefinition<SupplierScorecardReport> = {
  key: 'supplier_scorecard',
  label: 'How your suppliers are doing',
  description: 'On-time, fill rate, lead time and price behaviour, per supplier.',
  windowed: false,
  run: (ctx, filters) =>
    listSupplierScorecards(ctx, {
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'supplier-scorecard',
    headers: [
      'supplier',
      'code',
      'grade',
      'score',
      'orders_placed',
      'deliveries',
      'on_time_rate',
      'fill_rate',
      'avg_days_late',
      'lead_time_mean_days',
      'price_variance_pct',
      'damage_rate',
      'spend_cents',
      'measured_at',
    ],
    rows: r.items.map((row) => [
      csvSafeText(row.supplierName),
      row.supplierCode,
      row.grade,
      row.score,
      row.ordersPlaced,
      row.deliveries,
      row.onTimeRate,
      row.fillRate,
      row.avgDaysLate,
      row.leadTimeMeanDays,
      row.priceVariancePct,
      row.damageRate,
      row.spendCents,
      row.measuredAt,
    ]),
  }),
  summary: (r) => [
    { label: 'Suppliers scored', value: NUMBER.format(r.items.length - r.unscored) },
    ...(r.unscored > 0
      ? [
          {
            label: 'Suppliers with too little history to score',
            value: NUMBER.format(r.unscored),
            isGap: true,
          },
        ]
      : []),
  ],
};

const stockoutRisk: ReportDefinition<StockoutRiskReport> = {
  key: 'stockout_risk',
  label: 'What you are about to run out of',
  description: 'Lines heading for zero, with the sales that would be lost.',
  windowed: false,
  run: (ctx, filters) =>
    stockoutRiskReport(ctx, {
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'stockout-risk',
    headers: [
      'sku',
      'title',
      'warehouse',
      'on_hand',
      'available',
      'on_order',
      'days_of_cover',
      'days_of_cover_with_inbound',
      'projected_stockout_at',
      'lead_time_days',
      'units_at_risk',
      'revenue_at_risk_cents',
      'suggested_quantity',
      'supplier',
      'reasoning',
    ],
    rows: r.rows.map((row) => [
      row.sku,
      csvSafeText(row.title),
      row.warehouseCode,
      row.onHand,
      row.available,
      row.onOrder,
      row.daysOfCover,
      row.daysOfCoverWithInbound,
      row.projectedStockoutAt,
      row.leadTimeDays,
      row.unitsAtRisk,
      row.revenueAtRiskCents,
      row.suggestedQuantity,
      csvSafeText(row.supplierName),
      csvSafeText(row.reasoning),
    ]),
  }),
  summary: (r) => [
    { label: 'Sales at risk', value: money(r.totalRevenueAtRiskCents) },
    { label: 'Lines at risk', value: NUMBER.format(r.rows.length) },
    ...(r.unmeasuredLevels > 0
      ? [
          {
            label: 'Lines never measured, so not in the figure above',
            value: NUMBER.format(r.unmeasuredLevels),
            isGap: true,
          },
        ]
      : []),
  ],
};

const holdingCost: ReportDefinition<HoldingCostReport> = {
  key: 'holding_cost',
  label: 'What keeping it costs',
  description: 'The annual cost of holding your stock, and which lines cost most.',
  windowed: false,
  run: (ctx, filters) =>
    holdingCostReport(ctx, {
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
      ...(filters.take !== undefined ? { take: filters.take } : {}),
    }),
  csv: (r) => ({
    name: 'holding-cost',
    headers: [
      'sku',
      'title',
      'warehouse',
      'on_hand',
      'cost_known',
      'value_cents',
      'annual_holding_cost_cents',
      'days_of_cover',
    ],
    rows: r.topItems.map((row) => [
      row.sku,
      csvSafeText(row.title),
      csvSafeText(row.warehouseName),
      row.onHand,
      row.costKnown,
      row.valueCents,
      row.annualHoldingCostCents,
      row.daysOfCover,
    ]),
  }),
  summary: (r) => [
    { label: 'A year of holding costs', value: money(r.annualHoldingCostCents) },
    { label: 'A month', value: money(r.monthlyHoldingCostCents) },
    {
      label: 'Carrying rate used',
      value: `${r.annualRatePct}%${r.usingDefaultRate ? ' (the category default — set yours)' : ''}`,
      ...(r.usingDefaultRate ? { isGap: true } : {}),
    },
  ],
};

const glReconciliation: ReportDefinition<GlReconciliationReport> = {
  key: 'gl_reconciliation',
  label: 'Stock versus your books',
  description:
    'What your stock is worth here against your accounting inventory account, with every difference itemised.',
  windowed: true,
  run: (ctx, filters) =>
    glReconciliationReport(ctx, {
      asOf: filters.to ? new Date(filters.to) : new Date(),
      ...(filters.from ? { from: new Date(filters.from) } : {}),
    }),
  csv: (r) => ({
    name: 'gl-reconciliation',
    headers: ['line', 'kind', 'description', 'amount_cents', 'source', 'reference'],
    rows: r.lines.map((line, index) => [
      index + 1,
      line.kind,
      csvSafeText(line.description),
      line.amountCents,
      line.source,
      line.reference,
    ]),
  }),
  summary: (r) => [
    { label: 'Stock value here', value: money(r.sparxValueCents, r.currency) },
    {
      label: 'Inventory account in your books',
      value: r.ledgerValueCents === null ? 'not connected' : money(r.ledgerValueCents, r.currency),
      ...(r.ledgerValueCents === null ? { isGap: true } : {}),
    },
    {
      label: 'Unexplained difference',
      value:
        r.unexplainedCents === null
          ? 'cannot be worked out yet'
          : money(r.unexplainedCents, r.currency),
      ...(r.unexplainedCents === null ? { isGap: true } : {}),
    },
  ],
};

const cogs: ReportDefinition<Awaited<ReturnType<typeof cogsReport>>> = {
  key: 'cogs',
  label: 'What the goods that left cost',
  description: 'Cost of goods over the period, split by why the stock left.',
  windowed: true,
  run: (ctx, filters) => {
    const range = windowFrom(filters, 30);
    return cogsReport(ctx, {
      from: range.from,
      to: range.to,
      ...(warehouseOf(filters) ? { warehouseId: warehouseOf(filters) } : {}),
    });
  },
  csv: (r) => ({
    name: 'cost-of-goods',
    headers: ['reason', 'units', 'cost_cents', 'from', 'to'],
    rows: r.byReason.map((row) => [row.reason, row.units, row.costCents, r.from, r.to]),
  }),
  summary: (r) => [
    { label: 'Cost of what you sold', value: money(r.saleCostCents, r.currency) },
    {
      label: 'Cost of what left without being sold',
      value: money(r.totalCostCents - r.saleCostCents, r.currency),
    },
    ...(r.unattributedUnits > 0
      ? [
          {
            label: 'Units that left before costs were recorded',
            value: units(r.unattributedUnits),
            isGap: true,
          },
        ]
      : []),
  ],
};

/**
 * Every report, keyed.
 *
 * Ordered as an owner would look for them: what it is worth, how it is moving,
 * what is wrong with it, who supplied it, and what the accountant wants.
 */
export const REPORTS = [
  valuation,
  valuationAsOfDef,
  turnover,
  sellThroughDef,
  gmroiDef,
  cogs,
  aging,
  deadStock,
  holdingCost,
  lowStock,
  reorder,
  stockoutRisk,
  stockoutFrequency,
  fillRateDef,
  shrinkage,
  movementSummary,
  expiring,
  scorecard,
  glReconciliation,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the map is heterogeneous by design; each definition is internally typed and only ever used through runReport, which erases to unknown.
] as unknown as ReportDefinition<any>[];

const BY_KEY = new Map(REPORTS.map((definition) => [definition.key, definition]));

export function reportDefinition(key: string): ReportDefinition<unknown> | undefined {
  return BY_KEY.get(key as ReportKey);
}

/** The picker's data. Business labels only — no keys leak onto a screen. */
export interface ReportCatalogEntry {
  key: string;
  label: string;
  description: string;
  windowed: boolean;
}

export function reportCatalog(): ReportCatalogEntry[] {
  return REPORTS.map((d) => ({
    key: d.key,
    label: d.label,
    description: d.description,
    windowed: d.windowed,
  }));
}

export interface ReportRun {
  key: string;
  label: string;
  filters: ReportFilters;
  data: unknown;
  csv: CsvTable;
  summary: SummaryLine[];
  generatedAt: string;
}

/**
 * Run any report by key, with one filter shape.
 *
 * The single entry point 10.3 needs: the REST export route, the scheduler and
 * the MCP tool all call this, so a report cannot behave differently depending on
 * which of them asked for it.
 */
export async function runReport(
  ctx: ServiceContext,
  key: string,
  filters: ReportFilters = {}
): Promise<ReportRun> {
  const definition = reportDefinition(key);
  if (!definition) {
    throw new Error(`Unknown report: ${key}`);
  }
  const data = await definition.run(ctx, filters);
  return {
    key: definition.key,
    label: definition.label,
    filters,
    data,
    csv: definition.csv(data),
    summary: definition.summary(data),
    generatedAt: new Date().toISOString(),
  };
}
