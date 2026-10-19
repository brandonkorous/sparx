// What the consoles are told about each payment on an order (sparx persona issue 353).
//
// Whether a refund can go back through a gateway is the server's call: it asks
// `takenByGateway(processor)` before it calls one (`order-refund.ts`). The two
// consoles each kept their own short list of processors "paid by hand" instead,
// and the lists disagreed with the server and with each other: a card taken on
// the shop's own reader (`card`) read in sparx as "Sends $600.00 back to the card"
// while the server only records it. So the list endpoint says it, once.

import { takenByGateway } from '@wizeworks/payments';

/** Each payment row with `byGateway`: true when a gateway took it, so a refund
 *  goes back through that gateway; false when the money was taken by hand. */
export function withByGateway<T extends { processor: string }>(
  rows: readonly T[]
): (T & { byGateway: boolean })[] {
  return rows.map((row) => ({ ...row, byGateway: takenByGateway(row.processor) }));
}
