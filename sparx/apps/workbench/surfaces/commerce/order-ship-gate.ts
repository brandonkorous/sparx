// What on this order can leave the building NOW, and why the rest cannot.
//
// One shipping rule refuses, everywhere, to send two kinds of order line (sparx
// persona issues 057 and 058): anything on a B2B order still waiting for
// approval, and a rebuilt part bought by sending the old part first whose old
// part has not arrived. The server applies it to every way out, and the rule is
// a pure function in @wizeworks/crm-schemas. The order pane reads the SAME
// function rather than a second spelling of it, so the buttons it offers and the
// sentences it prints are the ones the server would answer with.

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
