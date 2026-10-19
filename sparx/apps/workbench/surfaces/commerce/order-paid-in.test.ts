// What came in on an order, before anything was given back (sparx persona
// issue 232).
//
// Brynn O'Hara-Løvdal paid $1,587.00 for O-000033 and was given $793.50 back for
// one injector. The order keeps what is paid net of refunds, and its money block
// printed that net $793.50 as "Paid so far" over "Given back $793.50": a
// customer who paid in full read as one who paid half and got all of it back.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { amountDue, leftToRefund, paidIn, type Order } from './data';

const o33 = {
  status: 'delivered',
  paymentStatus: 'paid',
  total: 1587,
  amountPaid: 793.5,
  refundTotal: 793.5,
} as Order;

describe('paidIn', () => {
  it('is what came in, before the refund', () => {
    expect(paidIn(o33)).toBe(1587);
  });

  it('is the paid amount when nothing was given back', () => {
    expect(paidIn({ ...o33, amountPaid: 273.44, refundTotal: 0 })).toBe(273.44);
  });

  it('leaves nothing owed on a part-refunded order paid in full', () => {
    expect(amountDue(o33)).toBe(0);
  });
});

describe('the order money block', () => {
  it('prints what came in as Paid', () => {
    const pane = readFileSync(
      fileURLToPath(new URL('./order-detail.tsx', import.meta.url)),
      'utf8'
    );
    expect(pane).toContain('amount={paidIn(order)}');
    expect(pane).not.toContain('label="Paid so far" amount={order.amountPaid}');
  });
});

// Sparx persona issue 349. Renee paid $108.44 for O-000036 and got $93.44 back
// on a return. The order keeps $15.00 as paid, already net of that refund, and
// the order page took the $93.44 off a second time: no "Refund" button for the
// $15.00 still held, and O-000001 would have offered $450.00 of the $600.00.
describe('leftToRefund', () => {
  it('is what is still held after a return', () => {
    expect(leftToRefund({ amountPaid: 15, refundTotal: 93.44 })).toBe(15);
  });

  it('is all of it when nothing was given back', () => {
    expect(leftToRefund({ amountPaid: 273.44, refundTotal: 0 })).toBe(273.44);
  });

  it('is nothing on an order refunded in full', () => {
    expect(leftToRefund({ amountPaid: 0, refundTotal: 640.96 })).toBe(0);
  });

  it('is what the order page offers', () => {
    const pane = readFileSync(
      fileURLToPath(new URL('./order-detail.tsx', import.meta.url)),
      'utf8'
    );
    expect(pane).toContain('const refundableAmount = leftToRefund(order);');
  });
});
