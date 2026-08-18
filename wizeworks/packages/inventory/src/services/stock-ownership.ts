// The stock-ownership axis (docs/146 Phase 9.5) — which of the goods in your
// building are actually yours.
//
// ── Why this is not obvious, and why it matters ──────────────────────────────
//
// Every inventory system starts from the assumption that stock on your shelf is
// your asset. For most businesses that is true. For a shop holding a supplier's
// consignment, a workshop holding a fleet operator's own parts, or a business
// whose 3PL owns the buffer stock, it is false — and the error runs in the
// dangerous direction. Valuing consigned goods as inventory overstates the
// balance sheet by the whole consignment, and it is the kind of overstatement
// that survives right up until an accountant asks for the schedule.
//
// ── The one behavioural consequence ──────────────────────────────────────────
//
// Ownership changes exactly one thing: whether the units count toward
// VALUATION. It does not change availability, and that asymmetry is the whole
// design. Consigned stock is sellable — being able to sell it is the entire
// reason to hold it — so a storefront sees no difference whatsoever. Anyone
// reaching for ownership to hide stock from a customer wants an unsellable
// shelf (`unsellableOnHand`) instead.
//
// ── Per level, not per unit ──────────────────────────────────────────────────
//
// Mixing owned and consigned units of the same SKU at the same location has no
// answer to "which one did I just sell", so the model refuses to pretend it
// does. A tenant holding both uses a second location, and gets a real answer
// instead of a plausible one.

import { withTenant } from '@wizeworks/db';
import { SetStockOwnershipInput, countsTowardValuation } from '@wizeworks/commerce-schemas';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError, InventoryValidationError, type ServiceContext } from '../errors';

export interface OwnedStockRow {
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  ownership: string;
  ownerSupplierId: string | null;
  ownerSupplierName: string | null;
  ownerCustomerId: string | null;
  ownerCustomerName: string | null;
  onHand: number;
  /** What it would be worth if it were yours. Reported on consigned stock too,
   *  because "how much of somebody else's money is sitting in my building" is
   *  the number that decides whether the arrangement is worth the shelf space. */
  valueCents: number | null;
  countsTowardValuation: boolean;
}

export interface ListOwnedStockFilter {
  ownership?: string;
  warehouseId?: string;
  ownerSupplierId?: string;
  take?: number;
  skip?: number;
}

interface OwnedStockQueryRow extends Omit<OwnedStockRow, 'countsTowardValuation'> {
  totalCount: number;
}

/**
 * Stock that is NOT plain owned — the exception list.
 *
 * Defaults to excluding `owned` because that is the useful screen: a business
 * with 40,000 owned levels and six consigned ones wants the six. Pass an
 * explicit `ownership` to see one class.
 */
