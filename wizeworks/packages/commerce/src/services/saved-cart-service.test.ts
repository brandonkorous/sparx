import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * NAMED SAVED CARTS FOR A TRADE ACCOUNT, AND ORDER AGAIN (sparx persona issue 086).
 *
 * "Accounts keep named saved carts and reorder a past order in a click." A
 * saved cart is the ACCOUNT's list: any contact who can order sees it, and no
 * contact of any other account can read, rename, delete or load it. The same
 * holds for the orders a reorder reads.
 */

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const WASATCH = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const BONNEVILLE = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const RENEE = 'fd7795a2-99f3-4583-b7be-efcb2d886a1b';
const MARCO = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';
const CART = 'c0ffee00-0000-4000-8000-000000000001';
const INJECTOR = '6f0cf3c9-2fc3-4294-a285-643eb5ef229d';
const FILTER = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ORDER = 'f3d0a7c2-1b5e-4f8a-9c6d-2e7b8a9c0d12';

interface SavedRow {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  createdByCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
interface ItemRow {
  id: string;
  savedCartId: string;
  variantId: string;
  quantity: number;
  position: number;
}

let saved: SavedRow[];
let items: ItemRow[];
let cartLines: { variantId: string; quantity: number }[];
let seq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

function matches(row: object, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
}

const NAMES: Record<string, { title: string | null; product: { title: string } }> = {
  [INJECTOR]: { title: null, product: { title: 'Bosch Remanufactured Fuel Injector' } },
  [FILTER]: { title: '10 micron', product: { title: 'Fuel Filter' } },
};

function withItems(row: SavedRow) {
  return {
    ...row,
    createdBy:
      row.createdByCustomerId === RENEE
        ? { firstName: 'Renée', lastName: 'Castañeda', email: null }
        : null,
    items: items
      .filter((i) => i.savedCartId === row.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ ...i, variant: NAMES[i.variantId] ?? null })),
  };
}

const orderFindFirst = vi.fn(({ where }: { where: { id: string; customerId: { in: string[] } } }) =>
  Promise.resolve(
    where.id === ORDER && where.customerId.in.includes(RENEE)
      ? {
          id: ORDER,
          items: [
            { variantId: INJECTOR, quantity: 6, name: 'Bosch Remanufactured Fuel Injector' },
            { variantId: null, quantity: 1, name: 'Custom bracket' },
          ],
        }
      : null
  )
);

const tx = {
  b2bSavedCart: {
    findMany: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(saved.filter((r) => matches(r, where)).map(withItems))
    ),
    findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) => {
      const row = saved.find((r) => matches(r, where));
      return Promise.resolve(row ? withItems(row) : null);
    }),
    create: vi.fn(
      ({
        data,
      }: {
        data: Omit<SavedRow, 'id' | 'createdAt' | 'updatedAt'> & {
          items: { create: Omit<ItemRow, 'id' | 'savedCartId'>[] };
        };
      }) => {
        const { items: nested, ...rest } = data;
        const row = { id: newId(), createdAt: new Date(), updatedAt: new Date(), ...rest };
        saved.push(row);
        for (const i of nested.create) items.push({ id: newId(), savedCartId: row.id, ...i });
        return Promise.resolve(row);
      }
    ),
    updateMany: vi.fn(
      ({ where, data }: { where: Record<string, unknown>; data: Partial<SavedRow> }) => {
        const hit = saved.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return Promise.resolve({ count: hit.length });
      }
    ),
    deleteMany: vi.fn(({ where }: { where: Record<string, unknown> }) => {
      const gone = saved.filter((r) => matches(r, where)).map((r) => r.id);
      saved = saved.filter((r) => !gone.includes(r.id));
      items = items.filter((i) => !gone.includes(i.savedCartId));
      return Promise.resolve({ count: gone.length });
    }),
  },
  cartItem: {
    findMany: vi.fn(() => Promise.resolve(cartLines)),
  },
  order: { findFirst: orderFindFirst },
};
vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const service = await import('./saved-cart-service');
const { CommerceNotFoundError, CommerceValidationError } = await import('../errors');

