// ABC / XYZ classification (docs/146 Phase 7.8).
//
// Two questions with two different answers, applied together.
//
//   ABC — where is the money? Rank every (variant, location) by its annual usage
//         VALUE (units moved × what a unit costs) and cut the ranking at 80% and
//         95% of the running total. A is the handful of lines carrying most of
//         the spend, C is the long tail.
//
//   XYZ — can it be forecast? The coefficient of variation of daily demand,
//         which Phase 7.1 already measured. X is steady, Y wobbles, Z is
//         effectively random.
//
// Neither is interesting on its own; the PAIR is the instruction. An AX line
// justifies a tight reorder point and a monthly count. A CZ line justifies
// buying it when someone asks and counting it once a year. That translation is
// `classificationAdvice`, and it is why this is a feature rather than two extra
// letters on a row.
//
// ── The tenant-wide ranking is the point, and the reason this is not per-row ──
//
// A cumulative cut only means something across the whole population, so the
// classification of one item genuinely depends on every other item. That makes
// this the one planning computation that cannot be done a level at a time — the
// whole set is read, ranked in memory, and written back. It is also why an
// override has to be stored rather than applied at read time: the ranking would
// otherwise silently re-shuffle around it.
//
// ── The override wins, and both are kept ─────────────────────────────────────
//
// A buyer who knows the £900 part is being discontinued, or that the 12p washer
// is the one that stops a production line, holds information no ledger has. The
// override wins everywhere it is used and the nightly pass never clears it — but
// the MEASURED class keeps being computed alongside, so the surface can say
// "measured C, you set A" instead of pretending the override was the finding.

import {
  classificationAdvice,
  classifyAbc,
  classifyXyz,
  coefficientOfVariation,
} from '@wizeworks/commerce-schemas';
import type { AbcClass, XyzClass } from '@wizeworks/commerce-schemas';
import { SetClassificationOverrideInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishInventoryEvent } from '../events';
import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import { loadPlanningPolicy } from './planning-policy';

const WRITE_CHUNK = 200;

export interface ClassificationRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string | null;
  /** The location in words. Without it a catalogue kept in two places shows the
      same SKU twice with nothing to tell the rows apart. */
  warehouseName: string | null;
  /** What the ledger says. Steadiness is null until there is enough history. */
  measuredAbcClass: AbcClass;
  measuredXyzClass: XyzClass | null;
  /** What a person said, when they said anything. */
  abcOverride: AbcClass | null;
  xyzOverride: XyzClass | null;
  /** The pair everything downstream uses: the override where there is one. */
  abcClass: AbcClass;
  xyzClass: XyzClass | null;
  annualUsageUnits: number;
  annualUsageValueCents: number;
  valueSharePct: number;
  cumulativeSharePct: number;
  demandCv: number | null;
  /** What to DO about this pair, in a sentence. */
  advice: string;
  overrideReason: string | null;
  overrideAt: string | null;
  classifiedAt: string;
}

export interface ClassificationSweepResult {
  levelsClassified: number;
  counts: { A: number; B: number; C: number; X: number; Y: number; Z: number };
  changed: number;
}

interface UsageRow {
  variantId: string;
  warehouseId: string;
  annualUsageUnits: number;
  annualUsageValueCents: number;
  demandCv: number | null;
  perDay90: number | null;
  demandStdDev: number | null;
  /** The evidence behind the CV — a steadiness class is only worth writing when
      there is enough of it. Nulls when the level has no velocity row at all. */
  daysWithDemand: number | null;
  historyDays: number | null;
}

/**
 * Re-rank the whole catalogue and write both classes.
 *
 * Fires `inventory.classification.changed` ONCE per sweep carrying the count and
 * a sample, not once per item: a re-ranking after a busy quarter moves hundreds
 * of items, and a per-item event would be a few hundred notifications saying
 * nothing an operator can act on individually.
 */
