// Planning intelligence (docs/146 Phase 7).
//
// The write contracts for the planning settings, and — more importantly — the
// PURE arithmetic every planning number is made of. Safety stock, the reorder
// point, ABC and XYZ, days of cover, revenue at risk, holding cost.
//
// ── Why the maths lives here and not in a service ────────────────────────────
//
// Three consumers need the same answer: the nightly sweep that materialises it,
// the REST/MCP reads that explain it, and the workbench that renders it. If any
// two of them compute it separately they WILL disagree, and a planning figure
// that says 84 on one screen and 79 on another is worse than no figure at all —
// the operator stops believing both. So the arithmetic is written once, here,
// with no database and no clock, and every one of the three calls it.
//
// ── The formulas, and why these ones ─────────────────────────────────────────
//
//   safety stock  = z × √( LT·σ_d²  +  d²·σ_LT² )
//   reorder point = d × LT × seasonality  +  safety stock
//
// The second term under the root is the one most tools leave out. A supplier
// whose lead time swings between 3 and 21 days puts far more stock at risk than
// one whose demand wobbles a little, and σ_LT is the only term that says so —
// which matters here because 52% of operators name supplier reliability as their
// number one problem.
//
// Everything below is total: given nonsense it returns a defensible number
// rather than NaN, because these run over every level in a catalogue and one bad
// row must not poison a nightly pass.

import { z } from 'zod';

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/**
 * How often you intend to be in stock when a replenishment cycle ends.
 *
 * p95 means "run out in about one cycle in twenty". The last few points cost
 * real money — going p95 → p99 is roughly a 40% increase in safety stock for a
 * four-in-a-hundred improvement — which is why this is a choice and not a
 * constant.
 */
export const ServiceLevel = z.enum(['p50', 'p80', 'p90', 'p95', 'p99']);
export type ServiceLevel = z.infer<typeof ServiceLevel>;

export const AbcClass = z.enum(['A', 'B', 'C']);
export type AbcClass = z.infer<typeof AbcClass>;

export const XyzClass = z.enum(['X', 'Y', 'Z']);
export type XyzClass = z.infer<typeof XyzClass>;

/** Which trailing window produced the forecast. `none` = nothing has ever sold. */
export const ForecastBasis = z.enum(['none', '7d', '30d', '90d']);
export type ForecastBasis = z.infer<typeof ForecastBasis>;

/** Where the lead time used in the arithmetic came from, worst to best. */
export const LeadTimeSource = z.enum(['default', 'level', 'supplier', 'measured']);
export type LeadTimeSource = z.infer<typeof LeadTimeSource>;

export const CountCadence = z.enum(['weekly', 'monthly', 'quarterly', 'annually', 'custom']);
export type CountCadence = z.infer<typeof CountCadence>;

// ─── Write contracts ─────────────────────────────────────────────────────────

export const UpdatePlanningPolicyInput = z.object({
  serviceLevel: ServiceLevel.optional(),
  holdingCostRatePct: z.number().min(0).max(100).optional(),
  abcAThresholdPct: z.number().min(1).max(99).optional(),
  abcBThresholdPct: z.number().min(2).max(100).optional(),
  xyzXMaxCv: z.number().min(0.01).max(10).optional(),
  xyzYMaxCv: z.number().min(0.02).max(20).optional(),
  overstockCoverDays: z.number().int().min(1).max(3650).optional(),
  deadStockDays: z.number().int().min(1).max(3650).optional(),
  autoApplyReorderPoints: z.boolean().optional(),
  minSeasonalityHistoryDays: z.number().int().min(90).max(1460).optional(),
});
export type UpdatePlanningPolicyInput = z.infer<typeof UpdatePlanningPolicyInput>;

export const SetReorderPolicyPlanningInput = z.object({
  variantId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  serviceLevel: ServiceLevel.nullish(),
  leadTimeDaysOverride: z.number().int().min(0).max(365).nullish(),
  safetyStockOverride: z.number().int().min(0).max(10_000_000).nullish(),
  /** Turning this ON hands the reorder point to the nightly maths. */
  isAutoManaged: z.boolean().optional(),
});
export type SetReorderPolicyPlanningInput = z.infer<typeof SetReorderPolicyPlanningInput>;