const renee = { accountId: WASATCH, customerId: RENEE };
const marco = { accountId: BONNEVILLE, customerId: MARCO };

beforeEach(() => {
  vi.clearAllMocks();
  saved = [];
  items = [];
  cartLines = [
    { variantId: INJECTOR, quantity: 6 },
    { variantId: FILTER, quantity: 12 },
    { variantId: FILTER, quantity: 12 },
  ];
});

describe('saving a cart for the account', () => {
  it('keeps what is in the cart under a name, with who saved it and no prices', async () => {
    const created = await service.saveFromCart(CTX, renee, {
      cartId: CART,
      name: '  Monthly shop restock ',
    });
    expect(created).toMatchObject({
      name: 'Monthly shop restock',
      itemCount: 2,
      unitCount: 30,
      savedBy: 'Renée Castañeda',
    });
    expect(items.map((i) => [i.variantId, i.quantity])).toEqual([
      [INJECTOR, 6],
      [FILTER, 24],
    ]);
    expect(Object.keys(items[0] ?? {})).not.toContain('unitPriceCents');
  });

  it('will not save an empty cart', async () => {
    cartLines = [];
    await expect(
      service.saveFromCart(CTX, renee, { cartId: CART, name: 'Nothing' })
    ).rejects.toThrow(CommerceValidationError);
  });

  it('lists the lines by name, for loading back into the cart', async () => {
    const created = await service.saveFromCart(CTX, renee, { cartId: CART, name: 'Restock' });
    expect(await service.linesFor(CTX, WASATCH, created.id)).toEqual([
      { variantId: INJECTOR, quantity: 6, name: 'Bosch Remanufactured Fuel Injector' },
      { variantId: FILTER, quantity: 24, name: 'Fuel Filter, 10 micron' },
    ]);
  });
});

describe('one account’s saved carts are that account’s alone', () => {
  it('cannot be listed, loaded, renamed or deleted from another account', async () => {
    const created = await service.saveFromCart(CTX, renee, { cartId: CART, name: 'Restock' });

    expect(await service.list(CTX, BONNEVILLE)).toEqual([]);
    expect(await service.linesFor(CTX, BONNEVILLE, created.id)).toBeNull();
    await expect(service.rename(CTX, BONNEVILLE, created.id, 'Mine now')).rejects.toThrow(
      CommerceNotFoundError
    );
    await expect(service.remove(CTX, BONNEVILLE, created.id)).rejects.toThrow(
      CommerceNotFoundError
    );

    const wasatch = await service.list(CTX, WASATCH);
    expect(wasatch.map((c) => c.name)).toEqual(['Restock']);
  });

  it('is shared by every contact on the account', async () => {
    const created = await service.saveFromCart(CTX, renee, { cartId: CART, name: 'Restock' });
    await service.rename(CTX, WASATCH, created.id, 'Restock, October');
    expect((await service.list(CTX, WASATCH))[0]?.name).toBe('Restock, October');
    await service.remove(CTX, WASATCH, created.id);
    expect(await service.list(CTX, WASATCH)).toEqual([]);
  });

  it('saves into the account it was given, never the one the cart came from', async () => {
    await service.saveFromCart(CTX, marco, { cartId: CART, name: 'Bonneville list' });
    expect(saved[0]?.companyId).toBe(BONNEVILLE);
    expect(await service.list(CTX, WASATCH)).toEqual([]);
  });
});

describe('the lines of a past order, for Order again', () => {
  it('reads an order only when one of the given people placed it', async () => {
    expect(await service.orderLinesFor(CTX, ORDER, [RENEE])).toEqual([
      { variantId: INJECTOR, quantity: 6, name: 'Bosch Remanufactured Fuel Injector' },
      { variantId: null, quantity: 1, name: 'Custom bracket' },
    ]);
    expect(await service.orderLinesFor(CTX, ORDER, [MARCO])).toBeNull();
    expect(await service.orderLinesFor(CTX, ORDER, [])).toBeNull();
  });
});
