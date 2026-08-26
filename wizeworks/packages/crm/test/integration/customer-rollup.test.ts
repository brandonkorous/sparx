// A customer's commerce figures, and the promise that they cannot drift.
//
// These four columns are what a shop owner reads on the customer list — "Total
// spent", "Last order" — so the test is not "does an increment fire" but "does
// the summary agree with the orders". Every case below was a real failure on a
// real shop before the figures became derived (persona issue 232).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customerService,
  orderPaymentsService,
  orderRefundsService,
  orderService,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('customer commerce rollup', () => {
  let test: TestContext;

  async function freshCustomer(email: string): Promise<string> {
    const created = await customerService.create(test.ctx, { type: 'retail', email });
    return created.id;
  }

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('counts money received, not the value of orders raised', async () => {
    const customerId = await freshCustomer('unpaid@example.test');
    await orderService.create(test.ctx, {
      customerId,
      items: [{ sku: 'A', name: 'A', quantity: 1, unitPrice: 100 }],
    });

    // An order raised and not paid is not money the customer has spent. The old
    // increment credited the whole total the instant the order existed, so a
    // shop with two unpaid orders on file read "$101.95 spent" from a customer
    // who had handed over nothing.
    const after = await customerService.get(test.ctx, customerId);
    expect(Number(after.totalSpent)).toBe(0);
    expect(after.orderCount).toBe(1);
    expect(after.firstOrderAt).not.toBeNull();
    expect(after.lastOrderAt).not.toBeNull();
  });

  it('follows the money as it is taken and given back', async () => {
    const customerId = await freshCustomer('paid@example.test');
    const order = await orderService.create(test.ctx, {
      customerId,
      items: [{ sku: 'B', name: 'B', quantity: 1, unitPrice: 170 }],
    });

    await orderPaymentsService.recordPayment(test.ctx, {
      orderId: order.id,
      processor: 'manual',
      amount: 170,
      currency: 'USD',
      status: 'captured',
    });
    expect(Number((await customerService.get(test.ctx, customerId)).totalSpent)).toBe(170);

    await orderRefundsService.recordRefund(test.ctx, {
      orderId: order.id,
      amount: 42,
      currency: 'USD',
      reason: 'Sent back',
    });

    const after = await customerService.get(test.ctx, customerId);
    expect(Number(after.totalSpent)).toBe(128);
    expect(after.orderCount).toBe(1);
  });

  it('never goes negative when a refund arrives on its own', async () => {
    const customerId = await freshCustomer('refund-only@example.test');
    const order = await orderService.create(test.ctx, {
      customerId,
      items: [{ sku: 'C', name: 'C', quantity: 1, unitPrice: 42 }],
    });
    await orderPaymentsService.recordPayment(test.ctx, {
      orderId: order.id,
      processor: 'manual',
      amount: 42,
      currency: 'USD',
      status: 'captured',
    });
    await orderRefundsService.recordRefund(test.ctx, {
      orderId: order.id,
      amount: 42,
      currency: 'USD',
    });

    // The shape that produced "-$42.00" on a live customer list: the decrement
    // outlived its increment. Derived, the floor is the orders themselves.
    const after = await customerService.get(test.ctx, customerId);
    expect(Number(after.totalSpent)).toBe(0);
    expect(Number(after.totalSpent)).toBeGreaterThanOrEqual(0);
  });

  it('stops counting a cancelled order', async () => {
    const customerId = await freshCustomer('cancelled@example.test');
    const keep = await orderService.create(test.ctx, {
      customerId,
      items: [{ sku: 'D', name: 'D', quantity: 1, unitPrice: 10 }],
    });
    const scrap = await orderService.create(test.ctx, {
      customerId,
      items: [{ sku: 'E', name: 'E', quantity: 1, unitPrice: 90 }],
    });
    await orderPaymentsService.recordPayment(test.ctx, {
      orderId: keep.id,
      processor: 'manual',
      amount: 10,
      currency: 'USD',
      status: 'captured',
    });

    expect((await customerService.get(test.ctx, customerId)).orderCount).toBe(2);

    await orderService.cancel(test.ctx, { orderId: scrap.id, reason: 'Changed their mind' });

    // Nothing used to take a cancelled order back out: the increment had already
    // been applied and no path reversed it.
    const after = await customerService.get(test.ctx, customerId);
    expect(after.orderCount).toBe(1);
    expect(Number(after.totalSpent)).toBe(10);
  });

  it('is a summary, so it survives being recomputed', async () => {
    const customerId = await freshCustomer('idempotent@example.test');
    const order = await orderService.create(test.ctx, {
      customerId,
      items: [{ sku: 'F', name: 'F', quantity: 2, unitPrice: 25 }],
    });
    await orderPaymentsService.recordPayment(test.ctx, {
      orderId: order.id,
      processor: 'manual',
      amount: 30,
      currency: 'USD',
      status: 'captured',
    });
    await orderPaymentsService.recordPayment(test.ctx, {
      orderId: order.id,
      processor: 'manual',
      amount: 20,
      currency: 'USD',
      status: 'captured',
    });

    // Two payments on one order is one order and fifty pounds, not two orders —
    // the thing an increment on the wrong event gets wrong.
    const after = await customerService.get(test.ctx, customerId);
    expect(after.orderCount).toBe(1);
    expect(Number(after.totalSpent)).toBe(50);
  });
});
