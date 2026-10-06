import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PUTTING PRODUCTS IN A CATEGORY NEVER TAKES THEM OUT OF ANOTHER (issue 065).
 *
 * Gillett Diesel puts all 126 "Fuel System" parts in a new Fuel System category.
 * Some are already in "Goods", the template's category. They stay there. Doing
 * it twice changes nothing, and taking a part out of its MAIN category hands
 * that role to the next category it is in.
 */

const FUEL = 'c0000000-0000-4000-8000-000000000001';
const GOODS = 'c0000000-0000-4000-8000-000000000002';
const TURBO = 'c0000000-0000-4000-8000-000000000003';
const P1 = '10000000-0000-4000-8000-000000000001';
const P2 = '10000000-0000-4000-8000-000000000002';
const P3 = '10000000-0000-4000-8000-000000000003';
const CTX = { tenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0' };

interface Link {
  productId: string;
  categoryId: string;
  isPrimary: boolean;
  position: number;
}

let links: Link[];

const tx = {
  productCategory: {
    findFirst: vi.fn((args: { where: { id: string } }) =>
      Promise.resolve(args.where.id === TURBO ? null : { name: 'Fuel System' })
    ),
  },
  product: {
    findMany: vi.fn((args: { where: { id?: { in: string[] } } }) =>
      Promise.resolve((args.where.id?.in ?? [P1, P2, P3]).map((id) => ({ id })))
    ),
  },
  categoryProduct: {
    findMany: vi.fn((args: { where: { productId: { in: string[] } } }) =>
      Promise.resolve(links.filter((link) => args.where.productId.in.includes(link.productId)))
    ),
    createMany: vi.fn((args: { data: Link[] }) => {
      links.push(...args.data);
      return Promise.resolve({ count: args.data.length });
    }),
    deleteMany: vi.fn((args: { where: { categoryId: string; productId: { in: string[] } } }) => {
      links = links.filter(
        (link) =>
          !(
            link.categoryId === args.where.categoryId &&
            args.where.productId.in.includes(link.productId)
          )
      );
      return Promise.resolve({ count: 0 });
    }),
    update: vi.fn(
      (args: { where: { categoryId_productId: { categoryId: string; productId: string } } }) => {
        const key = args.where.categoryId_productId;
        const link = links.find(
          (l) => l.categoryId === key.categoryId && l.productId === key.productId
        );
        if (link) link.isPrimary = true;
        return Promise.resolve(link);
      }
    ),
  },
  auditLog: { createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../events', () => ({ publishCommerceEvent: vi.fn(() => Promise.resolve()) }));

const { addProductsToCategory, removeProductsFromCategory, planCategoryAdds } =
  await import('./category-membership');

const inCategory = (categoryId: string) =>
  links.filter((link) => link.categoryId === categoryId).map((link) => link.productId);

beforeEach(() => {
  links = [
    { productId: P1, categoryId: GOODS, isPrimary: true, position: 0 },
    { productId: P2, categoryId: FUEL, isPrimary: false, position: 1 },
    { productId: P2, categoryId: GOODS, isPrimary: true, position: 0 },
  ];
});

describe('planCategoryAdds', () => {
  it('makes it the main category only for a product that had none', () => {
    const plan = planCategoryAdds(links, [P1, P3], FUEL);
    expect(plan).toEqual([
      { productId: P1, categoryId: FUEL, isPrimary: false, position: 1 },
      { productId: P3, categoryId: FUEL, isPrimary: true, position: 0 },
    ]);
  });
});

describe('addProductsToCategory', () => {
  it('adds every chosen product and keeps the categories they were already in', async () => {
    const result = await addProductsToCategory(CTX, {
      categoryId: FUEL,
      selection: { productIds: [P1, P2, P3] },
    });
    expect(inCategory(FUEL).sort()).toEqual([P1, P2, P3]);
    expect(inCategory(GOODS).sort()).toEqual([P1, P2]);
    expect(result).toEqual({ changed: 2, unchanged: 1, skipped: 0, categoryName: 'Fuel System' });
  });

  it('changes nothing the second time', async () => {
    const input = { categoryId: FUEL, selection: { productIds: [P1, P2, P3] } };
    await addProductsToCategory(CTX, input);
    const before = links.length;
    const again = await addProductsToCategory(CTX, input);
    expect(links).toHaveLength(before);
    expect(again).toMatchObject({ changed: 0, unchanged: 3 });
  });

  it('says plainly when the category has gone', async () => {
    await expect(
      addProductsToCategory(CTX, { categoryId: TURBO, selection: { productIds: [P1] } })
    ).rejects.toThrow();
  });
});

describe('removeProductsFromCategory', () => {
  it('takes them out of this category only, and hands on the main role', async () => {
    const result = await removeProductsFromCategory(CTX, {
      categoryId: GOODS,
      selection: { productIds: [P1, P2, P3] },
    });
    expect(inCategory(GOODS)).toEqual([]);
    expect(links).toEqual([{ productId: P2, categoryId: FUEL, isPrimary: true, position: 1 }]);
    expect(result).toMatchObject({ changed: 2, unchanged: 1 });
  });
});
