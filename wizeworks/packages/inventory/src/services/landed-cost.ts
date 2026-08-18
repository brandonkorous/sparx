// Landed cost — what the goods ACTUALLY cost to get onto the shelf
// (docs/146 Phase 5.1–5.3, 5.7).
//
// The supplier's invoice is only part of what a pallet costs. Freight, duty, the
// customs broker's fee and the insurance are real money spent to acquire that
// stock, and until this phase none of it reached the cost basis — so every
// margin figure on the platform was optimistic by exactly what it cost to get
// the goods here. On imported goods that is routinely 15–30%, which is the whole
// margin on a lot of lines.
//
// ── Estimate, then actual ────────────────────────────────────────────────────
//
// Freight is quoted when the order is raised and invoiced weeks after it lands,
// so charges live in two places on purpose:
//
//   PURCHASE ORDER  the estimate. Apportioned across the deliveries the order
//                   produces by the share of the order's value each one brings,
//                   with the final delivery taking the rounding remainder so the
//                   pennies land somewhere.
//   RECEIPT         the actual. All of it lands on that delivery's lines.
//
// ── Adding a charge later revalues what is still here ────────────────────────
//
// The forwarder's invoice arriving a fortnight after the pallet is the NORMAL
// case, not an edge one. So a charge can be added to a posted receipt, and doing
// so re-allocates the delivery, corrects the cost layers, and nudges the moving
// average by the value change across the units STILL ON THE SHELF.
//
// It does NOT restate what units already sold cost. That cost was recorded when
// they left; going back and editing shipped cost of goods is exactly what an
// accountant means by "the books moved". The difference between what those units
// were costed at and what they turned out to cost is a variance, and variances
// are reported rather than hidden.

import {
  CreateGoodsReceiptChargeInput,
  CreatePurchaseOrderChargeInput,
  UpdateGoodsReceiptChargeInput,
  UpdatePurchaseOrderChargeInput,
} from '@wizeworks/commerce-schemas';
import type { AllocationBasis, ChargeKind } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import { revalueReceiptLayer } from './cost-layers';
import { loadPolicy } from './costing-policy';

// ─── The allocation itself (pure) ────────────────────────────────────────────

/** One line a charge can land on. Values are already in BASE currency. */
export interface AllocatableLine {
  id: string;
  quantity: number;
  /** quantity × base unit cost — the line's goods value. */
  goodsValueCents: number;
  /** Total weight of the line, grams. 0 when the catalogue has no weight. */
  weightGrams: number;
}

/** One charge to spread. `amountCents` is already in BASE currency. */
export interface AllocatableCharge {
  id: string;
  kind: ChargeKind;
  amountCents: number;
  basis: AllocationBasis;
  /** Only read under the `manual` basis: line id → cents. */
  manual?: Record<string, number>;
  /** Where it came from, for the breakdown. */
  origin: 'order' | 'delivery';
  description: string | null;
}

export interface ChargeAllocation {
  chargeId: string;
  /** line id → cents. Sums exactly to the charge's amount. */
  perLine: Record<string, number>;
  /** True when the requested basis could not be used and quantity was used
   *  instead — a weight-based freight charge on goods with no weights recorded.
   *  Surfaced rather than swallowed: a breakdown that silently changed its mind
   *  about how it apportioned the freight is a breakdown nobody can check. */
  basisFellBack: boolean;
}

/**
 * Spread one charge across the lines it landed with.
 *
 * Largest-remainder rounding, so the per-line amounts sum to the charge EXACTLY.
 * Naive rounding loses or invents up to a penny per line, and a landed-cost
 * report that does not add up is a report an accountant stops reading.
 */
