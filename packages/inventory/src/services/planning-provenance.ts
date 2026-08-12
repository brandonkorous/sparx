// Why is this number what it is — for DERIVED numbers (docs/146 Phase 7.12).
//
// Phase 1 did this for a quantity: click a stock number and see the ledger rows
// that produced it. That read is the platform's single biggest advantage, and it
// only covers facts. This is the same treatment for the figures the planning
// pass INFERRED — which need it more, not less, because an inferred number has
// no rows behind it and therefore nothing to check it against.
//
// One call answers, for one (variant, location):
//
//   • What is the reorder point, and what would it be if the maths decided?
//   • Which demand rate went in, measured over which window, standing on how
//     much history — and how spiky that demand is.
//   • Which lead time went in, measured from how many real deliveries, and how
//     much it varies.
//   • What service level was asked for and what cushion that bought.
//   • The formula, with THIS item's numbers substituted into it.
//   • What is knowably missing, and what that costs in confidence.
//
// ── Confidence is stated, not implied ────────────────────────────────────────
//
// Every planning figure rests on measurements that may be thin. A reorder point
// computed from nine days of sales and one delivery is arithmetically identical
// in shape to one computed from three years and forty deliveries, and presenting
// them the same way is how a planning feature loses an operator. So this read
// scores its own inputs and says out loud which ones are weak — the surface then
// has something better to show than a number.

import {
  reorderPoint as computeReorderPoint,
  safetyStock as computeSafetyStock,
  serviceLevelLabel,
  serviceLevelZ,
  xyzEvidenceIsSufficient,
} from '@sparx/commerce-schemas';
import type { ServiceLevel } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';

import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import { fromDb as velocityFromDb } from './demand';
import type { DemandVelocityRow } from './demand';
import { DEFAULT_LEAD_TIME_DAYS, MIN_RELIABLE_SAMPLES } from './lead-times';
import { loadPlanningPolicy } from './planning-policy';

export type InputConfidence = 'measured' | 'thin' | 'assumed' | 'missing';

export interface PlanningInput {
  key: string;
  /** What this input is, in shop words. */
  label: string;
  /** The value, formatted for reading. */
  value: string;
  /** Where it came from. */
  source: string;
  confidence: InputConfidence;
  /** Why the confidence is what it is, when it is not `measured`. */
  caveat?: string;
}

export interface PlanningProvenance {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseName: string | null;

  /** The trigger in force right now, and who owns it. */
  currentReorderPoint: number | null;
  computedReorderPoint: number | null;
  isAutoManaged: boolean;
  /** True when a person's number and the maths disagree. */
  differs: boolean;

  safetyStockUnits: number | null;
  serviceLevel: ServiceLevel;
  serviceLevelLabel: string;

  /** Every input, with its provenance and its confidence. */
  inputs: PlanningInput[];

  /** The two formulas with this item's numbers in them, as strings a person can
   *  read straight off the screen and check on paper. */
  workings: { safetyStock: string; reorderPoint: string };

  /** The overall verdict on how much this number can be leaned on. */
  confidence: InputConfidence;
  /** What would most improve it. Empty when nothing is missing. */
  improve: string[];

  velocity: DemandVelocityRow | null;
  leadTime: {
    days: number;
    stdDevDays: number;
    source: string;
    sampleCount: number;
    supplierName: string | null;
    promisedDays: number | null;
  } | null;

  computedAt: string | null;
  lastSweepAt: string | null;
}

/**
 * Explain one level's reorder point.
 *
 * Throws NOT_FOUND when there is no level — the same honest answer Phase 1's
 * provenance gives, and for the same reason: nothing has ever stocked this item
 * here, and answering with a page of zeroes would present absence as measurement.
 *
 * Does NOT throw when the planning pass has never run. That is a real and
 * extremely common state (a tenant on their first day), and the correct output
 * is a page that says which measurements are missing and what taking them would
 * need — which is exactly what `inputs` and `improve` carry.
 */
