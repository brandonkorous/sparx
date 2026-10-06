import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A BOUGHT BASKET TAKES NO MORE WRITES (sparx persona issue 087).
 *
 * Renée's basket became order O-000014 at checkout, and minutes later the same
 * basket took an edit through the public cart routes: nothing refused it. These
 * drive the real cart, discount and checkout services, the functions every route
 * calls, against a fake transaction that answers "has this basket a completed
 * checkout?" the way the database would. Each write path must refuse with
 * `CART_ALREADY_BOUGHT` and write nothing; the same paths on a basket not yet
 * bought must get past the gate.
 */

const CART = '22222222-2222-4222-8222-222222222222';
const OTHER_CART = '77777777-7777-4777-8777-777777777777';
const VARIANT = '33333333-3333-4333-8333-333333333333';
const LINE = '66666666-6666-4666-8666-666666666666';
const CUSTOMER = '88888888-8888-4888-8888-888888888888';

/** Which baskets have a completed checkout session. */
let bought = new Set<string>();
/** Every write the fake transaction was asked to make. */
let writes: string[] = [];

interface Where {
  id?: unknown;
  NOT?: { checkoutSessions?: { none?: { step?: string } } };
}

/** `cart.count({ where: { id, NOT: NOT_BOUGHT_YET } })`: 1 when that basket has
 *  a completed checkout, read off the `where` the way the database would. */
function countBought({ where }: { where: Where }): Promise<number> {
  const asksBought = where.NOT?.checkoutSessions?.none?.step === 'completed';
  return Promise.resolve(asksBought && bought.has(String(where.id)) ? 1 : 0);
}

const recordWrite = (name: string) =>
  vi.fn(() => {
    writes.push(name);
    return Promise.resolve({ id: 'written', count: 1 });
  });

const cartRow = (id: string) => ({
  id,
  channel: 'storefront',
  currency: 'USD',
  customerId: null,
  propertyId: null,
  guestToken: 'token',
  abandonedAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  pricingTrace: {},
  customer: null,
  items: [],
});

const tx = {
  cart: {
    findFirst: vi.fn(({ where }: { where: { id?: string } }) =>
      Promise.resolve(cartRow(where.id ?? CART))
    ),
    count: vi.fn(countBought),
    update: recordWrite('cart.update'),
    delete: recordWrite('cart.delete'),
  },
  cartItem: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        id: LINE,
        cartId: CART,
        variantId: VARIANT,
        unitPriceCents: 2_500,
        quantity: 2,
        inventoryReservationId: null,
        variant: { dropshipSourceId: null, coreChargeCents: null, coreFirstOffered: false },
      })
    ),
    findMany: vi.fn(() => Promise.resolve([])),
    create: recordWrite('cartItem.create'),
    update: recordWrite('cartItem.update'),
    delete: recordWrite('cartItem.delete'),
    deleteMany: recordWrite('cartItem.deleteMany'),
  },
  cartDiscount: {
    create: recordWrite('cartDiscount.create'),
    deleteMany: recordWrite('cartDiscount.deleteMany'),
  },
  accountCredit: { update: recordWrite('accountCredit.update') },
  checkoutSession: { create: recordWrite('checkoutSession.create') },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../audit', () => ({ writeAuditLog: () => Promise.resolve() }));
vi.mock('../events', () => ({ publishCommerceEvent: () => Promise.resolve() }));
vi.mock('../inventory-gate', () => ({ isInventoryActive: () => Promise.resolve(false) }));

const cartService = await import('./cart-service');
const discountService = await import('./discount-service');
const checkoutService = await import('./checkout-service');
const { CommerceCartBoughtError } = await import('../errors');

const ctx = { tenantId: '55555555-5555-4555-8555-555555555555' };

