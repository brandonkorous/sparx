import { describe, expect, it } from 'vitest';

import { purchaseOrderEmailLines, purchaseOrderEmailSummary } from './purchase-order-email';

// What the supplier reads to fill the order (sparx persona issue 071).
const LINE = {
  description: 'Alliant Power Remanufactured Common Rail Injector',
  sku: 'AP54800',
  supplierSku: 'AP54800',
  quantityOrdered: 6,
  quantityReceived: 0,
  unitCostCents: 23800,
  lineTotalCents: 142800,
};

describe('the lines of an emailed purchase order', () => {
  it('shows the sum behind each line', () => {
    const [line] = purchaseOrderEmailLines({ currency: 'USD', lines: [LINE] });
    expect(line?.subtitle).toBe('AP54800 · 6 × $238.00');
    expect(line?.amount).toBe('$1,428.00');
  });

  it("adds the supplier's own code when it differs from ours", () => {
    const [line] = purchaseOrderEmailLines({
      currency: 'USD',
      lines: [{ ...LINE, supplierSku: 'R-54800' }],
    });
    expect(line?.subtitle).toBe('AP54800 · their code R-54800 · 6 × $238.00');
  });

  it('prints freight only when there is any', () => {
    expect(
      purchaseOrderEmailSummary({ currency: 'USD', subtotalCents: 360800, freightCents: 0 })
    ).toEqual([{ label: 'Subtotal', value: '$3,608.00' }]);
    expect(
      purchaseOrderEmailSummary({ currency: 'USD', subtotalCents: 360800, freightCents: 4500 })
    ).toEqual([
      { label: 'Subtotal', value: '$3,608.00' },
      { label: 'Freight', value: '$45.00' },
    ]);
  });
});
