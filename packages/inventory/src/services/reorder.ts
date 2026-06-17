// Reorder engine (docs/100 P3d) — turns low stock into purchase orders.
//
// A level at/below its reorder point is a reorder suggestion. Each suggestion
// resolves the variant's PREFERRED supplier (the `suppliersForVariant` ordering:
// preferred flag first, then cheapest active link), a suggested order quantity
// (the configured reorder quantity, else top-up to the reorder point, floored at
// the supplier's minimum), and an expected arrival (today + the supplier lead
// time). Suggestions group by (supplier, warehouse) — the shape of one PO.
//
// Two ways to act on them:
//   • Manual  — the buyer picks lines; `draftReorderPurchaseOrders` drafts one PO
//     per (supplier, warehouse) group in a single transaction.
//   • Auto    — the `inventory.low` automation action calls `autoDraftReorder` on
//     the engine's own transaction; it find-or-appends into a single open draft
//     PO per (supplier, warehouse) so repeated low events converge, never spam.
//
// Items with no supplier link can't be drafted — they surface separately so the
// buyer links a supplier first.

import { DraftReorderInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { createPurchaseOrderOnTx, isReorderUniqueViolation } from './purchase-orders';
import { recomputeTotals, resolveLineData } from './purchase-order-shared';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Suggestion shapes (API-facing) ────────────────────────────────────────────

export interface ReorderSuggestionLine {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  productId: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  suggestedQuantity: number;
  /** Units already on an open PO (draft/submitted/partial) for this location —
   *  so the buyer doesn't re-order what's already inbound. */
  onOrder: number;
  /** The (supplier, variant) link cost — the draft's line-cost basis. */
  unitCostCents: number | null;
  estimatedCostCents: number | null;
  supplierSku: string | null;
}

export interface ReorderGroup {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  currency: string;
  leadTimeDays: number | null;
  expectedArrivalAt: string | null;
  lines: ReorderSuggestionLine[];
  estimatedTotalCents: number;
}

export interface UnsuppliedSuggestion {
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string | null;
  sku: string | null;
  title: string | null;
  productId: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  suggestedQuantity: number;
  onOrder: number;
}

export interface ReorderSuggestions {
  groups: ReorderGroup[];
  unsupplied: UnsuppliedSuggestion[];
  counts: { groups: number; lines: number; unsupplied: number };
}

/** Snake→camel raw-SQL row for one low (variant, warehouse) + its preferred link. */
interface SuggestionRow {
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string | null;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  onOrder: number;
  sku: string | null;
  productId: string;
  title: string | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  supplierCurrency: string | null;
  supplierLeadTimeDays: number | null;
  unitCostCents: number | null;
  minOrderQty: number | null;
  supplierSku: string | null;
}

/** Suggested order qty: the configured reorder quantity (fixed lot), else enough
 *  to top back up to the reorder point; never below the supplier minimum or 1. */
export function suggestedReorderQty(
  reorderPoint: number,
  reorderQuantity: number | null,
  available: number,
  minOrderQty: number | null
): number {
  const topUp = Math.max(reorderPoint - available, 0);
  const base = reorderQuantity && reorderQuantity > 0 ? reorderQuantity : topUp;
  return Math.max(base, minOrderQty ?? 0, 1);
}

function arrivalFrom(days: number | null): string | null {
  if (days === null) return null;
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

/** Units already on an open PO (draft/submitted/partial) for a (variant,
 *  warehouse) — the outstanding ordered-minus-received total. */
async function openOrderQty(tx: TxClient, variantId: string, warehouseId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ qty: number }[]>`
    SELECT COALESCE(SUM(pol.quantity_ordered - pol.quantity_received), 0)::int AS qty
    FROM inventory_purchase_order_lines pol
    JOIN inventory_purchase_orders po ON po.id = pol.purchase_order_id
    WHERE pol.variant_id = ${variantId}::uuid
      AND po.warehouse_id = ${warehouseId}::uuid
      AND po.status IN ('draft', 'submitted', 'partial')
  `;
  return rows[0]?.qty ?? 0;
}

export interface ReorderFilter {
  warehouseId?: string;
  take?: number;
}

/** List reorder suggestions: low levels grouped by (supplier, warehouse), plus
 *  low items with no supplier link (can't be drafted until one is added). */
export async function listReorderSuggestions(
  ctx: ServiceContext,
  filter: ReorderFilter = {}
): Promise<ReorderSuggestions> {
  return withTenant(ctx, async (tx) => {
    const take = Math.min(filter.take ?? 200, 500);
    const warehouseFilter = filter.warehouseId ?? null;
    const rows = await tx.$queryRaw<SuggestionRow[]>`
      SELECT
        l.variant_id AS "variantId",
        l.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        l.on_hand AS "onHand",
        l.on_hand - l.allocated AS "available",
        l.reorder_point AS "reorderPoint",
        l.reorder_quantity AS "reorderQuantity",
        COALESCE((
          SELECT SUM(pol.quantity_ordered - pol.quantity_received)
          FROM inventory_purchase_order_lines pol
          JOIN inventory_purchase_orders po ON po.id = pol.purchase_order_id
          WHERE pol.variant_id = l.variant_id
            AND po.warehouse_id = l.warehouse_id
            AND po.status IN ('draft', 'submitted', 'partial')
        ), 0)::int AS "onOrder",
        v.sku AS "sku",
        v.product_id AS "productId",
        p.title AS "title",
        sup.supplier_id AS "supplierId",
        sup.supplier_name AS "supplierName",
        sup.supplier_code AS "supplierCode",
        sup.currency AS "supplierCurrency",
        sup.lead_time_days AS "supplierLeadTimeDays",
        sup.unit_cost_cents AS "unitCostCents",
        sup.min_order_qty AS "minOrderQty",
        sup.supplier_sku AS "supplierSku"
      FROM inventory_levels l
      JOIN inventory_warehouses w ON w.id = l.warehouse_id
      JOIN commerce_product_variants v ON v.id = l.variant_id
      JOIN commerce_products p ON p.id = v.product_id
      LEFT JOIN LATERAL (
        SELECT s.id AS supplier_id, s.name AS supplier_name, s.code AS supplier_code,
               s.currency AS currency, s.lead_time_days AS lead_time_days,
               sv.unit_cost_cents AS unit_cost_cents, sv.min_order_qty AS min_order_qty,
               sv.supplier_sku AS supplier_sku
        FROM inventory_supplier_variants sv
        JOIN inventory_suppliers s ON s.id = sv.supplier_id
        WHERE sv.variant_id = l.variant_id AND s.deleted_at IS NULL AND s.is_active = true
        ORDER BY sv.is_preferred DESC, sv.unit_cost_cents ASC
        LIMIT 1
      ) sup ON true
      WHERE l.tenant_id = current_tenant_id()
        AND l.reorder_point IS NOT NULL
        AND l.on_hand - l.allocated <= l.reorder_point
        AND (${warehouseFilter}::uuid IS NULL OR l.warehouse_id = ${warehouseFilter}::uuid)
        AND w.deleted_at IS NULL AND v.deleted_at IS NULL AND p.deleted_at IS NULL
      ORDER BY (l.on_hand - l.allocated) ASC
      LIMIT ${take}
    `;
    return assembleSuggestions(rows);
  });
}

function assembleSuggestions(rows: SuggestionRow[]): ReorderSuggestions {
  const groups = new Map<string, ReorderGroup>();
  const unsupplied: UnsuppliedSuggestion[] = [];
  let lineCount = 0;

  for (const r of rows) {
    const qty = suggestedReorderQty(r.reorderPoint, r.reorderQuantity, r.available, r.minOrderQty);
    if (r.supplierId === null) {
      unsupplied.push({
        variantId: r.variantId,
        warehouseId: r.warehouseId,
        warehouseCode: r.warehouseCode,
        warehouseName: r.warehouseName,
        sku: r.sku,
        title: r.title,
        productId: r.productId,
        onHand: r.onHand,
        available: r.available,
        reorderPoint: r.reorderPoint,
        reorderQuantity: r.reorderQuantity,
        suggestedQuantity: qty,
        onOrder: r.onOrder,
      });
      continue;
    }

    const key = `${r.supplierId}::${r.warehouseId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        supplierId: r.supplierId,
        supplierName: r.supplierName ?? r.supplierCode ?? 'Supplier',
        supplierCode: r.supplierCode ?? '',
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName ?? r.warehouseCode,
        warehouseCode: r.warehouseCode,
        currency: r.supplierCurrency ?? 'USD',
        leadTimeDays: r.supplierLeadTimeDays,
        expectedArrivalAt: arrivalFrom(r.supplierLeadTimeDays),
        lines: [],
        estimatedTotalCents: 0,
      };
      groups.set(key, group);
    }
    const estimatedCostCents = r.unitCostCents !== null ? r.unitCostCents * qty : null;
    group.lines.push({
      variantId: r.variantId,
      warehouseId: r.warehouseId,
      sku: r.sku,
      title: r.title,
      productId: r.productId,
      onHand: r.onHand,
      available: r.available,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      suggestedQuantity: qty,
      onOrder: r.onOrder,
      unitCostCents: r.unitCostCents,
      estimatedCostCents,
      supplierSku: r.supplierSku,
    });
    group.estimatedTotalCents += estimatedCostCents ?? 0;
    lineCount += 1;
  }

  return {
    groups: [...groups.values()],
    unsupplied,
    counts: { groups: groups.size, lines: lineCount, unsupplied: unsupplied.length },
  };
}

// ─── Manual draft ───────────────────────────────────────────────────────────────

export interface DraftedPurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  lineCount: number;
  totalCents: number;
  currency: string;
}

export interface DraftReorderResult {
  purchaseOrders: DraftedPurchaseOrder[];
  count: number;
}

interface DraftGroup {
  supplierId: string;
  warehouseId: string;
  lines: { variantId: string; quantity: number }[];
}

/** Draft one PO per (supplier, warehouse) group from buyer-selected suggestions.
 *  Runs in a single transaction (all-or-nothing); line costs default from the
 *  (supplier, variant) link via the shared PO creation core. */
export async function draftReorderPurchaseOrders(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<DraftReorderResult> {
  const input = DraftReorderInput.parse(rawInput);
  const groups = groupDraftLines(input.lines);

  // The PO number is count+1; a lost race trips the (tenant, number) unique
  // constraint and poisons the tx, so the WHOLE batch retries.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await withTenant(ctx, (tx) => draftGroupsOnTx(tx, ctx, groups));
    } catch (err) {
      if (isReorderUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new InventoryValidationError('Could not allocate a purchase-order number');
}

function groupDraftLines(
  lines: { variantId: string; warehouseId: string; supplierId: string; quantity: number }[]
): DraftGroup[] {
  const map = new Map<string, DraftGroup>();
  for (const l of lines) {
    const key = `${l.supplierId}::${l.warehouseId}`;
    const group = map.get(key) ?? {
      supplierId: l.supplierId,
      warehouseId: l.warehouseId,
      lines: [],
    };
    // Combine a repeated variant rather than tripping the per-PO unique line.
    const existing = group.lines.find((g) => g.variantId === l.variantId);
    if (existing) existing.quantity += l.quantity;
    else group.lines.push({ variantId: l.variantId, quantity: l.quantity });
    map.set(key, group);
  }
  return [...map.values()];
}

async function draftGroupsOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  groups: DraftGroup[]
): Promise<DraftReorderResult> {
  const out: DraftedPurchaseOrder[] = [];
  for (const g of groups) {
    const supplier = await tx.supplier.findFirst({
      where: { id: g.supplierId, deletedAt: null },
      select: { id: true, currency: true },
    });
    if (!supplier) throw new InventoryNotFoundError('Supplier', g.supplierId);
    const detail = await createPurchaseOrderOnTx(tx, ctx, {
      supplierId: g.supplierId,
      warehouseId: g.warehouseId,
      currency: supplier.currency ?? 'USD',
      reference: 'Reorder',
      shippingCents: 0,
      lines: g.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    });
    out.push({
      id: detail.id,
      number: detail.number,
      supplierId: detail.supplierId,
      supplierName: detail.supplierName,
      warehouseId: detail.warehouseId,
      warehouseName: detail.warehouseName,
      lineCount: detail.lineCount,
      totalCents: detail.totalCents,
      currency: detail.currency,
    });
  }
  return { purchaseOrders: out, count: out.length };
}

// ─── Auto draft (the inventory.low automation action) ──────────────────────────

export type AutoDraftOutcome =
  | 'created'
  | 'appended'
  | 'skipped_no_policy'
  | 'skipped_recovered'
  | 'skipped_no_supplier'
  | 'skipped_already_drafted';

export interface AutoDraftResult {
  outcome: AutoDraftOutcome;
  purchaseOrderId: string | null;
  variantId: string;
  warehouseId: string;
  quantity: number | null;
}

/** Draft (or grow) a reorder PO for one low (variant, warehouse). Find-or-appends
 *  into a single open draft per (supplier, warehouse) so repeated `inventory.low`
 *  events converge into one reviewable draft instead of spawning duplicates; a
 *  variant already on that draft is a no-op. When `ctx.tx` is set (the automation
 *  engine's run transaction) the draft commits atomically with the run-step write
 *  via `withTenant`'s compose-into-tx contract. */
export async function autoDraftReorder(
  ctx: ServiceContext,
  target: { variantId: string; warehouseId: string }
): Promise<AutoDraftResult> {
  return withTenant(ctx, async (tx) => {
    const { variantId, warehouseId } = target;
    const tenantId = ctx.tenantId;
    const base = { purchaseOrderId: null, variantId, warehouseId, quantity: null } as const;

    const level = await tx.inventoryLevel.findUnique({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      select: { onHand: true, allocated: true, reorderPoint: true, reorderQuantity: true },
    });
    if (level?.reorderPoint == null) return { ...base, outcome: 'skipped_no_policy' };
    const available = level.onHand - level.allocated;
    if (available > level.reorderPoint) return { ...base, outcome: 'skipped_recovered' };

    const link = await tx.supplierVariant.findFirst({
      where: { variantId, supplier: { deletedAt: null, isActive: true } },
      orderBy: [{ isPreferred: 'desc' }, { unitCostCents: 'asc' }],
      select: { supplierId: true, minOrderQty: true, supplier: { select: { currency: true } } },
    });
    if (!link) return { ...base, outcome: 'skipped_no_supplier' };

    const quantity = suggestedReorderQty(
      level.reorderPoint,
      level.reorderQuantity,
      available,
      link.minOrderQty
    );

    // Already inbound? Don't re-order what an open PO (draft/submitted/partial)
    // already covers — this is what keeps repeated `inventory.low` events from
    // spawning duplicate orders.
    const onOrder = await openOrderQty(tx, variantId, warehouseId);
    if (onOrder > 0) return { ...base, outcome: 'skipped_already_drafted', quantity };

    // Find-or-append into a single open draft per (supplier, warehouse) so the
    // low items for one supplier converge into one reviewable order.
    const draft = await tx.purchaseOrder.findFirst({
      where: { supplierId: link.supplierId, warehouseId, status: 'draft' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (draft) {
      const lineData = await resolveLineData(tx, link.supplierId, { variantId, quantity });
      await tx.purchaseOrderLine.create({
        data: { tenantId, purchaseOrderId: draft.id, ...lineData },
      });
      await recomputeTotals(tx, draft.id);
      await auditReorder(tx, ctx, draft.id, 'reorder_line_added', { variantId, quantity });
      return { ...base, outcome: 'appended', purchaseOrderId: draft.id, quantity };
    }

    const detail = await createPurchaseOrderOnTx(tx, ctx, {
      supplierId: link.supplierId,
      warehouseId,
      currency: link.supplier.currency ?? 'USD',
      reference: 'Auto-reorder',
      shippingCents: 0,
      lines: [{ variantId, quantity }],
    });
    await auditReorder(tx, ctx, detail.id, 'reorder_drafted', { variantId, quantity });
    return { ...base, outcome: 'created', purchaseOrderId: detail.id, quantity };
  });
}

async function auditReorder(
  tx: TxClient,
  ctx: ServiceContext,
  purchaseOrderId: string,
  action: 'reorder_drafted' | 'reorder_line_added',
  after: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: `inventory.purchase_order.${action}`,
    entityType: 'PurchaseOrder',
    entityId: purchaseOrderId,
    diff: { after },
  });
}
