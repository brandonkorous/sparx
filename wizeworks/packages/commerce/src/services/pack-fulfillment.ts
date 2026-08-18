// Sealed box → shipping record (docs/146 Phase 4.6).
//
// ── Why this lives in @wizeworks/commerce ────────────────────────────────────────
//
// It is the only package that can see both sides. `@wizeworks/inventory` owns the
// packing record and must not depend on `@wizeworks/crm` — the dependency rule points
// consumers AT inventory, never the reverse — and `@wizeworks/crm` owns the order and
// the fulfillment and knows nothing about warehouses. Commerce already depends on
// both, and already owns the rest of the outbound shipping path
// (`outbound-shipment-request.ts`, `fulfillment-label-store.ts`,
// `shipping-provider-bridge.ts`), so the hand-off belongs here next to the label
// purchase it feeds.
//
// ── One box, one fulfillment ─────────────────────────────────────────────────
//
// Not one order, one fulfillment. A three-box order is three shipping records
// because it is three parcels with three tracking numbers, and `OrderFulfillment`
// has carried exactly one tracking number since the day it was written. Order
// promotion to `fulfilled` still happens correctly: `createFulfillment` checks
// whether every ITEM is fully fulfilled, not whether one fulfillment covers
// everything.
//
// Nothing here decrements stock. The units left the ledger at checkout; a
// shipping record is paperwork about goods that have already gone.

import { orderFulfillmentsService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';
import type { OrderFulfillment } from '@wizeworks/db';

import { CommerceConflictError, CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';

export interface FulfillPackedShipmentInput {
  packageId: string;
  /** Carrier + service, when they are already known (a rate was bought, or the
   *  tenant ships on one account and never chooses). Left off, the fulfillment
   *  is created `pending` and the existing rate/label flow fills them in. */
  carrier?: string;
  service?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  /** Mark it shipped immediately rather than pending. For the shop that hands
   *  boxes to a driver and never buys a label through us. */
  markShipped?: boolean;
  notes?: string;
}

export interface FulfillPackedShipmentResult {
  fulfillmentId: string;
  packageId: string;
  packageNumber: string;
  orderId: string;
  lines: number;
  units: number;
  /** True when this box completed the order. */
  orderComplete: boolean;
}

/**
 * Turn a sealed box into a shipping record.
 *
 * Idempotent by the package's own `fulfillmentId`: a double-tapped Ship button,
 * or a retried request, returns the existing record rather than creating a second
 * one. Without that, one box becomes two fulfillments, `quantityFulfilled` double
 * counts, and the order reports fulfilled while half of it is still on a shelf.
 */
export async function fulfillPackedShipment(
  ctx: ServiceContext,
  input: FulfillPackedShipmentInput
): Promise<FulfillPackedShipmentResult> {
  const box = await inventoryService.getPackage(ctx, input.packageId);

  if (box.status !== 'packed') {
    throw new CommerceConflictError(
      box.status === 'open'
        ? `Box ${box.number} is still open. Seal it before handing it to shipping.`
        : `Box ${box.number} is ${box.status}.`
    );
  }

  const lines = box.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) {
    throw new CommerceValidationError(`Box ${box.number} has nothing in it.`);
  }

  if (box.fulfillmentId) {
    const existing = await withTenant(ctx, (tx) =>
      tx.orderFulfillment.findFirst({
        where: { id: box.fulfillmentId! },
        select: { id: true },
      })
    );
    if (existing) {
      return {
        fulfillmentId: existing.id,
        packageId: box.id,
        packageNumber: box.number,
        orderId: box.orderId,
        lines: lines.length,
        units: box.unitCount,
        orderComplete: box.orderFullyPacked,
      };
    }
    // The pointer survived a fulfillment that was cancelled and deleted. Fall
    // through and make a new one — the box is still packed and still needs to go.
  }

  const fulfillment: OrderFulfillment = await orderFulfillmentsService.createFulfillment(ctx, {
    orderId: box.orderId,
    status: input.markShipped ? 'shipped' : 'pending',
    ...(input.carrier ? { carrier: input.carrier } : {}),
    ...(input.service ? { service: input.service } : {}),
    ...(input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
    ...(input.trackingUrl ? { trackingUrl: input.trackingUrl } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    // The packing record is what makes this fulfillment auditable back to a
    // physical box and, through the box, to the scans that verified it.
    metadata: {
      packageId: box.id,
      packageNumber: box.number,
      ...(box.pickListNumber ? { pickList: box.pickListNumber } : {}),
      scannedUnits: box.scannedCount,
    },
    lines: lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })),
  });

  await inventoryService.attachFulfillment(ctx, box.id, fulfillment.id);

  // The goods have left the building, so any commitment this order was carrying
  // is discharged (docs/146 Phase 9.1). Best-effort on purpose: a box that has
  // physically shipped must be recorded as shipped even if a queue row will not
  // update, and the nightly pass re-reads the queue anyway.
  await inventoryService
    .markBackordersFulfilled(ctx, { holderType: 'order', holderId: box.orderId })
    .catch(() => undefined);

  return {
    fulfillmentId: fulfillment.id,
    packageId: box.id,
    packageNumber: box.number,
    orderId: box.orderId,
    lines: lines.length,
    units: box.unitCount,
    orderComplete: box.orderFullyPacked,
  };
}

/**
 * Seal a box and hand it straight to shipping.
 *
 * The pack bench's one button. Two steps that always happen together and whose
 * separation only ever produces a sealed box nobody remembered to ship.
 */
export async function closeAndFulfillPackage(
  ctx: ServiceContext,
  input: FulfillPackedShipmentInput & { allowPartial?: boolean }
): Promise<FulfillPackedShipmentResult> {
  const box = await inventoryService.getPackage(ctx, input.packageId).catch(() => null);
  if (!box) throw new CommerceNotFoundError('ShipmentPackage', input.packageId);

  if (box.status === 'open') {
    await inventoryService.closePackage(ctx, input.packageId, {
      ...(input.allowPartial !== undefined ? { allowPartial: input.allowPartial } : {}),
    });
  }
  return fulfillPackedShipment(ctx, input);
}