export async function recomputeClassifications(
  ctx: ServiceContext
): Promise<ClassificationSweepResult> {
  const { usage, thresholds } = await withTenant(ctx, async (tx) => {
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);
    return {
      usage: await collectUsage(tx, ctx.tenantId),
      thresholds: {
        aThresholdPct: policy.abcAThresholdPct,
        bThresholdPct: policy.abcBThresholdPct,
        xMaxCv: policy.xyzXMaxCv,
        yMaxCv: policy.xyzYMaxCv,
      },
    };
  });

  const abc = classifyAbc(
    usage.map((u) => ({ key: keyOf(u), valueCents: u.annualUsageValueCents })),
    { aThresholdPct: thresholds.aThresholdPct, bThresholdPct: thresholds.bThresholdPct }
  );
  const abcByKey = new Map(abc.map((r) => [r.key, r]));

  const computed = usage.map((u) => {
    const ranked = abcByKey.get(keyOf(u));
    // A CV the velocity pass could not measure is recomputed here from its two
    // parts rather than treated as absent — the same fallback, in one place.
    const cv = u.demandCv ?? coefficientOfVariation(u.perDay90 ?? 0, u.demandStdDev ?? 0) ?? null;
    return {
      variantId: u.variantId,
      warehouseId: u.warehouseId,
      abcClass: ranked?.abcClass ?? 'C',
      // Evidence goes in with the thresholds: below the floor this returns null
      // ("not enough selling days to say") rather than Z ("erratic"). Value is
      // still ranked — ABC needs only a year's usage total, not a pattern.
      xyzClass: classifyXyz(cv, {
        xMaxCv: thresholds.xMaxCv,
        yMaxCv: thresholds.yMaxCv,
        daysWithDemand: u.daysWithDemand,
        historyDays: u.historyDays,
      }),
      annualUsageUnits: u.annualUsageUnits,
      annualUsageValueCents: u.annualUsageValueCents,
      valueSharePct: ranked?.valueSharePct ?? 0,
      cumulativeSharePct: ranked?.cumulativeSharePct ?? 0,
      demandCv: cv,
    };
  });

  let changed = 0;
  for (let i = 0; i < computed.length; i += WRITE_CHUNK) {
    const chunk = computed.slice(i, i + WRITE_CHUNK);
    changed += await withTenant(ctx, async (tx) => {
      let moved = 0;
      for (const c of chunk) {
        const before = await tx.inventoryClassification.findUnique({
          where: {
            variantId_warehouseId: { variantId: c.variantId, warehouseId: c.warehouseId },
          },
          select: { abcClass: true, xyzClass: true },
        });
        if (before && (before.abcClass !== c.abcClass || before.xyzClass !== c.xyzClass)) {
          moved += 1;
        }
        const data = {
          abcClass: c.abcClass,
          xyzClass: c.xyzClass,
          annualUsageUnits: c.annualUsageUnits,
          annualUsageValueCents: BigInt(Math.round(c.annualUsageValueCents)),
          valueSharePct: c.valueSharePct,
          cumulativeSharePct: c.cumulativeSharePct,
          demandCv: c.demandCv,
          classifiedAt: new Date(),
        };
        await tx.inventoryClassification.upsert({
          where: {
            variantId_warehouseId: { variantId: c.variantId, warehouseId: c.warehouseId },
          },
          create: {
            tenantId: ctx.tenantId,
            variantId: c.variantId,
            warehouseId: c.warehouseId,
            ...data,
          },
          update: data,
        });
        await applyEffectiveClassToLevel(tx, c.variantId, c.warehouseId);
      }
      return moved;
    });
  }

  const counts = tally(computed);
  if (changed > 0) {
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'inventory.classification.changed',
      data: { changedCount: changed, levelsClassified: computed.length, counts },
    });
  }

  return { levelsClassified: computed.length, counts, changed };
}

/**
 * Annual usage in units and in money, per level, plus the variability the
 * velocity pass already measured.
 *
 * Cost basis is the same COALESCE chain valuation uses (moving average → the
 * set unit cost → the catalogue cost), so an item's ABC rank and its line in the
 * valuation report cannot tell two different stories about what it is worth.
 */
async function collectUsage(tx: TxClient, tenantId: string): Promise<UsageRow[]> {
  return tx.$queryRaw<UsageRow[]>`
    SELECT
      l.variant_id                                                       AS "variantId",
      l.warehouse_id                                                     AS "warehouseId",
      COALESCE(u.units, 0)::int                                          AS "annualUsageUnits",
      (COALESCE(u.units, 0)
        * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0))::float8
                                                                         AS "annualUsageValueCents",
      dv.demand_cv::float8                                               AS "demandCv",
      dv.per_day_90::float8                                              AS "perDay90",
      dv.demand_std_dev::float8                                          AS "demandStdDev",
      dv.days_with_demand::int                                           AS "daysWithDemand",
      dv.history_days::int                                               AS "historyDays"
    FROM inventory_levels l
    JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
    JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(ABS(m.delta)), 0) AS units
      FROM inventory_movements m
      WHERE m.tenant_id = l.tenant_id
        AND m.variant_id = l.variant_id
        AND m.warehouse_id = l.warehouse_id
        AND m.reason IN ('sale','assembly_out')
        AND m.created_at >= now() - interval '365 days'
    ) u ON true
    LEFT JOIN inventory_demand_velocity dv
      ON dv.variant_id = l.variant_id AND dv.warehouse_id = l.warehouse_id
    WHERE l.tenant_id = ${tenantId}::uuid
  `;
}

