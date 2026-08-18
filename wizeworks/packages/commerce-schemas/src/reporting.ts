// Inventory performance reporting (docs/146 Phase 10.1).
//
// The five figures a business is asked for and cannot currently answer from
// sparx: how much of what it bought it actually sold, what the money tied up in
// stock earned, how often it could fill an order from the shelf, how often it
// ran out, and where all the stock went.
//
// The arithmetic is here, pure, for the reason Phases 7–9's is: the REST report,
// the scheduled email, the CSV export and the workbench screen must not arrive
// at four different answers for one question. A report that changes depending on
// which door you came in by is worse than no report — it teaches people to trust
// none of them.
//
// ── The rule this phase inherits, sharpened ──────────────────────────────────
//
//   A RATIO WHOSE DENOMINATOR NOBODY MEASURED IS NOT ZERO, IT IS NULL — AND
//   THE RESULT CARRIES HOW MANY ROWS IT HAD TO LEAVE OUT.
//
// This matters more for ratios than for anything Phase 9 did, because a ratio
// hides its own inputs. "Fill rate: 100%" reads like an achievement whether it
// means every one of 4,000 lines shipped complete or nothing was ever measured.
// So every function here returns `null` rather than a comfortable number when it
// has nothing to divide, and every aggregate carries the count of what it could
// not measure so a screen can say so out loud.

import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

/** Percentages are reported to one decimal place. Two is false precision on a
 *  figure derived from a few hundred rows; zero loses the difference between a
 *  96% and a 96.4% fill rate, which is the difference a buyer argues about. */
