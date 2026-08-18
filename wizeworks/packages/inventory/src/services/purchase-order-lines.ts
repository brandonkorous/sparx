// Purchase-order line mutations (docs/100 P3b) — add / update / remove, all
// DRAFT-only (a submitted PO is locked; receiving in P3c is the only writer
// after that). Every mutation recomputes the PO totals. Add is an UPSERT keyed on
// (po, variant) so re-adding a variant replaces its line rather than tripping the
// unique constraint.

import { PurchaseOrderLineInput, UpdatePurchaseOrderLineInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import {
  assertStatus,
  ensurePurchaseOrder,
  loadPurchaseOrderDetail,
  recomputeTotals,
  resolveLineData,
} from './purchase-order-shared';
import type { PurchaseOrderDetail } from './purchase-order-shared';
import { resolveLineUom, toBaseUnitCost, toBaseUnits } from './units-of-measure';

export async function addPurchaseOrderLine(
  ctx: ServiceContext,
  purchaseOrderId: string,
  rawInput: unknown
): Promise<PurchaseOrderDetail> {
  const input = PurchaseOrderLineInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, purchaseOrderId);
    assertStatus(po, ['draft'], 'edited');

    const data = await resolveLineData(tx, po.supplierId, input);
    await tx.purchaseOrderLine.upsert({
      where: { purchaseOrderId_variantId: { purchaseOrderId, variantId: input.variantId } },
      create: { tenantId: ctx.tenantId, purchaseOrderId, ...data },
      update: {
        quantityOrdered: data.quantityOrdered,
        unitCostCents: data.unitCostCents,
        supplierSku: data.supplierSku,
        description: data.description,
        uomCode: data.uomCode,
        unitsPerUom: data.unitsPerUom,
      },
    });
    await recomputeTotals(tx, purchaseOrderId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.purchase_order.line_added',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrderId,
      diff: { after: { variantId: input.variantId, quantity: data.quantityOrdered } },
    });

    return loadPurchaseOrderDetail(tx, purchaseOrderId);
  });
}

export async function updatePurchaseOrderLine(
  ctx: ServiceContext,
  purchaseOrderId: string,
  lineId: string,
  rawInput: unknown
): Promise<PurchaseOrderDetail> {
  const input = UpdatePurchaseOrderLineInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, purchaseOrderId);
    assertStatus(po, ['draft'], 'edited');

    const line = await tx.purchaseOrderLine.findFirst({
      where: { id: lineId, purchaseOrderId },
      select: { id: true, variantId: true, uomCode: true, unitsPerUom: true },
    });
    if (!line) throw new InventoryNotFoundError('PurchaseOrderLine', lineId);

    // The unit the quantity and cost below are expressed IN. An explicit code
    // re-reads the line in that unit; omitted, the line keeps the unit it was
    // written with — so editing only the quantity on a line ordered in cases
    // still means cases, which is what the person typing 5 over a 4 intends.
    const uom =
      input.uomCode !== undefined
        ? await resolveLineUom(tx, { variantId: line.variantId, uomCode: input.uomCode })
        : { uomCode: line.uomCode, unitsPerUom: line.unitsPerUom };

    await tx.purchaseOrderLine.update({
      where: { id: lineId },
      data: {
        ...(input.quantity !== undefined
          ? { quantityOrdered: toBaseUnits(input.quantity, uom.unitsPerUom) }
          : {}),
        ...(input.unitCostCents !== undefined
          ? { unitCostCents: toBaseUnitCost(input.unitCostCents, uom.unitsPerUom) }
          : {}),
        ...(input.supplierSku !== undefined ? { supplierSku: input.supplierSku } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.uomCode !== undefined
          ? { uomCode: uom.uomCode, unitsPerUom: uom.unitsPerUom }
          : {}),
      },
    });
    await recomputeTotals(tx, purchaseOrderId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.purchase_order.line_updated',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrderId,
      diff: { after: { lineId } },
    });

    return loadPurchaseOrderDetail(tx, purchaseOrderId);
  });
}

export async function removePurchaseOrderLine(
  ctx: ServiceContext,
  purchaseOrderId: string,
  lineId: string
): Promise<PurchaseOrderDetail> {
  return withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, purchaseOrderId);
    assertStatus(po, ['draft'], 'edited');

    await tx.purchaseOrderLine.deleteMany({ where: { id: lineId, purchaseOrderId } });
    await recomputeTotals(tx, purchaseOrderId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.purchase_order.line_removed',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrderId,
      diff: { before: { lineId } },
    });

    return loadPurchaseOrderDetail(tx, purchaseOrderId);
  });
}