export const SetClassificationOverrideInput = z.object({
  variantId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  abcClass: AbcClass.nullish(),
  xyzClass: XyzClass.nullish(),
  reason: z.string().trim().max(255).optional(),
});
export type SetClassificationOverrideInput = z.infer<typeof SetClassificationOverrideInput>;

export const CreateCountScheduleInput = z.object({
  warehouseId: z.string().uuid(),
  name: z.string().trim().min(1, 'Give the schedule a name').max(80),
  abcClass: AbcClass.nullish(),
  zoneName: z.string().trim().max(60).nullish(),
  cadence: CountCadence,
  /** Required when the cadence is `custom`; ignored otherwise. */
  intervalDays: z.number().int().min(1).max(3650).optional(),
  maxItemsPerRun: z.number().int().min(1).max(500).default(50),
  isBlind: z.boolean().default(true),
  assignedTo: z.string().trim().max(127).nullish(),
  /** When the first count should be generated. Defaults to now. */
  startAt: z.coerce.date().optional(),
});
export type CreateCountScheduleInput = z.infer<typeof CreateCountScheduleInput>;

export const UpdateCountScheduleInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  abcClass: AbcClass.nullish(),
  zoneName: z.string().trim().max(60).nullish(),
  cadence: CountCadence.optional(),
  intervalDays: z.number().int().min(1).max(3650).optional(),
  maxItemsPerRun: z.number().int().min(1).max(500).optional(),
  isBlind: z.boolean().optional(),
  assignedTo: z.string().trim().max(127).nullish(),
  isActive: z.boolean().optional(),
  nextRunAt: z.coerce.date().optional(),
});
export type UpdateCountScheduleInput = z.infer<typeof UpdateCountScheduleInput>;

// ─── Service level → z ───────────────────────────────────────────────────────

/**
 * The one-tailed normal z-score for a service level.
 *
 * A lookup rather than an inverse-normal implementation, because there are five
 * legal service levels and a table of five numbers is something a person can
 * check against a textbook. An unknown value returns p95's z rather than
 * throwing — this runs inside a nightly pass over every level, and a typo in one
 * policy row must not stop the catalogue being planned.
 */
export function serviceLevelZ(level: string | null | undefined): number {
  switch (level) {
    case 'p50':
      return 0;
    case 'p80':
      return 0.8416;
    case 'p90':
      return 1.2816;
    case 'p99':
      return 2.3263;
    case 'p95':
    default:
      return 1.6449;
  }
}

/** The service level said the way an owner would read it. */
export function serviceLevelLabel(level: string | null | undefined): string {
  switch (level) {
    case 'p50':
      return 'In stock about half the time';
    case 'p80':
      return 'In stock 4 times out of 5';
    case 'p90':
      return 'In stock 9 times out of 10';
    case 'p99':
      return 'In stock 99 times out of 100';
    case 'p95':
    default:
      return 'In stock 19 times out of 20';
  }
}

// ─── Descriptive statistics ──────────────────────────────────────────────────

/** Arithmetic mean. Empty input is 0 — there is nothing to average. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const v of values) total += finite(v);
  return total / values.length;
}

/**
 * SAMPLE standard deviation (n−1), which is what these are: a sample of the days
 * or the deliveries, not the population of all of them. With fewer than two
 * observations there is no spread to measure and the answer is 0, not NaN.
 */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sum = 0;
  for (const v of values) {
    const d = finite(v) - m;
    sum += d * d;
  }
  return Math.sqrt(sum / (values.length - 1));
}

/**
 * Coefficient of variation — spread relative to size, so a line selling 2/day
 * ±1 and one selling 200/day ±100 read as equally erratic.
 *
 * Null when the mean is zero or negative. That is not a large CV, it is NO CV,
 * and returning 0 would classify a dead item as perfectly predictable.
 */
export function coefficientOfVariation(
  meanValue: number,
  standardDeviation: number
): number | null {
  const m = finite(meanValue);
  if (m <= 0) return null;
  return finite(standardDeviation) / m;
}

