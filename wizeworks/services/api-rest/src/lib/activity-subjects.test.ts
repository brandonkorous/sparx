// AN ACTIVITY ROW MUST SAY WHICH RECORD IT IS ABOUT.
//
// Six identical "Price list updated" lines on a business owner's security
// screen, over one price list.

import { describe, expect, it, vi } from 'vitest';

import { NAMEABLE_TYPES, UNNAMEABLE, subjectKey, subjectNames } from './activity-subjects';

/**
 * A stand-in for the tenant-scoped client.
 *
 * Only the delegates a test actually exercises are present; the map is checked
 * against the real Prisma client by the compiler, not here, so what is worth
 * testing is the BATCHING and the fallbacks.
 */
function fakeTx(delegates: Record<string, { findMany: unknown }>) {
  return delegates as unknown as Parameters<typeof subjectNames>[0];
}

const row = (entityType: string | null, entityId: string | null) => ({ entityType, entityId });

describe('naming the record', () => {
  it('names the price list that appeared six times as itself', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'pl-1', name: 'Trade prices' }]);
    const names = await subjectNames(fakeTx({ priceList: { findMany } }), [
      row('PriceList', 'pl-1'),
      row('PriceList', 'pl-1'),
      row('PriceList', 'pl-1'),
    ]);
    expect(names.get(subjectKey('PriceList', 'pl-1'))).toBe('Trade prices');
  });

  it('asks once per kind, not once per row', async () => {
    // A page of 50 rows must not be 50 queries. The ids are de-duplicated on
    // the way in, which is the whole reason this is batched.
    const findMany = vi.fn().mockResolvedValue([]);
    await subjectNames(
      fakeTx({ priceList: { findMany } }),
      Array.from({ length: 50 }, () => row('PriceList', 'pl-1'))
    );
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: { id: { in: ['pl-1'] } } });
  });

  it('asks each kind separately and merges the answers', async () => {
    const priceList = vi.fn().mockResolvedValue([{ id: 'pl-1', name: 'Trade prices' }]);
    const order = vi.fn().mockResolvedValue([{ id: 'o-1', orderNumber: 'JR-1042' }]);
    const names = await subjectNames(
      fakeTx({ priceList: { findMany: priceList }, order: { findMany: order } }),
      [row('PriceList', 'pl-1'), row('Order', 'o-1')]
    );
    expect(names.get(subjectKey('PriceList', 'pl-1'))).toBe('Trade prices');
    expect(names.get(subjectKey('Order', 'o-1'))).toBe('JR-1042');
    expect(priceList).toHaveBeenCalledTimes(1);
    expect(order).toHaveBeenCalledTimes(1);
  });
});

describe('records whose name is assembled', () => {
  it('reads a customer as a person, not an address, when it can', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { id: 'c-1', firstName: 'Ellen', lastName: 'Vance', email: 'ellen@ashcombe.test' },
      ]);
    const names = await subjectNames(fakeTx({ customer: { findMany } }), [row('Customer', 'c-1')]);
    expect(names.get(subjectKey('Customer', 'c-1'))).toBe('Ellen Vance');
  });

  it('falls back to the address when there is no name', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { id: 'c-1', firstName: null, lastName: null, email: 'ellen@ashcombe.test' },
      ]);
    const names = await subjectNames(fakeTx({ customer: { findMany } }), [row('Customer', 'c-1')]);
    expect(names.get(subjectKey('Customer', 'c-1'))).toBe('ellen@ashcombe.test');
  });

  it('does not print a blank name as a name', async () => {
    // A present-but-empty field is absence wearing a value, and half a name
    // ("Ellen " with a trailing space) is worse than the address.
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: 'c-1', firstName: '  ', lastName: '', email: '  ' }]);
    const names = await subjectNames(fakeTx({ customer: { findMany } }), [row('Customer', 'c-1')]);
    expect(names.has(subjectKey('Customer', 'c-1'))).toBe(false);
  });

  it('reads a variant by the code somebody types, then its title', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'v-1', sku: 'ASH-OVERSHIRT-L-INK', title: 'Large' },
      { id: 'v-2', sku: null, title: 'Extra large' },
    ]);
    const names = await subjectNames(fakeTx({ productVariant: { findMany } }), [
      row('Variant', 'v-1'),
      row('Variant', 'v-2'),
    ]);
    expect(names.get(subjectKey('Variant', 'v-1'))).toBe('ASH-OVERSHIRT-L-INK');
    expect(names.get(subjectKey('Variant', 'v-2'))).toBe('Extra large');
  });
});

describe('when there is nothing to say', () => {
  it('leaves a kind that has no name alone rather than inventing one', async () => {
    // A cart has no name. Printing its id would be the bug next door: a
    // placeholder shown where evidence belongs.
    const findMany = vi.fn();
    const names = await subjectNames(fakeTx({ cart: { findMany } }), [row('Cart', 'cart-1')]);
    expect(names.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('skips a row with no entity on it at all', async () => {
    const findMany = vi.fn();
    const names = await subjectNames(fakeTx({ priceList: { findMany } }), [
      row(null, null),
      row('PriceList', null),
      row(null, 'pl-1'),
    ]);
    expect(names.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('loses one kind rather than the whole feed when a lookup throws', async () => {
    // A deleted record, or a module whose table is not there. The page still
    // has to load: activity with no names beats no activity.
    const priceList = vi.fn().mockRejectedValue(new Error('gone'));
    const order = vi.fn().mockResolvedValue([{ id: 'o-1', orderNumber: 'JR-1042' }]);
    const names = await subjectNames(
      fakeTx({ priceList: { findMany: priceList }, order: { findMany: order } }),
      [row('PriceList', 'pl-1'), row('Order', 'o-1')]
    );
    expect(names.has(subjectKey('PriceList', 'pl-1'))).toBe(false);
    expect(names.get(subjectKey('Order', 'o-1'))).toBe('JR-1042');
  });
});

describe('the table itself', () => {
  it('covers the kinds that fill this log', () => {
    // Measured from `audit_logs`, biggest first. Losing one of these silently
    // is how the feed went anonymous in the first place, so they are named.
    const busiest = [
      'content_entry',
      'Product',
      'Deal',
      'Variant',
      'BuilderPage',
      'Customer',
      'Task',
      'SiteTheme',
      'BuilderEmail',
      'Category',
      'Collection',
      'PriceList',
      'Order',
      'PurchaseOrder',
    ];
    for (const kind of busiest) {
      expect(NAMEABLE_TYPES, kind).toContain(kind);
    }
  });

  it('never claims a kind is both nameable and unnameable', () => {
    for (const kind of NAMEABLE_TYPES) {
      expect(UNNAMEABLE.has(kind), kind).toBe(false);
    }
  });

  it('has a table to test at all', () => {
    // Without this the loops above pass over an empty map and say nothing.
    expect(NAMEABLE_TYPES.length).toBeGreaterThan(20);
  });
});
