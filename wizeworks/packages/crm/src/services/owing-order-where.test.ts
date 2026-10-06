// The "Still owed" chip asks the database; the order page asks `isOwingOrder`.
// They must give the same answer for every order, or the list shows rows the
// page says owe nothing.
//
// MEASURED 2026-10-06 on Gillett: O-000016, held for Doty's sign-off, read
// "still owed" on its page and sat under the chip, though nothing is owed until
// it is approved (sparx persona issue 091). The rule now says so in one place,
// and this holds the query to it for every status the database can store.

import { describe, expect, it } from 'vitest';
import {
  HELD_FOR_SIGN_OFF_STATUS,
  OrderPaymentStatus,
  OrderStatus,
  isOwingOrder,
} from '@wizeworks/crm-schemas';

const { OWING_ORDER_WHERE } = await import('./order-service.js');

/** The two clauses the query uses, read the way Postgres reads them. */
function queryMatches(row: { status: string; paymentStatus: string }): boolean {
  const where = OWING_ORDER_WHERE as {
    status: { notIn: string[] };
    paymentStatus: { in: string[] };
  };
  return (
    !where.status.notIn.includes(row.status) && where.paymentStatus.in.includes(row.paymentStatus)
  );
}

describe('the "Still owed" query', () => {
  const statuses = [...OrderStatus.options, HELD_FOR_SIGN_OFF_STATUS];

  it('agrees with the order page on every status and payment word', () => {
    for (const status of statuses) {
      for (const paymentStatus of OrderPaymentStatus.options) {
        expect(queryMatches({ status, paymentStatus }), `${status} / ${paymentStatus}`).toBe(
          isOwingOrder({ status, paymentStatus })
        );
      }
    }
  });

  it('leaves out an order held for sign-off', () => {
    expect(queryMatches({ status: HELD_FOR_SIGN_OFF_STATUS, paymentStatus: 'unpaid' })).toBe(false);
  });
});
