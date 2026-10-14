import { describe, expect, it } from 'vitest';

import { coreDeposits, countsAsSale, orderSales } from './order-sales';

// What an order SOLD, which is what a revenue chart and the profit headline add
// up. Gillett's October read "You kept $14,740.25" over $11,459.60 of goods sold:
// the order TOTAL was being counted, and a total carries sales tax (the state's)
// and core deposits (the customer's, until the old part comes back), and the sum
// counted an order still waiting for approval (sparx persona issue 172).

const base = {
  subtotal: 600,
  discountTotal: 0,
  shippingTotal: 0,
  surchargeTotal: 0,
  taxTotal: 0,
  refundTotal: 0,
  coreRefunded: 0,
  coreKept: 0,
};

describe('what an order sold', () => {
  it('is the goods, not the core deposit riding on them', () => {
    // O-000004: a $600 injector with a $150 core deposit, total $750.
    expect(orderSales(base)).toEqual({
      grossCents: 60000,
      discountCents: 0,
      refundedCents: 0,
      soldCents: 60000,
    });
  });

  it('leaves out the sales tax collected for the state', () => {
    // O-000020: $1,007.60 of parts, $73.05 Utah tax.
    expect(orderSales({ ...base, subtotal: 1007.6, taxTotal: 73.05 }).soldCents).toBe(100760);
  });

  it('counts a core deposit refunded as nothing sold back', () => {
    // O-000001: the old part came back, so the $150 deposit was refunded. The
    // injector is still sold.
    expect(orderSales({ ...base, refundTotal: 150, coreRefunded: 150 })).toMatchObject({
      refundedCents: 0,
      soldCents: 60000,
    });
  });

  it('counts a deposit the shop kept as money it made', () => {
    expect(orderSales({ ...base, coreKept: 150 }).soldCents).toBe(75000);
  });

  it('takes a goods refund off without its tax share', () => {
    // $100 of goods with $7 tax, fully refunded ($107 back): $100 less sold.
    const o = { ...base, subtotal: 100, taxTotal: 7, refundTotal: 107 };
    expect(orderSales(o)).toMatchObject({ refundedCents: 10000, soldCents: 0 });
  });

  it('keeps shipping and a card surcharge, less any discount', () => {
    const o = { ...base, subtotal: 200, discountTotal: 20, shippingTotal: 15, surchargeTotal: 6 };
    expect(orderSales(o).soldCents).toBe(20100);
  });
});

describe('which orders count as sales', () => {
  it('leaves out a cancelled order and one still waiting for approval', () => {
    expect(countsAsSale('cancelled')).toBe(false);
    expect(countsAsSale('pending_approval')).toBe(false);
    for (const status of ['placed', 'fulfilled', 'delivered', 'refunded']) {
      expect(countsAsSale(status)).toBe(true);
    }
  });
});

describe('the core deposits on an order', () => {
  const line = {
    coreCharge: 150,
    quantityRefunded: 0,
    coresReturned: 0,
    coresKept: 0,
    coreFirst: false,
  };

  it('counts a deposit refunded when the old part came back', () => {
    expect(coreDeposits([{ ...line, coresReturned: 1 }])).toEqual({
      coreRefunded: 150,
      coreKept: 0,
    });
  });

  it('counts a deposit refunded with the part itself', () => {
    // The part came back, so its deposit went back with it (order_items comment).
    expect(coreDeposits([{ ...line, quantityRefunded: 1 }])).toEqual({
      coreRefunded: 150,
      coreKept: 0,
    });
  });

  it('counts a deposit kept', () => {
    expect(coreDeposits([{ ...line, coresKept: 2 }])).toEqual({ coreRefunded: 0, coreKept: 300 });
  });

  it('counts nothing on a line bought old part first, which took no deposit', () => {
    expect(coreDeposits([{ ...line, coreFirst: true, coresReturned: 1 }])).toEqual({
      coreRefunded: 0,
      coreKept: 0,
    });
  });

  it('counts nothing on a line with no core', () => {
    expect(coreDeposits([{ ...line, coreCharge: null, quantityRefunded: 1 }])).toEqual({
      coreRefunded: 0,
      coreKept: 0,
    });
  });
});