// ─── Safety stock + reorder point ────────────────────────────────────────────

export interface SafetyStockInput {
  /** Forecast demand per day, in base units. */
  demandPerDay: number;
  /** Standard deviation of DAILY demand, in base units (σ_d). */
  demandStdDev: number;
  /** Lead time in days. */
  leadTimeDays: number;
  /** Standard deviation of the lead time, in days (σ_LT). 0 when unmeasured. */
  leadTimeStdDev: number;
  /** The z-score from `serviceLevelZ`. */
  z: number;
}

/**
 * Safety stock: the cushion that absorbs both kinds of surprise.
 *
 *   z × √( LT·σ_d²  +  d²·σ_LT² )
 *
 * The first term is demand varying over the lead time; the second is the lead
 * time itself varying while demand runs at its usual rate. Carrying only the
 * first — which is what most tools do — systematically under-protects anyone
 * whose suppliers are unreliable, and that is 52% of the market.
 *
 * Rounds UP: a safety stock of 4.2 units is 5 units, because you cannot hold
 * four fifths of a thing and rounding a cushion down is how the cushion stops
 * working.
 */
export function safetyStock(input: SafetyStockInput): number {
  const d = Math.max(0, finite(input.demandPerDay));
  const sigmaD = Math.max(0, finite(input.demandStdDev));
  const lt = Math.max(0, finite(input.leadTimeDays));
  const sigmaLt = Math.max(0, finite(input.leadTimeStdDev));
  const z = Math.max(0, finite(input.z));

  if (z === 0) return 0;
  const variance = lt * sigmaD * sigmaD + d * d * sigmaLt * sigmaLt;
  if (variance <= 0) return 0;
  return Math.ceil(z * Math.sqrt(variance));
}

export interface ReorderPointInput {
  demandPerDay: number;
  leadTimeDays: number;
  safetyStockUnits: number;
  /**
   * Seasonal multiplier for the period the lead time lands in. Null means not
   * enough history to know, which is treated as 1 for the arithmetic while the
   * surface still reports that it was unknown rather than measured.
   */
  seasonalityIndex?: number | null;
}

/**
 * The level at which to buy again: enough to cover demand while the delivery is
 * in transit, plus the cushion.
 *
 * Seasonality multiplies the LEAD-TIME demand only, never the safety stock — the
 * cushion is about variability, and December being busy is not variability, it
 * is a known fact you have already priced into the demand term.
 */
export function reorderPoint(input: ReorderPointInput): number {
  const d = Math.max(0, finite(input.demandPerDay));
  const lt = Math.max(0, finite(input.leadTimeDays));
  const ss = Math.max(0, finite(input.safetyStockUnits));
  const seasonality = clampSeasonality(input.seasonalityIndex);
  return Math.ceil(d * lt * seasonality + ss);
}

/**
 * A seasonality multiplier, bounded.
 *
 * Between a fifth and five times. A ratio computed from a thin slice of history
 * can produce absurdities — one bulk order last November against a quiet year
 * gives an index of 30 — and a reorder point thirty times too high is a worse
 * failure than ignoring the season entirely.
 */
function clampSeasonality(index: number | null | undefined): number {
  if (index === null || index === undefined) return 1;
  const v = finite(index);
  if (v <= 0) return 1;
  return Math.min(5, Math.max(0.2, v));
}

/**
 * How many to buy when the point is hit: enough to reach the reorder point plus
 * a review period of demand, never below the supplier's minimum.
 *
 * Deliberately NOT an economic order quantity. EOQ needs a per-order cost figure
 * no business has to hand, and its answer is wildly sensitive to that guess — so
 * it produces a precise-looking number built on an invented one. Cover-based
 * top-up is explainable in a sentence, which is worth more here.
 */
