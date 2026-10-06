// NOTHING ON A HELD ORDER, AND NO SEND-FIRST PART BEFORE ITS OLD PART.
//
// The order pane offered "Send to the warehouse" and "Mark it as sent" on any
// order with something still to send. A B2B order waiting for approval and a
// rebuilt part whose customer is sending the old part first both have something
// still to send, and both must wait (sparx persona issues 057 and 058). The server
// refuses them; this is the screen asking the same question first, so it never
// offers a button whose only job is to hand back that refusal.

import { describe, expect, it } from 'vitest';

import type { Order, OrderItem } from './data';
import { shipHoldLabel, whatCanShipNow } from './order-ship-gate';

function line(over: Partial<OrderItem>): OrderItem {
  return {
    id: 'line-1',
    productId: null,
    variantId: null,
    sku: '0986435621',
    name: 'Bosch injector',
    description: null,
    quantity: 1,
    unitPrice: 600,
    lineSubtotal: 600,
    taxAmount: 0,
    discountAmount: 0,
    lineTotal: 600,
    quantityFulfilled: 0,
    quantityRefunded: 0,
    coreCharge: null,
    coresReturned: 0,
    coresKept: 0,
    coreFirst: false,
    coreHoldReleasedAt: null,
    ...over,
  };
}

function order(status: string, items: OrderItem[]): Order {
  return { status, orderNumber: 'O-000057', items } as unknown as Order;
}

describe('what on an order can be sent now', () => {
  it('sends everything still owed on an ordinary order', () => {
    const now = whatCanShipNow(order('placed', [line({ quantity: 3, quantityFulfilled: 1 })]));
    expect(now.refusal).toBeNull();
    expect(now.lines).toEqual([{ orderItemId: 'line-1', quantity: 2 }]);
  });

  it('sends nothing on an order waiting for approval, and says so', () => {
    const held = order('pending_approval', [line({})]);
    const now = whatCanShipNow(held);
    expect(now.lines).toEqual([]);
    expect(now.refusal).toBe(
      'Order O-000057 is waiting for approval. Approve it before anything on it is sent.'
    );
    expect(shipHoldLabel(held, now)).toBe('Waiting for approval');
  });

  it('holds a send-first part until its old part arrives', () => {
    const waiting = order('placed', [line({ coreFirst: true })]);
    const now = whatCanShipNow(waiting);
    expect(now.lines).toEqual([]);
    expect(now.refusal).toContain('is held until the customer');
    expect(shipHoldLabel(waiting, now)).toBe('Waiting for an old part');
  });

  it('lets one part go per old part that has arrived, and says why the rest wait', () => {
    const now = whatCanShipNow(
      order('placed', [
        line({ coreFirst: true, quantity: 3, coresReturned: 1 }),
        line({ id: 'line-2', name: 'Gasket set', sku: 'G-1', quantity: 1 }),
      ])
    );
    expect(now.refusal).toBeNull();
    expect(now.lines).toEqual([
      { orderItemId: 'line-1', quantity: 1 },
      { orderItemId: 'line-2', quantity: 1 },
    ]);
    expect(now.held).toEqual([
      "Only 1 of Bosch injector can go now: 2 are waiting for the customer's old part.",
    ]);
  });

  it('sends a send-first part once the business chose not to wait', () => {
    const now = whatCanShipNow(
      order('placed', [line({ coreFirst: true, coreHoldReleasedAt: '2026-10-01T09:00:00Z' })])
    );
    expect(now.refusal).toBeNull();
    expect(now.lines).toEqual([{ orderItemId: 'line-1', quantity: 1 }]);
    expect(now.held).toEqual([]);
  });

  it('never holds a deposit line for its old part', () => {
    const now = whatCanShipNow(order('placed', [line({ coreCharge: 150 })]));
    expect(now.lines).toEqual([{ orderItemId: 'line-1', quantity: 1 }]);
  });
});
