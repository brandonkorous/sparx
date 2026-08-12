// Purchase-order lifecycle transitions (docs/100 P3b) — the status moves the PO
// itself owns:
//
//   submit      draft                          → submitted, OR pending_approval
//                                                when a spending rule matches
//                                                (docs/146 Phase 8.5)
//   reschedule  submitted | partial            → same status, new arrival date
//   cancel      draft | pending_approval | submitted → cancelled (nothing received)
//   close       submitted|partial|received     → closed (stop receiving the rest)
//
// partial / received are NOT here — receiving (P3c) drives those as goods book in.
// The approve/reject moves out of `pending_approval` live in
// ./purchase-order-approvals.ts, because that is where the trail is written.

import { SubmitPurchaseOrderInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import { z } from 'zod';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { openApprovalRequest, resolveRequiredApproval } from './purchase-order-approvals';
import {
  assertStatus,
  ensurePurchaseOrder,
  loadPurchaseOrderDetail,
} from './purchase-order-shared';
import type { PurchaseOrderDetail } from './purchase-order-shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Submit a draft PO.
 *
 * Two outcomes, and the second is new in Phase 8.5. With no spending rule
 * matching, this places the order exactly as it always did: stamp `orderedAt`,
 * resolve the expected arrival from the override → an already-set date → the
 * supplier's lead time. With a rule matching, the order goes to
 * `pending_approval` instead and NOTHING is stamped — until somebody signs,
 * there is no order, and an `orderedAt` written now would make an unapproved
 * order look placed to every report that reads it.
 *
 * An expected-arrival override given at submit is stored either way, so a date
 * the buyer typed survives the hold rather than being retyped after approval.
 */
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
        supplierId: true,
        warehouseId: true,
        totalCents: true,
        currency: true,
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
    const typedArrival = input.expectedArrivalAt ? new Date(input.expectedArrivalAt) : null;

    const gate = await resolveRequiredApproval(tx, ctx.tenantId, {
      supplierId: po.supplierId,
      warehouseId: po.warehouseId,
      totalCents: po.totalCents,
    });

    if (gate) {
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'pending_approval',
          ...(typedArrival ? { expectedArrivalAt: typedArrival } : {}),
        },
      });
      await openApprovalRequest(tx, ctx, {
        purchaseOrderId: id,
        ruleId: gate.ruleId,
        requiredApproverUserId: gate.requiredApproverUserId,
        amountCents: po.totalCents,
        currency: po.currency,
      });
      await audit(tx, ctx, id, 'approval_requested', {
        number: po.number,
        amountCents: po.totalCents,
      });
      return loadPurchaseOrderDetail(tx, id);
    }

    const expected =
      typedArrival ?? po.expectedArrivalAt ?? deriveArrival(now, po.supplier?.leadTimeDays ?? null);

    await tx.purchaseOrder.update({
      where: { id },
      data: { status: 'submitted', orderedAt: now, expectedArrivalAt: expected },
    });

    await audit(tx, ctx, id, 'submitted', { number: po.number });
    return loadPurchaseOrderDetail(tx, id);
  });
}

export const RescheduleArrivalInput = z.object({
  /** Null clears the date entirely — "they cannot tell us when", which is a
   *  truthful state and better than a stale promise nobody believes. */
  expectedArrivalAt: z.string().datetime().nullable(),
  note: z.string().trim().max(500).optional(),
});
export type RescheduleArrivalInput = z.infer<typeof RescheduleArrivalInput>;

/**
 * Record a new arrival date on an order already placed (docs/146 Phase 8.3).
 *
 * This exists because `updatePurchaseOrder` is draft-only, and until now there
 * was no way at all to record "they rang to say it will be a fortnight". The
 * buyer either left a date they knew was wrong — which makes the late list
 * useless — or nothing changed and the order stayed permanently overdue.
 *
 * Accepting a new promise RE-ARMS the late alert: `lateAlertedAt` is cleared, so
 * if this date is missed too, it is heard.
 */
export async function reschedulePurchaseOrderArrival(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<PurchaseOrderDetail> {
  const input = RescheduleArrivalInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, id);
    assertStatus(po, ['submitted', 'partial'], 'rescheduled');

    await tx.purchaseOrder.update({
      where: { id },
      data: {
        expectedArrivalAt: input.expectedArrivalAt ? new Date(input.expectedArrivalAt) : null,
        lateAlertedAt: null,
      },
    });
    await audit(tx, ctx, id, 'rescheduled', {
      number: po.number,
      expectedArrivalAt: input.expectedArrivalAt,
      note: input.note ?? null,
    });
    return loadPurchaseOrderDetail(tx, id);
  });
}

/** Cancel a not-yet-received PO (draft, held for approval, or submitted).
 *  Terminal. */
export async function cancelPurchaseOrder(
  ctx: ServiceContext,
  id: string
): Promise<PurchaseOrderDetail> {
  return withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, id);
    assertStatus(po, ['draft', 'pending_approval', 'submitted'], 'cancelled');

    await tx.purchaseOrder.update({ where: { id }, data: { status: 'cancelled' } });

    // A cancelled order leaves nothing to sign. Left pending, the request would
    // sit in somebody's queue forever attached to an order that no longer
    // exists — and an approval queue with dead entries in it stops being worked.
    await tx.purchaseOrderApproval.updateMany({
      where: { purchaseOrderId: id, status: 'pending' },
      data: { status: 'cancelled', decidedAt: new Date(), decidedByUserId: ctx.userId ?? null },
    });

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
