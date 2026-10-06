import { describe, expect, it } from 'vitest';

import { orderDeliveryNeeds, renderPackingSlipHtml, type PackingSlipData } from './packing-slip';

// The packing slip carries what the buyer said about delivery (sparx persona
// issue 086): the day they need it, where it goes, and anything else about
// getting it there. An order made from a quote has no shipping address, so the
// "Deliver to" block was empty while the buyer had written "Yard 2".

function slip(over: Partial<PackingSlipData> = {}): PackingSlipData {
  return {
    packageNumber: 'PKG-000012',
    orderNumber: 'SO-000412',
    orderedAt: '2026-10-02T17:00:00.000Z',
    packedAt: null,
    boxIndex: 1,
    boxCount: 1,
    shipTo: { name: 'Wasatch Front Utility Contractors', lines: ['', '', '', '', '', ''] },
    customerNote: null,
    delivery: null,
    lines: [{ description: 'Fuel Filter', sku: 'FF-10', quantity: 12, verified: true }],
    toFollow: [],
    weightGrams: null,
    ...over,
  };
}

describe('delivery needs on the packing slip', () => {
  it('prints the needed-by day and the delivery notes', () => {
    const html = renderPackingSlipHtml(
      slip({
        delivery: { neededBy: '2026-10-20', deliverTo: null, notes: 'Forklift on site' },
      })
    );
    expect(html).toContain('Needed by');
    expect(html).toContain('Oct 20, 2026');
    expect(html).toContain('Forklift on site');
  });

  it('prints where it goes under Deliver to when the order has no address of its own', () => {
    const html = renderPackingSlipHtml(
      slip({ delivery: { neededBy: null, deliverTo: 'Yard 2\n400 Industrial Way', notes: null } })
    );
    const block = html.slice(html.indexOf('Deliver to'), html.indexOf('<table'));
    expect(block).toContain('Yard 2');
    expect(block).toContain('400 Industrial Way');
  });

  it('keeps the order’s own address when it has one, and still prints where the buyer said', () => {
    const html = renderPackingSlipHtml(
      slip({
        shipTo: {
          name: 'Wasatch',
          lines: ['', '2275 S 900 W', '', 'Salt Lake City, UT', 'US', ''],
        },
        delivery: { neededBy: null, deliverTo: 'Yard 2', notes: null },
      })
    );
    expect(html).toContain('2275 S 900 W');
    expect(html).toContain('Yard 2');
  });

  it('prints no delivery section when the buyer said nothing', () => {
    expect(renderPackingSlipHtml(slip())).not.toContain('Needed by');
  });
});

describe('orderDeliveryNeeds', () => {
  it('reads the needs from the order’s metadata, and nothing that is not a day', () => {
    expect(
      orderDeliveryNeeds({
        poNumber: 'A1',
        delivery: { neededBy: '2026-10-20', notes: ' Dock 4 ' },
      })
    ).toEqual({ neededBy: '2026-10-20', deliverTo: null, notes: 'Dock 4' });
    expect(orderDeliveryNeeds({ delivery: { neededBy: 'soon' } })).toBeNull();
    expect(orderDeliveryNeeds({})).toBeNull();
    expect(orderDeliveryNeeds(null)).toBeNull();
  });
});