export async function planningProvenance(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string }
): Promise<PlanningProvenance> {
  return withTenant(ctx, async (tx) => {
    const key = {
      variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
    };

    const level = await tx.inventoryLevel.findUnique({
      where: key,
      include: {
        variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
        warehouse: { select: { name: true } },
      },
    });
    if (!level) {
      throw new InventoryNotFoundError('InventoryLevel', `${input.variantId}@${input.warehouseId}`);
    }

    const [policy, velocityRow, plan] = await Promise.all([
      loadPlanningPolicy(tx, ctx.tenantId),
      tx.demandVelocity.findUnique({ where: key }),
      tx.reorderPolicy.findUnique({ where: key }),
    ]);

    const velocity = velocityRow ? velocityFromDb(velocityRow) : null;

    // The supplier lead-time row that the plan would have used, re-read so the
    // explanation names the supplier and the sample size rather than only the
    // number the plan stored.
    const leadTimeDetail = await tx.$queryRaw<
      {
        supplierName: string | null;
        sampleCount: number | null;
        promisedDays: number | null;
        meanDays: number | null;
        stdDevDays: number | null;
      }[]
    >`
      SELECT
        s.name                                     AS "supplierName",
        COALESCE(ltv.sample_count, lta.sample_count)::int         AS "sampleCount",
        COALESCE(ltv.promised_days, lta.promised_days, s.lead_time_days)::int AS "promisedDays",
        COALESCE(ltv.mean_days, lta.mean_days)::float8            AS "meanDays",
        COALESCE(ltv.std_dev_days, lta.std_dev_days)::float8      AS "stdDevDays"
      FROM inventory_supplier_variants sv
      JOIN inventory_suppliers s ON s.id = sv.supplier_id
      LEFT JOIN inventory_supplier_lead_times ltv
        ON ltv.tenant_id = ${ctx.tenantId}::uuid AND ltv.supplier_id = s.id
       AND ltv.variant_id = ${input.variantId}::uuid
      LEFT JOIN inventory_supplier_lead_times lta
        ON lta.tenant_id = ${ctx.tenantId}::uuid AND lta.supplier_id = s.id
       AND lta.variant_id IS NULL
      WHERE sv.tenant_id = ${ctx.tenantId}::uuid
        AND sv.variant_id = ${input.variantId}::uuid
        AND s.deleted_at IS NULL AND s.is_active = true
      ORDER BY sv.is_preferred DESC, sv.unit_cost_cents ASC NULLS LAST
      LIMIT 1
    `;
    const supplier = leadTimeDetail[0] ?? null;

    const serviceLevel = (plan?.serviceLevel as ServiceLevel | null) ?? policy.serviceLevel;
    const leadTimeDays = plan ? Number(plan.leadTimeDaysUsed) : (supplier?.meanDays ?? null);
    const leadTimeStdDev = plan ? Number(plan.leadTimeStdDevUsed) : (supplier?.stdDevDays ?? 0);
    const leadTimeSource = plan?.leadTimeSource ?? (supplier?.meanDays ? 'measured' : 'default');

    const inputs = describeInputs({
      velocity,
      leadTimeDays,
      leadTimeStdDev,
      leadTimeSource,
      sampleCount: supplier?.sampleCount ?? 0,
      supplierName: supplier?.supplierName ?? null,
      serviceLevel,
      safetyStockOverride: plan?.safetyStockOverride ?? null,
      leadTimeOverride: plan?.leadTimeDaysOverride ?? null,
    });

    const workings = describeWorkings({
      demandPerDay: velocity?.forecastPerDay ?? 0,
      demandStdDev: velocity?.demandStdDev ?? 0,
      leadTimeDays: leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS,
      leadTimeStdDev,
      serviceLevel,
      seasonalityIndex: velocity?.seasonalityIndex ?? null,
      safetyStockUnits: plan?.safetyStockUnits ?? null,
      reorderPointUnits: plan?.computedReorderPoint ?? null,
    });

    const confidence = worstConfidence(inputs);

    return {
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      sku: level.variant?.sku ?? null,
      title: level.variant?.product?.title ?? level.variant?.title ?? null,
      warehouseName: level.warehouse?.name ?? null,

      currentReorderPoint: level.reorderPoint,
      computedReorderPoint: plan?.computedReorderPoint ?? level.dynamicReorderPoint ?? null,
      isAutoManaged: plan?.isAutoManaged ?? false,
      differs:
        level.reorderPoint !== null &&
        plan !== null &&
        level.reorderPoint !== plan.computedReorderPoint,

      safetyStockUnits: plan?.safetyStockUnits ?? null,
      serviceLevel,
      serviceLevelLabel: serviceLevelLabel(serviceLevel),

      inputs,
      workings,
      confidence,
      improve: improvements(inputs),

      velocity,
      leadTime:
        leadTimeDays === null
          ? null
          : {
              days: round2(leadTimeDays),
              stdDevDays: round2(leadTimeStdDev),
              source: leadTimeSource,
              sampleCount: supplier?.sampleCount ?? 0,
              supplierName: supplier?.supplierName ?? null,
              promisedDays: supplier?.promisedDays ?? null,
            },

      computedAt: plan?.computedAt.toISOString() ?? null,
      lastSweepAt: policy.lastSweepAt,
    };
  });
}