export function allocateCharge(
  charge: AllocatableCharge,
  lines: AllocatableLine[]
): ChargeAllocation {
  const perLine: Record<string, number> = {};
  for (const line of lines) perLine[line.id] = 0;
  if (lines.length === 0 || charge.amountCents <= 0) {
    return { chargeId: charge.id, perLine, basisFellBack: false };
  }

  // Manual: what was typed lands where it was typed. Anything left unassigned is
  // spread by value, so a crate charge entered against one line still adds up.
  let remainder = charge.amountCents;
  if (charge.basis === 'manual') {
    const manual = charge.manual ?? {};
    for (const line of lines) {
      const typed = Math.max(0, Math.round(manual[line.id] ?? 0));
      const take = Math.min(typed, remainder);
      perLine[line.id] = take;
      remainder -= take;
    }
    if (remainder <= 0) return { chargeId: charge.id, perLine, basisFellBack: false };
  }

  const { weights, fellBack } = weightsFor(charge.basis, lines);
  const spread = distribute(remainder, lines, weights);
  for (const line of lines) perLine[line.id] = (perLine[line.id] ?? 0) + (spread[line.id] ?? 0);

  return { chargeId: charge.id, perLine, basisFellBack: fellBack };
}

/**
 * The weight each line carries under a basis.
 *
 * A basis that produces nothing to divide by falls back rather than allocating
 * zero: freight apportioned by weight against a catalogue with no weights would
 * otherwise put the entire freight bill nowhere. Quantity is the fallback
 * because every line has one, and an equal split is the fallback after that.
 */
function weightsFor(
  basis: AllocationBasis,
  lines: AllocatableLine[]
): { weights: Record<string, number>; fellBack: boolean } {
  const build = (fn: (l: AllocatableLine) => number) => {
    const w: Record<string, number> = {};
    let total = 0;
    for (const l of lines) {
      const v = Math.max(0, fn(l));
      w[l.id] = v;
      total += v;
    }
    return { w, total };
  };

  if (basis === 'weight') {
    const byWeight = build((l) => l.weightGrams);
    if (byWeight.total > 0) return { weights: byWeight.w, fellBack: false };
  } else if (basis === 'value' || basis === 'manual') {
    const byValue = build((l) => l.goodsValueCents);
    if (byValue.total > 0) return { weights: byValue.w, fellBack: false };
  }

  const byQuantity = build((l) => l.quantity);
  if (byQuantity.total > 0) {
    return { weights: byQuantity.w, fellBack: basis !== 'quantity' };
  }
  const equal: Record<string, number> = {};
  for (const l of lines) equal[l.id] = 1;
  return { weights: equal, fellBack: true };
}

/** Proportional split with largest-remainder rounding — the parts sum to the
 *  whole, always. */
function distribute(
  amountCents: number,
  lines: AllocatableLine[],
  weights: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  const total = lines.reduce((s, l) => s + (weights[l.id] ?? 0), 0);
  if (amountCents <= 0 || total <= 0) {
    for (const l of lines) out[l.id] = 0;
    return out;
  }

  const remainders: { id: string; fraction: number }[] = [];
  let assigned = 0;
  for (const l of lines) {
    const exact = (amountCents * (weights[l.id] ?? 0)) / total;
    const whole = Math.floor(exact);
    out[l.id] = whole;
    assigned += whole;
    remainders.push({ id: l.id, fraction: exact - whole });
  }

  // The leftover pennies go to the largest fractional parts, ties broken by line
  // id so the same delivery allocates the same way every time it is recomputed.
  remainders.sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id));
  let leftover = amountCents - assigned;
  for (const r of remainders) {
    if (leftover <= 0) break;
    out[r.id] = (out[r.id] ?? 0) + 1;
    leftover -= 1;
  }
  return out;
}

// ─── Resolving a receipt's landed cost ───────────────────────────────────────

export interface LineLandedCost {
  receiptLineId: string;
  variantId: string;
  quantity: number;
  /** What the supplier billed, in the delivery's currency. */
  invoiceUnitCostCents: number;
  /** The same, converted into base currency. */
  baseUnitCostCents: number;
  /** This line's share of every charge, base currency, LINE total. */
  allocatedChargeCents: number;
  /** baseUnitCost + allocatedCharge / quantity. What feeds the cost basis. */
  landedUnitCostCents: number;
}

