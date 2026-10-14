// A supplier's parcel, recorded on the CUSTOMER'S order.
//
// A dropshipped order is one the shop never touches: the supplier ships it. When
// the supplier said it had shipped (the tracking poll) the shipment was written on
// the supplier order and nowhere else, so the customer's own order never read
// "shipped" and the "your order is on its way" email, which hangs off a
// fulfillment on that order, never went (sparx persona issue 170). And a supplier
// the owner orders from by hand had no way to say it shipped at all.
//
// Both now end here: one fulfillment on the customer's order for this supplier's
// lines, through the same `createFulfillment` every other way out of the building
// uses, so the order moves on and `order.fulfilled` sends the email.

import { orderFulfillmentsService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';

/** The carriers a fulfillment knows by name (crm-schemas `Carrier`). */
const KNOWN_CARRIERS = ['ups', 'usps', 'fedex', 'dhl'] as const;
type KnownCarrier = (typeof KNOWN_CARRIERS)[number];

/** A carrier as a person typed it: one we know by name, or theirs in their words. */
export function carrierOf(
  typed: string | null | undefined
): { carrier: KnownCarrier | 'other'; carrierOther?: string } | { carrier: null } {
  const words = (typed ?? '').trim();
  if (words === '') return { carrier: null };
  const known = KNOWN_CARRIERS.find((c) => c === words.toLowerCase());
  return known ? { carrier: known } : { carrier: 'other', carrierOther: words.slice(0, 63) };
}

/** The order lines this supplier ships, less what has already left. */
export function dropshipFulfillmentLines(
  items: readonly {
    id: string;
    quantity: number;
    quantityFulfilled: number;
    variant: { dropshipSourceId: string | null } | null;
  }[],
  supplierId: string
): { orderItemId: string; quantity: number }[] {
  return items
    .filter((item) => item.variant?.dropshipSourceId === supplierId)
    .map((item) => ({ orderItemId: item.id, quantity: item.quantity - item.quantityFulfilled }))
    .filter((line) => line.quantity > 0);
}

export type DropshipAction = 'placed' | 'shipped';

/**
 * Where a supplier order goes when the owner records something on it, or null
 * when that cannot happen from here. "Placed" moves one waiting on them (or one
 * that failed to send itself) to submitted; "shipped" moves anything not yet
 * shipped to shipped, since an owner may only hear about it once it is on its way.
 */
export function nextDropshipStatus(current: string, action: DropshipAction): string | null {
  if (action === 'placed') {
    return current === 'pending' || current === 'failed' ? 'submitted' : null;
  }
  return current === 'pending' || current === 'failed' || current === 'submitted'
    ? 'shipped'
    : null;
}

/**
 * Record a supplier order's shipment on the customer's order.
 *
 * Returns the fulfillment made, or null when every one of this supplier's lines
 * has already left (a second "shipped" for the same parcel adds nothing).
 */
export async function recordDropshipShipment(
  tenantId: string,
  actorId: string | null,
  shipment: {
    dropshipOrderId: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  }
): Promise<{ fulfillmentId: string } | null> {
  const found = await withTenant({ tenantId }, async (tx) => {
    const dsOrder = await tx.dropshipOrder.findUnique({
      where: { id: shipment.dropshipOrderId },
      select: { orderId: true, supplierId: true },
    });
    if (!dsOrder) return null;
    const items = await tx.orderItem.findMany({
      where: { orderId: dsOrder.orderId },
      select: {
        id: true,
        quantity: true,
        quantityFulfilled: true,
        variant: { select: { dropshipSourceId: true } },
      },
    });
    return { orderId: dsOrder.orderId, lines: dropshipFulfillmentLines(items, dsOrder.supplierId) };
  });
  if (!found || found.lines.length === 0) return null;

  const fulfillment = await orderFulfillmentsService.createFulfillment(
    { tenantId, ...(actorId ? { userId: actorId } : {}) },
    {
      orderId: found.orderId,
      status: 'shipped',
      ...carrierOf(shipment.carrier),
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      lines: found.lines,
      metadata: { dropshipOrderId: shipment.dropshipOrderId },
    }
  );
  return { fulfillmentId: fulfillment.id };
}