/** Each input, said the way an owner reads it, with an honest confidence. */
function describeInputs(params: {
  velocity: DemandVelocityRow | null;
  leadTimeDays: number | null;
  leadTimeStdDev: number;
  leadTimeSource: string;
  sampleCount: number;
  supplierName: string | null;
  serviceLevel: ServiceLevel;
  safetyStockOverride: number | null;
  leadTimeOverride: number | null;
}): PlanningInput[] {
  const inputs: PlanningInput[] = [];
  const v = params.velocity;

  // ── How fast it sells ──
  if (!v) {
    inputs.push({
      key: 'demand',
      label: 'How fast it sells',
      value: 'Not measured yet',
      source: 'The nightly measurement has not run for this item',
      confidence: 'missing',
      caveat: 'Without a sales rate there is no run-out date and no reorder point worth having.',
    });
  } else if (v.forecastBasis === 'none') {
    inputs.push({
      key: 'demand',
      label: 'How fast it sells',
      value: 'Nothing in 90 days',
      source: 'Measured from the stock ledger',
      confidence: 'measured',
      caveat: 'Nothing has sold, so there is no demand to plan for.',
    });
  } else {
    inputs.push({
      key: 'demand',
      label: 'How fast it sells',
      value: `${v.forecastPerDay} a day`,
      source: `Measured over the last ${windowLabel(v.forecastBasis)} — ${v.units90} sold in 90 days across ${v.daysWithDemand} days`,
      confidence: v.historyDays < 30 ? 'thin' : 'measured',
      ...(v.historyDays < 30
        ? {
            caveat: `Only ${v.historyDays} days of history, so this rate will move about as more sales land.`,
          }
        : {}),
    });

    // The steadiness WORD is only attached when there is enough evidence to
    // justify it — the same floor `classifyXyz` uses, so this row and the
    // "What matters" badge can never say different things about one item. The
    // spread itself is still shown: it is a real measurement of the sample, and
    // it is what goes into the cushion below whatever we call it.
    const steadinessIsJudgeable = xyzEvidenceIsSufficient({
      daysWithDemand: v.daysWithDemand,
      historyDays: v.historyDays,
    });
    inputs.push({
      key: 'variability',
      label: 'How steady the demand is',
      value:
        v.demandCv === null
          ? 'Not measurable'
          : steadinessIsJudgeable
            ? `${round2(v.demandStdDev)} a day either way (${describeCv(v.demandCv)})`
            : `${round2(v.demandStdDev)} a day either way`,
      source: 'Measured from the daily totals over 90 days',
      confidence: steadinessIsJudgeable ? 'measured' : 'thin',
      ...(steadinessIsJudgeable
        ? {}
        : {
            caveat: `Sales landed on only ${v.daysWithDemand} ${v.daysWithDemand === 1 ? 'day' : 'days'}, which is too few to call demand steady or erratic. The spread is used as a rough cushion.`,
          }),
    });

    inputs.push({
      key: 'seasonality',
      label: 'Whether this time of year runs hot',
      value:
        v.seasonalityIndex === null
          ? 'Not enough history'
          : `${Math.round(v.seasonalityIndex * 100)}% of a normal month`,
      source:
        v.seasonalityIndex === null
          ? 'A year of history is needed before the same period last year means anything'
          : 'The same period last year, against that year’s average',
      confidence: v.seasonalityIndex === null ? 'missing' : 'measured',
      ...(v.seasonalityIndex === null
        ? { caveat: 'The reorder point is worked out as if every month were average.' }
        : {}),
    });
  }

  // ── How long the supplier takes ──
  const days = params.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  if (params.leadTimeOverride !== null) {
    inputs.push({
      key: 'lead_time',
      label: 'How long the supplier takes',
      value: `${params.leadTimeOverride} days`,
      source: 'You set this by hand',
      confidence: 'assumed',
      caveat: 'Your figure is used instead of the measured one.',
    });
  } else if (params.leadTimeSource === 'measured') {
    inputs.push({
      key: 'lead_time',
      label: 'How long the supplier takes',
      value: `${round2(days)} days, ±${round2(params.leadTimeStdDev)}`,
      source: `Measured across ${params.sampleCount} deliveries${
        params.supplierName ? ` from ${params.supplierName}` : ''
      }`,
      confidence: params.sampleCount >= MIN_RELIABLE_SAMPLES * 2 ? 'measured' : 'thin',
      ...(params.sampleCount < MIN_RELIABLE_SAMPLES * 2
        ? { caveat: `${params.sampleCount} deliveries is a small sample — expect this to settle.` }
        : {}),
    });
  } else if (params.leadTimeSource === 'default') {
    inputs.push({
      key: 'lead_time',
      label: 'How long the supplier takes',
      value: `${DEFAULT_LEAD_TIME_DAYS} days`,
      source: 'Nothing is known, so a standard fortnight is assumed',
      confidence: 'assumed',
      caveat:
        'No supplier is linked and no deliveries have been recorded. This is the weakest part of the calculation.',
    });
  } else {
    inputs.push({
      key: 'lead_time',
      label: 'How long the supplier takes',
      value: `${round2(days)} days`,
      source:
        params.leadTimeSource === 'supplier'
          ? `${params.supplierName ?? 'The supplier'} states this — it has not been checked against real deliveries`
          : 'Set on this stock line',
      confidence: 'assumed',
      caveat: 'A stated lead time carries no spread, so the cushion covers demand only.',
    });
  }

  // ── The cushion ──
  inputs.push({
    key: 'service_level',
    label: 'How often you want to be in stock',
    value: serviceLevelLabel(params.serviceLevel),
    source:
      params.safetyStockOverride !== null
        ? 'Overridden — you set the cushion by hand'
        : 'Your planning settings',
    confidence: params.safetyStockOverride !== null ? 'assumed' : 'measured',
    ...(params.safetyStockOverride !== null
      ? { caveat: `The cushion is fixed at ${params.safetyStockOverride} rather than worked out.` }
      : {}),
  });

  return inputs;
}