export interface ChargeBreakdownRow {
  chargeId: string;
  origin: 'order' | 'delivery';
  kind: ChargeKind;
  description: string | null;
  /** Base currency, the part of this charge landing on THIS delivery. */
  amountCents: number;
  basis: AllocationBasis;
  basisFellBack: boolean;
  perLine: Record<string, number>;
}

export interface ReceiptLandedCost {
  receiptId: string;
  currency: string;
  baseCurrency: string;
  fxRate: number;
  goodsValueCents: number;
  chargeTotalCents: number;
  landedTotalCents: number;
  lines: LineLandedCost[];
  charges: ChargeBreakdownRow[];
}

interface ReceiptLineRow {
  id: string;
  variant_id: string;
  quantity_received: number;
  unit_cost_cents: number;
  weight_grams: number | null;
}

/**
 * Work out what every line on a delivery actually cost.
 *
 * Pure with respect to the database — reads only, writes nothing — so the same
 * function serves posting the receipt, re-allocating after a late invoice, and
 * showing the breakdown on screen. Three code paths agreeing about the freight
 * because they call one function, rather than by inspection.
 */
export async function resolveReceiptLandedCost(
  tx: TxClient,
  params: {
    tenantId: string;
    receiptId: string; /** Treat this as the last delivery on the order,
    so the purchase-order charges give up their rounding remainder. Resolved by
    the caller because only the poster knows whether the PO just closed. */
    finalForOrder?: boolean;
  }
): Promise<ReceiptLandedCost> {
  const receipt = await tx.goodsReceipt.findFirst({
    where: { id: params.receiptId },
    select: {
      id: true,
      purchaseOrderId: true,
      currency: true,
      baseCurrency: true,
      fxRate: true,
    },
  });
  if (!receipt) throw new InventoryNotFoundError('GoodsReceipt', params.receiptId);

  const fxRate = Number(receipt.fxRate);
  const lineRows = await tx.$queryRaw<ReceiptLineRow[]>`
    SELECT rl.id, rl.variant_id, rl.quantity_received, rl.unit_cost_cents, v.weight_grams
    FROM inventory_goods_receipt_lines rl
    JOIN commerce_product_variants v ON v.id = rl.variant_id
    WHERE rl.tenant_id = ${params.tenantId}::uuid
      AND rl.goods_receipt_id = ${params.receiptId}::uuid
    ORDER BY rl.created_at ASC, rl.id ASC
  `;

  const lines: AllocatableLine[] = lineRows.map((r) => {
    const baseUnit = Math.round(r.unit_cost_cents * fxRate);
    return {
      id: r.id,
      quantity: r.quantity_received,
      goodsValueCents: baseUnit * r.quantity_received,
      weightGrams: (r.weight_grams ?? 0) * r.quantity_received,
    };
  });
  const goodsValueCents = lines.reduce((s, l) => s + l.goodsValueCents, 0);

  const charges = await collectCharges(tx, {
    tenantId: params.tenantId,
    receipt: { id: receipt.id, purchaseOrderId: receipt.purchaseOrderId },
    fxRate,
    goodsValueCents,
    finalForOrder: params.finalForOrder ?? false,
  });

  const allocations = charges.map((c) => ({ charge: c, allocation: allocateCharge(c, lines) }));
  const perLineTotal: Record<string, number> = {};
  for (const line of lines) perLineTotal[line.id] = 0;
  for (const { allocation } of allocations) {
    for (const [lineId, cents] of Object.entries(allocation.perLine)) {
      perLineTotal[lineId] = (perLineTotal[lineId] ?? 0) + cents;
    }
  }

  const resolvedLines: LineLandedCost[] = lineRows.map((r) => {
    const baseUnit = Math.round(r.unit_cost_cents * fxRate);
    const allocated = perLineTotal[r.id] ?? 0;
    const qty = Math.max(1, r.quantity_received);
    return {
      receiptLineId: r.id,
      variantId: r.variant_id,
      quantity: r.quantity_received,
      invoiceUnitCostCents: r.unit_cost_cents,
      baseUnitCostCents: baseUnit,
      allocatedChargeCents: allocated,
      landedUnitCostCents: Math.round(baseUnit + allocated / qty),
    };
  });

  const chargeTotalCents = charges.reduce((s, c) => s + c.amountCents, 0);
  return {
    receiptId: receipt.id,
    currency: receipt.currency,
    baseCurrency: receipt.baseCurrency,
    fxRate,
    goodsValueCents,
    chargeTotalCents,
    landedTotalCents: goodsValueCents + chargeTotalCents,
    lines: resolvedLines,
    charges: allocations.map(({ charge, allocation }) => ({
      chargeId: charge.id,
      origin: charge.origin,
      kind: charge.kind,
      description: charge.description,
      amountCents: charge.amountCents,
      basis: charge.basis,
      basisFellBack: allocation.basisFellBack,
      perLine: allocation.perLine,
    })),
  };
}

