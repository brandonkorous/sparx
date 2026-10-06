import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ADDING WHAT PARTS FIT NEVER TAKES ANYTHING AWAY (sparx persona issue 065).
 *
 * Gillett Diesel files 34 injectors under the 6.6L L5P Duramax. Most of them
 * already fit the LML too, and some already fit the L5P for 2017-2019. The bulk
 * add must leave the LML alone, must not write the 2017-2019 L5P twice, and must
 * still add a 2020-2023 L5P because that is a different rule.
 */

const DOMAIN = 'd0000000-0000-4000-8000-000000000001';
const GM = 'a0000000-0000-4000-8000-000000000001';
const SILVERADO = 'a0000000-0000-4000-8000-000000000002';
const L5P = 'a0000000-0000-4000-8000-000000000005';
const LML = 'a0000000-0000-4000-8000-000000000004';
/** Each entry's path, root first and itself last, as the table stores it. */
const PATHS: Record<string, string[]> = {
  [L5P]: [GM, SILVERADO, L5P],
  [LML]: [GM, SILVERADO, LML],
};
const P1 = '10000000-0000-4000-8000-000000000001';
const P2 = '10000000-0000-4000-8000-000000000002';
const P3 = '10000000-0000-4000-8000-000000000003';
const CTX = { tenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0' };

interface Rule {
  id: string;
  productId: string;
  domainId: string;
  nodeId: string | null;
  ranges: { dimensionKey: string; min: number | null; max: number | null }[];
}

/** Both shapes a target can take: an entry and everything under it (by path), or
 *  exactly one entry, so the test can tell the two apart. */
type Target = { node: { path: { has: string } } } | { nodeId: { in: string[] } };
const hits = (target: Target, rule: Rule) =>
  'node' in target
    ? (PATHS[rule.nodeId ?? ''] ?? []).includes(target.node.path.has)
    : target.nodeId.in.includes(rule.nodeId ?? '');

let rules: Rule[];
/** The service asks for one list (remove) or several (add). */
const inDomain = (domainId: string | { in: string[] } | undefined, rule: Rule) =>
  domainId === undefined ||
  (typeof domainId === 'string' ? domainId === rule.domainId : domainId.in.includes(rule.domainId));
interface RangeRow {
  fitmentId: string;
  dimensionKey: string;
  min: number | null;
  max: number | null;
}
const deleteMany = vi.fn();

const tx = {
  fitmentDomain: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        displayName: 'Vehicles',
        dimensions: [
          { key: 'make', label: 'Make', kind: 'level' },
          { key: 'year', label: 'Year', kind: 'range' },
        ],
      })
    ),
  },
  fitmentNode: {
    count: vi.fn((args: { where: { id: { in: string[] } } }) =>
      Promise.resolve(
        args.where.id.in.filter((id) => [GM, SILVERADO, L5P, LML].includes(id)).length
      )
    ),
  },
  product: {
    findMany: vi.fn((args: { where: { id?: { in: string[] } } }) =>
      Promise.resolve((args.where.id?.in ?? [P1, P2, P3]).map((id) => ({ id })))
    ),
  },
  productFitment: {
    findMany: vi.fn(
      (args: {
        where: { productId: { in: string[] }; domainId?: string | { in: string[] }; OR?: Target[] };
      }) =>
        Promise.resolve(
          rules.filter(
            (rule) =>
              args.where.productId.in.includes(rule.productId) &&
              inDomain(args.where.domainId, rule) &&
              (!args.where.OR || args.where.OR.some((target) => hits(target, rule)))
          )
        )
    ),
    createMany: vi.fn((args: { data: Omit<Rule, 'ranges'>[] }) => {
      for (const row of args.data) rules.push({ ...row, nodeId: row.nodeId, ranges: [] });
      return Promise.resolve({ count: args.data.length });
    }),
    deleteMany: deleteMany.mockImplementation((args: { where: { id: { in: string[] } } }) => {
      rules = rules.filter((rule) => !args.where.id.in.includes(rule.id));
      return Promise.resolve({ count: 0 });
    }),
  },
  productFitmentRange: {
    createMany: vi.fn((args: { data: RangeRow[] }) => {
      for (const range of args.data) {
        rules.find((rule) => rule.id === range.fitmentId)?.ranges.push(range);
      }
      return Promise.resolve({ count: args.data.length });
    }),
  },
  auditLog: { createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../events', () => ({ publishCommerceEvent: vi.fn(() => Promise.resolve()) }));

const { addToProducts, removeFromProducts, planFitmentAdds, ruleKey } =
  await import('./fitment-bulk');

const years = (min: number, max: number) => [{ dimensionKey: 'year', min, max }];

beforeEach(() => {
  deleteMany.mockClear();
  rules = [
    { id: 'r1', productId: P1, domainId: DOMAIN, nodeId: LML, ranges: [] },
    {
      id: 'r2',
      productId: P2,
      domainId: DOMAIN,
      nodeId: L5P,
      ranges: [{ dimensionKey: 'year', min: 2017, max: 2019 }],
    },
  ];
});

describe('ruleKey', () => {
  it('is the same rule whatever order the windows were typed in', () => {
    const a = ruleKey({
      domainId: DOMAIN,
      nodeId: L5P,
      ranges: [
        { dimensionKey: 'year', min: 2017, max: 2019 },
        { dimensionKey: 'weight', max: 10 },
      ],
    });
    const b = ruleKey({
      domainId: DOMAIN,
      nodeId: L5P,
      ranges: [
        { dimensionKey: 'weight', min: null, max: 10 },
        { dimensionKey: 'year', min: 2017, max: 2019 },
      ],
    });
    expect(a).toBe(b);
  });

  it('tells different years apart', () => {
    expect(ruleKey({ domainId: DOMAIN, nodeId: L5P, ranges: years(2017, 2019) })).not.toBe(
      ruleKey({ domainId: DOMAIN, nodeId: L5P, ranges: years(2020, 2023) })
    );
  });
});

describe('planFitmentAdds', () => {
  it('skips what a product already has and collapses a rule given twice', () => {
    const plan = planFitmentAdds(
      [{ productId: P2, domainId: DOMAIN, nodeId: L5P, ranges: years(2017, 2019) }],
      [P1, P2],
      [
        { domainId: DOMAIN, nodeId: L5P, ranges: years(2017, 2019) },
        { domainId: DOMAIN, nodeId: L5P, ranges: years(2017, 2019) },
      ]
    );
    expect(plan.map((entry) => entry.productId)).toEqual([P1]);
  });
});

describe('addToProducts', () => {
  it('adds without deleting anything a product already fits', async () => {
    const result = await addToProducts(CTX, {
      selection: { productIds: [P1, P2, P3] },
      fitments: [{ domainId: DOMAIN, nodeId: L5P, ranges: years(2017, 2019) }],
    });

    expect(deleteMany).not.toHaveBeenCalled();
    // P1 keeps its LML and gains the L5P; P2 already had it; P3 gains it.
    expect(rules.filter((rule) => rule.productId === P1).map((rule) => rule.nodeId)).toEqual([
      LML,
      L5P,
    ]);
    expect(rules.filter((rule) => rule.productId === P2)).toHaveLength(1);
    expect(result).toEqual({ rules: 2, productsChanged: 2, productsUnchanged: 1, skipped: 0 });
    expect(rules.find((rule) => rule.productId === P3)?.ranges).toEqual([
      expect.objectContaining({ dimensionKey: 'year', min: 2017, max: 2019 }),
    ]);
  });

  it('writes nothing the second time the same thing is added', async () => {
    const input = {
      selection: { productIds: [P1, P2, P3] },
      fitments: [{ domainId: DOMAIN, nodeId: L5P, ranges: years(2017, 2019) }],
    };
    await addToProducts(CTX, input);
    const again = await addToProducts(CTX, input);
    expect(again).toMatchObject({ rules: 0, productsChanged: 0, productsUnchanged: 3 });
  });

  it('adds a different year window for the same engine as its own rule', async () => {
    await addToProducts(CTX, {
      selection: { productIds: [P2] },
      fitments: [{ domainId: DOMAIN, nodeId: L5P, ranges: years(2020, 2023) }],
    });
    expect(rules.filter((rule) => rule.productId === P2)).toHaveLength(2);
  });

  it('refuses a window on an axis the list does not have', async () => {
    await expect(
      addToProducts(CTX, {
        selection: { productIds: [P1] },
        fitments: [{ domainId: DOMAIN, nodeId: L5P, ranges: [{ dimensionKey: 'weight', max: 9 }] }],
      })
    ).rejects.toThrow('has no weight to narrow by');
  });
});

describe('removeFromProducts', () => {
  it('takes off only the chosen entry, whatever its years, and keeps the rest', async () => {
    const result = await removeFromProducts(CTX, {
      selection: { productIds: [P1, P2] },
      domainId: DOMAIN,
      nodeIds: [L5P],
    });
    expect(rules.map((rule) => rule.id)).toEqual(['r1']);
    expect(result).toEqual({ rules: 1, productsChanged: 1, productsUnchanged: 1, skipped: 0 });
  });

  it('takes off everything under a make, and keeps rules in other lists', async () => {
    rules.push({ id: 'r3', productId: P1, domainId: 'other-list', nodeId: L5P, ranges: [] });
    const result = await removeFromProducts(CTX, {
      selection: { productIds: [P1, P2] },
      domainId: DOMAIN,
      nodeIds: [GM],
    });
    expect(rules.map((rule) => rule.id)).toEqual(['r3']);
    expect(result).toMatchObject({ rules: 2, productsChanged: 2 });
  });

  it('takes off everything in the list when the whole list is chosen', async () => {
    const result = await removeFromProducts(CTX, {
      selection: { productIds: [P1, P2] },
      domainId: DOMAIN,
      nodeIds: [null],
    });
    expect(rules).toEqual([]);
    expect(result).toMatchObject({ rules: 2, productsChanged: 2 });
  });
});
