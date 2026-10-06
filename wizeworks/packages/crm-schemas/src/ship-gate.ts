// Can this order, and this line of it, leave the building yet?
//
// ONE rule for every way out: recording a shipment or a handover, building a pick
// list, opening a box, packing a unit, and pack-and-ship. Before this the only
// question any of them asked was "was it cancelled?", so two kinds of order that
// must wait could be picked, packed and shipped like any other:
//
//  - A B2B order held for approval (sparx persona issue 058). Its stock was not
//    committed and the warehouse could still send it, and a held order shipped in
//    full was then marked delivered without ever being approved.
//  - A rebuilt part bought by sending the old part FIRST (issue 057). It ships
//    when the old part arrives, one unit per old part, unless the business chose
//    to ship it before then.
//
// Pure, so the service that refuses, the pick list that leaves a line out and the
// screen that greys a button all give the same answer in the same words.

/** Why this ORDER cannot ship at all right now, or null when it can. */
export function orderShipRefusal(order: { status: string; orderNumber?: string }): string | null {
  const name = order.orderNumber ? `Order ${order.orderNumber}` : 'This order';
  switch (order.status) {
    case 'cancelled':
      return `${name} was canceled, so nothing on it can be sent.`;
    case 'refunded':
      return `${name} was refunded, so nothing on it can be sent.`;
    case 'pending_approval':
      return `${name} is waiting for approval. Approve it before anything on it is sent.`;
    default:
      return null;
  }
}

/** The fields of an order line this rule reads. */
export interface ShipGateLine {
  name: string;
  quantity: number;
  quantityFulfilled: number;
  coreFirst: boolean;
  coreHoldReleasedAt: Date | string | null;
  coresReturned: number;
}

/**
 * How many more units of this line may be sent now.
 *
 * An ordinary line: everything not yet sent. A send-the-old-part-first line: one
 * unit per old part that has arrived, less what has already gone, until the
 * business releases it, after which it is an ordinary line again.
 */
export function shippableUnits(line: Omit<ShipGateLine, 'name'>): number {
  const remaining = Math.max(0, line.quantity - line.quantityFulfilled);
  if (!line.coreFirst || line.coreHoldReleasedAt !== null) return remaining;
  return Math.max(0, Math.min(remaining, line.coresReturned - line.quantityFulfilled));
}

/** Units of this line waiting for the customer's old part. Zero on any other line. */
export function unitsWaitingForCore(line: Omit<ShipGateLine, 'name'>): number {
  return Math.max(0, line.quantity - line.quantityFulfilled) - shippableUnits(line);
}

/** Why `wanted` units of this line cannot be sent now, or null when they can. */
export function lineShipRefusal(line: ShipGateLine, wanted: number): string | null {
  const remaining = Math.max(0, line.quantity - line.quantityFulfilled);
  if (wanted > remaining) {
    return remaining === 0
      ? `All of ${line.name} has already been sent.`
      : `Only ${String(remaining)} of ${line.name} ${remaining === 1 ? 'is' : 'are'} still to send.`;
  }
  const allowed = shippableUnits(line);
  if (wanted <= allowed) return null;
  const waiting = remaining - allowed;
  return allowed === 0
    ? `${line.name} is held until the customer's old part arrives, and it has not arrived yet. Record it on the order when it does, or choose not to wait for it.`
    : `Only ${String(allowed)} of ${line.name} can go now: ${String(waiting)} ${waiting === 1 ? 'is' : 'are'} waiting for the customer's old part.`;
}