export function suggestedOrderQuantity(input: {
  reorderPointUnits: number;
  available: number;
  onOrder: number;
  demandPerDay: number;
  /** How many days of cover to buy on top of the point. */
  reviewPeriodDays?: number;
  minOrderQty?: number | null;
  /** A fixed lot the business always buys in (a pallet, a case quantity). */
  fixedLot?: number | null;
}): number {
  const fixed = input.fixedLot && input.fixedLot > 0 ? Math.ceil(input.fixedLot) : null;
  const position = Math.max(0, finite(input.available)) + Math.max(0, finite(input.onOrder));
  const target =
    Math.max(0, finite(input.reorderPointUnits)) +
    Math.max(0, finite(input.demandPerDay)) * Math.max(0, finite(input.reviewPeriodDays ?? 14));
  const topUp = Math.max(0, Math.ceil(target - position));
  const base = fixed ?? topUp;
  if (base <= 0) return 0;
  return Math.max(base, Math.max(0, Math.ceil(finite(input.minOrderQty ?? 0))));
}

// ─── Cover, stockout, risk ───────────────────────────────────────────────────

/**
 * How many days the stock on hand lasts at the current rate.
 *
 * Null when nothing is selling. That is not "infinite cover" dressed up — it is
 * the honest answer that there is no deadline, and a screen that prints ∞ or
 * 99999 invites someone to sort by it and conclude their dead stock is their
 * healthiest line.
 */
export function daysOfCover(available: number, demandPerDay: number): number | null {
  const d = finite(demandPerDay);
  if (d <= 0) return null;
  return Math.max(0, finite(available)) / d;
}

/**
 * The date the stock is projected to hit zero, given a starting instant.
 *
 * Takes `now` as an argument rather than reading the clock so the same inputs
 * always give the same answer — which is what makes this testable and what keeps
 * a server-rendered figure from disagreeing with the browser's.
 */
export function projectedStockoutAt(
  now: Date,
  available: number,
  demandPerDay: number
): Date | null {
  const cover = daysOfCover(available, demandPerDay);
  if (cover === null) return null;
  return new Date(now.getTime() + cover * 86_400_000);
}

export interface StockoutRiskInput {
  available: number;
  /** Units on an open purchase order for this location. */
  onOrder: number;
  demandPerDay: number;
  /** Days until a replacement could realistically be on the shelf. */
  leadTimeDays: number;
  /** Selling price per unit, minor units. */
  unitPriceCents: number;
}

export interface StockoutRisk {
  /** Cover from stock on the shelf alone. Null when nothing is selling. */
  daysOfCover: number | null;
  /** Cover counting what is already inbound — the number that decides urgency. */
  daysOfCoverWithInbound: number | null;
  /** Days of demand that would go unserved before a replacement could land. */
  shortfallDays: number;
  /** Units of that unserved demand. */
  unitsAtRisk: number;
  /** What those units would have sold for. */
  revenueAtRiskCents: number;
}

/**
 * What running out would actually cost — the figure the reorder list sorts by.
 *
 * The reasoning, in one line: if a replacement takes 12 days and there are only
 * 5 days of stock left, 7 days of demand has nowhere to come from. Value it at
 * the selling price and you have a number that ranks a slow, cheap line below a
 * fast, expensive one — which is the whole point, because "least stock left
 * first" ranks by how empty the shelf looks rather than by what it costs.
 *
 * Inbound stock counts. An order already on its way genuinely closes the gap,
 * and a list that shouts about items already handled is a list people stop
 * reading.
 */
export function stockoutRisk(input: StockoutRiskInput): StockoutRisk {
  const available = Math.max(0, finite(input.available));
  const onOrder = Math.max(0, finite(input.onOrder));
  const d = Math.max(0, finite(input.demandPerDay));
  const lt = Math.max(0, finite(input.leadTimeDays));
  const price = Math.max(0, finite(input.unitPriceCents));

  const cover = daysOfCover(available, d);
  const coverWithInbound = daysOfCover(available + onOrder, d);

  if (d <= 0 || coverWithInbound === null) {
    return {
      daysOfCover: cover,
      daysOfCoverWithInbound: coverWithInbound,
      shortfallDays: 0,
      unitsAtRisk: 0,
      revenueAtRiskCents: 0,
    };
  }

  const shortfallDays = Math.max(0, lt - coverWithInbound);
  const unitsAtRisk = Math.round(shortfallDays * d);
  return {
    daysOfCover: cover,
    daysOfCoverWithInbound: coverWithInbound,
    shortfallDays,
    unitsAtRisk,
    revenueAtRiskCents: Math.round(unitsAtRisk * price),
  };
}

