// A quote accepted over a spending limit is written by CRM, which knows nothing
// about stock, as a held order announced on `b2b.order.pending_approval`. Its
// stock is set aside here, the moment it is announced, the same as a held
// checkout order's is (MEASURED 2026-10-03 on Gillett Diesel: a held order kept
// no stock at all, and the approval hours later took whatever was left).

import { beforeEach, describe, expect, it, vi } from 'vitest';

let inventoryOn = true;
const holdHeldOrderStock = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ reservationIds: [], unheldQuantity: 0 })
);

vi.mock('@wizeworks/auth', () => ({ isModuleEnabled: () => Promise.resolve(inventoryOn) }));
vi.mock('@wizeworks/inventory', () => ({ inventoryService: { holdHeldOrderStock } }));
vi.mock('../services/discount-service', () => ({
  releaseOrderDiscountUsage: () => Promise.resolve(),
}));

const { resetPlatformBusForTesting } = await import('@wizeworks/crm');
const { registerCommerceConsumers } = await import('./index');

const held = {
  id: 'evt-1',
  topic: 'b2b.order.pending_approval',
  tenantId: 'tenant-gillett',
  occurredAt: new Date('2026-10-03T08:19:15Z'),
  payload: { orderId: 'o-quote', orderNumber: 'O-000016', companyId: 'acct', asks: ['business'] },
};

beforeEach(() => {
  inventoryOn = true;
  holdHeldOrderStock.mockClear();
});

describe('an order held for a sign-off', () => {
  it('has its stock set aside when it is announced', async () => {
    const bus = resetPlatformBusForTesting();
    const consumers = registerCommerceConsumers({ bus });
    await bus.publish(held);
    await bus.drain();
    consumers.unregister();
    expect(holdHeldOrderStock).toHaveBeenCalledWith(
      { tenantId: 'tenant-gillett' },
      { orderId: 'o-quote' }
    );
  });

  it('is left alone by a business that does not track stock', async () => {
    inventoryOn = false;
    const bus = resetPlatformBusForTesting();
    const consumers = registerCommerceConsumers({ bus });
    await bus.publish(held);
    await bus.drain();
    consumers.unregister();
    expect(holdHeldOrderStock).not.toHaveBeenCalled();
  });
});
