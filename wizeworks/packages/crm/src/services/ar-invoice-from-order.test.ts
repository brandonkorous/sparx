// An order on account is invoiced with its own items.
//
// MEASURED 2026-10-06 on Gillett: INV-000009, Salt Lake County's bill for
// O-000012, printed one line, "Order O-000012 · 1 · $3,715.00". The order was
// 2 × Holset Reman Turbo Actuator at the contract $1,657.50 with a $200.00
// refundable core deposit each: $3,315.00 of goods and $400.00 of deposits,
// folded together under a footer about returning cores for credit (sparx
// persona issue 095). Five of Gillett's six invoices on account looked like it.

import { describe, expect, it } from 'vitest';

import { computeBillingTotals } from './billing-totals';
import { itemizedFromOrder } from './ar-invoice-lines';

const ACTUATORS = {
  name: 'Holset Reman Turbo Actuator, X15 EPA17 6382093HX',
  sku: '6382093HX',
  quantity: 2,
  unitPrice: 1657.5,
  lineSubtotal: 3315,
  discountAmount: 0,
  taxAmount: 0,
  coreCharge: 200,
  productId: 'actuator',
  variantId: 'actuator-v',
};

const O_000012 = { shippingTotal: 0, surchargeTotal: 0, items: [ACTUATORS] };

describe('itemizedFromOrder', () => {
  it('bills each part with its deposit on its own line', () => {
    const invoice = itemizedFromOrder(O_000012, 3715);
    expect(invoice).not.toBeNull();
    expect(invoice?.lines).toEqual([
      expect.objectContaining({
        // The code is already in the name, so it is not printed twice.
        description: 'Holset Reman Turbo Actuator, X15 EPA17 6382093HX',
        quantity: 2,
        unitPrice: 1657.5,
        coreCharge: 200,
        variantId: 'actuator-v',
        // Order items keep no cost: unknown, never $0.
        costCents: null,
      }),
    ]);
    const totals = computeBillingTotals(invoice?.lines ?? [], invoice?.taxRate ?? 0);
    expect(totals).toMatchObject({ subtotal: 3315, coreChargeTotal: 400, total: 3715 });
  });

  it('keeps tax where the order charged it, and only there', () => {
    const invoice = itemizedFromOrder(
      {
        shippingTotal: 25,
        surchargeTotal: 0,
        items: [
          { ...ACTUATORS, quantity: 1, lineSubtotal: 1657.5, coreCharge: null, taxAmount: 120.17 },
          {
            name: 'Cummins Fuel Injection Crossover Tube O-Ring',
            sku: '4062328',
            quantity: 2,
            unitPrice: 3.8,
            lineSubtotal: 7.6,
            discountAmount: 0,
            taxAmount: 0,
            coreCharge: null,
            productId: 'o-ring',
            variantId: 'o-ring-v',
          },
        ],
      },
      1810.27
    );
    expect(invoice?.taxRate).toBe(0.0725);
    expect(invoice?.lines.map((line) => [line.description, line.taxable])).toEqual([
      ['Holset Reman Turbo Actuator, X15 EPA17 6382093HX', true],
      ['Cummins Fuel Injection Crossover Tube O-Ring (4062328)', false],
    ]);
  });

  it('keeps the single order line when the items do not come to the order total', () => {
    // A discount on the whole order, which no item carries.
    expect(itemizedFromOrder(O_000012, 3615)).toBeNull();
  });

  it('has nothing to itemize for an order with no items', () => {
    expect(itemizedFromOrder({ ...O_000012, items: [] }, 3715)).toBeNull();
  });
});
