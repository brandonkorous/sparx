// Purchase-order lifecycle transitions (docs/100 P3b) — the status moves the PO
// itself owns:
//
//   submit  draft               → submitted   (stamp orderedAt + expected arrival)
//   cancel  draft | submitted   → cancelled    (nothing received yet)
//   close   submitted|partial|received → closed (stop receiving the rest)
//
// partial / received are NOT here — receiving (P3c) drives those as goods book in.

import { SubmitPurchaseOrderInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import {
  assertStatus,
  ensurePurchaseOrder,
  loadPurchaseOrderDetail,
} from './purchase-order-shared';
import type { PurchaseOrderDetail } from './purchase-order-shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Submit a draft PO: it becomes an actual order. Stamps orderedAt; resolves the
 *  expected arrival from the override → an already-set date → the supplier lead
 *  time (today + leadTimeDays). Refuses an empty PO. */
export async function submitPurchaseOrder(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<PurchaseOrderDetail> {
  const input = SubmitPurchaseOrderInput.parse(rawInput ?? {});

  return withTenant(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        expectedArrivalAt: true,
        supplier: { select: { leadTimeDays: true } },
        _count: { select: { lines: true } },
      },
    });
    if (!po) throw new InventoryNotFoundError('PurchaseOrder', id);
    assertStatus(po, ['draft'], 'submitted');
    if (po._count.lines === 0) {
      throw new InventoryValidationError('Cannot submit a purchase order with no lines');
    }

    const now = new Date();
    const expected = input.expectedArrivalAt
      ? new Date(input.expectedArrivalAt)
      : (po.expectedArrivalAt ?? deriveArrival(now, po.supplier?.leadTimeDays ?? null));

    await tx.purchaseOrder.update({
      where: { id },
      data: { status: 'submitted', orderedAt: now, expectedArrivalAt: expected },
    });

    await audit(tx, ctx, id, 'submitted', { number: po.number });
    return loadPurchaseOrderDetail(tx, id);
  });
}

/** Cancel a not-yet-received PO (draft or submitted). Terminal. */
export async function cancelPurchaseOrder(
  ctx: ServiceContext,
  id: string
): Promise<PurchaseOrderDetail> {
  return withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, id);
    assertStatus(po, ['draft', 'submitted'], 'cancelled');

    await tx.purchaseOrder.update({ where: { id }, data: { status: 'cancelled' } });
    await audit(tx, ctx, id, 'cancelled', { number: po.number });
    return loadPurchaseOrderDetail(tx, id);
  });
}

/** Close a PO — stop receiving against it (e.g. the supplier short-shipped and
 *  the balance won't arrive). Allowed once ordered. Terminal. */
export async function closePurchaseOrder(
  ctx: ServiceContext,
  id: string
): Promise<PurchaseOrderDetail> {
  return withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, id);
    assertStatus(po, ['submitted', 'partial', 'received'], 'closed');

    await tx.purchaseOrder.update({ where: { id }, data: { status: 'closed' } });
    await audit(tx, ctx, id, 'closed', { number: po.number });
    return loadPurchaseOrderDetail(tx, id);
  });
}

function deriveArrival(now: Date, leadTimeDays: number | null): Date | null {
  if (leadTimeDays === null) return null;
  return new Date(now.getTime() + leadTimeDays * DAY_MS);
}

async function audit(
  tx: Parameters<typeof writeAuditLog>[0]['tx'],
  ctx: ServiceContext,
  id: string,
  transition: string,
  diff: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: `inventory.purchase_order.${transition}`,
    entityType: 'PurchaseOrder',
    entityId: id,
    diff: { after: diff },
  });
}