/**
 * Every charge landing on this delivery, converted into base currency: the
 * delivery's own charges in full, plus this delivery's share of the order's.
 *
 * The order's share is by VALUE — a delivery bringing 40% of the order's goods
 * carries 40% of its freight. That is the only apportionment that stays sensible
 * when a supplier splits an order into a big first shipment and a small
 * back-order, and it is the one a buyer can check in their head.
 */
async function collectCharges(
  tx: TxClient,
  params: {
    tenantId: string;
    receipt: { id: string; purchaseOrderId: string };
    fxRate: number;
    goodsValueCents: number;
    finalForOrder: boolean;
  }
): Promise<AllocatableCharge[]> {
  const out: AllocatableCharge[] = [];

  const receiptCharges = await tx.goodsReceiptCharge.findMany({
    where: { tenantId: params.tenantId, goodsReceiptId: params.receipt.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  for (const c of receiptCharges) {
    out.push({
      id: c.id,
      kind: c.kind as ChargeKind,
      amountCents: Math.round(c.amountCents * params.fxRate),
      basis: c.allocationBasis as AllocationBasis,
      manual: toManualMap(c.manualAllocation, params.fxRate),
      origin: 'delivery',
      description: c.description,
    });
  }

  const poCharges = await tx.purchaseOrderCharge.findMany({
    where: { tenantId: params.tenantId, purchaseOrderId: params.receipt.purchaseOrderId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (poCharges.length === 0) return out;

  const [orderValue] = await tx.$queryRaw<{ value_cents: bigint }[]>`
    SELECT COALESCE(SUM(quantity_ordered * unit_cost_cents), 0)::bigint AS value_cents
    FROM inventory_purchase_order_lines
    WHERE tenant_id = ${params.tenantId}::uuid
      AND purchase_order_id = ${params.receipt.purchaseOrderId}::uuid
  `;
  // The order's value in BASE currency, so the share divides like with like.
  const orderValueCents = Math.round(Number(orderValue?.value_cents ?? 0) * params.fxRate);
  const share = orderValueCents > 0 ? Math.min(1, params.goodsValueCents / orderValueCents) : 1;

  for (const c of poCharges) {
    const outstanding = Math.max(0, c.amountCents - c.allocatedCents);
    // The last delivery takes everything still unallocated, so the pennies lost
    // to rounding across four part-shipments land somewhere rather than
    // evaporating out of the cost basis.
    const raw = params.finalForOrder ? outstanding : Math.round(c.amountCents * share);
    const amount = Math.round(Math.min(raw, outstanding) * params.fxRate);
    if (amount <= 0) continue;
    out.push({
      id: c.id,
      kind: c.kind as ChargeKind,
      amountCents: amount,
      basis: c.allocationBasis as AllocationBasis,
      origin: 'order',
      description: c.description,
    });
  }
  return out;
}

function toManualMap(raw: unknown, fxRate: number): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.round(v * fxRate);
  }
  return out;
}

/**
 * Write the resolved landed cost onto the receipt lines and credit the
 * purchase-order charges with what they gave up to this delivery.
 *
 * Always called from a base where the order's charges have already had their
 * running `allocatedCents` set correctly for every EARLIER delivery — either
 * because this is a new delivery on an order whose earlier ones are already
 * counted, or because `reallocateOrderCharges` zeroed them and is replaying the
 * order in date order. That is what lets this simply increment: there is no
 * "have I already counted this one" question to get wrong.
 */
export async function persistLandedCost(
  tx: TxClient,
  params: { tenantId: string; resolved: ReceiptLandedCost }
): Promise<void> {
  for (const line of params.resolved.lines) {
    await tx.goodsReceiptLine.update({
      where: { id: line.receiptLineId },
      data: {
        allocatedChargeCents: line.allocatedChargeCents,
        baseUnitCostCents: line.baseUnitCostCents,
        landedUnitCostCents: line.landedUnitCostCents,
      },
    });
  }

  for (const charge of params.resolved.charges) {
    if (charge.origin !== 'order' || charge.amountCents === 0) continue;
    await tx.purchaseOrderCharge.update({
      where: { id: charge.chargeId },
      data: { allocatedCents: { increment: charge.amountCents } },
    });
  }
}

// ─── Charge writes ───────────────────────────────────────────────────────────

export interface ChargeRow {
  id: string;
  kind: ChargeKind;
  description: string | null;
  amountCents: number;
  allocationBasis: AllocationBasis;
  /** Purchase-order charges only: how much has already landed on a delivery. */
  allocatedCents?: number;
  manualAllocation?: Record<string, number>;
  createdAt: string;
}

export async function listPurchaseOrderCharges(
  ctx: ServiceContext,
  purchaseOrderId: string
): Promise<ChargeRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.purchaseOrderCharge.findMany({
      where: { purchaseOrderId },
      orderBy: [{ createdAt: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as ChargeKind,
      description: r.description,
      amountCents: r.amountCents,
      allocationBasis: r.allocationBasis as AllocationBasis,
      allocatedCents: r.allocatedCents,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export async function createPurchaseOrderCharge(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ChargeRow> {
  const input = CreatePurchaseOrderChargeInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId },
      select: { id: true, number: true },
    });
    if (!po) throw new InventoryNotFoundError('PurchaseOrder', input.purchaseOrderId);

    const policy = await loadPolicy(tx, ctx.tenantId);
    const basis =
      input.allocationBasis ??
      // The tenant's default, unless it is `manual` — which a purchase-order
      // charge cannot use, because the lines it will land on do not exist yet.
      (policy.defaultAllocationBasis === 'manual' ? 'value' : policy.defaultAllocationBasis);

    const row = await tx.purchaseOrderCharge.create({
      data: {
        tenantId: ctx.tenantId,
        purchaseOrderId: po.id,
        kind: input.kind,
        description: input.description ?? null,
        amountCents: input.amountCents,
        allocationBasis: basis,
      },
    });

    // A charge added to an order that has already had deliveries reaches those
    // deliveries. Adding freight after the first pallet landed is the ordinary
    // case, not an exception, so it corrects what is still on the shelf.
    await reallocateOrderCharges(tx, ctx, po.id);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.purchase_order_charge.created',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      diff: { after: { kind: input.kind, amountCents: input.amountCents, basis } },
    });

    // Re-read: the reallocation above may have already pushed some of this
    // charge onto an existing delivery, and returning the pre-allocation row
    // would show a fresh charge as untouched when it is not.
    return readPurchaseOrderCharge(tx, row.id);
  });
}

async function readPurchaseOrderCharge(tx: TxClient, id: string): Promise<ChargeRow> {
  const row = await tx.purchaseOrderCharge.findFirst({ where: { id } });
  if (!row) throw new InventoryNotFoundError('PurchaseOrderCharge', id);
  return {
    id: row.id,
    kind: row.kind as ChargeKind,
    description: row.description,
    amountCents: row.amountCents,
    allocationBasis: row.allocationBasis as AllocationBasis,
    allocatedCents: row.allocatedCents,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function updatePurchaseOrderCharge(
  ctx: ServiceContext,
  chargeId: string,
  rawInput: unknown
): Promise<ChargeRow> {
  const input = UpdatePurchaseOrderChargeInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseOrderCharge.findFirst({ where: { id: chargeId } });
    if (!existing) throw new InventoryNotFoundError('PurchaseOrderCharge', chargeId);

    // Correcting a charge DOWN is allowed even after it has landed on
    // deliveries — "the freight was £150, not £200" is the commonest correction
    // there is, and the reallocation below replays the whole order from zero, so
    // the deliveries end up carrying the right figure rather than a stale one.
    await tx.purchaseOrderCharge.update({
      where: { id: chargeId },
      data: {
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
        ...(input.allocationBasis ? { allocationBasis: input.allocationBasis } : {}),
      },
    });

    await reallocateOrderCharges(tx, ctx, existing.purchaseOrderId);

    return readPurchaseOrderCharge(tx, chargeId);
  });
}

export async function deletePurchaseOrderCharge(
  ctx: ServiceContext,
  chargeId: string
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseOrderCharge.findFirst({ where: { id: chargeId } });
    if (!existing) throw new InventoryNotFoundError('PurchaseOrderCharge', chargeId);
    await tx.purchaseOrderCharge.delete({ where: { id: chargeId } });
    await reallocateOrderCharges(tx, ctx, existing.purchaseOrderId);
    return { id: chargeId };
  });
}

