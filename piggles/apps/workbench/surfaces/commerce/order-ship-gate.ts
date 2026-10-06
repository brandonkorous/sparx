// What on an order can be sent NOW, in the server's own words (issues 057, 058):
// nothing on a B2B order waiting for approval, and no send-first part before its
// old part arrives. Same pure rule the server refuses with.

import {
  lineShipRefusal,
  orderShipRefusal,
  shippableUnits,
  unitsWaitingForCore,
  type ShipGateLine,
} from '@wizeworks/commerce-schemas';
import type { Order, OrderItem } from './data';

export interface ShipNow {
  /** Why nothing on this order can be sent right now, in the server's words; null
   *  when something can. */
  refusal: string | null;
  /** What can be sent now, at the quantity that may go. */
  lines: { orderItemId: string; quantity: number }[];
  /** Why part of a line has to stay behind, one sentence per line, in the
   *  server's words. Empty when nothing is waiting. */
  held: string[];
}

function gateLine(item: OrderItem): ShipGateLine {
  return {
    name: item.name,
    quantity: item.quantity,
    quantityFulfilled: item.quantityFulfilled,
    coreFirst: item.coreFirst,
    coreHoldReleasedAt: item.coreHoldReleasedAt,
    coresReturned: item.coresReturned,
  };
}

export function whatCanShipNow(order: Order): ShipNow {
  const items = order.items ?? [];
  const orderRefusal = orderShipRefusal(order);
  if (orderRefusal) return { refusal: orderRefusal, lines: [], held: [] };

  const lines: ShipNow['lines'] = [];
  const held: string[] = [];
  for (const item of items) {
    const line = gateLine(item);
    const now = shippableUnits(line);
    if (now > 0) lines.push({ orderItemId: item.id, quantity: now });
    if (unitsWaitingForCore(line) > 0) {
      const remaining = Math.max(0, item.quantity - item.quantityFulfilled);
      const why = lineShipRefusal(line, remaining);
      if (why) held.push(why);
    }
  }

  // Nothing can go, and something is still owed: the held sentences ARE the
  // reason, said once rather than as a refusal and a list repeating it.
  if (lines.length === 0 && held.length > 0) {
    return { refusal: held.join(' '), lines: [], held: [] };
  }
  return { refusal: null, lines, held };
}

/** A short state for the order's toolbar, or null when nothing is held. */
export function shipHoldLabel(order: Order, shipNow: ShipNow): string | null {
  if (order.status === 'pending_approval') return 'Waiting for approval';
  if (order.status === 'cancelled' || order.status === 'refunded') return null;
  return shipNow.refusal !== null || shipNow.held.length > 0 ? 'Waiting for an old part' : null;
}