// ─── Holding cost ────────────────────────────────────────────────────────────

/**
 * What it costs to keep this stock for a period, at the tenant's annual rate.
 *
 * Warehousing, insurance, the capital tied up, shrink and obsolescence, taken
 * together as one percentage of value per year. It is an estimate and the
 * surface has to say so — but "£41,000 has not moved in a year" becomes
 * actionable only when it is followed by "and it is costing about £10,000 a year
 * to keep".
 */
export function holdingCostCents(valueCents: number, annualRatePct: number, days = 365): number {
  const value = Math.max(0, finite(valueCents));
  const rate = Math.max(0, finite(annualRatePct)) / 100;
  const period = Math.max(0, finite(days)) / 365;
  return Math.round(value * rate * period);
}

// ─── Classification ──────────────────────────────────────────────────────────

export interface AbcInput {
  key: string;
  /** Annual usage value in minor units — units moved × cost. */
  valueCents: number;
}

export interface AbcResult {
  key: string;
  valueCents: number;
  abcClass: AbcClass;
  /** This item's share of the total, as a percentage. */
  valueSharePct: number;
  /** The running total including this item, as a percentage. */
  cumulativeSharePct: number;
  /** 1-based position in the value ranking. */
  rank: number;
}

/**
 * Rank by annual usage value and cut cumulatively: the items making up the first
 * `aThresholdPct` of the money are A, up to `bThresholdPct` are B, the tail is C.
 *
 * By VALUE, not units and not margin — the question is "where is the money",
 * and 10 a year of a £900 part outranks 4,000 of a 12p washer.
 *
 * Two behaviours worth knowing. An item with no usage at all is C regardless of
 * where the cut falls: a thing nobody bought cannot be a top-attention item, and
 * a catalogue of dormant stock would otherwise make its least dormant row an A.
 * And the item that CROSSES a threshold is included in the class it crosses into
 * — the 80% cut lands mid-item almost always, and putting that item in B would
 * mean the A group covers less than the 80% it claims.
 */
export function classifyAbc(
  items: AbcInput[],
  thresholds: { aThresholdPct?: number; bThresholdPct?: number } = {}
): AbcResult[] {
  const aCut = clampPct(thresholds.aThresholdPct ?? 80, 1, 99);
  const bCut = Math.max(aCut + 0.0001, clampPct(thresholds.bThresholdPct ?? 95, 2, 100));

  const ranked = [...items]
    .map((i) => ({ key: i.key, valueCents: Math.max(0, finite(i.valueCents)) }))
    .sort((a, b) => b.valueCents - a.valueCents || a.key.localeCompare(b.key));

  const total = ranked.reduce((sum, i) => sum + i.valueCents, 0);
  if (total <= 0) {
    return ranked.map((i, index) => ({
      key: i.key,
      valueCents: i.valueCents,
      abcClass: 'C' as const,
      valueSharePct: 0,
      cumulativeSharePct: 0,
      rank: index + 1,
    }));
  }

  let running = 0;
  return ranked.map((item, index) => {
    const sharePct = (item.valueCents / total) * 100;
    // The cumulative share BEFORE this item decides its class, so the item that
    // crosses the 80% line is the last A rather than the first B.
    const before = (running / total) * 100;
    running += item.valueCents;
    const cumulativePct = (running / total) * 100;

    let abcClass: AbcClass = 'C';
    if (item.valueCents <= 0) abcClass = 'C';
    else if (before < aCut) abcClass = 'A';
    else if (before < bCut) abcClass = 'B';

    return {
      key: item.key,
      valueCents: item.valueCents,
      abcClass,
      valueSharePct: round4(sharePct),
      cumulativeSharePct: round4(cumulativePct),
      rank: index + 1,
    };
  });
}