/** Copy the EFFECTIVE pair (override first) onto the level's fast-read columns. */
async function applyEffectiveClassToLevel(
  tx: TxClient,
  variantId: string,
  warehouseId: string
): Promise<void> {
  const row = await tx.inventoryClassification.findUnique({
    where: { variantId_warehouseId: { variantId, warehouseId } },
    select: { abcClass: true, xyzClass: true, abcOverride: true, xyzOverride: true },
  });
  if (!row) return;
  await tx.inventoryLevel.update({
    where: { variantId_warehouseId: { variantId, warehouseId } },
    data: {
      abcClass: row.abcOverride ?? row.abcClass,
      xyzClass: row.xyzOverride ?? row.xyzClass,
    },
  });
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListClassificationsFilter {
  warehouseId?: string;
  abcClass?: AbcClass;
  /** `unknown` selects the rows whose steadiness could not be judged yet — on a
      young catalogue that is most of them, so it needs to be reachable. */
  xyzClass?: XyzClass | 'unknown';
  /** Only rows a person has overridden. */
  overriddenOnly?: boolean;
  q?: string;
  take?: number;
  skip?: number;
}

export async function listClassifications(
  ctx: ServiceContext,
  filter: ListClassificationsFilter = {}
): Promise<{ items: ClassificationRow[]; total: number }> {
  const take = Math.min(filter.take ?? 50, 250);
  const skip = Math.max(filter.skip ?? 0, 0);

  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      // Filtering on the EFFECTIVE class means an overridden row appears under
      // the class its owner put it in, which is the only reading that is not a
      // surprise. `OR` rather than a computed column because Prisma has no way
      // to index a COALESCE and the row count here is small.
      ...(filter.abcClass
        ? {
            OR: [
              { abcOverride: filter.abcClass },
              { abcOverride: null, abcClass: filter.abcClass },
            ],
          }
        : {}),
      ...(filter.xyzClass
        ? {
            AND: [
              filter.xyzClass === 'unknown'
                ? // Unmeasured means BOTH are absent: an override is a person
                  // answering the question, which makes it answered.
                  { xyzOverride: null, xyzClass: null }
                : {
                    OR: [
                      { xyzOverride: filter.xyzClass },
                      { xyzOverride: null, xyzClass: filter.xyzClass },
                    ],
                  },
            ],
          }
        : {}),
      ...(filter.overriddenOnly
        ? { NOT: { AND: [{ abcOverride: null }, { xyzOverride: null }] } }
        : {}),
      ...(filter.q
        ? {
            variant: {
              OR: [
                { sku: { contains: filter.q, mode: 'insensitive' as const } },
                { title: { contains: filter.q, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      tx.inventoryClassification.findMany({
        where,
        orderBy: [{ annualUsageValueCents: 'desc' }],
        take,
        skip,
        include: {
          variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
          warehouse: { select: { code: true, name: true } },
        },
      }),
      tx.inventoryClassification.count({ where }),
    ]);

    return { items: rows.map(toClassificationRow), total };
  });
}

export async function getClassification(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string }
): Promise<ClassificationRow | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.inventoryClassification.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      include: {
        variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
        warehouse: { select: { code: true, name: true } },
      },
    });
    return row ? toClassificationRow(row) : null;
  });
}

/**
 * Set or clear a person's override.
 *
 * Passing null for a class CLEARS that override and hands the item back to the
 * measurement — which is a distinct action from setting it to the class the
 * measurement happens to give today, because the measurement moves and the
 * override does not.
 */
