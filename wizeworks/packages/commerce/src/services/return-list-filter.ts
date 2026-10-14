// Which returns a list asks for. The console asks by state or by order; a
// buyer's account page asks for the returns on her own orders (sparx persona
// issue 196). It used to read the shop's latest 200 returns and keep hers, so in
// a shop with more, her older returns were not on her list.

import type { Prisma } from '@wizeworks/db';

import type { ReturnStatus } from '@wizeworks/commerce-schemas';

/** The `where` for a return list. `customerOrderIds` is null for the console,
 *  and the buyer's own order ids for her list: an empty array finds nothing,
 *  never every return in the shop. */
export function returnListWhere(
  filter: { status?: ReturnStatus; orderId?: string },
  customerOrderIds: string[] | null
): Prisma.ReturnRequestWhereInput {
  const asked: Prisma.ReturnRequestWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.orderId ? { orderId: filter.orderId } : {}),
  };
  if (customerOrderIds === null) return asked;
  const hers: Prisma.ReturnRequestWhereInput = { orderId: { in: customerOrderIds } };
  return filter.orderId ? { AND: [asked, hers] } : { ...asked, ...hers };
}
