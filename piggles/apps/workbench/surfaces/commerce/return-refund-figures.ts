// The figures a return's refund dialog starts from, worked out from the order's
// own lines. Both are zero when the order (and so its prices) is not known.

import { coresOwedOn } from './cores-data';
import type { Order } from './order-types';
import type { ReturnDetail } from './returns-data';

export interface RefundFigures {
  /** The accepted lines at the price they sold for. */
  suggestedCents: number;
  /** Core deposits that go back with the parts: a part that comes back is its
   *  own core (sparx persona issue 051). The server adds these itself. */
  coreBackCents: number;
}

export function refundFigures(detail: ReturnDetail, order: Order | undefined): RefundFigures {
  const lines = new Map((order?.items ?? []).map((line) => [line.id, line] as const));
  let suggestedCents = 0;
  let coreBackCents = 0;
  for (const it of detail.items) {
    const line = lines.get(it.orderItemId);
    if (!line) continue;
    const qty = it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
    suggestedCents += Math.round(line.unitPrice * qty * 100);
    if (line.coreCharge !== null) {
      coreBackCents += Math.min(qty, coresOwedOn(line)) * Math.round(line.coreCharge * 100);
    }
  }
  return { suggestedCents, coreBackCents };
}
