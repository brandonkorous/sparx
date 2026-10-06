import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ORDER AGAIN, AND A SAVED CART BACK INTO THE BASKET (sparx persona issue 086).
 *
 * The /b2b page promised "reorder a past order in a click" and "named saved
 * carts". Both put a list of items into the cart. They go through the SAME
 * add-to-cart the product page uses, so today's account price, the account's
 * quantity rules and the stock check all apply, and the buyer is told plainly
 * what went in and what did not, and why.
 */

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const CART = 'c0ffee00-0000-4000-8000-000000000001';
const INJECTOR = '6f0cf3c9-2fc3-4294-a285-643eb5ef229d';
const FILTER = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const SEALS = '3b4c5d6e-7f80-4a1b-8c2d-3e4f5a6b7c8d';
const RETIRED = '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b';
const PACKED = '2a3b4c5d-6e7f-4809-8a1b-2c3d4e5f6a7b';

const { CommerceValidationError, CommerceNotFoundError } = await import('../errors');

/** What the shop sells right now. RETIRED has been archived. */
const SELLABLE = new Set([INJECTOR, FILTER, SEALS, PACKED]);

/** Units on the shelf, for the stock check inside add-to-cart. */
let shelf: Record<string, number>;

class OutOfStock extends Error {
  readonly code = 'OUT_OF_STOCK' as const;
  constructor(
    readonly variantId: string,
    readonly requested: number,
    readonly available: number
  ) {
    super(`Not enough stock. This asks for ${requested} and ${available} are available.`);
  }
}

const addItem = vi.fn((_ctx: unknown, input: { variantId: string; quantity: number }) => {
  if (input.variantId === PACKED && input.quantity % 12 !== 0) {
    return Promise.reject(
      new CommerceValidationError(
        'Wasatch buys Hydraulic Hose in cases of 12. Choose 12, 24 or 36.'
      )
    );
  }
  const onShelf = shelf[input.variantId];
  if (onShelf !== undefined && onShelf < input.quantity) {
    return Promise.reject(new OutOfStock(input.variantId, input.quantity, onShelf));
  }
  if (!SELLABLE.has(input.variantId)) {
    return Promise.reject(new CommerceNotFoundError('Variant', input.variantId));
  }
  return Promise.resolve({ cartItemId: `line-${input.variantId}` });
});
vi.mock('./cart-service', () => ({ addItem }));

const tx = {
  productVariant: {
    findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(where.id.in.filter((id) => SELLABLE.has(id)).map((id) => ({ id })))
    ),
  },
};
vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { refillCart } = await import('./cart-refill-service');

beforeEach(() => {
  vi.clearAllMocks();
  shelf = {};
});

describe('putting a list of items into the cart', () => {
  it('adds every line through the ordinary add-to-cart, which prices it today', async () => {
    const result = await refillCart(CTX, CART, [
      { variantId: INJECTOR, quantity: 6, name: 'Bosch Remanufactured Fuel Injector' },
      { variantId: FILTER, quantity: 12, name: 'Fuel Filter, 10 micron' },
    ]);
    expect(addItem.mock.calls.map((c) => c[1])).toEqual([
      { cartId: CART, variantId: INJECTOR, quantity: 6 },
      { cartId: CART, variantId: FILTER, quantity: 12 },
    ]);
    // Nothing from the old order rides along: no price, no line total.
    for (const call of addItem.mock.calls) {
      expect(Object.keys(call[1]).sort()).toEqual(['cartId', 'quantity', 'variantId']);
    }
    expect(result.added).toEqual([
      { name: 'Bosch Remanufactured Fuel Injector', quantity: 6, requested: 6 },
      { name: 'Fuel Filter, 10 micron', quantity: 12, requested: 12 },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it('skips an item the shop no longer sells, and says so', async () => {
    const result = await refillCart(CTX, CART, [
      { variantId: RETIRED, quantity: 2, name: 'Old Gasket Kit' },
      { variantId: null, quantity: 1, name: 'Custom bracket' },
    ]);
    expect(addItem).not.toHaveBeenCalled();
    expect(result.skipped).toEqual([
      expect.objectContaining({ name: 'Old Gasket Kit', reason: 'not_sold' }),
      expect.objectContaining({ name: 'Custom bracket', reason: 'not_sold' }),
    ]);
    expect(result.skipped[0]?.message).toBe('Old Gasket Kit is no longer sold.');
  });

  it('adds what is on the shelf when there is less than asked for, and says how much', async () => {
    shelf = { [INJECTOR]: 4 };
    const result = await refillCart(CTX, CART, [
      { variantId: INJECTOR, quantity: 6, name: 'Bosch Remanufactured Fuel Injector' },
    ]);
    expect(result.added).toEqual([
      { name: 'Bosch Remanufactured Fuel Injector', quantity: 4, requested: 6 },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it('skips an item that is out of stock', async () => {
    shelf = { [FILTER]: 0 };
    const result = await refillCart(CTX, CART, [
      { variantId: FILTER, quantity: 12, name: 'Fuel Filter, 10 micron' },
    ]);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual([
      {
        name: 'Fuel Filter, 10 micron',
        quantity: 12,
        reason: 'out_of_stock',
        message: 'Fuel Filter, 10 micron is out of stock.',
      },
    ]);
  });

  it('passes on the shop’s own words when a quantity rule refuses a line', async () => {
    const result = await refillCart(CTX, CART, [
      { variantId: PACKED, quantity: 5, name: 'Hydraulic Hose' },
      { variantId: SEALS, quantity: 6, name: 'Injector seals' },
    ]);
    expect(result.skipped).toEqual([
      {
        name: 'Hydraulic Hose',
        quantity: 5,
        reason: 'limited',
        message: 'Wasatch buys Hydraulic Hose in cases of 12. Choose 12, 24 or 36.',
      },
    ]);
    // One refusal does not stop the rest.
    expect(result.added).toEqual([{ name: 'Injector seals', quantity: 6, requested: 6 }]);
  });

  it('puts two lines of the same item in as one', async () => {
    await refillCart(CTX, CART, [
      { variantId: SEALS, quantity: 6, name: 'Injector seals' },
      { variantId: SEALS, quantity: 4, name: 'Injector seals' },
    ]);
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(addItem.mock.calls[0]?.[1]).toMatchObject({ variantId: SEALS, quantity: 10 });
  });
});