export async function setClassificationOverride(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ClassificationRow> {
  const input = SetClassificationOverrideInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryClassification.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
    });
    if (!existing) {
      // Nothing has classified this level yet. That is a real answer — there is
      // no measurement to override, and inventing a row would present the
      // override as though it sat on top of a finding.
      throw new InventoryNotFoundError(
        'InventoryClassification',
        `${input.variantId}@${input.warehouseId}`
      );
    }

    const hasOverride = input.abcClass != null || input.xyzClass != null;
    await tx.inventoryClassification.update({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      data: {
        abcOverride: input.abcClass ?? null,
        xyzOverride: input.xyzClass ?? null,
        overrideReason: hasOverride ? (input.reason ?? null) : null,
        overrideBy: hasOverride ? (ctx.userId ?? null) : null,
        overrideAt: hasOverride ? new Date() : null,
      },
    });
    await applyEffectiveClassToLevel(tx, input.variantId, input.warehouseId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.classification.override_set',
      entityType: 'InventoryClassification',
      // entity_id is a single UUID — key on the variant, carry the warehouse in
      // the diff. The same convention `setReorderPolicy` uses for level-scoped
      // audits; a composite `variant:warehouse` string fails the column outright.
      entityId: input.variantId,
      diff: {
        before: { abc: existing.abcOverride, xyz: existing.xyzOverride },
        after: {
          warehouseId: input.warehouseId,
          abc: input.abcClass ?? null,
          xyz: input.xyzClass ?? null,
        },
      },
    });

    const updated = await tx.inventoryClassification.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      include: {
        variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
        warehouse: { select: { code: true, name: true } },
      },
    });
    // Re-read inside the same transaction; the update above guarantees it exists.
    return toClassificationRow(updated!);
  });
}

function toClassificationRow(row: {
  variantId: string;
  warehouseId: string;
  abcClass: string;
  xyzClass: string | null;
  abcOverride: string | null;
  xyzOverride: string | null;
  annualUsageUnits: number;
  annualUsageValueCents: bigint;
  valueSharePct: unknown;
  cumulativeSharePct: unknown;
  demandCv: unknown;
  overrideReason: string | null;
  overrideAt: Date | null;
  classifiedAt: Date;
  variant?: { sku: string | null; title: string | null; product?: { title: string } | null } | null;
  warehouse?: { code: string; name?: string } | null;
}): ClassificationRow {
  const measuredAbc = row.abcClass as AbcClass;
  const measuredXyz = (row.xyzClass as XyzClass | null) ?? null;
  const abc = (row.abcOverride as AbcClass | null) ?? measuredAbc;
  const xyz = (row.xyzOverride as XyzClass | null) ?? measuredXyz;
  return {
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    sku: row.variant?.sku ?? null,
    title: row.variant?.product?.title ?? row.variant?.title ?? null,
    warehouseCode: row.warehouse?.code ?? null,
    warehouseName: row.warehouse?.name ?? null,
    measuredAbcClass: measuredAbc,
    measuredXyzClass: measuredXyz,
    abcOverride: (row.abcOverride as AbcClass | null) ?? null,
    xyzOverride: (row.xyzOverride as XyzClass | null) ?? null,
    abcClass: abc,
    xyzClass: xyz,
    annualUsageUnits: row.annualUsageUnits,
    annualUsageValueCents: Number(row.annualUsageValueCents),
    valueSharePct: Number(row.valueSharePct),
    cumulativeSharePct: Number(row.cumulativeSharePct),
    demandCv: row.demandCv === null ? null : Number(row.demandCv),
    advice: classificationAdvice(abc, xyz),
    overrideReason: row.overrideReason,
    overrideAt: row.overrideAt?.toISOString() ?? null,
    classifiedAt: row.classifiedAt.toISOString(),
  };
}

function keyOf(u: { variantId: string; warehouseId: string }): string {
  return `${u.variantId}::${u.warehouseId}`;
}

function tally(rows: { abcClass: AbcClass; xyzClass: XyzClass | null }[]): {
  A: number;
  B: number;
  C: number;
  X: number;
  Y: number;
  Z: number;
} {
  const counts = { A: 0, B: 0, C: 0, X: 0, Y: 0, Z: 0 };
  for (const r of rows) {
    counts[r.abcClass] += 1;
    // A level with no steadiness class counts toward none of X/Y/Z. The three
    // deliberately do not sum to the total — reporting an unmeasured row as Z
    // is precisely the overstatement this whole change removes.
    if (r.xyzClass) counts[r.xyzClass] += 1;
  }
  return counts;
}