export async function listGoodsReceiptCharges(
  ctx: ServiceContext,
  goodsReceiptId: string
): Promise<ChargeRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.goodsReceiptCharge.findMany({
      where: { goodsReceiptId },
      orderBy: [{ createdAt: 'asc' }],
    });
    return rows.map(serializeReceiptCharge);
  });
}

export async function createGoodsReceiptCharge(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ChargeRow> {
  const input = CreateGoodsReceiptChargeInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const receipt = await tx.goodsReceipt.findFirst({
      where: { id: input.goodsReceiptId },
      select: { id: true, number: true },
    });
    if (!receipt) throw new InventoryNotFoundError('GoodsReceipt', input.goodsReceiptId);

    const policy = await loadPolicy(tx, ctx.tenantId);
    const row = await tx.goodsReceiptCharge.create({
      data: {
        tenantId: ctx.tenantId,
        goodsReceiptId: receipt.id,
        kind: input.kind,
        description: input.description ?? null,
        amountCents: input.amountCents,
        allocationBasis: input.allocationBasis ?? policy.defaultAllocationBasis,
        manualAllocation: input.manualAllocation ?? {},
      },
    });

    await revalueReceipt(tx, ctx, receipt.id);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.goods_receipt_charge.created',
      entityType: 'GoodsReceipt',
      entityId: receipt.id,
      diff: { after: { kind: input.kind, amountCents: input.amountCents } },
    });

    return serializeReceiptCharge(row);
  });
}