/** Every way something can write into a basket by its id. */
const WRITES: [string, () => Promise<unknown>][] = [
  [
    'add an item',
    () => cartService.addItem(ctx, { cartId: CART, variantId: VARIANT, quantity: 1 }),
  ],
  ['change a quantity', () => cartService.updateItem(ctx, { cartItemId: LINE, quantity: 5 })],
  ['remove an item', () => cartService.removeItem(ctx, LINE, CART)],
  ['empty the basket', () => cartService.clear(ctx, CART)],
  [
    'link it to a signed-in buyer',
    () => cartService.claim(ctx, { cartId: CART, customerId: CUSTOMER }),
  ],
  ['reprice it', () => cartService.repriceCart(ctx, CART)],
  ['say the shopper came back', () => cartService.markRecovered(ctx, CART)],
  [
    'merge another basket into it',
    () => cartService.merge(ctx, { sourceCartId: OTHER_CART, targetCartId: CART }),
  ],
  [
    'merge it into another basket',
    () => cartService.merge(ctx, { sourceCartId: CART, targetCartId: OTHER_CART }),
  ],
  [
    'apply a discount code',
    () => discountService.redeemCode(ctx, { cartId: CART, code: 'SAVE10' }),
  ],
  [
    'remove a discount code',
    () => discountService.removeCode(ctx, { cartId: CART, code: 'SAVE10' }),
  ],
  [
    'apply a gift card',
    () => discountService.applyGiftCardToCart(ctx, { cartId: CART, code: 'GIFT-1234-5678' }),
  ],
  ['remove a gift card', () => discountService.removeGiftCardFromCart(ctx, { cartId: CART })],
  [
    'spend account credit on it',
    () =>
      discountService.spendAccountCredit(ctx, {
        customerId: CUSTOMER,
        cartId: CART,
        amountCents: 1_000,
      }),
  ],
  [
    'check it out again',
    () => checkoutService.start(ctx, { cartId: CART, channel: 'storefront', currency: 'USD' }),
  ],
];

beforeEach(() => {
  bought = new Set([CART]);
  writes = [];
});

describe('a basket already bought', () => {
  it.each(WRITES)('refuses to %s, and writes nothing', async (_name, write) => {
    const refused = await write().then(
      () => null,
      (err: unknown) => err
    );
    expect(refused).toBeInstanceOf(CommerceCartBoughtError);
    expect((refused as InstanceType<typeof CommerceCartBoughtError>).code).toBe(
      'CART_ALREADY_BOUGHT'
    );
    expect(writes).toEqual([]);
  });

  it('is not marked as walked away from', async () => {
    await cartService.markAbandoned(ctx, CART);
    const asked = tx.cart.findFirst.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> };
    expect(asked.where).toMatchObject(cartService.NOT_BOUGHT_YET);
  });

  it('is never handed back when the buyer signs in again', async () => {
    tx.cart.findFirst.mockClear();
    // Neither lookup finds a basket still being shopped.
    tx.cart.findFirst.mockResolvedValueOnce(null as never).mockResolvedValueOnce(null as never);
    await cartService.reconcileCartOnAuth(ctx, {
      guestToken: 'token',
      customerId: CUSTOMER,
      channel: 'storefront',
    });
    // Both lookups, the guest basket and the buyer's newest basket, ask for one
    // not bought yet. Renée's newest was the one she had just bought.
    const lookups = tx.cart.findFirst.mock.calls
      .map((call) => call[0].where as Record<string, unknown>)
      .filter((where) => 'channel' in where);
    expect(lookups).toHaveLength(2);
    for (const where of lookups) expect(where).toMatchObject(cartService.NOT_BOUGHT_YET);
  });
});

describe('a basket not bought yet', () => {
  it.each(WRITES)('gets past the gate to %s', async (_name, write) => {
    bought = new Set();
    // Past the gate, each write meets whatever the fake cannot answer; all that
    // matters here is that the refusal is not the bought-basket one.
    const outcome = await write().then(
      () => null,
      (err: unknown) => err
    );
    expect(outcome).not.toBeInstanceOf(CommerceCartBoughtError);
  });
});
