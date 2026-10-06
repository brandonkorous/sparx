import { describe, expect, it, vi } from 'vitest';

import {
  productListWhere,
  resolveSelection,
  searchWhere,
  selectionWhere,
} from './product-selection';

/**
 * "ALL 126 MATCHING" HAS TO BE THE 126 THE LIST SHOWED (issue 065).
 *
 * The bulk writes resolve a selection with the same `where` the Products list
 * reads with. If the two drifted, the count on screen would stop being the count
 * that acts, which is the one number an owner checks before pressing the button.
 */

const SITE = 'e0000000-0000-4000-8000-000000000001';
const P1 = '10000000-0000-4000-8000-000000000001';

describe('selectionWhere', () => {
  it('narrows a match exactly as the list does, and never reaches deleted products', () => {
    const match = { q: 'fuel', productType: 'Fuel System', propertyId: SITE };
    expect(selectionWhere({ match })).toEqual(
      productListWhere({ ...match, includeDeleted: false })
    );
    expect(selectionWhere({ match })).toMatchObject({
      deletedAt: null,
      productType: 'Fuel System',
      status: { not: 'archived' },
    });
  });

  it('acts on named ids only while they are live', () => {
    expect(selectionWhere({ productIds: [P1] })).toEqual({ id: { in: [P1] }, deletedAt: null });
  });
});

describe('resolveSelection', () => {
  const txWith = (count: number) =>
    ({
      product: {
        findMany: vi.fn(() =>
          Promise.resolve(Array.from({ length: count }, (_, i) => ({ id: `id-${String(i)}` })))
        ),
      },
    }) as never;

  it('refuses a match bigger than the limit rather than acting on part of it', async () => {
    await expect(resolveSelection(txWith(4), { match: { q: 'fuel' } }, 3)).rejects.toThrow(
      'more than 3 products'
    );
  });

  it('counts named ids that are gone as asked about but not resolved', async () => {
    const result = await resolveSelection(txWith(1), { productIds: [P1, P1.replace('1', '2')] });
    expect(result).toEqual({ ids: ['id-0'], requested: 2 });
  });
});

describe('searchWhere', () => {
  /** The places one word is looked for, by the field each clause reads. */
  const fieldsFor = (where: ReturnType<typeof searchWhere>, index: number): string[] =>
    ((where.AND as { OR: Record<string, unknown>[] }[])[index]?.OR ?? []).map(
      (clause) => Object.keys(clause)[0] ?? ''
    );

  it('finds a part by an engine it is set to fit, not only by its title', () => {
    expect(fieldsFor(searchWhere('L5P'), 0)).toContain('fitments');
  });

  it('finds a part by its code', () => {
    expect(fieldsFor(searchWhere('0986435621'), 0)).toContain('variants');
  });

  it('needs every word, in any order and in any place', () => {
    const where = searchWhere('  6.7L   Cummins ');
    expect(where.AND).toHaveLength(2);
    expect(JSON.stringify(where)).toContain('"6.7L"');
    expect(JSON.stringify(where)).toContain('"Cummins"');
  });

  it('still searches on a list scoped to one site', () => {
    // The site filter is an `AND` list too. Spread after the search, it replaced
    // it, and "L5P" on Gillett's site listed all 653 products.
    const json = JSON.stringify(productListWhere({ q: 'L5P', propertyId: SITE }));
    expect(json).toContain('"L5P"');
    expect(json).toContain(SITE);
  });

  it('adds nothing for an empty search', () => {
    expect(searchWhere('   ')).toEqual({});
    expect(searchWhere(undefined)).toEqual({});
  });
});