export async function updateGoodsReceiptCharge(
  ctx: ServiceContext,
  chargeId: string,
  rawInput: unknown
): Promise<ChargeRow> {
  const input = UpdateGoodsReceiptChargeInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.goodsReceiptCharge.findFirst({ where: { id: chargeId } });
    if (!existing) throw new InventoryNotFoundError('GoodsReceiptCharge', chargeId);

    const row = await tx.goodsReceiptCharge.update({
      where: { id: chargeId },
      data: {
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
        ...(input.allocationBasis ? { allocationBasis: input.allocationBasis } : {}),
        ...(input.manualAllocation ? { manualAllocation: input.manualAllocation } : {}),
      },
    });
    await revalueReceipt(tx, ctx, existing.goodsReceiptId);
    return serializeReceiptCharge(row);
  });
}

export async function deleteGoodsReceiptCharge(
  ctx: ServiceContext,
  chargeId: string
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.goodsReceiptCharge.findFirst({ where: { id: chargeId } });
    if (!existing) throw new InventoryNotFoundError('GoodsReceiptCharge', chargeId);
    await tx.goodsReceiptCharge.delete({ where: { id: chargeId } });
    await revalueReceipt(tx, ctx, existing.goodsReceiptId);
    return { id: chargeId };
  });
}

