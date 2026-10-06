// Every way an order leaves the building ends in `createFulfillment`, so this is
// where the two kinds of order that must wait are refused (persona issues 057,
// 058): a B2B order held for approval, and a rebuilt part the buyer is sending
// the old part back for FIRST.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Line {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  quantityFulfilled: number;
  coreFirst: boolean;
  coreHoldReleasedAt: Date | null;
  coresReturned: number;
}

let order: { id: string; status: string; orderNumber: string; customerId: string; items: Line[] };
const created = vi.fn();

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  afterCommit: () => Promise.resolve(),
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(
      fn({
        order: {
          findUnique: () => Promise.resolve({ ...order, fulfillments: [] }),
          update: () => Promise.resolve({}),
        },
        orderFulfillment: {
          create: (args: unknown) => {
            created(args);
            return Promise.resolve({ id: 'f-1', orderId: order.id, status: 'shipped' });
          },
        },
        orderItem: { update: () => Promise.resolve({}) },
        auditLog: { create: () => Promise.resolve({}) },
      })
    ),
}));
vi.mock('../audit', () => ({ writeAuditLog: () => Promise.resolve() }));
vi.mock('../consumers/platform-bus', () => ({ publishPlatformEvent: () => Promise.resolve() }));

const { createFulfillment } = await import('./order-fulfillments-service');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const ORDER_ID = '0b6f3a52-9a3c-4d6e-8f1b-2c4d5e6f7a8b';
const LINE_ID = '1c7a4b63-0b4d-4e7f-9a2c-3d5e6f7a8b9c';

function ship(quantity: number): Promise<unknown> {
  return createFulfillment(CTX, {
    orderId: ORDER_ID,
    status: 'shipped',
    lines: [{ orderItemId: LINE_ID, quantity }],
  });
}

beforeEach(() => {
  created.mockClear();
  order = {
    id: ORDER_ID,
    status: 'placed',
    orderNumber: '1042',
    customerId: 'c-1',
    items: [
      {
        id: LINE_ID,
        sku: '0986435621',
        name: 'Bosch Remanufactured Fuel Injector',
        quantity: 2,
        quantityFulfilled: 0,
        coreFirst: false,
        coreHoldReleasedAt: null,
        coresReturned: 0,
      },
    ],
  };
});

describe('createFulfillment', () => {
  it('ships an ordinary line', async () => {
    await ship(2);
    expect(created).toHaveBeenCalledOnce();
  });

  it('refuses a B2B order that is still waiting for approval', async () => {
    order.status = 'pending_approval';
    await expect(ship(1)).rejects.toThrow('Order 1042 is waiting for approval.');
    expect(created).not.toHaveBeenCalled();
  });

  it('refuses a send-the-old-part-first line until the old part arrives', async () => {
    order.items[0] = { ...order.items[0]!, coreFirst: true };
    await expect(ship(1)).rejects.toThrow(/is held until the customer's old part arrives/);
    expect(created).not.toHaveBeenCalled();
  });

  it('ships one unit per old part that arrived', async () => {
    order.items[0] = { ...order.items[0]!, coreFirst: true, coresReturned: 1 };
    await expect(ship(2)).rejects.toThrow(/Only 1 of/);
    await ship(1);
    expect(created).toHaveBeenCalledOnce();
  });
});