/**
 * The formulas with the numbers in them.
 *
 * Written out rather than described, because "1.64 × √(12 × 3.2² + 4.1² × 2.8²)
 * = 39" is checkable by anyone with a calculator and "we apply a statistical
 * safety-stock model" is checkable by nobody.
 */
function describeWorkings(params: {
  demandPerDay: number;
  demandStdDev: number;
  leadTimeDays: number;
  leadTimeStdDev: number;
  serviceLevel: ServiceLevel;
  seasonalityIndex: number | null;
  safetyStockUnits: number | null;
  reorderPointUnits: number | null;
}): { safetyStock: string; reorderPoint: string } {
  const z = serviceLevelZ(params.serviceLevel);
  const ss =
    params.safetyStockUnits ??
    computeSafetyStock({
      demandPerDay: params.demandPerDay,
      demandStdDev: params.demandStdDev,
      leadTimeDays: params.leadTimeDays,
      leadTimeStdDev: params.leadTimeStdDev,
      z,
    });
  const point =
    params.reorderPointUnits ??
    computeReorderPoint({
      demandPerDay: params.demandPerDay,
      leadTimeDays: params.leadTimeDays,
      safetyStockUnits: ss,
      seasonalityIndex: params.seasonalityIndex,
    });

  const season = params.seasonalityIndex ?? 1;
  const seasonPart = params.seasonalityIndex === null ? '' : ` × ${round2(season)}`;

  return {
    safetyStock:
      `${z} × √( ${round2(params.leadTimeDays)} × ${round2(params.demandStdDev)}²` +
      ` + ${round2(params.demandPerDay)}² × ${round2(params.leadTimeStdDev)}² ) = ${ss}`,
    reorderPoint:
      `${round2(params.demandPerDay)} a day × ${round2(params.leadTimeDays)} days${seasonPart}` +
      ` + ${ss} cushion = ${point}`,
  };
}

/** The verdict is the WEAKEST input, not the average of them. A perfect demand
 *  measurement against a guessed lead time produces a guessed reorder point. */
function worstConfidence(inputs: PlanningInput[]): InputConfidence {
  const order: InputConfidence[] = ['missing', 'assumed', 'thin', 'measured'];
  for (const level of order) {
    if (inputs.some((i) => i.confidence === level)) return level;
  }
  return 'measured';
}

/** What would most improve the number, in the order it would help. */
function improvements(inputs: PlanningInput[]): string[] {
  const out: string[] = [];
  for (const i of inputs) {
    if (i.confidence === 'measured') continue;
    if (i.key === 'demand' && i.confidence === 'missing') {
      out.push(
        'Nothing has measured this item yet — it will be picked up on the next nightly run.'
      );
    }
    if (i.key === 'lead_time' && i.confidence === 'assumed') {
      out.push(
        'Link a supplier and record deliveries against purchase orders — a measured lead time is the single biggest improvement to this number.'
      );
    }
    if (i.key === 'seasonality' && i.confidence === 'missing') {
      out.push('After a year of trading, this will start allowing for busy and quiet seasons.');
    }
  }
  return out;
}

function windowLabel(basis: string): string {
  if (basis === '7d') return '7 days';
  if (basis === '90d') return '90 days';
  return '30 days';
}

function describeCv(cv: number): string {
  if (cv <= 0.5) return 'steady';
  if (cv <= 1) return 'uneven';
  return 'very erratic';
}

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
