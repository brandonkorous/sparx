// Cost layers — which units, bought when, at what price (docs/146 Phase 5.4/5.9).
//
// `inventory_levels.avg_cost_cents` is a moving-average SUMMARY: one number per
// (variant, location). It answers "what is a unit worth" cheaply, and it is what
// valuation has always read. What it cannot answer is "which units, bought when,
// at what price" — and that is precisely the question behind the word FIFO.
//
// A layer is one costed arrival with a count of how many of those units are
// still on the shelf. Outbound movements consume layers oldest-first and record
// what they took. Two invariants make the whole thing checkable:
//
//     layer.quantityRemaining == layer.quantity − Σ(its consumptions.quantity)
//     Σ(open layers for a variant+location) == on_hand
//
// ── Layers are kept whatever method the tenant chose ─────────────────────────
//
// A business that switches to FIFO next year needs the history to already exist,
// and a layer ledger only some tenants keep is a layer ledger nobody can trust.
// So every costed inbound writes a layer and every outbound consumes one,
// regardless of the costing method. The method decides which number gets STAMPED
// on the movement as the cost of goods — not whether the layers are maintained.
//
// ── Concurrency ──────────────────────────────────────────────────────────────
//
// Everything here runs inside `applyMovement`, which has already taken a
// `FOR UPDATE` lock on the (variant, warehouse) level row. Layers for that pair
// are only ever touched under that lock, so two concurrent sales cannot consume
// the same units — the same guarantee that keeps `on_hand` correct, reused.
//
// ── Nothing here writes on_hand ──────────────────────────────────────────────
//
// Worth saying twice. The cost ledger is a passenger on the stock ledger.

import { Prisma } from '@sparx/db';
import type { TxClient } from '@sparx/db';

/** Where a layer's units came from. Mirrors the CHECK on
 *  `inventory_cost_layers.source_type` — a value here that is not in that
 *  constraint fails at INSERT with a bare 23514 nothing upstream predicts. */
export type CostLayerSource =
  | 'receipt'
  | 'adjustment'
  | 'return'
  | 'transfer_in'
  | 'opening'
  | 'count'
  // Made, rather than bought (docs/146 Phase 6.5). A finished assembly is a
  // costed arrival like any other and needs a layer to be sold out of later.
  | 'assembly';

export interface WriteLayerInput {
  tenantId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  /** Landed unit cost in base currency — goods plus allocated charges. */
  unitCostCents: number;
  /** The goods alone, so a breakdown can separate the part from the freight.
   *  Defaults to `unitCostCents` when the caller has no charges to separate. */
  goodsUnitCostCents?: number;
  sourceType: CostLayerSource;
  sourceId?: string | null;
  movementId?: string | null;
  /** When the units ARRIVED. A back-dated receipt sorts by when the goods
   *  landed, not by when someone got round to typing it in. */
  acquiredAt?: Date;
}

/** One layer a consumption will draw from, with how much it will take. */
export interface ConsumptionSlice {
  layerId: string;
  quantity: number;
  unitCostCents: number;
}

export interface ConsumptionPlan {
  slices: ConsumptionSlice[];
  /** Units the open layers could not cover. Valued by the caller at the moving
   *  average — see `costOfGoods`. */
  shortfall: number;
  /** Cost of the units the layers DID cover. */
  coveredCostCents: number;
}

interface OpenLayerRow {
  id: string;
  quantity_remaining: number;
  unit_cost_cents: number;
}

/**
 * Record a costed arrival.
 *
 * A zero-quantity or negative-cost arrival writes nothing: a layer that carries
 * no units is a row that will be scanned forever and never consumed, and a
 * negative cost is a data error that would silently make stock worth less than
 * nothing in every report downstream.
 */
export async function writeCostLayer(tx: TxClient, input: WriteLayerInput): Promise<string | null> {
  if (input.quantity <= 0) return null;
  const unitCost = Math.max(0, Math.round(input.unitCostCents));
  const goodsCost = Math.max(0, Math.round(input.goodsUnitCostCents ?? unitCost));

  const layer = await tx.inventoryCostLayer.create({
    data: {
      tenantId: input.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      quantityRemaining: input.quantity,
      unitCostCents: unitCost,
      goodsUnitCostCents: goodsCost,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      movementId: input.movementId ?? null,
      ...(input.acquiredAt ? { acquiredAt: input.acquiredAt } : {}),
    },
    select: { id: true },
  });
  return layer.id;
}

/**
 * Work out which layers `quantity` units would come off, oldest first.
 *
 * Reads only — nothing is written until `commitConsumption`, because the
 * movement row those consumptions point at does not exist yet. Both halves run
 * under the same level lock, so nothing can slip between them.
 *
 * A shortfall is NOT an error. Stock can legitimately outrun its layers: a sale
 * under a `continue` policy drives on-hand negative, and a business importing
 * history has stock the platform never costed. Refusing to answer would break
 * checkout to protect a report; the caller values the uncovered units at the
 * moving average and the shortfall is visible in the breakdown.
 */
