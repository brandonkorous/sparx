// A person with a booking is a customer (persona issue 113).
//
// Halo & Hem's Priyanka Deshmukh had a $180 color appointment on Friday, and her
// record called her a **Lead**. Only an order ever moved anyone off that stage
// (`recomputeCustomerCommerce` in @wizeworks/crm), so for a salon, a studio or a
// clinic, where people book time and never buy a product, every client stayed
// a lead for ever, and every group, filter and report that asks for customers
// left them all out. That is issue 280's till buyer again, through another door.
//
// The same rule as the order rollup, written here because this package writes
// the bookings and must not depend on CRM: it runs inside the transaction that
// puts a person on a booking, it only ever moves FORWARD (a customer or an
// evangelist keeps that, and a cancelled booking never demotes anyone), and
// `leadStatus` goes with it, since work in progress on a lead means nothing once
// they have booked.
//
// What counts as booked: a booking made for them, whether it is waiting for the
// business to accept it or not, and a seat in a class. A place on a waiting list
// is not a booking yet; the seat it turns into is.

import type { TxClient } from '@wizeworks/db';

/** Stages a booking does not move. The same list as the order rollup's. */
const SETTLED = ['customer', 'evangelist'];

/** Mark everyone named here as a customer, unless they already are one. */
export async function recognizeBookedCustomers(
  tx: TxClient,
  customerIds: readonly (string | null | undefined)[]
): Promise<void> {
  const ids = [...new Set(customerIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  await tx.customer.updateMany({
    where: { id: { in: ids }, lifecycleStage: { notIn: SETTLED } },
    data: { lifecycleStage: 'customer', leadStatus: null },
  });
}