export function pct1(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

/** Ratios (turns, GMROI) to two places — they live between 0 and ~10, where the
 *  second decimal is still information. */
export function ratio2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Divide, or refuse to.
 *
 * The single most common way a report lies is `x / (y || 1)`. Nothing divided by
 * nothing is not zero and it is not one hundred percent; it is a question that
 * was never asked. Every ratio below funnels through here.
 */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

// ─── 10.1a Sell-through ──────────────────────────────────────────────────────

/**
 * Sell-through: of everything you had available to sell in the period, what
 * share actually sold.
 *
 *   sold / (sold + still on hand at the end)
 *
 * The denominator is deliberately NOT "what you bought" — a business that
 * received nothing this month but sold half its shelf has a real sell-through,
 * and dividing by zero receipts would say otherwise. Units on hand at the END of
 * the period plus units sold during it is the stock that was there to be sold,
 * which is the question retailers mean by the word.
 */
export interface SellThroughInput {
  unitsSold: number;
  /** On hand when the period closed. */
  unitsOnHandAtEnd: number;
}

export interface SellThroughResult {
  unitsSold: number;
  unitsOnHandAtEnd: number;
  /** sold + on hand — the stock that was available to sell. */
  unitsAvailable: number;
  /** 0–100 to one decimal, or null when nothing was there to sell. */
  sellThroughPct: number | null;
}

export function sellThrough(input: SellThroughInput): SellThroughResult {
  const sold = Math.max(0, Math.trunc(input.unitsSold));
  // On hand can legitimately be negative on an oversold level. It is clamped for
  // the denominator because "available to sell" cannot be less than what sold,
  // and a negative would push sell-through above 100% — a number nobody can act
  // on and everybody screenshots.
  const onHand = Math.max(0, Math.trunc(input.unitsOnHandAtEnd));
  const available = sold + onHand;
  const fraction = safeRatio(sold, available);
  return {
    unitsSold: sold,
    unitsOnHandAtEnd: onHand,
    unitsAvailable: available,
    sellThroughPct: fraction === null ? null : pct1(fraction),
  };
}

/** How a sell-through figure reads: a stocking decision, not a grade.
 *
 *  The bands come from how buyers actually use the number. Below 20% over a
 *  season means the buy was too big or the price is wrong; above 80% means it
 *  sold out and the shelf was empty for part of the period, which costs sales
 *  even though it looks like success. The healthy middle is wide because it
 *  genuinely is. */
export type SellThroughVerdict = 'overstocked' | 'healthy' | 'understocked' | 'unmeasured';

export function sellThroughVerdict(sellThroughPct: number | null): SellThroughVerdict {
  if (sellThroughPct === null) return 'unmeasured';
  if (sellThroughPct < 20) return 'overstocked';
  if (sellThroughPct > 80) return 'understocked';
  return 'healthy';
}

// ─── 10.1b GMROI ─────────────────────────────────────────────────────────────

/**
 * Gross Margin Return On Inventory Investment.
 *
 *   gross margin over the period / average value of the stock held
 *
 * "For every pound sitting in stock, how many pounds of margin did it earn."
 * 1.0 means the stock paid for the money it tied up and nothing more; the retail
 * rule of thumb is that a line wants to clear about 3.
 *
 * It is the one figure that catches the item everything else calls fine: a fast
 * turner on a thin margin and a slow mover on a fat one can turn out to be the
 * same business, and only this ratio says so.
 */
export interface GmroiInput {
  /** Net of discounts, excluding tax — see the service for why. */
  revenueCents: number;
  /** What those exact goods cost, from the movement's stamped cost. */
  cogsCents: number;
  /** Mean inventory value at cost across the period. */
  avgInventoryCostCents: number;
}

export interface GmroiResult {
  revenueCents: number;
  cogsCents: number;
  grossMarginCents: number;
  /** margin / revenue, 0–100 to one decimal; null with no revenue. */
  grossMarginPct: number | null;
  avgInventoryCostCents: number;
  /** margin / average inventory, to two places; null when no stock was held. */
  gmroi: number | null;
}

export function gmroi(input: GmroiInput): GmroiResult {
  const revenueCents = Math.trunc(input.revenueCents);
  const cogsCents = Math.trunc(input.cogsCents);
  const avgInventoryCostCents = Math.trunc(input.avgInventoryCostCents);
  const grossMarginCents = revenueCents - cogsCents;
  const marginFraction = safeRatio(grossMarginCents, revenueCents);
  const returnFraction = safeRatio(grossMarginCents, avgInventoryCostCents);
  return {
    revenueCents,
    cogsCents,
    grossMarginCents,
    // A negative margin on positive revenue is a real and important answer —
    // selling below cost. safeRatio only refuses on the DENOMINATOR, so it
    // survives with its sign.
    grossMarginPct: marginFraction === null ? null : pct1(marginFraction),
    avgInventoryCostCents,
    gmroi: returnFraction === null ? null : ratio2(returnFraction),
  };
}

/** The band a GMROI falls in. `null` is its own answer and never `poor` — an
 *  item nobody has costed is not an item that earns nothing. */
export type GmroiVerdict = 'losing' | 'poor' | 'fair' | 'strong' | 'unmeasured';

export function gmroiVerdict(value: number | null): GmroiVerdict {
  if (value === null) return 'unmeasured';
  if (value < 0) return 'losing';
  if (value < 1) return 'poor';
  if (value < 3) return 'fair';
  return 'strong';
}

// ─── 10.1c Fill rate ─────────────────────────────────────────────────────────

/**
 * Fill rate: could you ship it from the shelf when the order arrived?
 *
 * Two of them, because they answer different complaints:
 *
 *   LINE fill rate  share of order lines that shipped complete, first time.
 *                   The customer-experience number — one short line spoils a
 *                   whole delivery.
 *   UNIT fill rate  share of ordered units shipped from stock. The operations
 *                   number — being three units short on a line of 400 is not
 *                   the same failure as being short on a line of 3.
 *
 * ── Why `unmeasuredLines` exists and is not optional ─────────────────────────
 *
 * A line only counts if the platform actually recorded whether it could be
 * filled — a backorder row, or a sale movement carrying its resulting balance.
 * Lines from before that recording began are counted in `unmeasuredLines` and
 * left OUT of both numerator and denominator, because including them would score
 * every one of them as a perfect fill and produce a 100% that means "we weren't
 * looking".
 */
export interface FillRateLine {
  /** Units the customer asked for on this line. */
  unitsOrdered: number;
  /** Units that could not be filled from stock when the order landed. */
  unitsShort: number;
  /** False when nothing recorded whether this line could be filled. Such a line
   *  is excluded from the rate entirely rather than scored as a success. */
  measured: boolean;
}

export interface FillRateResult {
  linesMeasured: number;
  linesFilledComplete: number;
  linesShort: number;
  unmeasuredLines: number;
  unitsOrdered: number;
  unitsShort: number;
  unitsFilled: number;
  /** 0–100 to one decimal; null when no line could be measured. */
  lineFillRatePct: number | null;
  unitFillRatePct: number | null;
}

export function fillRate(lines: readonly FillRateLine[]): FillRateResult {
  let linesMeasured = 0;
  let linesFilledComplete = 0;
  let unmeasuredLines = 0;
  let unitsOrdered = 0;
  let unitsShort = 0;

  for (const line of lines) {
    if (!line.measured) {
      unmeasuredLines += 1;
      continue;
    }
    const ordered = Math.max(0, Math.trunc(line.unitsOrdered));
    // A short count larger than the order is a data problem, not a 130% miss.
    const short = Math.min(ordered, Math.max(0, Math.trunc(line.unitsShort)));
    linesMeasured += 1;
    if (short === 0) linesFilledComplete += 1;
    unitsOrdered += ordered;
    unitsShort += short;
  }

  const unitsFilled = unitsOrdered - unitsShort;
  const lineFraction = safeRatio(linesFilledComplete, linesMeasured);
  const unitFraction = safeRatio(unitsFilled, unitsOrdered);

  return {
    linesMeasured,
    linesFilledComplete,
    linesShort: linesMeasured - linesFilledComplete,
    unmeasuredLines,
    unitsOrdered,
    unitsShort,
    unitsFilled,
    lineFillRatePct: lineFraction === null ? null : pct1(lineFraction),
    unitFillRatePct: unitFraction === null ? null : pct1(unitFraction),
  };
}

/** Distribution parity is a 95% line fill rate; below 90% is where customers
 *  start shopping elsewhere and above 98% usually means you are holding more
 *  stock than the service level is worth. */
export type FillRateVerdict = 'poor' | 'below_par' | 'good' | 'excellent' | 'unmeasured';

export function fillRateVerdict(lineFillRatePct: number | null): FillRateVerdict {
  if (lineFillRatePct === null) return 'unmeasured';
  if (lineFillRatePct < 90) return 'poor';
  if (lineFillRatePct < 95) return 'below_par';
  if (lineFillRatePct < 98) return 'good';
  return 'excellent';
}

// ─── 10.1d Stock-out frequency ───────────────────────────────────────────────

/**
 * How often a line ran out, and for how long.
 *
 * An EPISODE is a run of time at or below zero sellable, not a count of days —
 * a SKU that is out for a fortnight has one problem, not fourteen. Frequency is
 * episodes per period; the cost of the problem is in the days.
 *
 * The input is the ledger's running balance, in order. `balanceAfter` is
 * nullable on old rows, and a null breaks the run rather than being guessed at:
 * a gap in the record is not evidence of stock.
 */
export interface BalancePoint {
  at: Date;
  /** The level's on-hand AFTER the movement. Null on rows written before the
   *  running balance was recorded. */
  balanceAfter: number | null;
}

export interface StockoutEpisode {
  startedAt: Date;
  /** Null while still out at the end of the window. */
  endedAt: Date | null;
  days: number;
}

export interface StockoutResult {
  episodes: StockoutEpisode[];
  episodeCount: number;
  daysOut: number;
  /** True when the line was still out at the window's close. */
  currentlyOut: boolean;
  /** Movements skipped for having no recorded balance. A non-zero count means
   *  the episodes below are a floor, not a total. */
  unmeasuredPoints: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function stockoutEpisodes(points: readonly BalancePoint[], windowEnd: Date): StockoutResult {
  const episodes: StockoutEpisode[] = [];
  let unmeasuredPoints = 0;
  let openedAt: Date | null = null;

  const ordered = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());

  for (const point of ordered) {
    if (point.balanceAfter === null) {
      unmeasuredPoints += 1;
      continue;
    }
    const out = point.balanceAfter <= 0;
    if (out && openedAt === null) {
      openedAt = point.at;
    } else if (!out && openedAt !== null) {
      episodes.push({
        startedAt: openedAt,
        endedAt: point.at,
        days: daysBetween(openedAt, point.at),
      });
      openedAt = null;
    }
  }

  if (openedAt !== null) {
    episodes.push({
      startedAt: openedAt,
      endedAt: null,
      days: daysBetween(openedAt, windowEnd),
    });
  }

  return {
    episodes,
    episodeCount: episodes.length,
    daysOut: episodes.reduce((sum, e) => sum + e.days, 0),
    currentlyOut: openedAt !== null,
    unmeasuredPoints,
  };
}

/** Fractional days, to one decimal — a four-hour stock-out is real and rounding
 *  it to zero days makes a recurring afternoon shortage invisible. */
function daysBetween(from: Date, to: Date): number {
  const ms = Math.max(0, to.getTime() - from.getTime());
  return Math.round((ms / DAY_MS) * 10) / 10;
}

/**
 * Availability across a window: the share of it the line was in stock.
 *
 * Reported beside the episode count because the two disagree usefully. Forty
 * short stock-outs that each lasted an hour is a replenishment-timing problem;
 * one that lasted forty days is a buying problem.
 */
export function availabilityPct(daysOut: number, windowDays: number): number | null {
  const fraction = safeRatio(Math.max(0, windowDays - daysOut), windowDays);
  return fraction === null ? null : pct1(fraction);
}

// ─── 10.1e Movement summary by reason ────────────────────────────────────────

/** The ledger's reason vocabulary, in the order a summary reads best: what came
 *  in, what went out to customers, what went out for every other reason, then
 *  the internal shuffles that net to nothing. */
export const MOVEMENT_REASONS = [
  'receive',
  'return',
  'cancel',
  'sale',
  'loss',
  'damage',
  'recount',
  'transfer_in',
  'transfer_out',
  'reserve',
  'release',
  'manual',
  'sync',
  /** The first quantity a business ever recorded for a line, from the opening
   *  count that closes setup (docs/146 Phase 11.4). Its own reason and not
   *  `recount`, because the difference between "we had never counted this" and
   *  "we counted it and it was wrong" is the difference between a starting
   *  point and a loss — and only one of them belongs in the shrinkage report. */
  'opening',
] as const;

export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/** How each reason rolls up. The grouping is the point of the report: `sale`
 *  and `loss` are both stock leaving and only one of them is a business. */
export type MovementGroup = 'inbound' | 'sold' | 'lost' | 'corrected' | 'internal';

const MOVEMENT_GROUPS: Record<string, MovementGroup> = {
  receive: 'inbound',
  return: 'inbound',
  cancel: 'inbound',
  sale: 'sold',
  loss: 'lost',
  damage: 'lost',
  recount: 'corrected',
  transfer_in: 'internal',
  transfer_out: 'internal',
  reserve: 'internal',
  release: 'internal',
  manual: 'corrected',
  sync: 'corrected',
  // Stock arriving on the books for the first time. `inbound` rather than a
  // group of its own: it IS stock coming in, and a sixth group would appear as
  // an empty column on every report of every tenant past their first week.
  opening: 'inbound',
};

/** Unknown reasons group as `corrected` rather than being dropped. A reason the
 *  code does not recognise still moved real stock, and a summary whose parts do
 *  not add up to the ledger is a summary nobody can reconcile. */
export function movementGroup(reason: string): MovementGroup {
  return MOVEMENT_GROUPS[reason] ?? 'corrected';
}

export interface MovementReasonTotals {
  reason: string;
  group: MovementGroup;
  movements: number;
  unitsIn: number;
  unitsOut: number;
  netUnits: number;
  /** Signed, from the movement's stamped cost. Null when no movement in this
   *  reason carried one — an uncosted reason shows blank, never $0.00. */
  costCents: number | null;
}

export interface MovementSummary {
  rows: MovementReasonTotals[];
  totalMovements: number;
  totalUnitsIn: number;
  totalUnitsOut: number;
  netUnits: number;
  /** Movements with no cost stamped. Shown so a costed total is not mistaken
   *  for a complete one. */
  uncostedMovements: number;
}

export interface MovementRowInput {
  reason: string;
  movements: number;
  unitsIn: number;
  unitsOut: number;
  costCents: number | null;
  costedMovements: number;
}

/** Fold the grouped SQL rows into the report shape. Pure so the same fold serves
 *  the API, the CSV and the scheduled email. */
export function summarizeMovements(rows: readonly MovementRowInput[]): MovementSummary {
  const summary: MovementReasonTotals[] = rows.map((row) => ({
    reason: row.reason,
    group: movementGroup(row.reason),
    movements: row.movements,
    unitsIn: row.unitsIn,
    unitsOut: row.unitsOut,
    netUnits: row.unitsIn - row.unitsOut,
    costCents: row.costCents,
  }));

  summary.sort((a, b) => {
    const order = groupOrder(a.group) - groupOrder(b.group);
    return order !== 0 ? order : b.movements - a.movements;
  });

  return {
    rows: summary,
    totalMovements: rows.reduce((s, r) => s + r.movements, 0),
    totalUnitsIn: rows.reduce((s, r) => s + r.unitsIn, 0),
    totalUnitsOut: rows.reduce((s, r) => s + r.unitsOut, 0),
    netUnits: rows.reduce((s, r) => s + r.unitsIn - r.unitsOut, 0),
    uncostedMovements: rows.reduce((s, r) => s + Math.max(0, r.movements - r.costedMovements), 0),
  };
}

function groupOrder(group: MovementGroup): number {
  switch (group) {
    case 'inbound':
      return 0;
    case 'sold':
      return 1;
    case 'lost':
      return 2;
    case 'corrected':
      return 3;
    default:
      return 4;
  }
}

// ─── Report identity — one vocabulary for export, schedule and API ───────────

/**
 * Every inventory report, by key.
 *
 * One list, used by the export endpoint, the schedule table and the workbench
 * picker. It exists because 10.3 requires that a report be addressable by API
 * with the SAME filters as the screen, and 10.4 requires that a schedule name a
 * report — three places that would otherwise each grow their own slightly
 * different spelling of "dead stock".
 */
export const ReportKey = z.enum([
  'valuation',
  'valuation_as_of',
  'turnover',
  'cogs',
  'aging',
  'dead_stock',
  'reorder_analysis',
  'low_stock',
  'shrinkage',
  'sell_through',
  'gmroi',
  'fill_rate',
  'stockout_frequency',
  'movement_summary',
  'expiring_stock',
  'supplier_scorecard',
  'stockout_risk',
  'holding_cost',
  'gl_reconciliation',
]);
export type ReportKey = z.infer<typeof ReportKey>;

/** The filters a report accepts. A superset — each report reads the ones that
 *  mean something to it and ignores the rest, which is what lets one schedule
 *  row and one export endpoint serve all of them. */
export const ReportFilters = z.object({
  warehouseId: z.string().uuid().optional(),
  /** Rolling window in days. Reports that need a range and were given none use
   *  their own default; a schedule always sets this so each delivery covers the
   *  period since the last one rather than a fixed calendar span. */
  days: z.number().int().min(1).max(1095).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  supplierId: z.string().uuid().optional(),
  take: z.number().int().min(1).max(5000).optional(),
});
export type ReportFilters = z.infer<typeof ReportFilters>;

// ─── 10.4 Scheduled delivery ─────────────────────────────────────────────────

export const ReportCadence = z.enum(['daily', 'weekly', 'monthly']);
export type ReportCadence = z.infer<typeof ReportCadence>;

export const ReportFormat = z.enum(['csv', 'summary']);
export type ReportFormat = z.infer<typeof ReportFormat>;

export const CreateReportScheduleInput = z.object({
  reportKey: ReportKey,
  name: z.string().trim().min(1).max(120),
  cadence: ReportCadence,
  /** 0=Sunday … 6=Saturday. Weekly only. */
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  /** 1–28 only: a monthly report set to the 31st would skip February, and
   *  silently missing a month is exactly the failure a schedule exists to
   *  prevent. */
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  /** Hour of day in the tenant's timezone, 0–23. */
  hour: z.number().int().min(0).max(23).default(7),
  timezone: z.string().trim().min(1).max(64).default('UTC'),
  recipients: z.array(z.string().email()).min(1).max(20),
  format: ReportFormat.default('csv'),
  filters: ReportFilters.default({}),
  isActive: z.boolean().default(true),
});
export type CreateReportScheduleInput = z.infer<typeof CreateReportScheduleInput>;

/**
 * A patch. Written out rather than `CreateReportScheduleInput.partial()`.
 *
 * `.partial()` makes a field optional but does NOT strip its `.default()`, so
 * `.partial().parse({ name: 'x' })` comes back carrying hour 7, timezone UTC,
 * format csv, filters {} and isActive true — and an update service that writes
 * whatever is `!== undefined` would then reset all five while renaming the
 * thing. That is the exact class of silent loss `patch-semantics.test.ts`
 * exists to catch, and it caught this.
 *
 * `reportKey` is absent on purpose: the delivery history below a schedule is
 * about ONE report, and swapping it would make that history a lie. A different
 * report is a different schedule.
 */
export const UpdateReportScheduleInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  cadence: ReportCadence.optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  recipients: z.array(z.string().email()).min(1).max(20).optional(),
  format: ReportFormat.optional(),
  filters: ReportFilters.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateReportScheduleInput = z.infer<typeof UpdateReportScheduleInput>;

/**
 * When a schedule should next run, from the moment it last did.
 *
 * Pure and UTC-arithmetic over an offset the caller resolves, so the sweep, the
 * "next delivery" line on the screen and the tests all agree. The offset is
 * passed in rather than resolved here because a zone's offset changes twice a
 * year and only the caller knows the instant to resolve it at.
 *
 * The result is always strictly AFTER `after`. A schedule whose next run
 * computed to "now" would fire again on every sweep tick for an hour.
 */
export function nextRunAt(
  schedule: {
    cadence: ReportCadence;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    hour: number;
  },
  after: Date,
  utcOffsetMinutes = 0
): Date {
  const offsetMs = utcOffsetMinutes * 60_000;
  // Work in the tenant's local wall clock, then shift back at the end.
  const local = new Date(after.getTime() + offsetMs);
  const candidate = new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      schedule.hour,
      0,
      0,
      0
    )
  );

  const advanceDays = (days: number): void => {
    candidate.setUTCDate(candidate.getUTCDate() + days);
  };

  switch (schedule.cadence) {
    case 'daily':
      if (candidate.getTime() <= local.getTime()) advanceDays(1);
      break;
    case 'weekly': {
      const target = schedule.dayOfWeek ?? 1;
      let delta = (target - candidate.getUTCDay() + 7) % 7;
      if (delta === 0 && candidate.getTime() <= local.getTime()) delta = 7;
      advanceDays(delta);
      break;
    }
    case 'monthly': {
      const target = Math.min(28, Math.max(1, schedule.dayOfMonth ?? 1));
      candidate.setUTCDate(target);
      if (candidate.getTime() <= local.getTime()) {
        candidate.setUTCMonth(candidate.getUTCMonth() + 1);
        candidate.setUTCDate(target);
      }
      break;
    }
  }

  return new Date(candidate.getTime() - offsetMs);
}