export async function planConsumption(
  tx: TxClient,
  params: { tenantId: string; variantId: string; warehouseId: string; quantity: number }
): Promise<ConsumptionPlan> {
  if (params.quantity <= 0) {
    return { slices: [], shortfall: 0, coveredCostCents: 0 };
  }

  const layers = await tx.$queryRaw<OpenLayerRow[]>`
    SELECT id, quantity_remaining, unit_cost_cents
    FROM inventory_cost_layers
    WHERE tenant_id = ${params.tenantId}::uuid
      AND variant_id = ${params.variantId}::uuid
      AND warehouse_id = ${params.warehouseId}::uuid
      AND quantity_remaining > 0
    ORDER BY acquired_at ASC, id ASC
  `;

  const slices: ConsumptionSlice[] = [];
  let remaining = params.quantity;
  let coveredCostCents = 0;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, layer.quantity_remaining);
    slices.push({ layerId: layer.id, quantity: take, unitCostCents: layer.unit_cost_cents });
    coveredCostCents += take * layer.unit_cost_cents;
    remaining -= take;
  }

  return { slices, shortfall: remaining, coveredCostCents };
}

/**
 * Apply a plan: draw the units off each layer and record what was taken.
 *
 * The layer decrement is guarded by `quantity_remaining >= take` in the WHERE
 * clause rather than by trusting the plan. Under the level lock it can never
 * fail — and if the locking ever regresses, this turns a silent negative into a
 * consumption that visibly did not happen, which is the failure mode you can
 * find.
 */
export async function commitConsumption(
  tx: TxClient,
  params: { tenantId: string; movementId: string; plan: ConsumptionPlan }
): Promise<void> {
  for (const slice of params.plan.slices) {
    await tx.$executeRaw`
      UPDATE inventory_cost_layers
      SET quantity_remaining = quantity_remaining - ${slice.quantity}, updated_at = now()
      WHERE id = ${slice.layerId}::uuid
        AND quantity_remaining >= ${slice.quantity}
    `;
    await tx.inventoryCostConsumption.create({
      data: {
        tenantId: params.tenantId,
        movementId: params.movementId,
        layerId: slice.layerId,
        quantity: slice.quantity,
        unitCostCents: slice.unitCostCents,
      },
    });
  }
}

/**
 * Give units back to the layers a specific movement took them from.
 *
 * A cancelled order restocking is not a new purchase — the units are the same
 * units, and putting them back on a fresh layer at today's average would quietly
 * re-cost them and break FIFO for everything behind them. So a reversal refills
 * the layers the original sale drained, in reverse order (the last one drained
 * refills first, which is the exact inverse of what happened), and records the
 * give-back as a NEGATIVE consumption rather than by editing the original row.
 * The sale happened and was later reversed; both are facts and the ledger keeps
 * both.
 *
 * Returns the cost credited and how many units had no layer to go back to —
 * those the caller lands on a fresh layer, because they are stock that exists.
 */
export async function restoreToLayers(
  tx: TxClient,
  params: {
    tenantId: string;
    movementId: string;
    sourceMovementId: string;
    quantity: number;
  }
): Promise<{ restored: number; creditedCostCents: number; uncovered: number }> {
  if (params.quantity <= 0) {
    return { restored: 0, creditedCostCents: 0, uncovered: 0 };
  }

  // What the original movement consumed, net of anything already given back —
  // so a second cancel for the same order cannot restore the units twice.
  const net = await tx.$queryRaw<{ layer_id: string; quantity: number; unit_cost_cents: number }[]>`
    SELECT layer_id,
           SUM(quantity)::int AS quantity,
           MAX(unit_cost_cents)::int AS unit_cost_cents
    FROM inventory_cost_consumptions
    WHERE tenant_id = ${params.tenantId}::uuid
      AND movement_id = ${params.sourceMovementId}::uuid
    GROUP BY layer_id
    HAVING SUM(quantity) > 0
    ORDER BY MIN(created_at) DESC, layer_id DESC
  `;

  let remaining = params.quantity;
  let creditedCostCents = 0;
  let restored = 0;

  for (const row of net) {
    if (remaining <= 0) break;
    const give = Math.min(remaining, row.quantity);
    // The layer cannot end up holding more than it ever received; the guard
    // makes that structural rather than a comment.
    await tx.$executeRaw`
      UPDATE inventory_cost_layers
      SET quantity_remaining = LEAST(quantity, quantity_remaining + ${give}), updated_at = now()
      WHERE id = ${row.layer_id}::uuid
    `;
    await tx.inventoryCostConsumption.create({
      data: {
        tenantId: params.tenantId,
        movementId: params.movementId,
        layerId: row.layer_id,
        quantity: -give,
        unitCostCents: row.unit_cost_cents,
      },
    });
    creditedCostCents += give * row.unit_cost_cents;
    restored += give;
    remaining -= give;
  }

  return { restored, creditedCostCents, uncovered: remaining };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface CostLayerRow {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  quantityRemaining: number;
  unitCostCents: number;
  goodsUnitCostCents: number;
  sourceType: string;
  sourceId: string | null;
  acquiredAt: string;
}

/** The open layers behind a (variant, location), oldest first — "what is this
 *  stock actually made of". */
export async function listOpenLayers(
  tx: TxClient,
  params: { tenantId: string; variantId: string; warehouseId?: string | null; take?: number }
): Promise<CostLayerRow[]> {
  const rows = await tx.inventoryCostLayer.findMany({
    where: {
      tenantId: params.tenantId,
      variantId: params.variantId,
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      quantityRemaining: { gt: 0 },
    },
    orderBy: [{ acquiredAt: 'asc' }, { id: 'asc' }],
    take: Math.min(params.take ?? 100, 500),
  });
  return rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    warehouseId: r.warehouseId,
    quantity: r.quantity,
    quantityRemaining: r.quantityRemaining,
    unitCostCents: r.unitCostCents,
    goodsUnitCostCents: r.goodsUnitCostCents,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    acquiredAt: r.acquiredAt.toISOString(),
  }));
}

