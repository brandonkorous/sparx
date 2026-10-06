// What a trade buyer said about delivery when they asked for the quote an order
// came from (sparx persona issue 086): the day they need it, where it goes, and
// anything else about getting it there. The person packing and shipping the
// order reads it on the order, beside their PO number.

import { describe, expect, it } from 'vitest';

import { orderDeliveryRows } from './order-delivery-needs';

describe('orderDeliveryRows', () => {
  it('says when, where and how, in that order', () => {
    const rows = orderDeliveryRows({
      poNumber: 'WFUC-24-0901',
      delivery: { neededBy: '2026-10-20', deliverTo: 'Yard 2', notes: 'Forklift on site' },
    });
    expect(rows.map((r) => r.label)).toEqual(['Needed by', 'Deliver to', 'Delivery notes']);
    expect(rows[0]?.value).toMatch(/Oct/);
    expect(rows[0]?.value).toContain('20');
    expect(rows[1]?.value).toBe('Yard 2');
    expect(rows[2]?.value).toBe('Forklift on site');
  });

  it('shows only what the buyer said', () => {
    expect(
      orderDeliveryRows({ delivery: { neededBy: null, deliverTo: null, notes: 'Dock 4' } })
    ).toEqual([{ label: 'Delivery notes', value: 'Dock 4' }]);
  });

  it('shows nothing for an order with no delivery needs', () => {
    expect(orderDeliveryRows({})).toEqual([]);
    expect(orderDeliveryRows(null)).toEqual([]);
  });
});