function serializeReceiptCharge(r: {
  id: string;
  kind: string;
  description: string | null;
  amountCents: number;
  allocationBasis: string;
  manualAllocation: unknown;
  createdAt: Date;
}): ChargeRow {
  return {
    id: r.id,
    kind: r.kind as ChargeKind,
    description: r.description,
    amountCents: r.amountCents,
    allocationBasis: r.allocationBasis as AllocationBasis,
    manualAllocation: toManualMap(r.manualAllocation, 1),
    createdAt: r.createdAt.toISOString(),
  };
}

// ─── Revaluation ─────────────────────────────────────────────────────────────

export interface RevaluationResult {
  purchaseOrderId: string;
  receiptsTouched: number;
  linesChanged: number;
  /** The value change across units STILL ON HAND, base currency. Units already
   *  sold keep the cost they left with. */
  onHandValueDeltaCents: number;
}

/**
 * Recompute an order's landed cost end to end and correct what is still on the
 * shelf.
 *
 * The whole ORDER rather than one delivery, because the order's charges are
 * shared: a freight estimate changing reaches every delivery it was spread
 * across, not just the newest. And because replaying an order from a zeroed base
 * makes the arithmetic idempotent — run it twice and you get the same answer,
 * which is exactly what "add a charge, then correct it, then delete it" needs.
 *
 * Per delivery, three things move, in this order:
 *   1. the receipt lines' landed unit cost — the record of what it cost
 *   2. the cost layers that delivery created — so FIFO reports the corrected
 *      figure for the units it still holds
 *   3. the level's moving average — nudged by the value change across the units
 *      still on hand, which is the only part of the stock a correction can
 *      honestly reach
 *
 * What does NOT move is `on_hand`, and what does not move is the cost already
 * stamped on movements that took units out. Both deliberate: the first because
 * a freight invoice is not a stock count, the second because restating shipped
 * cost of goods is what an accountant means by "the books moved".
 */
