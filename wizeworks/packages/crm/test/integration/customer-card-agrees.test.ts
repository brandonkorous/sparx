// The figures on a customer card and the orders listed underneath them must
// describe ONE population (issue 332).
//
// Marguerite Adeyemi's card read "Orders 3 / Their orders come to $582.60" over
// three rows summing to $636.90. Every number was correct on its own: the
// figures leave a cancelled order out, the list did not, and the list's
// three-row window had pushed off the only order she had actually paid for. So
// the card stated $72.00 collected and showed nothing that could account for it.
//
// This is the same defect as issue 323 one layer along, which is why the
// invariant is asserted directly rather than by re-checking the arithmetic:
// **whatever the rollup counted is what the list returns.** Against the real
// client, because a mocked one confirms whatever the code already believes
// (issue 331).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { customerService, orderService } from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('a customer card agrees with itself', () => {
  let test: TestContext;
  let customerId: string;
  let cancelledId: string;
  let paidOnlyNumber: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'marguerite@cardagrees.test',
      firstName: 'Marguerite',
      lastName: 'Adeyemi',
    });
    customerId = customer.id;

    // Her shape exactly: four orders, the cancelled one among the most recent
    // three, and the paid one the oldest — so a naive "latest three" drops it.
    const place = async (sku: string, unitPrice: number) =>
      orderService.create(test.ctx, {
        customerId,
        items: [{ sku, name: sku, quantity: 1, unitPrice }],
      });

    const oldest = await place('PAID-72', 72);
    paidOnlyNumber = oldest.orderNumber;
    await place('LATER-276', 276);
    const doomed = await place('CANCEL-126', 126.3);
    await place('LATEST-234', 234.6);
    cancelledId = doomed.id;

    await orderService.cancel(test.ctx, { orderId: cancelledId, reason: 'changed mind' });
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('leaves a cancelled order out of a counted list', async () => {
    const { items, total } = await orderService.list(test.ctx, {
      customerId,
      countedOnly: true,
      take: 50,
      skip: 0,
    });
    expect(total).toBe(3);
    expect(items.map((o) => o.status)).not.toContain('cancelled');
  });

  it('returns exactly what the figures were computed from', async () => {
    // The invariant. Not "3 happens to equal 3" — the count on the card and the
    // number of rows the card can show are read from the two sides here.
    const card = await customerService.get(test.ctx, customerId);
    const { items, total } = await orderService.list(test.ctx, {
      customerId,
      countedOnly: true,
      take: 250,
      skip: 0,
    });

    expect(total).toBe(card.orderCount);
    const worth = items.reduce((sum, o) => sum + Number(o.total) - Number(o.refundTotal), 0);
    expect(worth.toFixed(2)).toBe(Number(card.totalOrdered).toFixed(2));
  });

  it('keeps the order the money came from inside the three rows the card shows', async () => {
    // The visible half of the defect. Unfiltered, the newest three are the three
    // placed last and the $72 she actually paid falls off the bottom.
    const counted = await orderService.list(test.ctx, {
      customerId,
      countedOnly: true,
      sortBy: 'placedAt',
      order: 'desc',
      take: 3,
      skip: 0,
    });
    expect(counted.items.map((o) => o.orderNumber)).toContain(paidOnlyNumber);

    const unfiltered = await orderService.list(test.ctx, {
      customerId,
      sortBy: 'placedAt',
      order: 'desc',
      take: 3,
      skip: 0,
    });
    expect(unfiltered.items.map((o) => o.orderNumber)).not.toContain(paidOnlyNumber);
  });

  it('still hands over cancelled orders when they are what was asked for', async () => {
    // `countedOnly` is for a list rendered beside the figures, not a blanket
    // hiding. Asking for cancelled orders and getting none would be the worse
    // surprise, so an explicit status wins.
    const { items } = await orderService.list(test.ctx, {
      customerId,
      status: 'cancelled',
      countedOnly: true,
      take: 50,
      skip: 0,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(cancelledId);
  });

  it('changes nothing for a list that does not ask', async () => {
    const { total } = await orderService.list(test.ctx, { customerId, take: 50, skip: 0 });
    expect(total).toBe(4);
  });

  it('agrees again after the cancelled order is the only one left standing', async () => {
    // A customer whose every order was cancelled reads zero orders worth zero,
    // and a counted list of them is empty — not one row the figures deny.
    const solo = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'allgone@cardagrees.test',
      firstName: 'All',
      lastName: 'Gone',
    });
    const only = await orderService.create(test.ctx, {
      customerId: solo.id,
      items: [{ sku: 'ONLY-50', name: 'Only', quantity: 1, unitPrice: 50 }],
    });
    await orderService.cancel(test.ctx, { orderId: only.id });

    const card = await customerService.get(test.ctx, solo.id);
    const { total } = await orderService.list(test.ctx, {
      customerId: solo.id,
      countedOnly: true,
      take: 50,
      skip: 0,
    });
    expect(card.orderCount).toBe(0);
    expect(Number(card.totalOrdered)).toBe(0);
    expect(total).toBe(0);
  });
});