export interface MovementCostBreakdownRow {
  layerId: string;
  quantity: number;
  unitCostCents: number;
  costCents: number;
  acquiredAt: string;
  sourceType: string;
}

/** What one movement's cost was made of — "£412.60, being 40 units off the March
 *  receipt at £8.20 and 12 off January's at £7.15". */
export async function movementCostBreakdown(
  tx: TxClient,
  params: { tenantId: string; movementId: string }
): Promise<MovementCostBreakdownRow[]> {
  const rows = await tx.$queryRaw<
    {
      layer_id: string;
      quantity: number;
      unit_cost_cents: number;
      acquired_at: Date;
      source_type: string;
    }[]
  >`
    SELECT c.layer_id, c.quantity, c.unit_cost_cents, l.acquired_at, l.source_type
    FROM inventory_cost_consumptions c
    JOIN inventory_cost_layers l ON l.id = c.layer_id
    WHERE c.tenant_id = ${params.tenantId}::uuid
      AND c.movement_id = ${params.movementId}::uuid
    ORDER BY l.acquired_at ASC, c.created_at ASC
  `;
  return rows.map((r) => ({
    layerId: r.layer_id,
    quantity: r.quantity,
    unitCostCents: r.unit_cost_cents,
    costCents: r.quantity * r.unit_cost_cents,
    acquiredAt: r.acquired_at.toISOString(),
    sourceType: r.source_type,
  }));
}

/**
 * Revalue the layers a receipt created, keeping the units untouched.
 *
 * Used when a charge lands after the delivery was booked — the freight invoice
 * that arrives a fortnight later. The goods are the same goods; only what they
 * cost has been corrected. Returns the value change across the units STILL on
 * the shelf, which is what the moving average needs to be nudged by: the units
 * already sold were costed when they left, and restating shipped COGS is exactly
 * what an accountant means by "the books moved".
 */
export async function revalueReceiptLayer(
  tx: TxClient,
  params: {
    tenantId: string;
    receiptLineId: string;
    unitCostCents: number;
    goodsUnitCostCents: number;
  }
): Promise<{ remainingUnits: number; deltaValueCents: number } | null> {
  const layers = await tx.inventoryCostLayer.findMany({
    where: { tenantId: params.tenantId, sourceType: 'receipt', sourceId: params.receiptLineId },
    select: { id: true, quantityRemaining: true, unitCostCents: true },
  });
  if (layers.length === 0) return null;

  let remainingUnits = 0;
  let deltaValueCents = 0;
  for (const layer of layers) {
    remainingUnits += layer.quantityRemaining;
    deltaValueCents += layer.quantityRemaining * (params.unitCostCents - layer.unitCostCents);
    await tx.inventoryCostLayer.update({
      where: { id: layer.id },
      data: {
        unitCostCents: params.unitCostCents,
        goodsUnitCostCents: params.goodsUnitCostCents,
      },
    });
  }
  return { remainingUnits, deltaValueCents };
}

/**
 * The value of what is on the shelf according to the layers, for one variant or
 * the whole tenant. Distinct from the moving-average valuation: this one can be
 * traced back to individual purchases, which is the point of keeping layers.
 */
export async function layeredValuation(
  tx: TxClient,
  params: { tenantId: string; warehouseId?: string | null }
): Promise<{ units: number; valueCents: number }> {
  const where = params.warehouseId
    ? Prisma.sql`AND warehouse_id = ${params.warehouseId}::uuid`
    : Prisma.empty;
  const [row] = await tx.$queryRaw<{ units: bigint; value_cents: bigint }[]>`
    SELECT COALESCE(SUM(quantity_remaining), 0)::bigint AS units,
           COALESCE(SUM(quantity_remaining * unit_cost_cents), 0)::bigint AS value_cents
    FROM inventory_cost_layers
    WHERE tenant_id = ${params.tenantId}::uuid
      AND quantity_remaining > 0
      ${where}
  `;
  return { units: Number(row?.units ?? 0), valueCents: Number(row?.value_cents ?? 0) };
}