export async function reallocateOrderCharges(
  tx: TxClient,
  ctx: ServiceContext,
  purchaseOrderId: string
): Promise<RevaluationResult> {
  // Zero the running totals and replay every delivery in the order it arrived.
  // Each one then sees exactly what its predecessors took, and the last one
  // takes whatever rounding left behind.
  await tx.purchaseOrderCharge.updateMany({
    where: { tenantId: ctx.tenantId, purchaseOrderId },
    data: { allocatedCents: 0 },
  });

  const receipts = await tx.goodsReceipt.findMany({
    where: { purchaseOrderId },
    orderBy: [{ receivedAt: 'asc' }, { number: 'asc' }],
    select: { id: true, warehouseId: true },
  });
  const orderComplete = await isOrderFullyReceived(tx, ctx.tenantId, purchaseOrderId);

  let linesChanged = 0;
  let onHandValueDeltaCents = 0;

  for (const [index, receipt] of receipts.entries()) {
    const before = await tx.goodsReceiptLine.findMany({
      where: { goodsReceiptId: receipt.id },
      select: { id: true, landedUnitCostCents: true, variantId: true },
    });
    const resolved = await resolveReceiptLandedCost(tx, {
      tenantId: ctx.tenantId,
      receiptId: receipt.id,
      // Only the last delivery on a CLOSED order sweeps up the remainder. On an
      // order still expecting goods, holding the remainder back is right: more
      // freight is still to be apportioned.
      finalForOrder: orderComplete && index === receipts.length - 1,
    });
    await persistLandedCost(tx, { tenantId: ctx.tenantId, resolved });

    const previousById = new Map(before.map((l) => [l.id, l.landedUnitCostCents]));
    for (const line of resolved.lines) {
      if (previousById.get(line.receiptLineId) === line.landedUnitCostCents) continue;
      linesChanged += 1;

      const revalued = await revalueReceiptLayer(tx, {
        tenantId: ctx.tenantId,
        receiptLineId: line.receiptLineId,
        unitCostCents: line.landedUnitCostCents,
        goodsUnitCostCents: line.baseUnitCostCents,
      });
      if (!revalued || revalued.remainingUnits === 0) continue;

      onHandValueDeltaCents += revalued.deltaValueCents;
      await nudgeAverageCost(tx, {
        variantId: line.variantId,
        warehouseId: receipt.warehouseId,
        deltaValueCents: revalued.deltaValueCents,
      });
    }
  }

  return {
    purchaseOrderId,
    receiptsTouched: receipts.length,
    linesChanged,
    onHandValueDeltaCents,
  };
}

/** Reallocate the order a given delivery belongs to. */
async function revalueReceipt(
  tx: TxClient,
  ctx: ServiceContext,
  receiptId: string
): Promise<RevaluationResult | null> {
  const receipt = await tx.goodsReceipt.findFirst({
    where: { id: receiptId },
    select: { purchaseOrderId: true },
  });
  if (!receipt) return null;
  return reallocateOrderCharges(tx, ctx, receipt.purchaseOrderId);
}

/** True when nothing on the order is still outstanding — the last delivery on a
 *  closed order sweeps up whatever rounding left behind. */
async function isOrderFullyReceived(
  tx: TxClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<boolean> {
  const [row] = await tx.$queryRaw<{ outstanding: bigint }[]>`
    SELECT COALESCE(SUM(GREATEST(0, quantity_ordered - quantity_received)), 0)::bigint
             AS outstanding
    FROM inventory_purchase_order_lines
    WHERE tenant_id = ${tenantId}::uuid
      AND purchase_order_id = ${purchaseOrderId}::uuid
  `;
  return Number(row?.outstanding ?? 0) === 0;
}

/** Move a level's moving average by a value change spread over what is on hand.
 *  Nothing to do when the shelf is empty — there is no stock left for the
 *  correction to apply to, and dividing by zero would invent one. */
async function nudgeAverageCost(
  tx: TxClient,
  params: { variantId: string; warehouseId: string; deltaValueCents: number }
): Promise<void> {
  if (params.deltaValueCents === 0) return;
  await tx.$executeRaw`
    UPDATE inventory_levels
    SET avg_cost_cents = GREATEST(
          0,
          ROUND(COALESCE(avg_cost_cents, 0) + (${params.deltaValueCents}::numeric / on_hand))
        )::int,
        updated_at = now()
    WHERE variant_id = ${params.variantId}::uuid
      AND warehouse_id = ${params.warehouseId}::uuid
      AND on_hand > 0
  `;
}

/** The landed-cost breakdown for one delivery, for the receipt surface and the
 *  `get_landed_cost_breakdown` MCP tool. */
export async function getLandedCostBreakdown(
  ctx: ServiceContext,
  receiptId: string
): Promise<ReceiptLandedCost> {
  return withTenant(ctx, (tx) =>
    resolveReceiptLandedCost(tx, { tenantId: ctx.tenantId, receiptId })
  );
}
