// The figures "Give the money back" starts from, for the lines accepted back.
//
// What the customer paid for those units, from the server (`paidGoodsCents` and
// `paidTaxCents`, worked out by the one rule the return form and the refund split
// also use). It was the unit price times the units: Brynn's injector came to
// $600.00 when she had paid $643.50 for it, sales tax included (sparx persona
// issue 231). An older server sends no figures; the price each is then all that
// is known, and no tax is claimed.

import { coresOwedOn } from './cores-data';
import type { Order } from './data';
import type { ReturnDetail } from './returns-data';

export interface RefundFigures {
  /** What the accepted units were paid, tax included. */
  suggestedCents: number;
  /** The sales tax inside that figure, so the dialog can say it is there. */
  taxCents: number;
  /** Core deposits that go back with the parts: a part that comes back is its
   *  own core (issue 051). The server adds these itself. */
  coreBackCents: number;
}

export function refundFigures(detail: ReturnDetail, order: Order | undefined): RefundFigures {
  const lines = new Map((order?.items ?? []).map((line) => [line.id, line] as const));
  const figures: RefundFigures = { suggestedCents: 0, taxCents: 0, coreBackCents: 0 };
  for (const it of detail.items) {
    const line = lines.get(it.orderItemId);
    if (!line) continue;
    const qty = it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
    if (it.paidGoodsCents !== undefined) {
      const tax = it.paidTaxCents ?? 0;
      figures.suggestedCents += it.paidGoodsCents + tax;
      figures.taxCents += tax;
    } else {
      figures.suggestedCents += Math.round(line.unitPrice * qty * 100);
    }
    if (line.coreCharge != null) {
      figures.coreBackCents += Math.min(qty, coresOwedOn(line)) * Math.round(line.coreCharge * 100);
    }
  }
  return figures;
}