// ─── 10.5 Adjustment import ──────────────────────────────────────────────────

/**
 * One row of an adjustment import, after parsing and before it touches stock.
 *
 * The import is deliberately a two-step — parse to these, show the operator what
 * would happen, and only then apply. docs/68 §11 left this open, and the reason
 * to close it carefully rather than quickly is that a bad adjustment import is
 * indistinguishable from theft in the ledger afterwards: hundreds of `manual`
 * movements, all timestamped the same second, all attributed to whoever pressed
 * the button.
 */
export const AdjustmentImportRow = z
  .object({
    sku: z.string().trim().min(1).max(127).optional(),
    variantId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    warehouseCode: z.string().trim().min(1).max(63).optional(),
    /** Absolute count after the adjustment. */
    onHand: z.number().int().min(0).max(100_000_000).optional(),
    /** Signed change. Exactly one of onHand/delta. */
    delta: z.number().int().min(-100_000_000).max(100_000_000).optional(),
    reason: z.string().trim().max(20).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((r) => r.sku !== undefined || r.variantId !== undefined, {
    message: 'Give each row a SKU or a variant id so we know which item it is',
  })
  .refine((r) => (r.onHand === undefined) !== (r.delta === undefined), {
    message: 'Give each row either a new count or a change, not both and not neither',
  });
export type AdjustmentImportRow = z.infer<typeof AdjustmentImportRow>;

/** `skipped` is a person's decision (docs/146 Phase 11.3), not a parse result:
 *  a row that could have been applied and deliberately was not. Kept distinct
 *  from `no_change` — "we left it out" and "it was already right" look identical
 *  in a total and mean opposite things. */
export type ImportRowOutcome = 'apply' | 'no_change' | 'error' | 'skipped';

export interface ImportRowPlan {
  /** 1-based, counting the header as line 1 — so it matches what the operator
   *  sees when they open the file to fix it. */
  line: number;
  sku: string | null;
  variantId: string | null;
  warehouseId: string | null;
  outcome: ImportRowOutcome;
  currentOnHand: number | null;
  newOnHand: number | null;
  delta: number;
  /** Populated when `outcome` is `error` — in the operator's language, naming
   *  the line so the file can be fixed without guessing. */
  error: string | null;
  /** The item name the file carried, kept so a row whose code matches nothing
   *  can offer "create BRK-9920 — Front brake pad" rather than "create
   *  BRK-9920" (docs/146 Phase 11.3). */
  name?: string | null;
  /** Unit cost from the file, in cents. Used to value an item this row creates
   *  and left alone otherwise. */
  unitCostCents?: number | null;
  /** Custom-field values this row carried, by field key (docs/146 Phase 11.8).
   *  Applied to the stock position, and applied even on a row that changes no
   *  quantity — a file correcting only the aisle number is a real import. */
  customFields?: Record<string, unknown>;
  /** How a person resolved this row: `skip`, `match` (point it at an item that
   *  already exists) or `create`. Absent on a row nobody touched. */
  resolution?: 'skip' | 'match' | 'create';
}

export interface ImportPlan {
  rows: ImportRowPlan[];
  totalRows: number;
  applyCount: number;
  noChangeCount: number;
  errorCount: number;
  /** Rows a person chose to leave out (docs/146 Phase 11.3). */
  skippedCount: number;
  /** Rows whose code matched an item that already exists. The reassuring half
   *  of "412 matched, 18 new items, 6 to sort out". */
  matchedCount: number;
  /** Rows carrying a code sparx has never seen. Not an error on its own — it is
   *  a decision, and the dry run's whole job is to put it in front of somebody
   *  before four hundred items get created by accident. */
  newItemCount: number;
  /** Sum of the absolute unit change that would be posted. The number that
   *  makes an operator stop and look: "412 rows, 9,930 units". */
  unitsChanged: number;
}

/** Fold row plans into the dry-run summary the confirm screen reads. */
export function summarizeImportPlan(rows: readonly ImportRowPlan[]): ImportPlan {
  return {
    rows: [...rows],
    totalRows: rows.length,
    applyCount: rows.filter((r) => r.outcome === 'apply').length,
    noChangeCount: rows.filter((r) => r.outcome === 'no_change').length,
    errorCount: rows.filter((r) => r.outcome === 'error').length,
    skippedCount: rows.filter((r) => r.outcome === 'skipped').length,
    matchedCount: rows.filter((r) => r.variantId !== null).length,
    newItemCount: rows.filter((r) => r.variantId === null && r.sku !== null).length,
    unitsChanged: rows
      .filter((r) => r.outcome === 'apply')
      .reduce((sum, r) => sum + Math.abs(r.delta), 0),
  };
}