/**
 * The least evidence a steadiness judgement is worth making on.
 *
 * A coefficient of variation over daily demand is a real number for any history
 * at all, which is the trap: an item that sold twice in thirty days produces a
 * CV around 4, and 4 is emphatically "erratic" by any threshold. But it is not a
 * measurement of erratic demand — it is a measurement of not enough demand to
 * have a pattern. Six selling days is the floor at which the spread between them
 * starts describing the item rather than the sample, and four weeks is the floor
 * at which the window is long enough to contain a normal slow fortnight.
 */
export const MIN_DEMAND_DAYS_FOR_XYZ = 6;
export const MIN_HISTORY_DAYS_FOR_XYZ = 28;

/** Is there enough demand history for a steadiness class to mean anything? */
export function xyzEvidenceIsSufficient(evidence: {
  daysWithDemand?: number | null;
  historyDays?: number | null;
}): boolean {
  return (
    (evidence.daysWithDemand ?? 0) >= MIN_DEMAND_DAYS_FOR_XYZ &&
    (evidence.historyDays ?? 0) >= MIN_HISTORY_DAYS_FOR_XYZ
  );
}

/**
 * How forecastable demand is: X steady, Y wobbly, Z effectively random — or
 * `null` when there is not enough history to say.
 *
 * **Null is not Z.** An earlier version returned Z for a null CV, reasoning that
 * an item with no demand history is exactly the item you cannot forecast. That
 * is true of the ITEM and false of the SENTENCE it produces: the screen then
 * tells a business owner their stock is erratic and should be ordered little and
 * often, on the strength of a measurement nobody made. On a young dataset it
 * labelled every line erratic, which is both alarming and useless. An unmeasured
 * thing reports as unmeasured — the same rule seasonality already followed.
 */
export function classifyXyz(
  cv: number | null,
  options: {
    xMaxCv?: number;
    yMaxCv?: number;
    /** Omit both to skip the evidence guard — callers with no history to pass. */
    daysWithDemand?: number | null;
    historyDays?: number | null;
  } = {}
): XyzClass | null {
  const guarded = options.daysWithDemand !== undefined || options.historyDays !== undefined;
  if (guarded && !xyzEvidenceIsSufficient(options)) return null;
  if (cv === null || !Number.isFinite(cv)) return null;
  const xMax = Math.max(0.001, options.xMaxCv ?? 0.5);
  const yMax = Math.max(xMax + 0.001, options.yMaxCv ?? 1);
  if (cv <= xMax) return 'X';
  if (cv <= yMax) return 'Y';
  return 'Z';
}

/**
 * What an ABC×XYZ pair means you should DO, in one sentence of plain English.
 *
 * Nine combinations, nine different policies — plus three more for the case
 * where steadiness is not yet known. This is the payoff of classifying at all: a
 * letter pair on a row is trivia; "count this monthly and keep a tight reorder
 * point" is an instruction.
 *
 * The unknown-steadiness sentences say what to do MEANWHILE rather than
 * pretending the question was answered. Value is known even when steadiness is
 * not — an item can be worth watching before anyone can forecast it.
 */
export function classificationAdvice(abc: AbcClass, xyz: XyzClass | null): string {
  if (xyz === null) {
    if (abc === 'A') {
      return 'One of your bigger spends, but it has not sold on enough separate days to tell whether demand is steady. Watch it yourself until it has.';
    }
    if (abc === 'B') {
      return 'Middling value, and too few selling days so far to judge whether demand is steady. Leave the reorder level as it is for now.';
    }
    return 'Little money in it and too little history to judge. Nothing to do — it will classify itself once it starts moving.';
  }
  if (abc === 'A' && xyz === 'X') {
    return 'Your best line and easy to predict. Keep a tight reorder point, a modest cushion, and count it monthly.';
  }
  if (abc === 'A' && xyz === 'Y') {
    return 'Valuable but uneven. Worth a bigger cushion than the numbers alone suggest, and worth counting monthly.';
  }
  if (abc === 'A') {
    return 'Valuable and unpredictable — the hardest kind to hold. Order little and often rather than in bulk, and count it monthly.';
  }
  if (abc === 'B' && xyz === 'X') {
    return 'Steady and worth a fair amount. Let the reorder point run itself and count it quarterly.';
  }
  if (abc === 'B') {
    return 'Middling value with uneven demand. Keep a cushion, review it when a supplier changes, and count it quarterly.';
  }
  if (xyz === 'X') {
    return 'Low value and predictable. Buy it in larger, less frequent lots and count it once a year.';
  }
  return 'Low value and hard to predict. Buy it when someone asks rather than holding it, and count it once a year.';
}

