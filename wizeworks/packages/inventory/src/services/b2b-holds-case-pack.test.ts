import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A fleet hold keeps to the same buying rules as the cart (sparx persona issue
 * 086). Holds read the account's minimum and maximum and ignored its case pack,
 * so stock could be held for 5 of a filter the account buys only in cases of
 * 12, and the refusal it did give was worded differently from the cart's.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const FILTER = '33333333-3333-4333-8333-333333333333';

let rule: { minOrderQty: number | null; maxOrderQty: number | null; orderMultiple: number | null };
const holdsCreated: unknown[] = [];

const tx = {
  company: {
    findFirst: vi.fn(() => Promise.resolve({ id: ACCOUNT, companyName: 'Wasatch Fleet Services' })),
  },
  productVariant: {
    findFirst: vi.fn(() =>
      Promise.resolve({ id: FILTER, title: null, product: { title: 'FPPF 90343' } })
    ),
    findMany: vi.fn(() =>
      Promise.resolve([{ id: FILTER, sku: 'FPPF-90343', product: { title: 'FPPF 90343' } }])
    ),
  },
  b2bAccountProductOverride: {
    findFirst: vi.fn(() => Promise.resolve(rule)),
    findMany: vi.fn(() => Promise.resolve([{ variantId: FILTER, ...rule }])),
  },
  inventoryLevel: { findMany: vi.fn(() => Promise.resolve([])) },
  b2bFleetHold: {
    groupBy: vi.fn(() => Promise.resolve([])),
    create: vi.fn((args: unknown) => {
      holdsCreated.push(args);
      return Promise.reject(new Error('the hold was written'));
    }),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('./reservations', () => ({
  pickWarehouseFor: () => Promise.resolve('warehouse-1'),
  reserveOnTx: () => Promise.resolve(null),
  releaseOnTx: () => Promise.resolve(),
}));

const { accountAvailability, createFleetHold } = await import('./b2b-holds');
const ctx = { tenantId: '55555555-5555-4555-8555-555555555555' };

beforeEach(() => {
  rule = { minOrderQty: null, maxOrderQty: null, orderMultiple: 12 };
  holdsCreated.length = 0;
});

const hold = (quantity: number) =>
  createFleetHold(ctx, { accountId: ACCOUNT, variantId: FILTER, quantity, workOrderRef: 'WO-1' });

describe('fleet holds keep to the case pack', () => {
  it('refuses 5 of a case-of-12 item in the same words as the cart', async () => {
    await expect(hold(5)).rejects.toThrow(
      'Wasatch Fleet Services buys FPPF 90343 in cases of 12. Choose 12, 24 or 36.'
    );
    expect(holdsCreated).toHaveLength(0);
  });

  it('refuses below the minimum in the same words as the cart', async () => {
    rule = { minOrderQty: 24, maxOrderQty: null, orderMultiple: 12 };
    await expect(hold(12)).rejects.toThrow(
      'Wasatch Fleet Services buys at least 24 of FPPF 90343 at a time, in cases of 12. Choose 24, 36 or 48.'
    );
  });

  it('lets a whole case through to the hold', async () => {
    await expect(hold(24)).rejects.toThrow('the hold was written');
  });

  it('says the case pack in account availability', async () => {
    const [row] = await accountAvailability(ctx, { accountId: ACCOUNT, variantIds: [FILTER] });
    expect(row).toMatchObject({ orderMultiple: 12, minOrderQty: null, maxOrderQty: null });
  });
});
