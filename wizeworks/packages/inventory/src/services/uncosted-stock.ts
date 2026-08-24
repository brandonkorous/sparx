// The stock nobody has said what they paid for.
//
// ── Why this exists as a screen rather than a field ─────────────────────────
//
// Cost is optional and the product form never asks for it, so a business can
// run for months before any value-of-stock figure means anything — and the
// owner has no reason to know, because the figure renders as a confident
// $0.00 rather than as a gap. Every derived number built on cost is affected:
// margin, what the shelves are worth, whether a discount is profitable.
//
// Asking on the product form would be the obvious fix and is the wrong one. A
// product is created at the moment of LEAST knowledge — often before the first
// delivery, sometimes before the supplier is chosen — and a required field
// there is a wall across the five-minute setup for a number the person cannot
// answer yet. Cost properly arrives with the DELIVERY, which the platform
// already stamps per movement.
//
// What that leaves is the opening balance: the stock you already had on the day
// you started. This is the list of exactly that, and nothing else.

import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

export interface UncostedVariantRow {
  variantId: string;
  productId: string;
  sku: string | null;
  title: string;
  variantName: string | null;
  /** On-hand units across every location, so the person can see what the number
   *  they are about to type will be multiplied by. */
  onHand: number;
  /** What it sells for. The single most useful anchor when someone is trying to
   *  remember what they paid — and the one figure they have already entered. */
  priceCents: number | null;
}

export interface UncostedStockReport {
  items: UncostedVariantRow[];
  total: number;
  /** Units represented by `total`, so a partial page still reports the whole. */
  uncostedUnits: number;
}

interface Row {
  variantId: string;
  productId: string;
  sku: string | null;
  title: string;
  variantName: string | null;
  onHand: bigint;
  priceCents: number | null;
}

/**
 * Every owned variant that has stock on a shelf and no cost anywhere.
 *
 * Ordered by units held, descending: the biggest holdings move the valuation
 * most, so somebody who fills in five rows and stops has still fixed most of
 * the number. Alphabetical would spread the same effort at random.
 */
export async function uncostedStock(
  ctx: ServiceContext,
  filter: { take?: number; skip?: number } = {}
): Promise<UncostedStockReport> {
  const take = Math.min(filter.take ?? 100, 500);
  const skip = filter.skip ?? 0;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<Row[]>`
      SELECT v.id                                     AS "variantId",
             v.product_id                             AS "productId",
             v.sku                                    AS "sku",
             p.title                                  AS "title",
             COALESCE(v.title, opts.label)            AS "variantName",
             COALESCE(SUM(l.on_hand), 0)::bigint      AS "onHand",
             v.price_cents                            AS "priceCents"
      FROM commerce_product_variants v
      JOIN commerce_products p ON p.id = v.product_id AND p.deleted_at IS NULL
      JOIN inventory_levels l ON l.variant_id = v.id
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      -- What she CALLS it. A variant's title is usually null (the schema computes
      -- it from the options), so without this every one of fifteen Ash Overshirt
      -- rows reads "The Ash Overshirt" and is told apart only by its code.
      LEFT JOIN LATERAL (
        SELECT string_agg(ov.value, ' / ' ORDER BY o.position, ov.position) AS label
        FROM commerce_product_variant_option_values vov
        JOIN commerce_product_option_values ov ON ov.id = vov.option_value_id
        JOIN commerce_product_options o ON o.id = ov.option_id
        WHERE vov.variant_id = v.id
      ) opts ON TRUE
      WHERE v.tenant_id = ${ctx.tenantId}::uuid
        AND v.deleted_at IS NULL
        AND v.cost_cents IS NULL
        AND l.ownership = 'owned'
        AND l.avg_cost_cents IS NULL
        AND l.unit_cost_cents IS NULL
      GROUP BY v.id, v.product_id, v.sku, p.title, v.title, opts.label, v.price_cents
      HAVING COALESCE(SUM(l.on_hand), 0) > 0
      ORDER BY COALESCE(SUM(l.on_hand), 0) DESC, p.title ASC
      LIMIT ${take} OFFSET ${skip}
    `;

    const [totals] = await tx.$queryRaw<{ total: bigint; units: bigint }[]>`
      SELECT COUNT(*)::bigint AS "total", COALESCE(SUM(units), 0)::bigint AS "units"
      FROM (
        SELECT COALESCE(SUM(l.on_hand), 0) AS units
        FROM commerce_product_variants v
        JOIN commerce_products p ON p.id = v.product_id AND p.deleted_at IS NULL
        JOIN inventory_levels l ON l.variant_id = v.id
        JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
        WHERE v.tenant_id = ${ctx.tenantId}::uuid
          AND v.deleted_at IS NULL
          AND v.cost_cents IS NULL
          AND l.ownership = 'owned'
          AND l.avg_cost_cents IS NULL
          AND l.unit_cost_cents IS NULL
        GROUP BY v.id
        HAVING COALESCE(SUM(l.on_hand), 0) > 0
      ) held
    `;

    return {
      items: rows.map((r) => ({
        variantId: r.variantId,
        productId: r.productId,
        sku: r.sku,
        title: r.title,
        variantName: r.variantName,
        onHand: Number(r.onHand),
        priceCents: r.priceCents,
      })),
      total: Number(totals?.total ?? 0),
      uncostedUnits: Number(totals?.units ?? 0),
    };
  });
}

export interface CostEntry {
  variantId: string;
  /** What one of them cost. Never zero: a genuinely free item is rare enough
   *  that recording it as "no cost" and having the screen say so is more honest
   *  than a zero nobody can tell from an unanswered question. */
  costCents: number;
}

export interface SetCostsResult {
  updated: number;
  /** Variants the caller named that were not theirs, already costed, or gone.
   *  Reported rather than silently dropped — a save that says "12 updated" when
   *  15 were typed is the kind of thing found weeks later. */
  skipped: string[];
}

/**
 * Record what a batch of stock cost.
 *
 * Writes `cost_cents` on the VARIANT, which is the level a person thinks at
 * ("what does an Ash Overshirt in medium cost me") and the fallback the whole
 * costing chain already ends at: avg_cost → unit_cost → variant.cost. Later
 * deliveries layer real landed costs on top and take over; this only ever fills
 * the gap underneath them.
 *
 * Guarded to variants that are still uncosted, so a save racing a delivery
 * cannot overwrite a real landed cost with somebody's recollection.
 */
export async function setVariantCosts(
  ctx: ServiceContext,
  entries: CostEntry[]
): Promise<SetCostsResult> {
  if (entries.length === 0) return { updated: 0, skipped: [] };

  return withTenant(ctx, async (tx) => {
    const skipped: string[] = [];
    let updated = 0;

    for (const entry of entries) {
      const { count } = await tx.productVariant.updateMany({
        where: { id: entry.variantId, deletedAt: null, costCents: null },
        data: { costCents: entry.costCents },
      });
      if (count === 0) skipped.push(entry.variantId);
      else updated += count;
    }

    await tx.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'inventory.costs.recorded',
        entityType: 'Tenant',
        entityId: ctx.tenantId,
        diff: { after: { updated, skipped: skipped.length } },
      },
    });

    return { updated, skipped };
  });
}