export async function listNonOwnedStock(
  ctx: ServiceContext,
  filter: ListOwnedStockFilter = {}
): Promise<{ items: OwnedStockRow[]; total: number; totalValueCents: number }> {
  const take = Math.min(Math.max(filter.take ?? 50, 1), 200);
  const skip = Math.max(filter.skip ?? 0, 0);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<OwnedStockQueryRow[]>`
      WITH matched AS (
        SELECT l.variant_id,
               l.warehouse_id,
               l.ownership,
               l.owner_supplier_id,
               l.owner_customer_id,
               l.on_hand,
               -- Null, not zero, when nothing has ever costed this level. A
               -- consignment line reading $0.00 says "they gave it to us",
               -- which is the most expensive possible way to be wrong.
               COALESCE(l.avg_cost_cents, l.unit_cost_cents) AS unit_cost_cents
          FROM inventory_levels l
         WHERE l.tenant_id = ${ctx.tenantId}::uuid
           AND (${filter.ownership ?? null}::text IS NULL
                OR l.ownership = ${filter.ownership ?? null})
           AND (${filter.ownership ?? null}::text IS NOT NULL OR l.ownership <> 'owned')
           AND (${filter.warehouseId ?? null}::uuid IS NULL
                OR l.warehouse_id = ${filter.warehouseId ?? null}::uuid)
           AND (${filter.ownerSupplierId ?? null}::uuid IS NULL
                OR l.owner_supplier_id = ${filter.ownerSupplierId ?? null}::uuid)
      )
      SELECT m.variant_id       AS "variantId",
             v.sku              AS "variantSku",
             v.title             AS "variantName",
             m.warehouse_id     AS "warehouseId",
             w.name             AS "warehouseName",
             m.ownership,
             m.owner_supplier_id AS "ownerSupplierId",
             s.name              AS "ownerSupplierName",
             m.owner_customer_id AS "ownerCustomerId",
             NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '') AS "ownerCustomerName",
             m.on_hand          AS "onHand",
             CASE WHEN m.unit_cost_cents IS NULL THEN NULL
                  ELSE (m.on_hand * m.unit_cost_cents)::int END AS "valueCents",
             (SELECT COUNT(*)::int FROM matched) AS "totalCount"
        FROM matched m
        LEFT JOIN commerce_product_variants v ON v.id = m.variant_id
        LEFT JOIN inventory_warehouses w      ON w.id = m.warehouse_id
        LEFT JOIN inventory_suppliers s       ON s.id = m.owner_supplier_id
        LEFT JOIN customers c                 ON c.id = m.owner_customer_id
       ORDER BY m.ownership, w.name, v.sku
       LIMIT ${take} OFFSET ${skip}
    `;

    return {
      items: rows.map((r) => ({
        variantId: r.variantId,
        variantSku: r.variantSku,
        variantName: r.variantName,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        ownership: r.ownership,
        ownerSupplierId: r.ownerSupplierId,
        ownerSupplierName: r.ownerSupplierName,
        ownerCustomerId: r.ownerCustomerId,
        ownerCustomerName: r.ownerCustomerName,
        onHand: r.onHand,
        valueCents: r.valueCents,
        countsTowardValuation: countsTowardValuation(r.ownership),
      })),
      total: rows[0]?.totalCount ?? 0,
      totalValueCents: rows.reduce((sum, r) => sum + (r.valueCents ?? 0), 0),
    };
  });
}

/**
 * Declare who owns the stock at one (variant, location).
 *
 * Movements already written keep the ownership they were stamped with. That is
 * the point of stamping — buying out a consignment changes what happens NEXT,
 * and must not retroactively erase the money that was owed on everything that
 * sold before.
 */
export async function setStockOwnership(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SetStockOwnershipInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const level = await tx.inventoryLevel.findFirst({
      where: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
      },
      select: { ownership: true, ownerSupplierId: true, ownerCustomerId: true },
    });
    if (!level) {
      throw new InventoryNotFoundError('InventoryLevel', `${input.variantId}/${input.warehouseId}`);
    }

    // Consigned stock with no named owner is a debt to nobody. The DB tolerates
    // it (a merchant may classify before they have created the supplier record);
    // settlement does not. Refusing here, at the moment somebody is looking at
    // the screen, is far kinder than refusing three weeks later when they try to
    // close a period.
    if (input.ownership === 'consignment' && !input.ownerSupplierId && !input.ownerCustomerId) {
      throw new InventoryValidationError(
        'Consigned stock needs an owner — somebody is owed for it when it sells.',
        [{ field: 'ownerSupplierId', message: 'Name the supplier or the customer.' }]
      );
    }

    await tx.inventoryLevel.update({
      where: {
        variantId_warehouseId: {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        },
      },
      data: {
        ownership: input.ownership,
        ownerSupplierId: input.ownership === 'owned' ? null : (input.ownerSupplierId ?? null),
        ownerCustomerId: input.ownership === 'owned' ? null : (input.ownerCustomerId ?? null),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.ownership.changed',
      entityType: 'InventoryLevel',
      // A level is keyed by (variant, warehouse) but `entity_id` is a single
      // UUID column — so the variant goes in it and the location rides in the
      // diff, exactly as `adjust` does.
      entityId: input.variantId,
      diff: {
        before: {
          ownership: level.ownership,
          ownerSupplierId: level.ownerSupplierId,
          ownerCustomerId: level.ownerCustomerId,
        },
        after: {
          warehouseId: input.warehouseId,
          ownership: input.ownership,
          ownerSupplierId: input.ownerSupplierId ?? null,
          ownerCustomerId: input.ownerCustomerId ?? null,
        },
      },
    });
  });
}
