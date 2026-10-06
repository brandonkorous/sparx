import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Staff set a business's buying rules on a version: a minimum, a maximum and a
 * case pack (sparx persona issue 086). The /b2b page promised these "per
 * product per account"; the columns for two of them existed and nothing could
 * write them, and the case pack did not exist at all.
 */

interface Row {
  id: string;
  accountId: string;
  variantId: string | null;
  collectionId: string | null;
  priceCents: number | null;
  discountPercentage: number | null;
  minOrderQty: number | null;
  maxOrderQty: number | null;
  orderMultiple: number | null;
}

let rows: Row[] = [];
const created: Record<string, unknown>[] = [];
const updated: Record<string, unknown>[] = [];

const tx = {
  company: { findFirst: vi.fn(() => Promise.resolve({ id: 'wasatch' })) },
  b2bAccountProductOverride: {
    findFirst: vi.fn(({ where }: { where: Partial<Row> }) =>
      Promise.resolve(
        rows.find(
          (r) =>
            (where.id === undefined || r.id === where.id) &&
            (where.variantId === undefined || r.variantId === where.variantId) &&
            r.accountId === where.accountId
        ) ?? null
      )
    ),
    create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
      created.push(data);
      return Promise.resolve(data);
    }),
    update: vi.fn(({ data }: { data: Record<string, unknown> }) => {
      updated.push(data);
      return Promise.resolve(data);
    }),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { addAccountOverride, overrideSettingProblem, updateAccountOverride } =
  await import('./accounts');

const ctx = { tenantId: 'tenant-1', userId: 'staff-1' } as never;
const FILTER = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  rows = [];
  created.length = 0;
  updated.length = 0;
});

const shape = (over: Partial<Row>) => ({
  variantId: FILTER,
  collectionId: null,
  priceCents: null,
  discountPercentage: null,
  minOrderQty: null,
  maxOrderQty: null,
  orderMultiple: null,
  ...over,
});

describe('overrideSettingProblem', () => {
  it('accepts a case pack on its own, with no price of its own', () => {
    expect(overrideSettingProblem(shape({ orderMultiple: 12 }))).toBeNull();
  });

  it('refuses a minimum that is not a whole number of cases, and offers the nearest', () => {
    expect(overrideSettingProblem(shape({ minOrderQty: 30, orderMultiple: 12 }))).toBe(
      'A minimum of 30 cannot be bought in cases of 12. Use 24 or 36.'
    );
    expect(overrideSettingProblem(shape({ maxOrderQty: 100, orderMultiple: 12 }))).toBe(
      'A maximum of 100 cannot be bought in cases of 12. Use 96 or 108.'
    );
  });

  it('refuses a minimum above the maximum', () => {
    expect(overrideSettingProblem(shape({ minOrderQty: 48, maxOrderQty: 24 }))).toMatch(
      /The minimum \(48\) is more than the maximum \(24\)/
    );
  });

  it('refuses a row that would change nothing', () => {
    expect(overrideSettingProblem(shape({}))).toMatch(/would change nothing/);
  });
});

describe('addAccountOverride', () => {
  it('saves a case pack, a minimum and a maximum without a price', async () => {
    await addAccountOverride(ctx, 'wasatch', {
      variantId: FILTER,
      minOrderQty: 24,
      maxOrderQty: 96,
      orderMultiple: 12,
    });
    expect(created[0]).toMatchObject({ minOrderQty: 24, maxOrderQty: 96, orderMultiple: 12 });
  });

  it('refuses rules staff could never see met, in their words', async () => {
    await expect(
      addAccountOverride(ctx, 'wasatch', { variantId: FILTER, minOrderQty: 30, orderMultiple: 12 })
    ).rejects.toThrow('A minimum of 30 cannot be bought in cases of 12. Use 24 or 36.');
    expect(created).toHaveLength(0);
  });

  it('refuses a second row for the same business and version', async () => {
    rows = [{ id: 'o-1', accountId: 'wasatch', ...shape({ priceCents: 900 }) }];
    await expect(
      addAccountOverride(ctx, 'wasatch', { variantId: FILTER, orderMultiple: 12 })
    ).rejects.toThrow(/already has a price or buying rule for this version/);
  });
});

describe('updateAccountOverride', () => {
  it('holds a new case pack to the minimum already saved', async () => {
    rows = [{ id: 'o-1', accountId: 'wasatch', ...shape({ priceCents: 900, minOrderQty: 30 }) }];
    await expect(
      updateAccountOverride(ctx, 'wasatch', 'o-1', { orderMultiple: 12 })
    ).rejects.toThrow('A minimum of 30 cannot be bought in cases of 12. Use 24 or 36.');
  });

  it('clears a rule with null', async () => {
    rows = [{ id: 'o-1', accountId: 'wasatch', ...shape({ priceCents: 900, orderMultiple: 12 }) }];
    await updateAccountOverride(ctx, 'wasatch', 'o-1', { orderMultiple: null });
    expect(updated[0]).toMatchObject({ orderMultiple: null });
  });
});