// ─── Cadence ─────────────────────────────────────────────────────────────────

/** The interval a named cadence means, in days. `custom` has no answer of its own. */
export function cadenceIntervalDays(cadence: CountCadence, custom?: number | null): number {
  switch (cadence) {
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    case 'quarterly':
      return 91;
    case 'annually':
      return 365;
    case 'custom':
    default:
      return Math.max(1, Math.round(finite(custom ?? 30)));
  }
}

/**
 * The cadence the market's convention would give a class: count where the money
 * is monthly, the middle quarterly, the tail annually.
 */
export function cadenceForAbcClass(abc: AbcClass): CountCadence {
  if (abc === 'A') return 'monthly';
  if (abc === 'B') return 'quarterly';
  return 'annually';
}

// ─── Seasonality ─────────────────────────────────────────────────────────────

/**
 * How much hotter or colder this time of year runs: the same period last year
 * against the whole of last year's daily average.
 *
 * Null — never 1 — when there is not enough history. A defaulted 1.0 is
 * indistinguishable from a measured 1.0, and the difference between "we checked
 * and this time of year is normal" and "we have no idea" is the difference
 * between a figure an operator trusts and one they should not.
 */
export function seasonalityIndex(input: {
  /** Units sold in the same calendar window one year ago. */
  samePeriodLastYearUnits: number;
  /** Days in that window. */
  periodDays: number;
  /** Units sold across the whole trailing year that contained it. */
  trailingYearUnits: number;
  /** How much history exists for this item, in days. */
  historyDays: number;
  /** The minimum history the tenant demands before trusting an index. */
  minHistoryDays: number;
}): number | null {
  if (input.historyDays < Math.max(1, input.minHistoryDays)) return null;
  const periodDays = Math.max(1, Math.round(finite(input.periodDays)));
  const yearAvgPerDay = Math.max(0, finite(input.trailingYearUnits)) / 365;
  if (yearAvgPerDay <= 0) return null;
  const periodAvgPerDay = Math.max(0, finite(input.samePeriodLastYearUnits)) / periodDays;
  return round4(periodAvgPerDay / yearAvgPerDay);
}

// ─── Forecast selection ──────────────────────────────────────────────────────

/**
 * Pick the window to forecast from, and say which one it was.
 *
 * A new item has no 90-day history to average — using it would divide a fortnight
 * of sales by ninety days and conclude the thing barely sells. A slow mover has a
 * 30-day window that is mostly zeroes, and its 90-day rate is the more honest
 * one. So: too new for 30 days → the 7-day rate; nothing in the last 30 days but
 * something in the last 90 → the 90-day rate; otherwise the 30-day rate, which is
 * right for almost everything.
 */
export function chooseForecast(input: {
  perDay7: number;
  perDay30: number;
  perDay90: number;
  units30: number;
  units90: number;
  historyDays: number;
}): { perDay: number; basis: ForecastBasis } {
  const history = Math.max(0, finite(input.historyDays));
  const units30 = Math.max(0, finite(input.units30));
  const units90 = Math.max(0, finite(input.units90));

  if (units90 <= 0) return { perDay: 0, basis: 'none' };
  if (history < 30) return { perDay: round4(Math.max(0, finite(input.perDay7))), basis: '7d' };
  if (units30 <= 0) return { perDay: round4(Math.max(0, finite(input.perDay90))), basis: '90d' };
  return { perDay: round4(Math.max(0, finite(input.perDay30))), basis: '30d' };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** NaN and Infinity in, 0 out. Every function here runs over a whole catalogue
 *  and one malformed row must not turn a nightly pass into a column of NaN. */
function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function clampPct(value: number, min: number, max: number): number {
  const v = finite(value);
  return Math.min(max, Math.max(min, v));
}

function round4(n: number): number {
  return Math.round(finite(n) * 10_000) / 10_000;
}
