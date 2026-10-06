import { describe, expect, it } from 'vitest';

import { renderPurchaseOrderHtml, type PurchaseOrderDocumentData } from './purchase-order-document';

const ORDER: PurchaseOrderDocumentData = {
  number: 'PO-000001',
  status: 'submitted',
  currency: 'USD',
  orderedAt: '2026-10-02T16:00:00.000Z',
  expectedArrivalAt: '2026-10-07T16:00:00.000Z',
  reference: 'Quote AP-88213 (Corbin)',
  paymentTerms: 'Net 30',
  vendor: { heading: 'Vendor', name: 'Alliant Power', lines: ['orders@alliantpower.test'] },
  vendorEmail: 'orders@alliantpower.test',
  vendorContactName: null,
  shipTo: { heading: 'Ship to', name: 'Warehouse (Concord Park)', lines: ['Bluffdale, UT'] },
  lines: [
    {
      description: 'Alliant Power Remanufactured Common Rail Injector (AP54800)',
      sku: 'AP54800',
      supplierSku: 'AP54800',
      quantityOrdered: 6,
      quantityReceived: 0,
      unitCostCents: 23800,
      lineTotalCents: 142800,
    },
  ],
  subtotalCents: 142800,
  freightCents: 0,
  totalCents: 142800,
  notes: null,
};

const statusOf = (status: string): string =>
  /class="status [a-z]+">([^<]*)</.exec(renderPurchaseOrderHtml({ ...ORDER, status }))?.[1] ?? '';

describe('the printed purchase order', () => {
  it('says "Placed", the word on the owner\'s screen, for an order sent off', () => {
    expect(statusOf('submitted')).toBe('Placed');
    expect(statusOf('partial')).toBe('Partly received');
  });

  it('never prints a raw status code', () => {
    for (const status of [
      'draft',
      'pending_approval',
      'submitted',
      'partial',
      'received',
      'closed',
      'cancelled',
    ]) {
      expect(statusOf(status), status).not.toMatch(/_|^[a-z]/);
    }
  });
});
