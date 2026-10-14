// The order a sale at the counter is written as (`POST /v1/orders`).
//
// The sales tax goes on each line and on the order, with the rate it was charged
// at, as a checkout order keeps it (sparx persona issues 226, 228), so the
// receipt, the takings and an invoice made from it all show it. It used to go
// nowhere: every counter sale was written with $0.00 of tax (issue 230).

import { saleItem } from './sale-core';
import type { SaleLine } from './sale-data';
import { noticeOn } from './sale-made-to-order';
import { taxByLine, type SaleTaxQuote } from './sale-tax';

/** The same rate ref checkout writes when a shopper chooses to collect, so the
 *  order pane reads a counter sale as collected and stops offering a carrier, a
 *  tracking number and a warehouse walk. See `deliveryPlan` in order-types. */
export const COLLECTION_RATE_REF = 'collection:in-person';

export function saleOrderBody(input: {
  customerId: string;
  currency: string;
  propertyId: string | null;
  lines: SaleLine[];
  tax: SaleTaxQuote | null;
}) {
  const notice = noticeOn(input.lines);
  const tax = input.tax ? taxByLine(input.tax) : new Map<string, number>();
  return {
    customerId: input.customerId,
    currency: input.currency,
    channel: 'admin',
    source: 'till',
    // The order spine turns days into the due DAY, in the shop's own zone
    // (issue 026). A cake ordered over the counter gets the same date a cake
    // ordered from the website does.
    ...(notice !== null ? { orderAheadDays: notice } : {}),
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    ...(input.tax ? { taxTotal: input.tax.totalTaxCents / 100 } : {}),
    metadata: {
      shippingRateRef: COLLECTION_RATE_REF,
      shippingDescription: 'Taken at the counter',
      ...(input.tax?.rateBasisPoints ? { taxRateBasisPoints: input.tax.rateBasisPoints } : {}),
    },
    // A rebuilt part carries its core deposit, or "old part first" and no
    // deposit, never both (sparx issue 061). See sale-core.ts.
    items: input.lines.map((line) => saleItem(line, tax.get(line.id) ?? 0)),
  };
}
